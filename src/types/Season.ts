/** Formato della regular season, definito per singola stagione. */
export type RegularSeasonFormat = "single_round_robin" | "double_round_robin";
export type MarketWindow = { startDate: string; endDate: string };

export type SeasonMarketConfiguration = {
  /** Nessun default implicito: legacy = mercato disabilitato. */
  format?: RegularSeasonFormat;
  /** Prima giornata del ritorno, per stagioni A/R. */
  firstReturnMatchweek?: number | null;
  /** Estremi inclusivi, date civili Europe/Rome (YYYY-MM-DD). */
  marketWindow?: MarketWindow;
};

export type SeasonStatus =
  | "draft"
  | "active"
  | "completed";

export type Season = SeasonMarketConfiguration & {
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

export type CreateSeasonInput = SeasonMarketConfiguration & {
  competitionId?: string;

  name: string;
  startYear: number;
  endYear: number;
};

export type UpdateSeasonInput = SeasonMarketConfiguration & {
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