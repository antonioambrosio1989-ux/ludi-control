import type {
  MatchStatus,
} from "@/src/types/MatchStatus";

/*
 * ============================================================
 * TIPO GOL MATCH WIZARD
 * ============================================================
 */

export type MatchWizardGoalType =
  | "action"
  | "penalty"
  | "freeKick"
  | "freeShot"
  | "ownGoal";

/*
 * ============================================================
 * GOL MATCH WIZARD
 * ============================================================
 */

export type MatchWizardGoal = {
  id: string;

  scorerPlayerId:
    | string
    | number;

  teamId:
    | string
    | number;

  minute: number;

  stoppageTime?: number;

  type:
    MatchWizardGoalType;

  assistPlayerId?:
    | string
    | number;
};

/*
 * ============================================================
 * PERFORMANCE GIOCATORE
 * ============================================================
 */

export type MatchWizardPlayerPerformance = {
  playerId: string;

  teamId:
    | string
    | number;

  status:
    | "rated"
    | "sv";

  vote?: number;

  goals: number;
  assists: number;

  yellowCards: number;
  redCards: number;

  /*
   * Rosso diretto.
   *
   * Separato dal conteggio complessivo
   * dei cartellini rossi per mantenere
   * compatibilità con la gestione disciplinare.
   */
  directRedCards?: number;

  /*
   * Utilizzato principalmente
   * per i portieri.
   */
  goalsConceded?: number;
};

/*
 * ============================================================
 * DATI MATCH WIZARD
 * ============================================================
 */

export type MatchWizardData = {
  matchId: string;

  status:
    MatchStatus;

  homeScore: number;
  awayScore: number;

  /*
 * ============================================================
 * TEMPI SUPPLEMENTARI
 * ============================================================
 *
 * true:
 * la partita è proseguita ai tempi supplementari.
 *
 * Il punteggio homeScore / awayScore continua a rappresentare
 * il risultato finale dopo il tempo di gioco, quindi include
 * anche gli eventuali gol segnati nei supplementari.
 *
 * I calci di rigore restano separati.
 * ============================================================
 */

extraTimePlayed?:
  boolean;
  
  /*
 * ==========================================================
 * RIGORI
 * ==========================================================
 *
 * Utilizzati quando una partita a eliminazione/spareggio
 * termina in parità nei tempi regolamentari.
 *
 * Non rappresentano gol individuali e non vengono sommati
 * alle statistiche dei giocatori.
 * ==========================================================
 */

homePenalties?: number;
awayPenalties?: number;

  /*
   * Presente solamente quando
   * status === "walkover".
   */
  
  walkoverWinnerTeamId?:
    | string
    | number;

  homePresentPlayerIds:
    string[];

  awayPresentPlayerIds:
    string[];

  performances:
    Record<
      string,
      MatchWizardPlayerPerformance
    >;

  goals:
    MatchWizardGoal[];

  mvpPlayerId?: string;

  mvpPhotoUrl?: string;
};