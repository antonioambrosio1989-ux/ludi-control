/*
 * ============================================================
 * SEZIONI HALL OF FAME
 * ============================================================
 */

export type HallOfFameSection =
  | "bestOfSeason"
  | "teamOfSeason"
  | "goalAndSave"
  | "otherAwards";

/*
 * ============================================================
 * TIPO VINCITORE
 * ============================================================
 */

export type HallOfFameWinnerType =
  | "player"
  | "team"
  | "custom";

/*
 * ============================================================
 * STATO
 * ============================================================
 */

export type HallOfFameStatus =
  | "draft"
  | "published";

/*
 * ============================================================
 * ITEM HALL OF FAME
 * ============================================================
 */

export type HallOfFameItem = {
  id: string;

   /*
   * Identificativo della stagione.
   *
   * Deve restare quello realmente associato
   * al premio, anche per le stagioni storiche.
   */
  seasonId: string;

   /*
 * Competizione principale
 * alla quale appartiene il premio.
 *
 * Esempi:
 * premier-league
 * championship
 * league-one
 */
competitionId: string;

  /*
   * Etichetta visualizzata.
   *
   * Esempio:
   * 2024/25
   */
  seasonLabel: string;

  /*
   * Sezione pubblica Hall of Fame.
   *
   * È obbligatoria nel modello applicativo.
   *
   * I vecchi documenti Firestore privi di
   * questo campo vengono normalizzati dal
   * repository come "otherAwards".
   */
  section:
    HallOfFameSection;

  /*
   * Nome del premio.
   *
   * Esempio:
   * The Best LUDI Player
   */
  category: string;

  /*
 * Sottotitolo del premio.
 *
 * Esempio:
 * Capocannoniere della Regular Season
 *
 * Se assente o vuoto,
 * non viene mostrato nulla
 * sotto il nome del premio.
 */
awardDescription?: string;

  /*
   * Tipo di vincitore.
   */
  winnerType:
    HallOfFameWinnerType;

  /*
   * Nome mostrato pubblicamente.
   */
  winnerName: string;

  /*
   * Collegamento facoltativo
   * al giocatore globale.
   */
  playerId?: string;

  /*
   * Collegamento facoltativo
   * alla squadra.
   */
  teamId?: string;

  /*
   * Foto associata al premio.
   */
  imageUrl?: string;

  /*
   * Chiave UploadThing.
   */
  imageKey?: string;

  /*
   * Video associato al premio.
   * Usato soprattutto nella sezione Goal & Save.
   */
  videoUrl?: string;

  /*
   * Chiave UploadThing del video.
   */
  videoKey?: string;

  /*
   * Testo aggiuntivo.
   *
   * Esempio:
   * Brentford · 87 goal
   */
  description?: string;

  /*
   * Ordine di visualizzazione
   * all'interno della sezione.
   */
  sortOrder: number;

  status:
    HallOfFameStatus;

  createdAt?: unknown;
  updatedAt?: unknown;
};

/*
 * ============================================================
 * CREATE
 * ============================================================
 */

export type CreateHallOfFameItemInput = {
  seasonId: string;

  competitionId: string;

  seasonLabel: string;

  /*
   * Obbligatoria anche in creazione.
   */
  section:
    HallOfFameSection;

  category: string;

  awardDescription?: string;

  winnerType:
    HallOfFameWinnerType;

  winnerName: string;

  playerId?: string;

  teamId?: string;

  imageUrl?: string;

  imageKey?: string;

  videoUrl?: string;

  videoKey?: string;

  description?: string;

  sortOrder: number;

  status:
    HallOfFameStatus;
};

/*
 * ============================================================
 * UPDATE
 * ============================================================
 */

export type UpdateHallOfFameItemInput =
  CreateHallOfFameItemInput & {
    itemId: string;
  };