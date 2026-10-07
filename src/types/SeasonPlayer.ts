export type SeasonPlayerStatus =
  | "active"
  | "inactive"
  | "transferred"
  | "withdrawn";

export type SeasonPlayerRole =
  | "Portiere"
  | "Difensore"
  | "Attaccante";

export type SeasonPlayer = {
  id: string;

  seasonId: string;
  playerId: string;
  teamId: string;

  role: SeasonPlayerRole;
  shirtNumber?: number;
  rating?: number;
  status: SeasonPlayerStatus;

  joinedAt?: string;
  leftAt?: string;
  baseRating?: number;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type CreateSeasonPlayerInput = {
  seasonId: string;
  playerId: string;
  teamId: string;

  role: SeasonPlayerRole;
  shirtNumber?: number;
};

export type UpdateSeasonPlayerInput = {
  seasonPlayerId: string;

  teamId: string;
  role: SeasonPlayerRole;
  shirtNumber?: number;
  status: SeasonPlayerStatus;

  joinedAt?: string;
  leftAt?: string;
};