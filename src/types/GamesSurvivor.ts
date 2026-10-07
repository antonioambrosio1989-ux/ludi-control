export type SurvivorOutcome =
  | "pending"
  | "qualified"
  | "eliminated"
  | "postponed";

export type SurvivorPlayerStatus =
  | "active"
  | "waiting_result"
  | "qualified"
  | "eliminated"
  | "winner";

export type SurvivorChoice = {
  matchweek: number;
  matchId: string;
  teamId: string;
  teamName: string;
};

export type SurvivorMatch = {
  id: string;
  homeTeamId: string;
  homeTeamName: string;
  homeTeamLogoUrl?: string;
  awayTeamId: string;
  awayTeamName: string;
  awayTeamLogoUrl?: string;
  date: string;
  time: string;
};

export type SurvivorRuntime = {
  gameId: string;
  competitionId: string;
  competitionName: string;
  seasonId: string;
  seasonName: string;
  matchweek: number;
  closesAtLabel: string;
  isLocked: boolean;
  canEdit: boolean;
  status: SurvivorPlayerStatus;
  matches: SurvivorMatch[];
  choice: SurvivorChoice | null;
  usedTeamIds: string[];
};

export function resolveSurvivorOutcome(input: {
  selectedTeamId: string;
  homeTeamId: string;
  awayTeamId: string;
  status: string;
  homeScore?: number;
  awayScore?: number;
}): SurvivorOutcome {
  if (input.status === "postponed" || input.status === "cancelled") return "postponed";
  if (!["played", "finished", "walkover"].includes(input.status)) return "pending";
  if (input.homeScore === undefined || input.awayScore === undefined) return "pending";
  if (input.homeScore === input.awayScore) return "eliminated";
  const winnerId = input.homeScore > input.awayScore ? input.homeTeamId : input.awayTeamId;
  return winnerId === input.selectedTeamId ? "qualified" : "eliminated";
}
