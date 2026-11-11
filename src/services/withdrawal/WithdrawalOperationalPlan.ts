/**
 * Piano operativo deterministico per ritiri. Collante tra 8A (importazioni)
 * e 8B (maturazione). NON applica modifiche a Firestore.
 * I record in bozza sono simulabili, ma non possono produrre effetti sportivi.
 */
import { calculateWithdrawalPolicy, type WithdrawalConfig } from './WithdrawalRegistryRules';
import { planWithdrawalFutureImports, type ImportedFixture, type FutureImportDecision } from './WithdrawalFutureImportPlanner';
import { evaluateWithdrawalMatchweekMaturity, type MaturityCheck } from './WithdrawalMatchweekMaturity';

export type RegisteredWithdrawal = {
  seasonId: string;
  teamId: string;
  effectiveMatchweek: number;
  state: 'draft_pending_activation' | 'active' | 'cancelled';
  effectsApplied: boolean;
};

export type OperationalPlanInput = {
  seasonId: string;
  config: WithdrawalConfig;
  registrations: readonly RegisteredWithdrawal[];
  /** Snapshot prima dell'import corrente. */
  existingFixtures: readonly ImportedFixture[];
  /** Nuova importazione, non ancora applicata al database. */
  incomingFixtures: readonly ImportedFixture[];
  /** Attestazioni ufficiali ottenute da fonte amministrativa affidabile. */
  officiallyClosedMatchweeks: readonly number[];
  /** Tavolini gia' registrati con ID partita deterministico. */
  recordedWalkoverMatchIds: readonly string[];
};

export type OperationalDecision = {
  matchId: string;
  matchweek: number;
  teamId: string;
  opponentTeamId: string;
  action: FutureImportDecision['action'];
  maturity: MaturityCheck['outcome'] | 'not_applicable';
  reason: string;
  /** Nessun calcolo in questa fase assegna punti. */
  assignedPoints: 0;
};

export type OperationalPlan = {
  seasonId: string;
  mode: 'preview_only';
  canActivate: false;
  canPublish: false;
  decisions: OperationalDecision[];
  blockingIssues: string[];
  reviewIssues: string[];
  summary: {
    imported: number;
    voidCandidates: number;
    walkoverCandidates: number;
    readyForReview: number;
    notDue: number;
    manualReviews: number;
  };
};

function uniqueSorted(values: Iterable<string>): string[] { return [...new Set(values)].sort((a,b) => a.localeCompare(b)); }
function fixtureKey(m: ImportedFixture): string { return JSON.stringify([m.seasonId, m.matchweek, String(m.homeTeamId), String(m.awayTeamId), m.matchType ?? 'regularSeason']); }

export function buildWithdrawalOperationalPlan(input: OperationalPlanInput): OperationalPlan {
  const seasonId = input.seasonId.trim();
  if (!seasonId) throw new Error('Stagione mancante.');
  const blocking: string[] = [];
  const review: string[] = [];
  const decisions: OperationalDecision[] = [];
  const entries = input.registrations.filter(r => r.state !== 'cancelled');
  const teamIds = new Set<string>();

  for (const r of input.registrations) {
    if (r.seasonId !== seasonId || !r.teamId.trim()) blocking.push('Registrazione con stagione o squadra non coerente.');
    if (r.state === 'cancelled') continue;
    if (teamIds.has(r.teamId)) blocking.push(`Registrazione duplicata per la squadra ${r.teamId}.`);
    teamIds.add(r.teamId);
    calculateWithdrawalPolicy(input.config, r.effectiveMatchweek); // fail closed
    if (r.state === 'draft_pending_activation') review.push(`Ritiro ${r.teamId} ancora in bozza: nessun effetto applicabile.`);
    if (r.state === 'active' && !r.effectsApplied) blocking.push(`Ritiro ${r.teamId} attivo senza riconciliazione degli effetti: fermare ogni pubblicazione.`);
  }

  // Impedisce l'elaborazione di due ritiri che rivendicano la stessa gara.
  const claimed = new Map<string, string>();
  for (const r of entries) {
    const importPlan = planWithdrawalFutureImports({
      seasonId, withdrawnTeamId: r.teamId, config: input.config,
      effectiveMatchweek: r.effectiveMatchweek,
      existingFixtures: input.existingFixtures, incomingFixtures: input.incomingFixtures,
    });
    for (const issue of importPlan.issues) {
      (issue.code === 'duplicate_fixture' ? review : blocking).push(`${r.teamId}: ${issue.message}`);
    }
    const fixtures = [...input.existingFixtures, ...input.incomingFixtures];
    const maturity = evaluateWithdrawalMatchweekMaturity({
      seasonId, withdrawnTeamId: r.teamId, config: input.config,
      effectiveMatchweek: r.effectiveMatchweek,
      fixtures,
      officiallyClosedMatchweeks: input.officiallyClosedMatchweeks,
      recordedWalkoverMatchIds: input.recordedWalkoverMatchIds,
      decisions: importPlan.decisions.filter(d => d.action === 'walkover_candidate'),
    });
    for (const issue of maturity.issues) blocking.push(`${r.teamId}: ${issue}`);
    const checks = new Map(maturity.checks.map(c => [c.matchId, c]));
    for (const decision of importPlan.decisions) {
      const claimant = claimed.get(decision.matchId);
      if (claimant && claimant !== r.teamId) {
        blocking.push(`Conflitto: gara ${decision.matchId} coinvolta in ritiri sia di ${claimant} sia di ${r.teamId}.`);
        continue;
      }
      claimed.set(decision.matchId, r.teamId);
      const check = checks.get(decision.matchId);
      if (decision.action === 'manual_review' || check?.outcome === 'requires_review') {
        review.push(`${r.teamId}, gara ${decision.matchId}: ${check?.reason ?? decision.reason}`);
      }
      decisions.push({
        matchId: decision.matchId, matchweek: decision.matchweek,
        teamId: r.teamId, opponentTeamId: decision.opponentTeamId,
        action: decision.action, maturity: check?.outcome ?? 'not_applicable',
        reason: check?.reason ?? decision.reason, assignedPoints: 0,
      });
    }
  }

  // ID ripetuti con righe discordanti tra le stagioni o gli import esistenti
  // non devono essere ignorati neppure se la partita non riguarda una squadra ritirata.
  const known = new Map<string, string>();
  for (const f of [...input.existingFixtures, ...input.incomingFixtures]) {
    if (f.seasonId !== seasonId) { blocking.push(`Gara ${f.id} di stagione diversa.`); continue; }
    const signature = fixtureKey(f);
    const previous = known.get(f.id);
    if (previous && previous !== signature) blocking.push(`Gara ${f.id} presenta dati sportivi discordanti.`);
    known.set(f.id, signature);
  }
  if (entries.length === 0) review.push('Nessun ritiro attivo o in bozza da simulare.');
  decisions.sort((a,b) => a.matchweek - b.matchweek || a.matchId.localeCompare(b.matchId) || a.teamId.localeCompare(b.teamId));
  return {
    seasonId, mode: 'preview_only', canActivate: false, canPublish: false,
    decisions, blockingIssues: uniqueSorted(blocking), reviewIssues: uniqueSorted(review),
    summary: {
      imported: input.incomingFixtures.length,
      voidCandidates: decisions.filter(d => d.action === 'void_candidate').length,
      walkoverCandidates: decisions.filter(d => d.action === 'walkover_candidate').length,
      readyForReview: decisions.filter(d => d.maturity === 'ready_for_review').length,
      notDue: decisions.filter(d => d.maturity === 'not_due').length,
      manualReviews: decisions.filter(d => d.action === 'manual_review' || d.maturity === 'requires_review').length,
    },
  };
}
