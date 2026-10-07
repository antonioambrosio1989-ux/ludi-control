import type {
  FinalStageMatch,
} from "@/src/types/FinalStageMatch";

import type {
  FinalStageQualificationResolution,
} from "./FinalStageQualificationResolver";

/*
 * ============================================================
 * RESULT
 * ============================================================
 */

export type FinalStageBracketAdvancementResolution =
  | {
      status:
        "notApplicable";

      reason:
        "groupStage";
    }
  | {
      status:
        "pending";

      reason:
        "qualificationNotResolved";
    }
  | {
      status:
        "advance";

      winnerTeamId:
        string;

      sourceRound:
        "quarterfinal" |
        "semifinal";

      sourceMatchOrder:
        number;

      targetRound:
        "semifinal" |
        "final";

      targetMatchOrder:
        number;

      targetSlot:
        "home" |
        "away";
    }
  | {
      status:
        "champion";

      championTeamId:
        string;

      decidingMatchId:
        string;
    };

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function assertWinnerBelongsToMatch({
  match,
  winnerTeamId,
}: {
  match:
    FinalStageMatch;

  winnerTeamId:
    string;
}) {
  const normalizedWinnerTeamId =
    String(
      winnerTeamId,
    );

  const isHomeTeam =
    normalizedWinnerTeamId ===
    String(
      match.homeTeamId,
    );

  const isAwayTeam =
    normalizedWinnerTeamId ===
    String(
      match.awayTeamId,
    );

  if (
    !isHomeTeam &&
    !isAwayTeam
  ) {
    throw new Error(
      "La squadra qualificata non appartiene alla partita selezionata.",
    );
  }
}

function requireMatchOrder(
  match:
    FinalStageMatch,
): number {
  if (
    typeof match.matchOrder !==
      "number" ||
    !Number.isInteger(
      match.matchOrder,
    ) ||
    match.matchOrder <
      1
  ) {
    throw new Error(
      "La partita non contiene un ordine valido nel tabellone.",
    );
  }

  return match.matchOrder;
}

/*
 * ============================================================
 * PUBLIC API
 * ============================================================
 */

export function resolveFinalStageBracketAdvancement({
  match,
  qualification,
}: {
  match:
    FinalStageMatch;

  qualification:
    FinalStageQualificationResolution;
}): FinalStageBracketAdvancementResolution {
  /*
   * ==========================================================
   * GIRONE
   * ==========================================================
   *
   * L'avanzamento dai gironi verrà gestito
   * separatamente nel blocco dedicato alle
   * regole delle competizioni.
   * ==========================================================
   */

  if (
    match.round ===
    "group"
  ) {
    return {
      status:
        "notApplicable",

      reason:
        "groupStage",
    };
  }

  /*
   * ==========================================================
   * QUALIFICAZIONE NON ANCORA RISOLTA
   * ==========================================================
   */

  if (
    qualification.status !==
    "qualified"
  ) {
    return {
      status:
        "pending",

      reason:
        "qualificationNotResolved",
    };
  }

  const winnerTeamId =
    String(
      qualification
        .winnerTeamId,
    );

  assertWinnerBelongsToMatch({
    match,
    winnerTeamId,
  });

  /*
   * ==========================================================
   * FINALE
   * ==========================================================
   *
   * Dopo la finale non esiste un turno
   * successivo: la qualificata è la campione.
   * ==========================================================
   */

  if (
    match.round ===
    "final"
  ) {
    return {
      status:
        "champion",

      championTeamId:
        winnerTeamId,

      decidingMatchId:
        String(
          qualification
            .decidingMatchId,
        ),
    };
  }

  /*
   * Per quarti e semifinali matchOrder
   * identifica la posizione nel tabellone.
   */
  const sourceMatchOrder =
    requireMatchOrder(
      match,
    );

  /*
   * ==========================================================
   * QUARTI → SEMIFINALI
   * ==========================================================
   *
   * QF1 ─┐
   *      ├─ SF1
   * QF2 ─┘
   *
   * QF3 ─┐
   *      ├─ SF2
   * QF4 ─┘
   * ==========================================================
   */

  if (
  match.round ===
  "quarterfinal"
) {
  switch (
    sourceMatchOrder
  ) {
    case 1:
      return {
        status:
          "advance",

        winnerTeamId:
          qualification.winnerTeamId,

        sourceRound:
          "quarterfinal",

        sourceMatchOrder:
          1,

        targetRound:
          "semifinal",

        targetMatchOrder:
          1,

        targetSlot:
          "home",
      };

    case 4:
      return {
        status:
          "advance",

        winnerTeamId:
          qualification.winnerTeamId,

        sourceRound:
          "quarterfinal",

        sourceMatchOrder:
          4,

        targetRound:
          "semifinal",

        targetMatchOrder:
          1,

        targetSlot:
          "away",
      };

    case 2:
      return {
        status:
          "advance",

        winnerTeamId:
          qualification.winnerTeamId,

        sourceRound:
          "quarterfinal",

        sourceMatchOrder:
          2,

        targetRound:
          "semifinal",

        targetMatchOrder:
          2,

        targetSlot:
          "home",
      };

    case 3:
      return {
        status:
          "advance",

        winnerTeamId:
          qualification.winnerTeamId,

        sourceRound:
          "quarterfinal",

        sourceMatchOrder:
          3,

        targetRound:
          "semifinal",

        targetMatchOrder:
          2,

        targetSlot:
          "away",
      };
  }
}

  /*
   * ==========================================================
   * SEMIFINALI → FINALE
   * ==========================================================
   *
   * SF1 ─┐
   *      ├─ Finale
   * SF2 ─┘
   * ==========================================================
   */

  if (
    match.round ===
    "semifinal"
  ) {
    if (
      sourceMatchOrder >
      2
    ) {
      throw new Error(
        "Ordine della semifinale non valido: sono ammessi i valori 1 e 2.",
      );
    }

    return {
      status:
        "advance",

      winnerTeamId,

      sourceRound:
        "semifinal",

      sourceMatchOrder,

      targetRound:
        "final",

      targetMatchOrder:
        1,

      targetSlot:
        sourceMatchOrder ===
        1
          ? "home"
          : "away",
    };
  }

  throw new Error(
    "Turno delle fasi finali non supportato.",
  );
}