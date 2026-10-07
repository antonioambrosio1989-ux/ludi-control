export type PredictionOneXTwo = "1" | "X" | "2";
export type PredictionGoalBand = "under" | "over";
export type PredictionResultStatus = "played" | "walkover" | "postponed";

export type PredictionSelection = {
  matchId: string;
  oneXTwo: PredictionOneXTwo;
  goalBand: PredictionGoalBand;
};

export type PredictionLeaderboardEntry = {
  position: number;
  userId: string;
  displayName: string;
  totalScore: number;
  submittedTickets: number;
};

export type PredictionMatch = {
  id: string;
  competitionId: string;
  competitionName: string;
  homeTeamName: string;
  awayTeamName: string;
  date: string;
  time: string;
  result?: {
    status: PredictionResultStatus;
    homeScore?: number;
    awayScore?: number;
    oneXTwo?: PredictionOneXTwo;
    goalBand?: PredictionGoalBand;
  };
};

export type PredictionTicket = {
  gameId: string;
  competitionId: string;
  competitionName: string;
  seasonId: string;
  seasonName: string;
  matchweek: number;
  matchweekId: string;
  closesAtLabel: string;
  isLocked: boolean;
  matches: PredictionMatch[];
  selections: PredictionSelection[];
  submittedAt?: unknown;
  score?: number;
  maxScore: number;
  isScored: boolean;
  seasonLeaderboard: PredictionLeaderboardEntry[];
};

export function resolveOneXTwo(homeScore: number, awayScore: number): PredictionOneXTwo {
  if (homeScore > awayScore) return "1";
  if (homeScore < awayScore) return "2";
  return "X";
}

export function resolveGoalBand(homeScore: number, awayScore: number): PredictionGoalBand {
  return homeScore + awayScore <= 7 ? "under" : "over";
}

export function calculatePredictionScore(
  selections: PredictionSelection[],
  results: Array<{
    matchId: string;
    status?: PredictionResultStatus;
    homeScore?: number;
    awayScore?: number;
  }>,
) {
  const selectionByMatchId = new Map(selections.map((selection) => [selection.matchId, selection]));
  let score = 0;
  for (const result of results) {
    const selection = selectionByMatchId.get(result.matchId);
    if (!selection || result.status === "postponed") continue;
    if (result.homeScore === undefined || result.awayScore === undefined) continue;
    if (selection.oneXTwo === resolveOneXTwo(result.homeScore, result.awayScore)) score += 30;
    if (result.status !== "walkover" && selection.goalBand === resolveGoalBand(result.homeScore, result.awayScore)) score += 20;
  }
  return score;
}

export function calculatePredictionMaxScore(
  results: Array<{ status?: PredictionResultStatus }>,
) {
  return results.reduce((total, result) => {
    if (result.status === "postponed") return total;
    return total + (result.status === "walkover" ? 30 : 50);
  }, 0);
}
