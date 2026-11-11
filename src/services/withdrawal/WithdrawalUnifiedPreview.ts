/**
 * Fase 6A. Aggregatore di simulazioni: nessun accesso a Firebase, nessuna scrittura.
 * Mantiene intatti gli input e NON costituisce autorizzazione al ritiro effettivo.
 */
import { buildWithdrawalSportingProjection, type WithdrawalSportingInput, type WithdrawalSportingProjection } from './WithdrawalSportingProjection';
import { buildWithdrawalIndividualProjection, type WithdrawalIndividualProjection, type WithdrawalPlayerReference } from './WithdrawalPlayerProjection';
import { projectWithdrawalDiscipline, type DisciplineProjection } from './WithdrawalDisciplineProjection';
import { replayWithdrawalDiscipline, type ReplayResult } from './WithdrawalDisciplineReplay';
import type { DisciplinarySuspension, PlayerDisciplinaryRecord } from '../../types/DisciplinaryRecord';

export type UnifiedWithdrawalInput = WithdrawalSportingInput & {
  players: WithdrawalPlayerReference[];
  disciplinaryRecords: PlayerDisciplinaryRecord[];
  disciplinarySuspensions: DisciplinarySuspension[];
};

export type WithdrawalPlayerChange = {
  playerId: string;
  teamId: string;
  appearancesDelta: number;
  goalsDelta: number;
  assistsDelta: number;
  mvpDelta: number;
  topPlayerPointsDelta: number;
  cleanSheetPointsDelta: number;
  averageVoteBefore: number | null;
  averageVoteAfter: number | null;
  eligibilityBefore: boolean;
  eligibilityAfter: boolean;
};

export type WithdrawalTeamChange = {
  teamId: string;
  pointsDelta: number;
  playedDelta: number;
  goalsForDelta: number;
  goalsAgainstDelta: number;
};

export type UnifiedWithdrawalPreview = {
  sporting: WithdrawalSportingProjection;
  players: WithdrawalIndividualProjection;
  disciplineAudit: DisciplineProjection;
  disciplineReplay: ReplayResult;
  teamChanges: WithdrawalTeamChange[];
  playerChanges: WithdrawalPlayerChange[];
  overview: {
    excludedMatches: number;
    excludedReports: number;
    scheduledWalkovers: number;
    postponedForReview: number;
    affectedPlayers: number;
    disciplinaryCasesForReview: number;
  };
  issues: string[];
  /** Fase 6A è solo anteprima: sempre falso, anche se issues è vuoto. */
  safeToApply: false;
};

const sortedUnique = (items: string[]): string[] => [...new Set(items)].sort();

export function buildUnifiedWithdrawalPreview(input: UnifiedWithdrawalInput): UnifiedWithdrawalPreview {
  const sporting = buildWithdrawalSportingProjection(input);
  const excludedMatchIds = [...sporting.excludedMatchIds];
  // Non utilizzare mai gli ID forniti dal browser per escludere partite: sono calcolati dalla policy ufficiale.
  const players = buildWithdrawalIndividualProjection({
    seasonId: input.seasonId,
    matches: input.matches,
    reports: input.reports,
    players: input.players,
    excludedMatchIds,
  });
  const disciplineAudit = projectWithdrawalDiscipline({
    seasonId: input.seasonId,
    matches: input.matches,
    reports: input.reports,
    records: input.disciplinaryRecords,
    suspensions: input.disciplinarySuspensions,
    excludedMatchIds,
  });
  const disciplineReplay = replayWithdrawalDiscipline({
    seasonId: input.seasonId,
    // Il tipo Match ammette ID squadra numerici; il replay 5D richiede stringhe.
    // Normalizziamo solo la copia usata dalla simulazione, senza mutare gli input.
    matches: input.matches.map(match => ({
      ...match,
      homeTeamId: String(match.homeTeamId),
      awayTeamId: String(match.awayTeamId),
    })),
    reports: input.reports,
    existingSuspensions: input.disciplinarySuspensions,
    excludedMatchIds,
  });
  const teamBefore = new Map(sporting.standingsBefore.map(r => [String(r.teamId), r]));
  const teamChanges: WithdrawalTeamChange[] = sporting.standingsAfter.flatMap(after => {
    const before = teamBefore.get(String(after.teamId));
    if (!before) return [];
    const change: WithdrawalTeamChange = {
      teamId: String(after.teamId),
      pointsDelta: after.points - before.points,
      playedDelta: after.played - before.played,
      goalsForDelta: after.goalsFor - before.goalsFor,
      goalsAgainstDelta: after.goalsAgainst - before.goalsAgainst,
    };
    return Object.values(change).slice(1).some(v => v !== 0) ? [change] : [];
  }).sort((a, b) => a.teamId.localeCompare(b.teamId));
  const playerBefore = new Map(players.before.map(p => [p.playerId, p]));
  const playerChanges: WithdrawalPlayerChange[] = players.after.flatMap(after => {
    const before = playerBefore.get(after.playerId);
    if (!before) return [];
    const change: WithdrawalPlayerChange = {
      playerId: after.playerId, teamId: after.teamId,
      appearancesDelta: after.appearances - before.appearances,
      goalsDelta: after.goals - before.goals,
      assistsDelta: after.assists - before.assists,
      mvpDelta: after.mvp - before.mvp,
      topPlayerPointsDelta: after.topPlayerPoints - before.topPlayerPoints,
      cleanSheetPointsDelta: after.cleanSheetPoints - before.cleanSheetPoints,
      averageVoteBefore: before.averageVote, averageVoteAfter: after.averageVote,
      eligibilityBefore: before.eligibleForAverageRanking,
      eligibilityAfter: after.eligibleForAverageRanking,
    };
    return change.appearancesDelta !== 0 || change.goalsDelta !== 0 || change.assistsDelta !== 0 ||
      change.mvpDelta !== 0 || change.topPlayerPointsDelta !== 0 || change.cleanSheetPointsDelta !== 0 ||
      change.averageVoteBefore !== change.averageVoteAfter || change.eligibilityBefore !== change.eligibilityAfter
      ? [change] : [];
  }).sort((a, b) => a.playerId.localeCompare(b.playerId));
  const issues = sortedUnique([
    ...sporting.issues, ...players.issues, ...disciplineAudit.blockers, ...disciplineReplay.blockers,
  ]);
  return {
    sporting, players, disciplineAudit, disciplineReplay, teamChanges, playerChanges,
    overview: {
      excludedMatches: excludedMatchIds.length,
      excludedReports: sporting.excludedPublishedReportIds.length,
      scheduledWalkovers: sporting.futureWalkovers.length,
      postponedForReview: sporting.postponedToReview.length,
      affectedPlayers: playerChanges.length,
      disciplinaryCasesForReview: disciplineAudit.affectedSuspensions.length + disciplineReplay.historicalAutomaticReviewIds.length,
    },
    issues,
    safeToApply: false,
  };
}
