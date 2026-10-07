export type PlayerRole =
  | "Portiere"
  | "Difensore"
  | "Attaccante";

export type PlayerStats = {
  appearances: number;
  goals: number;
  assists: number;
  mvp: number;
  averageVote: number;
  yellowCards: number;
  redCards: number;
  cost: number;
  cleanSheets: number;
};

export type PlayerLastMatch = {
  id: number;
  match: string;
  vote: number;
  goals: number;
  assists: number;
  yellowCard: boolean;
  redCard: boolean;
  mvp: boolean;
};

export type PlayerCleanSheetEntry = {
  matchId: number;
  opponent?: string;
  date?: string;
  goalsConceded: number;
  isWalkover?: boolean;
};

export type Player = {
  id: number;
  name: string;
  team: string;
  teamSlug: string;
  role: PlayerRole;
  shirtNumber: number;
  photoUrl?: string;
  overall: number;
  stats: PlayerStats;
  topPlayerVotes: unknown[];
  cleanSheetEntries?: PlayerCleanSheetEntry[];
  lastMatches?: PlayerLastMatch[];
};