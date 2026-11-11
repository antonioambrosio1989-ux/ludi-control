/**
 * 10O: reconciles newly imported fixture IDs against an ACTIVE second-leg
 * withdrawal ledger. Emulator-only. No match/report changes, no awarded scores.
 * This service is intentionally NOT wired to the production import UI.
 */
import { type Firestore } from 'firebase-admin/firestore';
import { planFutureWalkoverRegistrations, type ImportedScheduledFixture,
  type WalkoverFutureRegistration } from './WithdrawalPostImportAndTopPlayer';

export type RegisterImportedFixturesRequest = {
  seasonId: string;
  withdrawnTeamId: string;
  matchIds: string[];
  adminUid: string;
};
export type RegisterImportedFixturesResult = {
  added: number;
  unchanged: number;
  unrelated: number;
  pendingAwardCount: 0;
};

const validId = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v);

function demoOnly(): void {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
  if (!/^(?:localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host) || !project.startsWith('demo-')) {
    throw new Error('Solo Firestore Emulator su progetto demo-.');
  }
}

type LedgerEntry = WalkoverFutureRegistration & {reportIds?: string[]};
const allowedEntry = (e: unknown): e is LedgerEntry => {
  if (!e || typeof e !== 'object') return false;
  const obj = e as Record<string, unknown>;
  return validId(obj.matchId) && Number.isSafeInteger(obj.matchweek) && Number(obj.matchweek) >= 1 &&
    validId(obj.opponentTeamId) && obj.effect === 'walkover_pending_official_closure' &&
    (obj.reportIds === undefined || (Array.isArray(obj.reportIds) && obj.reportIds.every(validId)));
};

export async function registerPostImportWalkoversInEmulator(
  db: Firestore,
  req: RegisterImportedFixturesRequest,
): Promise<RegisterImportedFixturesResult> {
  demoOnly();
  if (![req.seasonId, req.withdrawnTeamId, req.adminUid].every(validId) ||
      !Array.isArray(req.matchIds) || req.matchIds.length === 0 || req.matchIds.length > 150 ||
      req.matchIds.some(x => !validId(x)) || new Set(req.matchIds).size !== req.matchIds.length) {
    throw new Error('Richiesta importazione non valida.');
  }
  const seasonRef = db.collection('seasons').doc(req.seasonId);
  const regRef = seasonRef.collection('withdrawalRegistrations').doc(req.withdrawnTeamId);
  const ledgerRef = seasonRef.collection('withdrawalEffectLedgers').doc(req.withdrawnTeamId);
  const matchRefs = req.matchIds.map(id => db.collection('matches').doc(id));
  return db.runTransaction(async tx => {
    const [seasonSnap, regSnap, ledgerSnap, ...matchSnaps] = await Promise.all([
      tx.get(seasonRef), tx.get(regRef), tx.get(ledgerRef), ...matchRefs.map(ref => tx.get(ref)),
    ]);
    if (!seasonSnap.exists || seasonSnap.data()?.status !== 'active') throw new Error('Stagione inattiva.');
    const reg = regSnap.data(); const ledger = ledgerSnap.data();
    if (!regSnap.exists || reg?.state !== 'active' || reg.effectsApplied !== true ||
        !validId(reg.activationCommitId) || !ledgerSnap.exists || ledger?.state !== 'applied' ||
        ledger.effectsApplied !== true || ledger.policy !== 'retain_and_walkover' ||
        ledger.activationCommitId !== reg.activationCommitId || !validId(ledger.operationId) ||
        !Number.isSafeInteger(ledger.effectiveMatchweek) || ledger.effectiveMatchweek < 1) {
      throw new Error('Ritiro del ritorno non attivo o registro incompatibile.');
    }
    if (!Array.isArray(ledger.entries) || !ledger.entries.every(allowedEntry)) {
      throw new Error('Registro effetti non verificabile.');
    }
    const entries = ledger.entries as LedgerEntry[];
    if (new Set(entries.map(e => e.matchId)).size !== entries.length) {
      throw new Error('Registro effetti con duplicati.');
    }
    const fixtures: ImportedScheduledFixture[] = matchSnaps.map(snap => {
      if (!snap.exists) throw new Error('Gara importata mancante.');
      const m = snap.data() ?? {};
      if (m.seasonId !== req.seasonId || !Number.isSafeInteger(m.matchweek) ||
          !validId(String(m.homeTeamId ?? '')) || !validId(String(m.awayTeamId ?? '')) ||
          typeof m.status !== 'string') throw new Error('Dati gara importata non validi.');
      return {id: snap.id, seasonId: m.seasonId, matchweek: m.matchweek,
        homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
        status: m.status, matchType: m.matchType};
    });
    const plan = planFutureWalkoverRegistrations({
      seasonId: req.seasonId, withdrawnTeamId: req.withdrawnTeamId,
      effectiveMatchweek: ledger.effectiveMatchweek,
      fixtures, registeredEntries: entries.map((item) => {
        // Il ledger conserva reportIds: [] come metadato operativo.
        // La pianificazione confronta soltanto i quattro campi canonici.
        // Vietare metadati sconosciuti e report associati a una candidatura pending.
        const keys = Object.keys(item);
        if (keys.some(key => !['matchId', 'matchweek', 'opponentTeamId', 'effect', 'reportIds'].includes(key)) ||
            (item.reportIds !== undefined && item.reportIds.length !== 0)) {
          throw new Error('Registro futuro non canonico o con report associati.');
        }
        return { matchId: item.matchId, matchweek: item.matchweek,
          opponentTeamId: item.opponentTeamId, effect: item.effect };
      }),
    });
    // A mature/closed week cannot acquire newly introduced withdrawal effects.
    const weeks = [...new Set(plan.newEntries.map(e => e.matchweek))];
    for (const w of weeks) {
      const closure = await tx.get(seasonRef.collection('officialMatchweekClosures').doc(String(w)));
      if (closure.exists && closure.data()?.state === 'officially_closed') {
        throw new Error('Giornata già chiusa: vietato aggiungere tavolini retroattivi.');
      }
    }
    if (plan.newEntries.length) {
      tx.update(ledgerRef, {entries: [...entries, ...plan.newEntries.map(e => ({...e, reportIds: []}))]});
    }
    return {added: plan.newEntries.length, unchanged: plan.alreadyRegisteredMatchIds.length,
      unrelated: plan.unrelatedMatchIds.length, pendingAwardCount: 0};
  });
}
