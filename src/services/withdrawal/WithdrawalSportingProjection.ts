/**
 * Fase 5A: proiezione sportiva IN MEMORIA. Nessuna scrittura, nessun effetto su Firestore.
 * La proiezione non costituisce autorizzazione ad applicare un ritiro.
 */
import type { Match } from "@/src/types/Match";
import type { CloudMatchReport } from "@/src/services/match/FirebaseMatchReportRepository";
import { calculateStandings, type StandingRow } from "../standings/StandingsCalculator";
import { calculateWithdrawalPolicy, type WithdrawalConfig, type WithdrawalPolicy } from "./WithdrawalRegistryRules";

export type FutureWalkover = {
  matchId: string;
  matchweek: number;
  opponentTeamId: string;
  scheduledDate: string;
  scheduledTime: string;
};

export type VoidedMatchImpact = {
  matchId: string;
  matchweek: number;
  reportFound: boolean;
  participantIds: string[];
  presentPlayerIds: string[];
  performancePlayerIds: string[];
};

export type WithdrawalSportingProjection = {
  policy: WithdrawalPolicy;
  excludedMatchIds: string[];
  excludedPublishedReportIds: string[];
  voidedMatchImpacts: VoidedMatchImpact[];
  futureWalkovers: FutureWalkover[];
  postponedToReview: string[];
  /** Le partite mantenute sono l'input esatto del calcolatore classifiche. */
  standingsBefore: StandingRow[];
  standingsAfter: StandingRow[];
  issues: string[];
  /** Non può mai attivare scritture: un altro motore dovrà validare e approvare gli effetti. */
  safeToApply: false;
};

export type WithdrawalSportingInput = {
  seasonId: string;
  withdrawnTeamId: string;
  config: WithdrawalConfig;
  effectiveMatchweek: number;
  /** Partite dell'intera Regular Season di UNA stagione; anche con calendario parziale. */
  matches: Match[];
  /** Report pubblicati della stessa stagione; bozze ignorate. */
  reports: CloudMatchReport[];
  /** ID iscrizioni stagionali, inclusa la squadra ritirata. */
  teamIds: string[];
};

const ended = new Set(["played", "finished", "walkover"]);

function uniqueStrings(items: Array<string | number>): string[] {
  return [...new Set(items.map(String))];
}

export function buildWithdrawalSportingProjection(input: WithdrawalSportingInput): WithdrawalSportingProjection {
  const seasonId = input.seasonId.trim();
  const withdrawnTeamId = input.withdrawnTeamId.trim();
  if (!seasonId || !withdrawnTeamId) throw new Error("Stagione o squadra assente.");
  const { policy } = calculateWithdrawalPolicy(input.config, input.effectiveMatchweek);
  const issues: string[] = [];
  if (!input.teamIds.map(String).includes(withdrawnTeamId)) issues.push("La squadra non compare nelle iscrizioni stagionali.");
  const matches = input.matches.filter(m => (m.matchType ?? "regularSeason") === "regularSeason");
  const ids = new Set<string>();
  for (const m of matches) {
    if (m.seasonId !== seasonId) issues.push(`Partita di un'altra stagione: ${m.id}.`);
    if (!m.id || ids.has(m.id)) issues.push(`ID partita duplicato: ${m.id}.`);
    if (!Number.isSafeInteger(m.matchweek) || m.matchweek < 1 || m.matchweek > input.config.totalMatchweeks) {
      issues.push(`Giornata non valida: ${m.id}.`);
    }
    ids.add(m.id);
  }
  const published = input.reports.filter(r => r.status === "published");
  const reportsById = new Map(published.map(r => [String(r.matchId), r]));
  const involved = matches.filter(m => String(m.homeTeamId) === withdrawnTeamId || String(m.awayTeamId) === withdrawnTeamId);
  if (!involved.length) issues.push("Nessuna partita della squadra presente nel calendario importato.");

  const excludedMatchIds: string[] = [];
  const futureWalkovers: FutureWalkover[] = [];
  const postponedToReview: string[] = [];
  const voidedMatchImpacts: VoidedMatchImpact[] = [];

  for (const m of involved) {
    const opponentTeamId = String(m.homeTeamId) === withdrawnTeamId ? String(m.awayTeamId) : String(m.homeTeamId);
    if (opponentTeamId === withdrawnTeamId) issues.push(`La squadra affronta se stessa: ${m.id}.`);
    if (policy === "void_all") {
      excludedMatchIds.push(m.id);
      const report = reportsById.get(m.id);
      const presentPlayerIds = report ? uniqueStrings([
        ...(report.data.homePresentPlayerIds ?? []), ...(report.data.awayPresentPlayerIds ?? []),
      ]) : [];
      voidedMatchImpacts.push({
        matchId: m.id,
        matchweek: m.matchweek,
        reportFound: Boolean(report),
        participantIds: uniqueStrings([m.homeTeamId, m.awayTeamId]),
        presentPlayerIds,
        performancePlayerIds: report ? Object.keys(report.data.performances ?? {}) : [],
      });
      continue;
    }

    // Ritorno: risultati conclusi prima del ritiro rimangono validi.
    if (ended.has(m.status)) {
      if (m.matchweek >= input.effectiveMatchweek) {
        issues.push(`Partita già conclusa nella giornata di ritiro o successiva: ${m.id}; serve verifica della data effettiva.`);
      }
    } else if (m.status === "scheduled") {
      if (m.matchweek < input.effectiveMatchweek) {
        issues.push(`Partita arretrata non disputata: ${m.id}; non è un tavolino automatico.`);
      } else {
        futureWalkovers.push({
          matchId: m.id, matchweek: m.matchweek, opponentTeamId,
          scheduledDate: m.date, scheduledTime: m.time,
        });
      }
    } else if (m.status === "postponed") {
      postponedToReview.push(m.id);
    } else {
      issues.push(`Stato partita da risolvere manualmente (${m.status}): ${m.id}.`);
    }
  }
  excludedMatchIds.sort();
  futureWalkovers.sort((a, b) => a.matchweek - b.matchweek || a.matchId.localeCompare(b.matchId));
  const excludedSet = new Set(excludedMatchIds);
  const effectiveMatches = matches.filter(m => !excludedSet.has(m.id));
  const effectiveReports = published.filter(r => !excludedSet.has(String(r.matchId)));
  const teamIds = uniqueStrings(input.teamIds);
  return {
    policy,
    excludedMatchIds,
    excludedPublishedReportIds: published.filter(r => excludedSet.has(String(r.matchId))).map(r => String(r.matchId)).sort(),
    voidedMatchImpacts,
    futureWalkovers,
    postponedToReview,
    standingsBefore: calculateStandings(matches, published, { teamIds }),
    standingsAfter: calculateStandings(effectiveMatches, effectiveReports, { teamIds }),
    issues,
    safeToApply: false,
  };
}
