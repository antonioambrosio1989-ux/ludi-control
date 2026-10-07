import type {
  MatchStatus,
} from "@/src/types/MatchStatus";

export type FinalStageMatchStatus =
  MatchStatus;

export type FinalStageCompetition =
  | "championsLeague"
  | "europaLeague"
  | "conferenceLeague"
  | "ludiFootballLeagueCup";

export type FinalStageRound =
  | "play-off"
  | "group"
  | "quarterfinal"
  | "semifinal"
  | "final";

export type FinalStageLeg =
  | "first"
  | "second"
  | "single";

export type FinalStageMatch = {
  id: string;

  seasonId: string;

  competition:
    FinalStageCompetition;

  round:
    FinalStageRound;

  /*
   * Utile soprattutto per:
   *
   * - gironi Europa / Conference
   * - eventuali gruppi futuri
   */
  group?: string;

  /*
   * Gara di andata, ritorno
   * oppure partita secca.
   */
  leg:
    FinalStageLeg;

  /*
   * Numero progressivo utile
   * all'interno dello stesso turno.
   *
   * Esempio:
   * QF1, QF2, SF1...
   */
  matchOrder?: number;

  /*
   * Settimana pubblica stabile delle Final Stage.
   *
   * È indipendente dalla data della partita:
   * spostare una gara non deve cambiare /fs1, /fs2, ...
   *
   * Optional sul modello letto da Firestore per compatibilità
   * con i documenti legacy creati prima di questo campo.
   */
  finalStageWeek?: number;

  homeTeamId: string;
  awayTeamId: string;

  date: string;
  time: string;

  venue: string;

  status:
    FinalStageMatchStatus;

  published: boolean;

  homeScore?:
  number;

awayScore?:
  number;

/*
 * ============================================================
 * TEMPI SUPPLEMENTARI
 * ============================================================
 *
 * Indica se la partita è proseguita oltre
 * i tempi regolamentari.
 *
 * Utilizzato principalmente per le finali
 * disputate in gara secca.
 * ============================================================
 */

extraTimePlayed?:
  boolean;

homePenalties?:
  number;

awayPenalties?:
  number;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type CreateFinalStageMatchInput = {
  seasonId: string;

  competition:
    FinalStageCompetition;

  round:
    FinalStageRound;

  group?: string;

  leg:
    FinalStageLeg;

  matchOrder?: number;

  finalStageWeek: number;

  homeTeamId: string;
  awayTeamId: string;

  date: string;
  time: string;

  venue: string;
};

export type UpdateFinalStageMatchInput = {
  matchId: string;

  competition:
    FinalStageCompetition;

  round:
    FinalStageRound;

  group?: string;

  leg:
    FinalStageLeg;

  matchOrder?: number;

  finalStageWeek: number;

  homeTeamId: string;
  awayTeamId: string;

  date: string;
  time: string;

  venue: string;

  status:
    FinalStageMatchStatus;

  published: boolean;

  homeScore?: number;
  awayScore?: number;

  homePenalties?: number;
  awayPenalties?: number;
};