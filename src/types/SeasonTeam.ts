export type SeasonTeamStatus =
  | "active"
  | "withdrawn"
  | "completed";

export type SeasonTeam = {
  id: string;
  teamId: string;
  seasonId: string;

  president?: string;

  status: SeasonTeamStatus;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type CreateSeasonTeamInput = {
  teamId: string;
  seasonId: string;

  president?: string;
};