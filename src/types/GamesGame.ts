/*
 * ============================================================
 * GAMES GAME
 * ============================================================
 *
 * Un gioco appartiene al catalogo Games permanente.
 *
 * NON appartiene più a una singola Games Season.
 * La Games Season decide soltanto se il contenitore Games è
 * visibile e quali utenti possono partecipare.
 * ============================================================
 */

export type GamesGameStatus =
  | "waiting"
  | "active"
  | "suppressed";

/*
 * Mantenuto per compatibilità con i giochi già sviluppati.
 * Non viene più scelto nel form "Crea nuovo gioco":
 * il repository lo deduce automaticamente dallo slug.
 */
export type GamesGameType =
  | "fantacalcio"
  | "pronostici"
  | "votazioni"
  | "quiz"
  | "custom";

export type GamesGame = {
  id: string;

  name: string;
  slug: string;

  /*
   * 0 = gratuito.
   */
  priceCents: number;

  status: GamesGameStatus;

  activatesAt?: unknown;

  /*
   * Campi interni/legacy.
   * Restano disponibili per non rompere i moduli già sviluppati.
   */
  gameType: GamesGameType;

  competitionIds: string[];

  description?: string;

  /*
   * Posizione nel catalogo pubblico.
   * Valori più bassi vengono mostrati prima.
   */
  sortOrder?: number;

  gamesSeasonId?: string;

  catalogVersion?: number;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type CreateGamesGameInput = {
  name: string;
  slug: string;

  priceCents: number;

  status:
    Exclude<
      GamesGameStatus,
      "suppressed"
    >;

  activatesAt?: Date;

  /*
   * Legacy compatibility:
   * accettati ma non usati per limitare il gioco.
   */
  gamesSeasonId?: string;
  gameType?: GamesGameType;
  description?: string;
  competitionIds?: string[];
};

export type UpdateGamesGameInput = {
  gameId: string;

  name: string;

  /*
   * Lo slug resta stabile durante la modifica per non rompere
   * route, dati e riferimenti del gioco.
   */
  slug: string;

  priceCents: number;

  status: GamesGameStatus;

  activatesAt?: Date;

  /*
   * Legacy compatibility.
   */
  gameType?: GamesGameType;
  description?: string;
  competitionIds?: string[];
};

export function isSurvivorGame(game: Pick<GamesGame, "slug" | "name">) {
  return `${game.slug} ${game.name}`.toLocaleLowerCase("it").includes("survivor");
}
