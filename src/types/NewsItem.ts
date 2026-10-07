export type NewsCategory = "risultato" | "intervista" | "calciomercato" | "news";

export type NewsStatus =
  | "draft"
  | "published";

export type NewsItem = {
  id: string;

  seasonId: string;

  matchweek?: number;

  badgeLabel?: string;
  newsType?: NewsCategory;
  editorial?: boolean;
  matchId?: string;
  matchPhase?: "regularSeason" | "finalStage";
  teamId?: string;
  category: string;
  content: string;

  coverUrl?: string;
  coverKey?: string;

  /*
   * Collegamento interno facoltativo.
   * Per i comunicati disciplinari sarà:
   * /comunicati/mw1
   */
  linkUrl?: string;

  status: NewsStatus;

  createdAt?: unknown;
  updatedAt?: unknown;
  publishedAt?: unknown;
};

export type CreateNewsItemInput = {
  seasonId: string;

  matchweek?: number;

  newsType?: NewsCategory;
  editorial?: boolean;
  matchId?: string;
  matchPhase?: "regularSeason" | "finalStage";
  teamId?: string;
  category: string;
  
  content: string;

  badgeLabel?: string;
  coverUrl?: string;
  coverKey?: string;
  linkUrl?: string;

  status: NewsStatus;
};

export type UpdateNewsItemInput =
  CreateNewsItemInput & {
    itemId: string;
  };