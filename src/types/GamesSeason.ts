/*
 * ============================================================
 * GAMES SEASON
 * ============================================================
 *
 * Una Games Season è una finestra stagionale di accesso ai Games.
 *
 * I giochi NON appartengono più alla Games Season:
 * restano nel catalogo permanente e vengono semplicemente nascosti
 * quando non esiste una Games Season effettivamente attiva.
 * ============================================================
 */

export type GamesSeasonStatus =
  | "active"
  | "archived"; // legacy: mantenuto solo per leggere vecchi documenti.

export const GAMES_COMPETITION_IDS = [
  "premier-league",
  "championship",
  "league-one",
] as const;

export type GamesCompetitionId =
  (typeof GAMES_COMPETITION_IDS)[number];

/*
 * ============================================================
 * GAME PASS PRICING
 * ============================================================
 */

export type GamesPassPricePeriod = {
  id: string;
  name: string;
  priceCents: number;
  startsAt: unknown;
  endsAt?: unknown;
};

export type GamesPassPricePeriodInput = {
  id: string;
  name: string;
  priceCents: number;
  startsAt: Date;
  endsAt?: Date;
};

/*
 * ============================================================
 * MODEL
 * ============================================================
 */

export type GamesSeason = {
  id: string;

  /*
   * Generato automaticamente:
   * Games 2026/27
   */
  name: string;

  /*
   * "archived" resta solo per compatibilità con eventuali
   * vecchi documenti. Le nuove Games Season non vengono archiviate:
   * la disponibilità è determinata da startsAt / endsAt.
   */
  status: GamesSeasonStatus;

  /*
   * Campo mantenuto nel documento per compatibilità con il codice
   * esistente. Per le nuove Games Season contiene SEMPRE tutte
   * le competizioni di Ludi.
   */
  competitionIds: GamesCompetitionId[];

  passPricing: GamesPassPricePeriod[];

  startsAt?: unknown;
  endsAt?: unknown;

  createdAt?: unknown;
  updatedAt?: unknown;
};

/*
 * ============================================================
 * CREATE
 * ============================================================
 */

export type CreateGamesSeasonInput = {
  startsAt: Date;
  endsAt: Date;

  passPricing?:
    GamesPassPricePeriodInput[];

  /*
   * Campi legacy accettati dal tipo per rendere più morbida
   * la migrazione. Il repository NON li usa per creare il nome,
   * l'ID o l'elenco competizioni.
   */
  id?: string;
  name?: string;
  competitionIds?: string[];
};

/*
 * ============================================================
 * UPDATE
 * ============================================================
 */

export type UpdateGamesSeasonInput = {
  gamesSeasonId: string;

  passPricing?:
    GamesPassPricePeriodInput[];

  startsAt?: Date;
  endsAt?: Date;

  /*
   * Legacy compatibility.
   * Le nuove regole generano nome/status/competizioni.
   */
  name?: string;
  status?: GamesSeasonStatus;
  competitionIds?: string[];
};

/*
 * ============================================================
 * IDENTITY
 * ============================================================
 */

export type GamesSeasonIdentity = {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
};

export function buildGamesSeasonIdentity(
  startsAt: Date,
  endsAt: Date,
): GamesSeasonIdentity {
  const startYear =
    startsAt.getFullYear();

  const endYear =
    endsAt.getFullYear();

  return {
    id:
      `games-${startYear}-${String(
        endYear,
      ).slice(-2)}`,

    name:
      `Games ${startYear}/${String(
        endYear,
      ).slice(-2)}`,

    startYear,
    endYear,
  };
}
