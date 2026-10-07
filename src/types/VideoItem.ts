export type VideoStatus =
  | "draft"
  | "published";

export type VideoSection =
  | "video"
  | "ludi-tv";

export type VideoItem = {
  id: string;

  seasonId: string;

  /*
   * Nuova struttura generica.
   *
   * Esempi:
   * Goal Parade
   * Save Parade
   */
  contentType: string;

  title?: string;

  youtubeUrl: string;
  youtubeVideoId: string;

  coverUrl?: string;
  coverKey?: string;

  status: VideoStatus;

  section: VideoSection;

  /*
   * Campo mantenuto soltanto
   * per compatibilità con i vecchi
   * documenti Goal Parade.
   *
   * I nuovi video useranno 0.
   */
  matchweek: number;

  createdAt?: unknown;
  updatedAt?: unknown;
  publishedAt?: unknown;
};

export type CreateVideoInput = {
  seasonId: string;

  contentType: string;

  title?: string;

  youtubeUrl: string;
  youtubeVideoId: string;

  coverUrl?: string;
  coverKey?: string;

  status: VideoStatus;

  section: VideoSection;

  /*
   * Legacy.
   */
  matchweek?: number;
};

export type UpdateVideoInput = {
  itemId: string;

  seasonId: string;

  contentType: string;

  title?: string;

  youtubeUrl: string;
  youtubeVideoId: string;

  coverUrl?: string;
  coverKey?: string;

  status: VideoStatus;

  section: VideoSection;

  /*
   * Legacy.
   */
  matchweek?: number;
};

export type CreateVideoItemInput =
  CreateVideoInput;

export type UpdateVideoItemInput =
  UpdateVideoInput;