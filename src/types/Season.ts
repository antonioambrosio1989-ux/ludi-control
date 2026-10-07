export type SeasonStatus =
  | "draft"
  | "active"
  | "completed";

export type Season = {
  id: string;

  competitionId?: string;

  name: string;
  startYear: number;
  endYear: number;

  status: SeasonStatus;
  isCurrent: boolean;

  createdAt?: unknown;
  updatedAt?: unknown;

  regularSeasonClosed?: boolean;
  finalStageClosed?: boolean;
};

export type CreateSeasonInput = {
  competitionId?: string;

  name: string;
  startYear: number;
  endYear: number;
};

export type UpdateSeasonInput = {
  competitionId?: string;

  seasonId: string;

  name: string;
  startYear: number;
  endYear: number;

  status: SeasonStatus;
  isCurrent: boolean;

  regularSeasonClosed?: boolean;
  finalStageClosed?: boolean;
};