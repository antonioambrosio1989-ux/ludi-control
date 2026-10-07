import {
  FirebaseMatchRepository,
} from "@/src/services/match/FirebaseMatchRepository";

import {
  SeasonClosureService,
} from "@/src/services/season/SeasonClosureService";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

export type CreateTitlePlayoffInput = {
  seasonId:
    string;

  homeTeamId:
    string;

  awayTeamId:
    string;

  date:
    string;

  time:
    string;

  venue?:
    string;
};

export type CreateTitlePlayoffResult = {
  matchId:
    string;

  seasonId:
    string;

  matchweek:
    number;

  homeTeamId:
    string;

  awayTeamId:
    string;

  date:
    string;

  time:
    string;

  venue:
    string;
};

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

export class TitlePlayoffCreationService {
  static async create({
    seasonId,
    homeTeamId,
    awayTeamId,
    date,
    time,
    venue,
  }: CreateTitlePlayoffInput): Promise<
    CreateTitlePlayoffResult
  > {
    /*
     * ========================================================
     * NORMALIZZAZIONE
     * ========================================================
     */

    const normalizedSeasonId =
      seasonId.trim();

    const normalizedHomeTeamId =
      homeTeamId.trim();

    const normalizedAwayTeamId =
      awayTeamId.trim();

    const normalizedDate =
      date.trim();

    const normalizedTime =
      time.trim();

    const normalizedVenue =
      venue?.trim() ||
      "Centro Sportivo Ludi";

    if (
      !normalizedSeasonId
    ) {
      throw new Error(
        "seasonId non valido.",
      );
    }

    if (
      !normalizedHomeTeamId ||
      !normalizedAwayTeamId
    ) {
      throw new Error(
        "Devi indicare entrambe le squadre dello spareggio.",
      );
    }

    if (
      normalizedHomeTeamId ===
      normalizedAwayTeamId
    ) {
      throw new Error(
        "Una squadra non può giocare contro sé stessa.",
      );
    }

    if (
      !normalizedDate
    ) {
      throw new Error(
        "Devi indicare la data dello spareggio.",
      );
    }

    if (
      !normalizedTime
    ) {
      throw new Error(
        "Devi indicare l'orario dello spareggio.",
      );
    }

    /*
     * ========================================================
     * PREPARAZIONE CHIUSURA
     * ========================================================
     *
     * Questa è la fonte di verità per determinare
     * quali squadre abbiano realmente diritto
     * allo spareggio.
     * ========================================================
     */

    const preparation =
      await SeasonClosureService
        .prepareRegularSeasonClosure(
          normalizedSeasonId,
        );

    /*
     * Nessuno spareggio necessario.
     */

    if (
      preparation.status ===
      "readyToClose"
    ) {
      throw new Error(
        "La classifica non richiede uno spareggio per il titolo.",
      );
    }

    /*
     * Spareggio già esistente.
     */

    if (
      preparation.status ===
      "titlePlayoffExists"
    ) {
      throw new Error(
        "Lo spareggio per il titolo è già stato creato.",
      );
    }

    /*
     * ========================================================
     * VALIDAZIONE SQUADRE
     * ========================================================
     */

    const candidateTeamIds =
      preparation
        .candidateTeamIds;

    const expectedTeams =
      new Set(
        candidateTeamIds.map(
          (
            teamId,
          ) =>
            String(
              teamId,
            ),
        ),
      );

    const selectedTeams =
      new Set([
        normalizedHomeTeamId,
        normalizedAwayTeamId,
      ]);

    const validTeams =
      expectedTeams.size ===
        2 &&
      selectedTeams.size ===
        2 &&
      Array.from(
        expectedTeams,
      ).every(
        (
          teamId,
        ) =>
          selectedTeams.has(
            teamId,
          ),
      );

    if (
      !validTeams
    ) {
      throw new Error(
        "Le squadre selezionate non coincidono con le due squadre aventi diritto allo spareggio per il titolo.",
      );
    }

    /*
     * ========================================================
     * VERIFICA FINALE PARTITE
     * ========================================================
     *
     * Ricarichiamo le partite immediatamente prima
     * della creazione.
     *
     * Se esiste già QUALSIASI titlePlayoff,
     * anche con squadre errate, non ne creiamo
     * automaticamente un secondo.
     * ========================================================
     */

    const matches =
      await FirebaseMatchRepository
        .getBySeason(
          normalizedSeasonId,
        );

    const existingTitlePlayoffs =
      matches.filter(
        (
          match,
        ) =>
          match.matchType ===
          "titlePlayoff",
      );

    if (
      existingTitlePlayoffs.length >
      0
    ) {
      throw new Error(
        "È già presente uno spareggio per il titolo nella stagione. Verifica la partita esistente prima di crearne una nuova.",
      );
    }

    /*
     * ========================================================
     * MATCHWEEK
     * ========================================================
     *
     * Lo spareggio viene collocato nella prima
     * matchweek successiva alla Regular Season.
     *
     * Questo mantiene coerente anche la gestione
     * disciplinare delle squalifiche.
     * ========================================================
     */

    const regularSeasonMatches =
      matches.filter(
        (
          match,
        ) =>
          (
            match.matchType ??
            "regularSeason"
          ) ===
          "regularSeason",
      );

    const latestMatchweek =
      regularSeasonMatches.reduce(
        (
          maximum,
          match,
        ) =>
          Math.max(
            maximum,
            match.matchweek,
          ),
        0,
      );

    if (
      latestMatchweek <
      1
    ) {
      throw new Error(
        "Non è possibile determinare la matchweek dello spareggio.",
      );
    }

    const playoffMatchweek =
      latestMatchweek +
      1;

    /*
     * ========================================================
     * CREAZIONE
     * ========================================================
     */

    const matchId =
      await FirebaseMatchRepository
        .create({
          seasonId:
            normalizedSeasonId,

          matchType:
            "titlePlayoff",

          matchweek:
            playoffMatchweek,

          matchweekId:
            `mw${playoffMatchweek}`,

          homeTeamId:
            normalizedHomeTeamId,

          awayTeamId:
            normalizedAwayTeamId,

          date:
            normalizedDate,

          time:
            normalizedTime,

          venue:
            normalizedVenue,
        });

    /*
     * ========================================================
     * RESULT
     * ========================================================
     */

    return {
      matchId,

      seasonId:
        normalizedSeasonId,

      matchweek:
        playoffMatchweek,

      homeTeamId:
        normalizedHomeTeamId,

      awayTeamId:
        normalizedAwayTeamId,

      date:
        normalizedDate,

      time:
        normalizedTime,

      venue:
        normalizedVenue,
    };
  }
}