/**
 * Emulator-only immutable sporting snapshot for withdrawal review.
 * This transaction does NOT activate a withdrawal, mark effectsApplied,
 * cancel matches, edit reports, award points or reconcile suspensions.
 */
import { createHash } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  buildWithdrawalPreparation,
  comparePreparedWithdrawal,
  preparationFingerprint,
  validWithdrawalId,
} from './WithdrawalPersistenceContract';

export type SnapshotRequest = {
  seasonId: string;
  teamId: string;
  expectedMatchweek: number;
  adminUid: string;
};
export type WithdrawalSnapshotResult = {
  state: 'created' | 'unchanged';
  operationId: string;
  snapshotHash: string;
  affectedMatchIds: string[];
  affectedReportIds: string[];
  policy: 'void_all' | 'retain_and_walkover';
};
function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  // Firestore timestamps and field values are included rather than silently dropped.
  const record = v as Record<string, unknown>;
  return `{${Object.keys(record).sort().filter(k => record[k] !== undefined)
    .map(k => `${JSON.stringify(k)}:${canonical(record[k])}`).join(',')}}`;
}
function hash(v: unknown): string {
  return createHash('sha256').update(canonical(v)).digest('hex');
}
function id(v: unknown): string { return String(v ?? '').trim(); }
function isRS(data: Record<string, unknown>): boolean {
  return data.matchType === undefined || data.matchType === 'regularSeason';
}
/**
 * Transactional Firestore read of the complete current season match/report set.
 * It writes one immutable *review snapshot* only; no sporting document changes.
 * Only invoke from dedicated demo-project Emulator tests.
 */
export async function snapshotWithdrawalForReview(
  db: Firestore,
  input: SnapshotRequest,
): Promise<WithdrawalSnapshotResult> {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.match(/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/) ||
      !id(process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT).startsWith('demo-')) {
    throw new Error('Snapshot consentito esclusivamente con Firestore Emulator e progetto demo-.');
  }
  const { seasonId, teamId, expectedMatchweek, adminUid } = input;
  if (![seasonId, teamId, adminUid].every(validWithdrawalId) ||
      !Number.isSafeInteger(expectedMatchweek) || expectedMatchweek < 1) {
    throw new Error('Dati di richiesta non validi.');
  }
  const seasonRef = db.collection('seasons').doc(seasonId);
  const configRef = seasonRef.collection('withdrawalSettings').doc('official');
  const teamRef = seasonRef.collection('teamEntries').doc(teamId);
  const registrationRef = seasonRef.collection('withdrawalRegistrations').doc(teamId);
  const intentRef = seasonRef.collection('withdrawalActivationIntents').doc(teamId);
  const snapshotRef = seasonRef.collection('withdrawalReviewSnapshots').doc(teamId);
  const matchQuery = db.collection('matches').where('seasonId', '==', seasonId);
  const reportQuery = db.collection('matchReports').where('seasonId', '==', seasonId);

  return db.runTransaction(async tx => {
    // All reads precede the sole possible create write.
    const [season, config, team, registration, intent, existing, matches, reports] = await Promise.all([
      tx.get(seasonRef), tx.get(configRef), tx.get(teamRef), tx.get(registrationRef),
      tx.get(intentRef), tx.get(snapshotRef), tx.get(matchQuery), tx.get(reportQuery),
    ]);
    if (!season.exists || season.data()?.status !== 'active') throw new Error('Stagione non attiva.');
    if (!team.exists || team.data()?.status !== 'active') throw new Error('Squadra non attiva.');
    if (!config.exists || !registration.exists || !intent.exists) throw new Error('Bozza o preparazione assente.');
    const candidate = buildWithdrawalPreparation({
      seasonId, teamId, expectedMatchweek,
      config: config.data(), registration: registration.data(),
    });
    const operationId = createHash('sha256').update(preparationFingerprint(candidate)).digest('hex');
    comparePreparedWithdrawal(intent.data(), { ...candidate, operationId });

    // The audit captures *all* imported RS fixtures involving the withdrawn team.
    // It never assumes that a postponed or unpublished match was played.
    const affectedMatches = matches.docs.filter(doc => {
      const data = doc.data() as Record<string, unknown>;
      return isRS(data) && (id(data.homeTeamId) === teamId || id(data.awayTeamId) === teamId);
    }).map(doc => ({ id: doc.id, data: doc.data() }));
    const ids = new Set(affectedMatches.map(m => m.id));
    const affectedReports = reports.docs.filter(doc => ids.has(id(doc.data().matchId)))
      .map(doc => ({ id: doc.id, data: doc.data() }));
    affectedMatches.sort((a, b) => a.id.localeCompare(b.id));
    affectedReports.sort((a, b) => a.id.localeCompare(b.id));
    if (affectedMatches.length === 0) throw new Error('Nessuna gara importata per la squadra: revisione manuale obbligatoria.');
    const affectedMatchIds = affectedMatches.map(m => m.id);
    const affectedReportIds = affectedReports.map(r => r.id);
    const snapshotHash = hash({ operationId, affectedMatches, affectedReports });
    const result: WithdrawalSnapshotResult = {
      state: existing.exists ? 'unchanged' : 'created', operationId,
      snapshotHash, affectedMatchIds, affectedReportIds, policy: candidate.policy,
    };
    if (existing.exists) {
      const prev = existing.data();
      if (prev?.state !== 'review_only' || prev.operationId !== operationId ||
          prev.snapshotHash !== snapshotHash || prev.effectsApplied !== false) {
        throw new Error('Snapshot obsoleto o in conflitto: nessuna sovrascrittura consentita.');
      }
      return result;
    }
    tx.create(snapshotRef, {
      schemaVersion: 1, state: 'review_only', effectsApplied: false,
      seasonId, teamId, operationId, policy: candidate.policy,
      effectiveMatchweek: expectedMatchweek, snapshotHash,
      affectedMatchIds, affectedReportIds, createdBy: adminUid,
      createdAt: FieldValue.serverTimestamp(),
    });
    return result;
  });
}
