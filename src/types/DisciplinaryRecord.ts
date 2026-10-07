export type SuspensionReason =
  | "directRed"
  | "yellowAccumulation"
  | "sportsJudge";

export type SuspensionStatus =
  | "active"
  | "completed"
  | "cancelled";

export type DisciplinarySuspension = {
  id: string;

  seasonId: string;

  playerId: string;
  playerName: string;

  teamId: string;
  teamName: string;

  reason: SuspensionReason;

  sourceMatchId?: string;
  /*
 * Presente per Regular Season e titlePlayoff.
 *
 * Le partite delle fasi finali non sono
 * organizzate per Matchweek.
 */

  sourceMatchweek?: number;

/*
 * ID delle singole partite nelle quali
 * la squalifica è stata effettivamente
 * scontata.
 *
 * È il riferimento principale per le
 * fasi finali e rende idempotente lo
 * sconto per singola partita.
 */
servedMatchIds?: string[];

  /*
 * Utilizzati per i provvedimenti
 * manuali del giudice sportivo.
 */
sourceCommunicationId?: string;

sourceCommunicationSanctionId?: string;

  totalMatches: number;
  servedMatches: number;
  remainingMatches: number;
  /*
 * Matchweek nelle quali la squalifica
 * è già stata effettivamente scontata.
 *
 * Serve a impedire che la rigenerazione
 * dello stesso comunicato sottragga
 * più volte la stessa giornata.
 */
  servedMatchweeks?: number[];
  note?: string;

  status: SuspensionStatus;

  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
};

export type PlayerDisciplinaryRecord = {
  id: string;

  seasonId: string;

  playerId: string;
  playerName: string;

  teamId: string;
  teamName: string;

  /*
   * Totale dei cartellini gialli
   * ricevuti nell’intera stagione.
   */
  seasonYellowCards: number;

  /*
   * Cartellini validi per il ciclo
   * disciplinare corrente.
   *
   * Questo valore torna a zero dopo
   * che la squalifica per somma di
   * ammonizioni è stata scontata.
   */
  currentYellowCycle: number;

  directRedCards: number;

  activeSuspensionIds: string[];

  /*
 * Match Report disciplinari già elaborati.
 *
 * Serve a rendere idempotente il processamento
 * per singola partita e non soltanto per Matchweek.
 */
processedSourceMatchIds?: string[];

  lastProcessedMatchweek?: number;

  createdAt?: string;
  updatedAt?: string;
};