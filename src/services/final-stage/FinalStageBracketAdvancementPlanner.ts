import type {
  FinalStageMatch,
} from "@/src/types/FinalStageMatch";

import {
  resolveFinalStageQualification,
} from "./FinalStageQualificationResolver";

import {
  resolveFinalStageBracketAdvancement,
} from "./FinalStageBracketAdvancementResolver";

/*
 * ============================================================
 * RESULT
 * ============================================================
 */

export type FinalStageBracketAdvancementPlan =
  | {
      status:
        "notApplicable";

      reason:
        | "groupStage"
        | "final";
    }
  | {
      status:
        "waiting";

      targetRound:
        "semifinal" |
        "final";

      targetMatchOrder:
        number;

      missingSlot:
        "home" |
        "away";
    }
  | {
      status:
        "alreadyExists";

      matchId:
        string;
    }
  | {
      status:
        "ready";

      seasonId:
        string;

      competition:
        FinalStageMatch[
          "competition"
        ];

      targetRound:
        "semifinal" |
        "final";

      targetMatchOrder:
        number;

      homeTeamId:
        string;

      awayTeamId:
        string;
    };

/*
 * ============================================================
 * SOURCE MATCH
 * ============================================================
 */

function isDecidingMatch(
  match:
    FinalStageMatch,
): boolean {
  /*
   * Gara secca:
   * è lei a decidere il confronto.
   */
  if (
    match.leg ===
    "single"
  ) {
    return true;
  }

  /*
   * Andata/ritorno:
   * soltanto il ritorno decide
   * la qualificazione.
   */
  return (
    match.leg ===
    "second"
  );
}

/*
 * ============================================================
 * TARGET GIÀ ESISTENTE
 * ============================================================
 */

function findExistingTargetMatches({
  matches,
  seasonId,
  competition,
  round,
  matchOrder,
}: {
  matches:
    FinalStageMatch[];

  seasonId:
    string;

  competition:
    FinalStageMatch[
      "competition"
    ];

  round:
    "semifinal" |
    "final";

  matchOrder:
    number;
}): FinalStageMatch[] {
  return matches.filter(
    (
      match,
    ) =>
      match.seasonId ===
        seasonId &&
      match.competition ===
        competition &&
      match.round ===
        round &&
      (
        match.matchOrder ??
        null
      ) ===
        matchOrder,
  );
}

function containsExpectedTeams({
  match,
  homeTeamId,
  awayTeamId,
}: {
  match:
    FinalStageMatch;

  homeTeamId:
    string;

  awayTeamId:
    string;
}): boolean {
  const actualTeams =
    new Set([
      String(
        match.homeTeamId,
      ),

      String(
        match.awayTeamId,
      ),
    ]);

  return (
    actualTeams.size ===
      2 &&
    actualTeams.has(
      homeTeamId,
    ) &&
    actualTeams.has(
      awayTeamId,
    )
  );
}

/*
 * ============================================================
 * PUBLIC API
 * ============================================================
 */

export function planFinalStageBracketAdvancement({
  sourceMatch,
  allMatches,
}: {
  sourceMatch:
    FinalStageMatch;

  allMatches:
    FinalStageMatch[];
}): FinalStageBracketAdvancementPlan {
  /*
   * ==========================================================
   * GIRONE
   * ==========================================================
   */

  if (
    sourceMatch.round ===
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
   * FINALE
   * ==========================================================
   */

  if (
    sourceMatch.round ===
    "final"
  ) {
    return {
      status:
        "notApplicable",

      reason:
        "final",
    };
  }

  /*
   * Un'andata da sola non può
   * avanzare il tabellone.
   */
  if (
    !isDecidingMatch(
      sourceMatch,
    )
  ) {
    throw new Error(
      "La partita selezionata non determina ancora una qualificazione.",
    );
  }

  /*
   * ==========================================================
   * QUALIFICAZIONE SOURCE
   * ==========================================================
   */

  const sourceQualification =
    resolveFinalStageQualification({
      match:
        sourceMatch,

      allMatches,
    });

  if (
    sourceQualification
      .status !==
    "qualified"
  ) {
    throw new Error(
      "La partita selezionata non contiene ancora una qualificazione ufficiale.",
    );
  }

  const sourceAdvancement =
    resolveFinalStageBracketAdvancement({
      match:
        sourceMatch,

      qualification:
        sourceQualification,
    });

  if (
    sourceAdvancement
      .status !==
    "advance"
  ) {
    throw new Error(
      "La partita selezionata non produce un avanzamento nel tabellone.",
    );
  }

  const {
    targetRound,
    targetMatchOrder,
  } =
    sourceAdvancement;
  /*
   * ==========================================================
   * CERCHIAMO LE DUE SORGENTI DEL TARGET
   * ==========================================================
   *
   * SF1:
   * QF1 + QF4
   *
   * SF2:
   * QF2 + QF3
   *
   * Finale:
   * SF1 + SF2
   * ==========================================================
   */

  const requiredSourceRound =
    targetRound ===
      "semifinal"
      ? "quarterfinal"
      : "semifinal";

  const requiredSourceOrders =
  targetRound ===
  "semifinal"
    ? targetMatchOrder ===
        1
      ? [
          1,
          4,
        ]
      : [
          2,
          3,
        ]
    : [
        1,
        2,
      ];

  const qualifiedSlots: {
    home?:
      string;

    away?:
      string;
  } = {};

  for (
    const requiredOrder
    of requiredSourceOrders
  ) {
    const decidingMatches =
      allMatches.filter(
        (
          candidate,
        ) =>
          candidate.seasonId ===
            sourceMatch.seasonId &&
          candidate.competition ===
            sourceMatch.competition &&
          candidate.round ===
            requiredSourceRound &&
          (
            candidate.matchOrder ??
            null
          ) ===
            requiredOrder &&
          isDecidingMatch(
            candidate,
          ),
      );

    if (
      decidingMatches.length >
      1
    ) {
      throw new Error(
        "Sono presenti più partite decisive per lo stesso slot del tabellone.",
      );
    }

    const decidingMatch =
      decidingMatches[0];

    if (
      !decidingMatch
    ) {
      continue;
    }

    const qualification =
      resolveFinalStageQualification({
        match:
          decidingMatch,

        allMatches,
      });

    if (
      qualification.status !==
      "qualified"
    ) {
      continue;
    }

    const advancement =
      resolveFinalStageBracketAdvancement({
        match:
          decidingMatch,

        qualification,
      });

    if (
      advancement.status !==
      "advance"
    ) {
      continue;
    }

    if (
      advancement.targetRound !==
        targetRound ||
      advancement.targetMatchOrder !==
        targetMatchOrder
    ) {
      throw new Error(
        "Il tabellone contiene un avanzamento incoerente.",
      );
    }

    qualifiedSlots[
      advancement.targetSlot
    ] =
      advancement
        .winnerTeamId;
  }

  /*
   * ==========================================================
   * ASPETTIAMO L'ALTRA QUALIFICATA
   * ==========================================================
   */

  if (
    !qualifiedSlots.home
  ) {
    return {
      status:
        "waiting",

      targetRound,

      targetMatchOrder,

      missingSlot:
        "home",
    };
  }

  if (
    !qualifiedSlots.away
  ) {
    return {
      status:
        "waiting",

      targetRound,

      targetMatchOrder,

      missingSlot:
        "away",
    };
  }

  /*
   * ==========================================================
   * MATCH PRONTO
   * ==========================================================
   */

  if (
    qualifiedSlots.home ===
    qualifiedSlots.away
  ) {
    throw new Error(
      "La stessa squadra non può occupare entrambi gli slot del turno successivo.",
    );
  }

  /*
 * ==========================================================
 * TARGET GIÀ ESISTENTE
 * ==========================================================
 *
 * Solo ora conosciamo entrambe le qualificate.
 *
 * Se il turno successivo esiste già:
 *
 * - stesse due squadre -> tutto coerente;
 * - squadre diverse -> errore strutturale;
 * - non viene mai sovrascritto automaticamente.
 * ==========================================================
 */

const existingTargets =
  findExistingTargetMatches({
    matches:
      allMatches,

    seasonId:
      sourceMatch.seasonId,

    competition:
      sourceMatch.competition,

    round:
      targetRound,

    matchOrder:
      targetMatchOrder,
  });

if (
  existingTargets.length >
  0
) {
  const conflictingTarget =
    existingTargets.find(
      (
        existingTarget,
      ) =>
        !containsExpectedTeams({
          match:
            existingTarget,

          homeTeamId:
            qualifiedSlots.home!,

          awayTeamId:
            qualifiedSlots.away!,
        }),
    );

  if (
    conflictingTarget
  ) {
    throw new Error(
      "Il turno successivo esiste già ma contiene squadre diverse dalle qualificate.",
    );
  }

  return {
    status:
      "alreadyExists",

    matchId:
      String(
        existingTargets[0].id,
      ),
  };
}

  return {
    status:
      "ready",

    seasonId:
      sourceMatch.seasonId,

    competition:
      sourceMatch.competition,

    targetRound,

    targetMatchOrder,

    homeTeamId:
      qualifiedSlots.home,

    awayTeamId:
      qualifiedSlots.away,
  };
}