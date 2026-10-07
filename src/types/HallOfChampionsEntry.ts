/*
 * ============================================================
 * MARCATORI FINALE - VERSIONE SINTETICA
 * ============================================================
 */

export type HallOfChampionsGoal = {
  id: string;

  minute: number;
  stoppageTime?: number;

  scorerName: string;

  /*
   * Indica la squadra del GIOCATORE che ha realizzato
   * l'evento.
   *
   * ATTENZIONE:
   * in caso di autorete il giocatore appartiene a questa
   * squadra, ma il gol viene assegnato all'avversaria.
   */
  team:
    | "champion"
    | "runnerUp";

  /*
   * true = autorete.
   *
   * Esempio:
   * 4' aut. Prisco
   */
  isOwnGoal?: boolean;
};

/*
 * ============================================================
 * ROSA CAMPIONE
 * ============================================================
 */

export type HallOfChampionsPlayer = {
  playerId?: string;

  firstName: string;
  lastName: string;

  role?: string;

  shirtNumber?: number;

  appearances: number;

  averageVote?: number;

  goals: number;

  assists?: number;

  ownGoals?: number;

  yellowCards?: number;

  redCards?: number;
};

/*
 * ============================================================
 * MINUTI GOL TABELLINO FINALE
 * ============================================================
 */

export type HallOfChampionsFinalGoalMinute = {
  minute: number;

  stoppageTime?: number;
};

/*
 * ============================================================
 * RIGORI TABELLINO FINALE
 * ============================================================
 */

export type HallOfChampionsFinalPenaltyKickResult =
  | "scored"
  | "missed";

export type HallOfChampionsFinalPenaltyKick = {
  order: number;

  playerSeasonCode: string;

  result:
    HallOfChampionsFinalPenaltyKickResult;
};

/*
 * ============================================================
 * GIOCATORE TABELLINO FINALE
 * ============================================================
 */

export type HallOfChampionsFinalPlayer = {
  playerId?: string;

  playerSeasonCode: string;

  firstName: string;
  lastName: string;

  role?: string;

  shirtNumber?: number;

  vote?: number;

  withoutVote: boolean;

  /*
   * Gol segnati alla squadra avversaria.
   */
  goals: number;

  assists: number;

  /*
   * Numero di autoreti realizzate dal giocatore.
   */
  ownGoals: number;

  yellowCards: number;
  redCards: number;

  goalsConceded?: number;

  mvp: boolean;

  /*
   * Minuti dei gol normali.
   */
  goalMinutes:
    HallOfChampionsFinalGoalMinute[];

  /*
   * Minuti delle autoreti.
   *
   * Esempio:
   * Prisco -> [{ minute: 4 }]
   *
   * In questo modo l'Albo può mostrare:
   * 4' aut. Prisco
   *
   * nella colonna della squadra avversaria.
   */
  ownGoalMinutes?:
    HallOfChampionsFinalGoalMinute[];
};

/*
 * ============================================================
 * TABELLINO COMPLETO DELLA FINALE
 * ============================================================
 */

export type HallOfChampionsFinalReport = {
  /*
   * Ordine originale del tabellino.
   *
   * CASA SEMPRE A SINISTRA
   * OSPITE SEMPRE A DESTRA
   */

  homeTeamCode: string;
  homeTeamName: string;

  awayTeamCode: string;
  awayTeamName: string;

  homeTeamAliasName?: string;
  awayTeamAliasName?: string;

  /*
   * Risultato visualizzato della partita.
   *
   * Se sono stati disputati i supplementari contiene
   * il risultato complessivo dopo DTS.
   * Altrimenti coincide con il risultato al 90'.
   */
  homeScore: number;
  awayScore: number;

  /*
   * Risultato al termine dei tempi regolamentari.
   *
   * Viene mantenuto separato per poter distinguere
   * una finale conclusa nei 90' da una conclusa ai DTS.
   */
  homeRegulationScore?: number;
  awayRegulationScore?: number;

  /*
   * true quando la finale ha previsto i supplementari.
   *
   * È necessario perché una partita può restare in parità
   * anche dopo i DTS e venire poi decisa ai rigori.
   */
  wentToExtraTime?: boolean;

  /*
   * Eventuale risultato ai rigori.
   */
  homePenalties?: number;
  awayPenalties?: number;

  /*
   * Sequenza dei rigori nell'ordine di tiro.
   *
   * I vecchi archivi possono non avere questi campi.
   */
  homePenaltyKicks?:
    HallOfChampionsFinalPenaltyKick[];

  awayPenaltyKicks?:
    HallOfChampionsFinalPenaltyKick[];

  homePlayers:
    HallOfChampionsFinalPlayer[];

  awayPlayers:
    HallOfChampionsFinalPlayer[];
};

/*
 * ============================================================
 * ALBO D'ORO
 * ============================================================
 */

export type HallOfChampionsEntry = {
  id: string;

  seasonId?: string;
  seasonName: string;
  competitionId?: string;
  competitionName: string;

  /*
   * ==========================================================
   * CAMPIONE
   * ==========================================================
   */

  championTeamId?: string;
  championTeamName: string;

  /*
   * ==========================================================
   * FINALISTA
   * ==========================================================
   */

  runnerUpTeamId?: string;
  runnerUpTeamName: string;

  /*
   * ==========================================================
   * RISULTATO DAL PUNTO DI VISTA CAMPIONE / FINALISTA
   * ==========================================================
   *
   * Questi valori restano utili per archivio e statistiche.
   *
   * La pagina grafica della finale utilizza invece
   * finalReport.homeScore / awayScore.
   */

  championScore: number;
  runnerUpScore: number;

  championPenalties?: number;
  runnerUpPenalties?: number;

  /*
   * ==========================================================
   * MARCATORI SINTETICI
   * ==========================================================
   */

  finalGoals:
    HallOfChampionsGoal[];

  /*
   * ==========================================================
   * TABELLINO COMPLETO
   * ==========================================================
   *
   * Fonte principale per:
   *
   * - ordine casa / ospite
   * - risultato
   * - codici squadra
   * - marcatori
   * - autoreti
   */

  finalReport?:
    HallOfChampionsFinalReport;

  finalMvpPhotoUrl?: string;
  finalMvpPhotoKey?: string;

  /*
   * ==========================================================
   * FOTO VINCITORI
   * ==========================================================
   */

  winnerPhotoUrl?: string;
  winnerPhotoKey?: string;

  /*
   * ==========================================================
   * ROSA CAMPIONE
   * ==========================================================
   */

  roster:
    HallOfChampionsPlayer[];

  createdAt?: unknown;
  updatedAt?: unknown;
};

/*
 * ============================================================
 * CREATE
 * ============================================================
 */

export type CreateHallOfChampionsEntryInput = {
  seasonId?: string;
  seasonName: string;
  competitionId?: string;
  competitionName: string;

  championTeamId?: string;
  championTeamName: string;

  runnerUpTeamId?: string;
  runnerUpTeamName: string;

  championScore: number;
  runnerUpScore: number;

  championPenalties?: number;
  runnerUpPenalties?: number;

  finalMvpPhotoUrl?: string;
  finalMvpPhotoKey?: string;

  finalGoals:
    HallOfChampionsGoal[];

  finalReport?:
    HallOfChampionsFinalReport;

  winnerPhotoUrl?: string;
  winnerPhotoKey?: string;

  roster:
    HallOfChampionsPlayer[];
};

/*
 * ============================================================
 * UPDATE
 * ============================================================
 */

export type UpdateHallOfChampionsEntryInput =
  CreateHallOfChampionsEntryInput & {
    entryId: string;
  };