import type {
  PlayerCleanSheetEntry,
  PlayerLastMatch,
} from "./Player";

import type {
  PlayerAchievement,
} from "./PlayerAchievement";

export type PlayerRole =
  | "Portiere"
  | "Difensore"
  | "Attaccante";

export type PreferredFoot =
  | "Destro"
  | "Sinistro"
  | "Ambidestro";

export type Player = {
  id: number;
  name: string;

  team: string;
  teamSlug: string;

  role: PlayerRole;

  shirtNumber: number;

  photoUrl?: string;

  overall: number;

  topPlayerVotes: unknown[];

  cleanSheetEntries?:
    PlayerCleanSheetEntry[];

  lastMatches?:
    PlayerLastMatch[];
};

export type HistoricalImportSource = {
  seasonId: string;
  seasonName: string;
  fileName: string;
};

export type PlayerProfile = {
  id: string;

  competitionId: string;

  firstName: string;
  lastName: string;

  /*
   * Dato amministrativo privato.
   *
   * Non viene letto dalla collection pubblica `players`;
   * gli Admin lo ricevono da `playerPrivateProfiles`.
   */
  birthYear?: number;

  photoUrl?: string;
  coverImageUrl?: string;
  historicalImportSources?: HistoricalImportSource[];
  achievements?: PlayerAchievement[];
  preferredFoot?: PreferredFoot;

  /*
   * Rating iniziale del giocatore.
   *
   * Se non presente:
   * RATING = NP
   *
   * Quando viene inserito, il rating
   * attuale viene ricalcolato utilizzando
   * tutte le partite già disputate
   * nella stagione.
   */
  baseRating?: number;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type CreatePlayerInput = {
  competitionId: string;

  firstName: string;
  lastName: string;

  birthYear?: number;

  photoUrl?: string;
  coverImageUrl?: string;
  historicalImportSources?: HistoricalImportSource[];

  preferredFoot?: PreferredFoot;

  /*
   * Facoltativo.
   * Se assente il giocatore viene
   * visualizzato con rating "NP".
   */
  baseRating?: number;
};

export type UpdatePlayerInput = {
  playerId: string;

  firstName?: string;
  lastName?: string;

  birthYear?: number;

  photoUrl?: string;
  coverImageUrl?: string;
  historicalImportSources?: HistoricalImportSource[];

  preferredFoot?: PreferredFoot;

  /*
   * Consente di inserire o modificare
   * successivamente il rating iniziale.
   */
  baseRating?: number | null;
};