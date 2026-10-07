import type {
  MatchStatus
} from "@/src/types/MatchStatus";

export type {
  MatchStatus
} from "@/src/types/MatchStatus";

export type MatchType =
  | "regularSeason"
  | "titlePlayoff";

export type Match = {
  id: string;

  seasonId: string;
  matchType?: MatchType;
  matchweek: number;
  matchweekId: string;

  homeTeamId: string | number;
  awayTeamId: string | number;

  date: string;
  time: string;
  venue: string;

  status: MatchStatus;
  published: boolean;

  /*
   * Risultato della partita.
   *
   * - status === "live": punteggio provvisorio;
   * - status === "finished": risultato finale confermato, tabellino in elaborazione;
   * - tabellino pubblicato: risultato definitivo già consolidato.
   */
  homeScore?: number;
  awayScore?: number;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type CreateMatchInput = {
  seasonId: string;
  matchType?:
    MatchType;
  matchweek: number;
  matchweekId?: string;

  homeTeamId: string;
  awayTeamId: string;

  date: string;
  time: string;
  venue: string;
};

export type UpdateMatchInput = {
  matchId: string;
  matchType?: MatchType;
  matchweek: number;
  matchweekId?: string;

  homeTeamId: string;
  awayTeamId: string;

  date: string;
  time: string;
  venue: string;

  status: MatchStatus;
  published: boolean;

  homeScore?: number;
  awayScore?: number;
};