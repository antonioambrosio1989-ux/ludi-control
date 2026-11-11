/**
 * Fase 5B - Proiezione individuale in memoria (read-only).
 * Nessuna scrittura, nessun aggiornamento delle statistiche persistite.
 * Usa ID di giocatore e di squadra, mai il nome come chiave.
 */
import type { Match } from "../../types/Match";
import type { CloudMatchReport } from "../match/FirebaseMatchReportRepository";

export type WithdrawalPlayerReference = {
  playerId: string;
  teamId: string;
  role: "Portiere" | "Difensore" | "Attaccante";
};

export type WithdrawalPlayerTotals = {
  playerId: string;
  teamId: string;
  role: WithdrawalPlayerReference["role"];
  teamMatchesPlayed: number;
  appearances: number;
  ratedAppearances: number;
  goals: number;
  assists: number;
  mvp: number;
  yellowCards: number;
  redCards: number;
  directRedCards: number;
  averageVote: number | null;
  topPlayerPoints: number;
  cleanSheetPoints: number;
  eligibleForAverageRanking: boolean;
};

export type WithdrawalIndividualProjection = {
  before: WithdrawalPlayerTotals[];
  after: WithdrawalPlayerTotals[];
  excludedMatchIds: string[];
  issues: string[];
  safeToApply: false;
};

export type WithdrawalIndividualInput = {
  seasonId: string;
  matches: Match[];
  reports: CloudMatchReport[];
  players: WithdrawalPlayerReference[];
  excludedMatchIds: string[];
};

type Accumulator = WithdrawalPlayerTotals & { voteSum: number };

const completedStatuses = new Set(["played", "finished", "walkover"]);
const cleanSheetByGoalsConceded = (goals: number): number =>
  goals === 0 ? 3 : goals === 1 ? 2 : goals === 2 ? 1 : 0;

function calculate(input: WithdrawalIndividualInput, excluded: Set<string>, issues: string[]): WithdrawalPlayerTotals[] {
  const players = new Map<string, Accumulator>();
  for (const p of input.players) {
    if (!p.playerId || !p.teamId) { issues.push("Giocatore privo di ID o teamId."); continue; }
    if (players.has(p.playerId)) { issues.push(`Giocatore duplicato nella proiezione: ${p.playerId}.`); continue; }
    players.set(p.playerId, {
      ...p, teamMatchesPlayed: 0, appearances: 0, ratedAppearances: 0,
      goals: 0, assists: 0, mvp: 0, yellowCards: 0, redCards: 0,
      directRedCards: 0, averageVote: null, topPlayerPoints: 0,
      cleanSheetPoints: 0, eligibleForAverageRanking: false, voteSum: 0,
    });
  }
  const reports = new Map(input.reports.filter(r => r.status === "published").map(r => [String(r.matchId), r]));
  const seen = new Set<string>();
  for (const match of input.matches) {
    if (match.seasonId !== input.seasonId || (match.matchType ?? "regularSeason") !== "regularSeason") continue;
    const matchId = String(match.id);
    if (seen.has(matchId)) { issues.push(`Partita duplicata: ${matchId}.`); continue; }
    seen.add(matchId);
    if (excluded.has(matchId)) continue;
    const report = reports.get(matchId);
    if (!report || !completedStatuses.has(match.status)) continue;
    const data = report.data;
    const home = String(match.homeTeamId);
    const away = String(match.awayTeamId);
    const isWalkover = data.status === "walkover" || match.status === "walkover";
    const winner = data.homeScore > data.awayScore ? home : data.awayScore > data.homeScore ? away : null;
    const present = new Set([...data.homePresentPlayerIds, ...data.awayPresentPlayerIds].map(String));
    const homePresent = new Set((data.homePresentPlayerIds ?? []).map(String));
    const awayPresent = new Set((data.awayPresentPlayerIds ?? []).map(String));
    for (const player of players.values()) {
      if (player.teamId !== home && player.teamId !== away) continue;
      player.teamMatchesPlayed += 1;
      const onCorrectSide = player.teamId === home ? homePresent.has(player.playerId) : awayPresent.has(player.playerId);
      if (present.has(player.playerId) && !onCorrectSide) {
        issues.push(`Giocatore ${player.playerId} schierato nella squadra sbagliata: ${matchId}.`);
      }
      if (isWalkover) {
        if (winner === player.teamId) player.topPlayerPoints += 7;
        if (onCorrectSide) player.appearances += 1;
        continue;
      }
      if (!onCorrectSide) {
        player.topPlayerPoints += 5;
        continue;
      }
      player.appearances += 1;
      const performance = Object.values(data.performances ?? {}).find(p => String(p.playerId) === player.playerId);
      const hasVote = performance?.status === "rated" && typeof performance.vote === "number" && Number.isFinite(performance.vote);
      player.topPlayerPoints += hasVote ? performance.vote! : 5;
      if (hasVote) { player.voteSum += performance.vote!; player.ratedAppearances += 1; }
      player.goals += Math.max(0, performance?.goals ?? 0);
      player.assists += Math.max(0, performance?.assists ?? 0);
      player.yellowCards += Math.max(0, performance?.yellowCards ?? 0);
      player.redCards += Math.max(0, performance?.redCards ?? 0);
      player.directRedCards += Math.max(0, performance?.directRedCards ?? 0);
      if (String(data.mvpPlayerId ?? "") === player.playerId) player.mvp += 1;
      if (player.role === "Portiere") {
        const conceded = player.teamId === home ? data.awayScore : data.homeScore;
        if (Number.isFinite(conceded) && conceded >= 0) player.cleanSheetPoints += cleanSheetByGoalsConceded(conceded);
      }
    }
  }
  return [...players.values()].map(({ voteSum, ...p }) => ({
    ...p,
    averageVote: p.ratedAppearances ? Math.round(voteSum / p.ratedAppearances * 100) / 100 : null,
    eligibleForAverageRanking: p.teamMatchesPlayed > 0 && p.appearances / p.teamMatchesPlayed >= 0.6,
  })).sort((a, b) => a.playerId.localeCompare(b.playerId));
}

/**
 * A match void is SPORTING only: its yellow and red cards remain valid.
 * Augment the after-projection with original published disciplinary events,
 * without recreating any appearances, goals, assists, votes or MVPs.
 */
function carryOverDiscipline(
  totals: WithdrawalPlayerTotals[],
  reports: CloudMatchReport[],
  excluded: Set<string>,
  issues: string[],
): void {
  const byId = new Map(totals.map(total => [total.playerId, total]));
  const seen = new Set<string>();
  for (const report of reports) {
    const matchId = String(report.matchId);
    if (!excluded.has(matchId) || report.status !== "published") continue;
    if (seen.has(matchId)) { issues.push(`Tabellino annullato duplicato: ${matchId}.`); continue; }
    seen.add(matchId);
    for (const performance of Object.values(report.data.performances ?? {})) {
      const total = byId.get(String(performance.playerId));
      if (!total) continue;
      if ([performance.yellowCards, performance.redCards, performance.directRedCards]
        .some(value => value !== undefined && (!Number.isSafeInteger(value) || value < 0))) {
        issues.push(`Cartellini non verificabili nel tabellino ${matchId}.`);
        continue;
      }
      total.yellowCards += performance.yellowCards ?? 0;
      total.redCards += performance.redCards ?? 0;
      total.directRedCards += performance.directRedCards ?? 0;
    }
  }
}

/** Pure projection: before/after cancellation of provided match IDs. */
export function buildWithdrawalIndividualProjection(input: WithdrawalIndividualInput): WithdrawalIndividualProjection {
  if (!input.seasonId.trim()) throw new Error("Stagione obbligatoria.");
  const known = new Set(input.matches.filter(m => m.seasonId === input.seasonId && (m.matchType ?? "regularSeason") === "regularSeason").map(m => String(m.id)));
  const excluded = new Set(input.excludedMatchIds.map(String));
  const issues: string[] = [];
  for (const id of excluded) if (!known.has(id)) issues.push(`Partita da annullare non presente nella Regular Season: ${id}.`);
  const before = calculate(input, new Set(), issues);
  const after = calculate(input, excluded, issues);
  carryOverDiscipline(after, input.reports, excluded, issues);
  return { before, after, excludedMatchIds: [...excluded].sort(), issues: [...new Set(issues)], safeToApply: false };
}
