/*
 * ============================================================
 * DATI STAGIONE
 * ============================================================
 */

export type HistoricalSeasonData = {
  seasonCode: string;
  seasonName: string;
  competitionName: string;

  startYear: number;
  endYear: number;

  status: string;

  finalCompetitionName?: string;
};

/*
 * ============================================================
 * SQUADRE
 * ============================================================
 */

export type HistoricalTeamData = {
  teamCode: string;

  name: string;
  aliasName?: string;

  logoUrl?: string;

  colors?: string;

  president?: string;
  captain?: string;
};

/*
 * ============================================================
 * REGULAR SEASON
 * ============================================================
 */

export type HistoricalRegularSeasonPlayer = {
  playerSeasonCode: string;

  teamCode: string;

  firstName: string;
  lastName: string;

  birthYear?: number;

  role?: string;

  shirtNumber?: number;

  transferOrder: number;

  startDate?: string;
  endDate?: string;

  appearances: number;

  ratedMatches: number;
  withoutVote: number;

  averageVote?: number;

  goals: number;
  assists: number;

  goalsConceded: number;
  cleanSheets: number;

  yellowCards: number;
  redCards: number;

  ownGoals: number;

  mvps: number;

  status?: string;
};

/*
 * ============================================================
 * CLASSIFICA FINALE
 * ============================================================
 */

export type HistoricalStanding = {
  position: number;

  teamCode: string;

  played: number;
  won: number;
  drawn: number;
  lost: number;

  goalsFor: number;
  goalsAgainst: number;

  goalDifference: number;

  points: number;

  checkMatches?: number;
  checkGoalDifference?: number;
};

/*
 * ============================================================
 * CALENDARIO CHAMPIONS
 * ============================================================
 */

export type HistoricalChampionsMatch = {
  matchCode: string;

  round: string;

  leg?: string;

  date?: string;
  time?: string;

  homeTeamCode: string;
  awayTeamCode: string;

  status?: string;

  /* Risultato al 90'. */
  homeScore?: number;
  awayScore?: number;

  /* Risultato complessivo dopo i supplementari, se disputati. */
  homeExtraTimeScore?: number;
  awayExtraTimeScore?: number;

  /* Esito della serie di rigori, esclusi dal punteggio partita. */
  homePenalties?: number;
  awayPenalties?: number;

  venue?: string;

  notes?: string;
};

/*
 * ============================================================
 * STATISTICHE CHAMPIONS
 *
 * I valori comprendono l'intera fase finale,
 * finale compresa.
 * ============================================================
 */

export type HistoricalChampionsPlayerStats = {
  playerSeasonCode: string;

  teamCode: string;

  firstName: string;
  lastName: string;

  birthYear?: number;

  role?: string;

  shirtNumber?: number;

  appearances: number;

  ratedMatches?: number;
  withoutVote?: number;

  averageVote?: number;

  goals: number;
  assists: number;

  ownGoals: number;

  yellowCards: number;
  redCards: number;

  goalsConceded?: number;
  cleanSheets?: number;

  mvps: number;
};

/*
 * ============================================================
 * TABELLINO FINALE
 * ============================================================
 */

export type HistoricalFinalReportGoalMinute = {
  minute: number;

  stoppageTime?: number;
};

export type HistoricalFinalPenaltyKickResult =
  | "scored"
  | "missed";

export type HistoricalFinalPenaltyKick = {
  order: number;

  playerSeasonCode: string;

  result:
    HistoricalFinalPenaltyKickResult;
};

export type HistoricalFinalReportPlayer = {
  playerSeasonCode: string;

  role?: string;

  shirtNumber?: number;

  vote?: number;

  withoutVote: boolean;

  goals: number;
  assists: number;

  ownGoals: number;

  yellowCards: number;
  redCards: number;

  goalsConceded?: number;

  mvp: boolean;

  goalMinutes:
    HistoricalFinalReportGoalMinute[];

  ownGoalMinutes:
    HistoricalFinalReportGoalMinute[];
};

export type HistoricalChampionsFinalReport = {
  homeTeamCode: string;
  awayTeamCode: string;

  /* Risultato al 90'. */
  homeScore: number;
  awayScore: number;

  /* Totale dopo DTS. Assenti se i supplementari non sono stati disputati. */
  homeExtraTimeScore?: number;
  awayExtraTimeScore?: number;

  /* Totale della serie di rigori. */
  homePenalties?: number;
  awayPenalties?: number;

  /* Sequenza dei tiri di rigore nell'ordine di esecuzione. */
  homePenaltyKicks?:
    HistoricalFinalPenaltyKick[];

  awayPenaltyKicks?:
    HistoricalFinalPenaltyKick[];

  homePlayers:
    HistoricalFinalReportPlayer[];

  awayPlayers:
    HistoricalFinalReportPlayer[];
};

/*
 * ============================================================
 * PREMIAZIONI
 * ============================================================
 */

export type HistoricalAwardSection =
  | "bestOfSeason"
  | "teamOfSeason"
  | "goalAndSave"
  | "otherAwards";

export type HistoricalAward = {
  teamCode?: string;

  firstName: string;
  lastName: string;

  birthYear?: number;

  section:
    HistoricalAwardSection;

  award: string;

  awardDescription?: string;

  awardLabel?: string;

  notes?: string;
};

/*
 * ============================================================
 * ARCHIVIO COMPLETO
 * ============================================================
 */

export type HistoricalSeasonArchiveImport = {
  season:
    HistoricalSeasonData;

  teams:
    HistoricalTeamData[];

  regularSeasonPlayers:
    HistoricalRegularSeasonPlayer[];

  finalStandings:
    HistoricalStanding[];

  championsMatches:
    HistoricalChampionsMatch[];

  championsPlayerStats:
    HistoricalChampionsPlayerStats[];

  championsFinalReport?:
    HistoricalChampionsFinalReport;

  awards:
    HistoricalAward[];
};