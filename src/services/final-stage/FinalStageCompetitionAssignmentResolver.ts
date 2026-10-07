import type {
  FinalStageCompetition,
} from "@/src/types/FinalStageMatch";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

export type RegularSeasonCompetitionId =
  | "premier-league"
  | "championship"
  | "league-one";

export type FinalStageCompetitionAssignment = {
  competition:
    FinalStageCompetition;

  label:
    string;

  sourceCompetitionId:
    RegularSeasonCompetitionId;

  recycledName:
    boolean;
};

/*
 * ============================================================
 * CONFIG
 * ============================================================
 */

export const CHAMPIONSHIP_FULL_TEAM_COUNT =
  16;

/*
 * ============================================================
 * LABEL
 * ============================================================
 */

export function getFinalStageCompetitionLabel(
  competition:
    FinalStageCompetition,
): string {
  switch (
    competition
  ) {
    case "championsLeague":
      return "Champions League";

    case "europaLeague":
      return "Europa League";

    case "conferenceLeague":
      return "Conference League";

    case "ludiFootballLeagueCup":
      return "Ludi Football League Cup";
  }
}

/*
 * ============================================================
 * CHAMPIONSHIP FORMAT
 * ============================================================
 */

export function hasChampionshipConferenceLeague(
  championshipTeamCount:
    number,
): boolean {
  if (
    !Number.isInteger(
      championshipTeamCount,
    ) ||
    championshipTeamCount <
      0
  ) {
    throw new Error(
      "Il numero di squadre della Championship non è valido.",
    );
  }

  return (
    championshipTeamCount >=
    CHAMPIONSHIP_FULL_TEAM_COUNT
  );
}

/*
 * ============================================================
 * ASSIGNMENT RESOLVER
 * ============================================================
 */

export function resolveFinalStageCompetitions({
  regularSeasonCompetitionId,
  championshipTeamCount,
}: {
  regularSeasonCompetitionId:
    RegularSeasonCompetitionId;

  championshipTeamCount:
    number;
}): FinalStageCompetitionAssignment[] {
  const championshipConferenceEnabled =
    hasChampionshipConferenceLeague(
      championshipTeamCount,
    );

  /*
   * ==========================================================
   * PREMIER LEAGUE
   * ==========================================================
   */

  if (
    regularSeasonCompetitionId ===
    "premier-league"
  ) {
    return [
      {
        competition:
          "championsLeague",

        label:
          "Champions League",

        sourceCompetitionId:
          "premier-league",

        recycledName:
          false,
      },
    ];
  }

  /*
   * ==========================================================
   * CHAMPIONSHIP
   * ==========================================================
   */

  if (
    regularSeasonCompetitionId ===
    "championship"
  ) {
    const assignments:
      FinalStageCompetitionAssignment[] = [
        {
          competition:
            "europaLeague",

          label:
            "Europa League",

          sourceCompetitionId:
            "championship",

          recycledName:
            false,
        },
      ];

    /*
     * Conference League Championship:
     * attiva soltanto con almeno 16 squadre.
     */
    if (
      championshipConferenceEnabled
    ) {
      assignments.push({
        competition:
          "conferenceLeague",

        label:
          "Conference League",

        sourceCompetitionId:
          "championship",

        recycledName:
          false,
      });
    }

    return assignments;
  }

  /*
   * ==========================================================
   * LEAGUE ONE
   * ==========================================================
   *
   * Se la Championship dispone della propria
   * Conference League:
   *
   * League One -> Ludi Football League Cup
   *
   * Se la Championship non raggiunge 16 squadre:
   *
   * League One -> Conference League
   *
   * In questo secondo caso viene riciclato
   * esclusivamente il nome della competizione.
   * ==========================================================
   */

  if (
    championshipConferenceEnabled
  ) {
    return [
      {
        competition:
          "ludiFootballLeagueCup",

        label:
          "Ludi Football League Cup",

        sourceCompetitionId:
          "league-one",

        recycledName:
          false,
      },
    ];
  }

  return [
    {
      competition:
        "conferenceLeague",

      label:
        "Conference League",

      sourceCompetitionId:
        "league-one",

      recycledName:
        true,
    },
  ];
}

/*
 * ============================================================
 * ENABLED CHECK
 * ============================================================
 */

export function isFinalStageCompetitionEnabled({
  regularSeasonCompetitionId,
  finalStageCompetition,
  championshipTeamCount,
}: {
  regularSeasonCompetitionId:
    RegularSeasonCompetitionId;

  finalStageCompetition:
    FinalStageCompetition;

  championshipTeamCount:
    number;
}): boolean {
  return resolveFinalStageCompetitions({
    regularSeasonCompetitionId,
    championshipTeamCount,
  }).some(
    (
      assignment,
    ) =>
      assignment.competition ===
      finalStageCompetition,
  );
}