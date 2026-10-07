import type {
  FinalStageCompetition,
  FinalStageMatch,
} from "@/src/types/FinalStageMatch";

import {
  resolveFinalStageQualification,
} from "@/src/services/final-stage/FinalStageQualificationResolver";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

export type FinalStageClosureWinner = {
  competition:
    FinalStageCompetition;

  finalMatchId:
    string;

  winnerTeamId:
    string;

  loserTeamId:
    string;
};

export type FinalStageClosureValidationResult = {
  winners:
    FinalStageClosureWinner[];
};

/*
 * ============================================================
 * VALIDATOR
 * ============================================================
 */

export function validateFinalStageClosure({
  matches,
  requiredCompetitions,
}: {
  matches:
    FinalStageMatch[];

  requiredCompetitions:
    FinalStageCompetition[];
}): FinalStageClosureValidationResult {
  if (
    requiredCompetitions.length ===
    0
  ) {
    throw new Error(
      "Nessuna competizione delle fasi finali risulta attiva.",
    );
  }

  /*
   * ==========================================================
   * COMPETIZIONI UNICHE
   * ==========================================================
   */

  const uniqueCompetitions =
    new Set(
      requiredCompetitions,
    );

  if (
    uniqueCompetitions.size !==
    requiredCompetitions.length
  ) {
    throw new Error(
      "La configurazione delle fasi finali contiene competizioni duplicate.",
    );
  }

  /*
 * ============================================================
 * COMPETIZIONI NON PREVISTE
 * ============================================================
 *
 * Non possiamo chiudere una Final Stage se esistono
 * partite attive appartenenti a competizioni che non
 * dovrebbero far parte della stagione corrente.
 *
 * Le vecchie partite cancellate vengono ignorate.
 * ============================================================
 */

const unexpectedMatches =
  matches.filter(
    (
      match,
    ) =>
      match.status !==
        "cancelled" &&
      !uniqueCompetitions.has(
        match.competition,
      ),
  );

if (
  unexpectedMatches.length >
  0
) {
  throw new Error(
    `Sono presenti ${unexpectedMatches.length} partite appartenenti a competizioni non previste per questa Final Stage.`,
  );
}

  const winners:
    FinalStageClosureWinner[] =
      [];

  /*
   * ==========================================================
   * VALIDAZIONE DI OGNI COMPETIZIONE ATTIVA
   * ==========================================================
   */

  for (
    const competition of
      requiredCompetitions
  ) {
    const competitionMatches =
      matches.filter(
        (
          match,
        ) =>
          match.competition ===
          competition,
      );

    if (
      competitionMatches.length ===
      0
    ) {
      throw new Error(
        `Non sono presenti partite per ${getCompetitionLabel(
          competition,
        )}.`,
      );
    }

    /*
     * ========================================================
     * PARTITE NON CONCLUSE
     * ========================================================
     *
     * Le partite cancellate possono rimanere nello storico.
     *
     * Tutte le altre devono invece essere:
     *
     * - played / finished / walkover
     * - published = true
     * ========================================================
     */

    const incompleteMatches =
      competitionMatches.filter(
        (
          match,
        ) => {
          if (
            match.status ===
            "cancelled"
          ) {
            return false;
          }

          const completed =
            match.status ===
              "played" ||
            match.status ===
              "finished" ||
            match.status ===
              "walkover";

          return (
            !completed ||
            match.published !==
              true
          );
        },
      );

    if (
      incompleteMatches.length >
      0
    ) {
      throw new Error(
        `${getCompetitionLabel(
          competition,
        )} contiene ${incompleteMatches.length} partite non ancora concluse e pubblicate.`,
      );
    }

    /*
     * ========================================================
     * FINALE
     * ========================================================
     */

    const finals =
      competitionMatches.filter(
        (
          match,
        ) =>
          match.round ===
            "final" &&
          match.status !==
            "cancelled",
      );

    if (
      finals.length ===
      0
    ) {
      throw new Error(
        `La finale di ${getCompetitionLabel(
          competition,
        )} non è stata trovata.`,
      );
    }

    if (
      finals.length >
      1
    ) {
      throw new Error(
        `${getCompetitionLabel(
          competition,
        )} contiene più di una finale valida.`,
      );
    }

    const finalMatch =
      finals[0];

    if (
      finalMatch.leg !==
      "single"
    ) {
      throw new Error(
        `La finale di ${getCompetitionLabel(
          competition,
        )} deve essere disputata in gara secca.`,
      );
    }

    if (
      finalMatch.published !==
      true
    ) {
      throw new Error(
        `Il tabellino della finale di ${getCompetitionLabel(
          competition,
        )} non è stato pubblicato.`,
      );
    }

    /*
     * ========================================================
     * VINCITORE
     * ========================================================
     */

    const qualification =
      resolveFinalStageQualification({
        match:
          finalMatch,

        allMatches:
          competitionMatches,
      });

    if (
      qualification.status !==
      "qualified"
    ) {
      throw new Error(
        `La finale di ${getCompetitionLabel(
          competition,
        )} non determina ancora una squadra vincitrice.`,
      );
    }

    winners.push({
      competition,

      finalMatchId:
        String(
          finalMatch.id,
        ),

      winnerTeamId:
        String(
          qualification.winnerTeamId,
        ),

      loserTeamId:
        String(
          qualification.loserTeamId,
        ),
    });
  }

  return {
    winners,
  };
}

/*
 * ============================================================
 * LABEL
 * ============================================================
 */

export function getFinalStageClosureCompetitionLabel(
  competition:
    FinalStageCompetition,
): string {
  return getCompetitionLabel(
    competition,
  );
}

function getCompetitionLabel(
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

    default:
      return competition;
  }
}