/**
 * Fase 8B. Gate PURO di maturazione dei tavolini successivi al ritiro.
 * Un operatore/servizio separato deve attestare la chiusura ufficiale delle
 * giornate; non la deduciamo dalla data, dall'import o dai report parziali.
 * NON scrive Firebase, NON assegna punti e NON pubblica risultati.
 */
import { calculateWithdrawalPolicy, type WithdrawalConfig } from './WithdrawalRegistryRules';
import type { FutureImportDecision } from './WithdrawalFutureImportPlanner';

export type MaturityFixture = {
  id: string;
  seasonId: string;
  matchweek: number;
  homeTeamId: string | number;
  awayTeamId: string | number;
  status: string;
  matchType?: string;
};

export type MaturityCheck = {
  matchId: string;
  matchweek: number;
  opponentTeamId: string;
  outcome: 'ready_for_review' | 'not_due' | 'requires_review' | 'already_recorded';
  reason: string;
  /** Il motore e' un planner, non un allocatore di punti. */
  assignedPoints: 0;
};

export type EvaluateMaturityInput = {
  seasonId: string;
  withdrawnTeamId: string;
  config: WithdrawalConfig;
  effectiveMatchweek: number;
  /** Elenco delle gare gia' importate, inclusi eventuali arretrati. */
  fixtures: readonly MaturityFixture[];
  /** SOLO giornate la cui chiusura ufficiale e' stata attestata da un processo affidabile. */
  officiallyClosedMatchweeks: readonly number[];
  /** Match gia' processati dal registro idempotente, non dalla semplice lettura dei report. */
  recordedWalkoverMatchIds: readonly string[];
  /** Candidate provenienti dal planner della fase 8A. */
  decisions: readonly FutureImportDecision[];
};

export type MaturityPlan = {
  checks: MaturityCheck[];
  issues: string[];
  /** Non equivale ad autorizzazione automatica a pubblicare punti. */
  safeToPublish: false;
};

export function evaluateWithdrawalMatchweekMaturity(input: EvaluateMaturityInput): MaturityPlan {
  const seasonId = input.seasonId.trim();
  const teamId = input.withdrawnTeamId.trim();
  if (!seasonId || !teamId) throw new Error('Stagione o squadra non valida.');
  const { policy } = calculateWithdrawalPolicy(input.config, input.effectiveMatchweek);
  const closed = new Set<number>();
  const issues: string[] = [];
  for (const week of input.officiallyClosedMatchweeks) {
    if (!Number.isSafeInteger(week) || week < 1 || week > input.config.totalMatchweeks) {
      throw new Error('Giornata attestata non valida.');
    }
    if (closed.has(week)) issues.push(`Chiusura giornata ${week} ripetuta.`);
    closed.add(week);
  }
  const recorded = new Set(input.recordedWalkoverMatchIds);
  if (recorded.size !== input.recordedWalkoverMatchIds.length) {
    issues.push('Registro tavolini contiene identificativi ripetuti.');
  }
  const fixturesById = new Map<string, MaturityFixture>();
  const conflicts = new Set<string>();
  for (const fixture of input.fixtures) {
    if (!fixture.id.trim() || fixture.seasonId !== seasonId ||
        !Number.isSafeInteger(fixture.matchweek) || fixture.matchweek < 1 ||
        fixture.matchweek > input.config.totalMatchweeks) {
      issues.push(`Gara non valida nel calendario: ${fixture.id}.`);
      conflicts.add(fixture.id);
      continue;
    }
    const prior = fixturesById.get(fixture.id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(fixture)) {
      conflicts.add(fixture.id);
      issues.push(`ID gara ${fixture.id} duplicato con informazioni contrastanti.`);
    }
    fixturesById.set(fixture.id, fixture);
  }
  const seen = new Set<string>();
  const checks: MaturityCheck[] = [];
  for (const candidate of input.decisions) {
    if (seen.has(candidate.matchId)) {
      issues.push(`Decisione ripetuta per la gara ${candidate.matchId}.`);
      continue;
    }
    seen.add(candidate.matchId);
    const base = {
      matchId: candidate.matchId, matchweek: candidate.matchweek,
      opponentTeamId: candidate.opponentTeamId, assignedPoints: 0 as const,
    };
    const reject = (reason: string): MaturityCheck => ({ ...base, outcome: 'requires_review', reason });
    const fixture = fixturesById.get(candidate.matchId);
    if (policy !== 'retain_and_walkover' || candidate.action !== 'walkover_candidate') {
      checks.push(reject('Non e\' una candidatura valida a tavolino nel girone di ritorno.'));
    } else if (conflicts.has(candidate.matchId) || !fixture) {
      checks.push(reject('Gara assente o in conflitto nel calendario.'));
    } else if (fixture.seasonId !== seasonId || fixture.matchType && fixture.matchType !== 'regularSeason' ||
       fixture.matchweek !== candidate.matchweek || fixture.matchweek < input.effectiveMatchweek ||
       fixture.status !== 'scheduled' ||
       !(String(fixture.homeTeamId) === teamId || String(fixture.awayTeamId) === teamId) ||
       String(fixture.homeTeamId) === String(fixture.awayTeamId) ||
       (String(fixture.homeTeamId) === teamId ? String(fixture.awayTeamId) : String(fixture.homeTeamId)) !== candidate.opponentTeamId) {
      checks.push(reject('Candidatura incoerente con la gara corrente o con lo stato ufficiale.'));
    } else if (recorded.has(candidate.matchId)) {
      checks.push({ ...base, outcome: 'already_recorded', reason: 'Tavolino gia\' presente nel registro idempotente.' });
    } else if (!closed.has(fixture.matchweek)) {
      checks.push({ ...base, outcome: 'not_due', reason: 'Giornata non ancora dichiarata ufficialmente conclusa.' });
    } else {
      checks.push({ ...base, outcome: 'ready_for_review', reason: 'Giornata attestata conclusa: proposta da confermare con operazione atomica separata.' });
    }
  }
  checks.sort((a,b) => a.matchweek - b.matchweek || a.matchId.localeCompare(b.matchId));
  return { checks, issues, safeToPublish: false };
}
