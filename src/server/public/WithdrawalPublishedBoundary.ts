/**
 * Fase 9F: confine di lettura ufficiale per il backend pubblico di Ludi Control.
 * Nessuna scrittura. Le bozze non alterano i dati; i ritiri non completati bloccano.
 * Le vittorie a tavolino restano vietate fino alla persistenza della maturazione.
 */
import 'server-only';
import { adminDb } from '../../lib/firebaseAdmin';
import type { Match } from '../../types/Match';
import type { CloudMatchReport } from '../../services/match/FirebaseMatchReportRepository';
import {
  selectOfficialWithdrawalInputs,
  type VerifiedWithdrawalRegistration,
} from '../../services/withdrawal/WithdrawalOfficialReadFilter';
import { verifyWithdrawalPublishedSnapshot } from '../../services/withdrawal/WithdrawalPublishedBoundaryRules';
import { projectMaturedWalkovers, type WalkoverLedger, type WalkoverAward, type WalkoverClosure } from '../../services/withdrawal/WithdrawalMaturedWalkoverReadModel';

export async function getWithdrawalPublishedInputs(input: {
  seasonId: string;
  matches: Match[];
  reports: CloudMatchReport[];
}): Promise<{ matches: Match[]; reports: CloudMatchReport[] }> {
  const { seasonId, matches, reports } = input;
  if (!seasonId.trim()) throw new Error('Stagione mancante nel riepilogo pubblico.');
  const registrationsSnapshot = await adminDb.collection('seasons').doc(seasonId)
    .collection('withdrawalRegistrations').get();
  // L'intera subcollection viene letta sul server prima di dichiararla completa.
  const raw: Array<{
    id: string;
    seasonId?: unknown;
    teamId?: unknown;
    state?: unknown;
    effectsApplied?: unknown;
    policy?: unknown;
    activationCommitId?: unknown;
  }> = registrationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const verified = verifyWithdrawalPublishedSnapshot(seasonId, raw);
  if (!verified.some(item => item.state === 'active')) return { matches, reports };
  const filtered = selectOfficialWithdrawalInputs({
    seasonId, matches, reports, registrations: verified as VerifiedWithdrawalRegistration[],
    registrationSnapshotComplete: true,
  });
  if (filtered.warnings.length > 0) {
    throw new Error('Ritiro: input pubblici incompleti: ' + filtered.warnings.join('; '));
  }
  const secondLeg = raw.filter(item => item.state === 'active' && item.effectsApplied === true && item.policy === 'retain_and_walkover');
  if (secondLeg.length === 0) return { matches: filtered.matches, reports: filtered.reports };
  // Server-side full reads. An individual award does not grant points without the
  // matching active ledger, activation ID and officially closed matchweek.
  const season = adminDb.collection('seasons').doc(seasonId);
  const [ledgerSnapshot, awardSnapshot, closureSnapshot] = await Promise.all([
    season.collection('withdrawalEffectLedgers').get(),
    season.collection('withdrawalWalkoverAwards').get(),
    season.collection('officialMatchweekClosures').get(),
  ]);
  const ledgers = ledgerSnapshot.docs.map(doc => ({ ...doc.data(), teamId: doc.id })) as WalkoverLedger[];
  const awards = awardSnapshot.docs.map(doc => ({ ...doc.data(), matchId: doc.id })) as WalkoverAward[];
  const closures = closureSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as WalkoverClosure[];
  // Fail closed also when the registration is active but no award is yet due.
  for (const registration of secondLeg) {
    const matching = ledgers.filter(item => item.teamId === registration.teamId);
    if (matching.length !== 1 || matching[0].state !== 'applied' ||
        matching[0].effectsApplied !== true || matching[0].policy !== 'retain_and_walkover' ||
        matching[0].activationCommitId !== registration.activationCommitId ||
        !matching[0].operationId) {
      throw new Error('Ritiro al ritorno: registro effetti non verificato.');
    }
  }
  const publishedMatchIds = new Set(filtered.reports.map(item => String(item.matchId)));
  for (const award of awards) {
    if (publishedMatchIds.has(award.matchId)) {
      throw new Error('Ritiro al ritorno: tavolino con tabellino già pubblicato.');
    }
  }
  const projected = projectMaturedWalkovers({
    seasonId,
    matches: filtered.matches,
    registrations: raw.map(item => ({
      seasonId: String(item.seasonId), teamId: String(item.teamId),
      state: String(item.state), effectsApplied: item.effectsApplied === true,
      policy: String(item.policy ?? ''), activationCommitId: typeof item.activationCommitId === 'string' ? item.activationCommitId : undefined,
    })),
    ledgers, awards, closures, completeSnapshot: true,
  });
  return { matches: projected.matches as Match[], reports: filtered.reports };
}
