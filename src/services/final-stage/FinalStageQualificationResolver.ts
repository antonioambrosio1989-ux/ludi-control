import type {
  FinalStageMatch,
} from "@/src/types/FinalStageMatch";

/*
 * ============================================================
 * RESULT
 * ============================================================
 */

export type FinalStageQualificationResolution =
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
        | "matchNotCompleted"
        | "secondLegRequired"
        | "firstLegNotCompleted";

      matchId:
        string;
    }
  | {
      status:
        "penaltiesRequired";

      decidingMatchId:
        string;

      aggregate?: {
        firstTeamId:
          string;

        secondTeamId:
          string;

        firstTeamScore:
          number;

        secondTeamScore:
          number;
      };
    }
  | {
      status:
        "qualified";

      winnerTeamId:
        string;

      loserTeamId:
        string;

      decidedBy:
  | "score"
  | "extraTime"
  | "penalties"
  | "aggregate"
  | "aggregatePenalties";

      decidingMatchId:
        string;

      aggregate?: {
        firstTeamId:
          string;

        secondTeamId:
          string;

        firstTeamScore:
          number;

        secondTeamScore:
          number;
      };
    };

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function isCompletedOfficialMatch(
  match:
    FinalStageMatch,
): boolean {
  return (
    match.published ===
      true &&
    (
      match.status ===
        "played" ||
      match.status ===
        "finished" ||
      match.status ===
        "walkover"
    )
  );
}

function hasValidScore(
  match:
    FinalStageMatch,
): boolean {
  return (
    typeof match.homeScore ===
      "number" &&
    Number.isFinite(
      match.homeScore,
    ) &&
    typeof match.awayScore ===
      "number" &&
    Number.isFinite(
      match.awayScore,
    )
  );
}

function sameTeamPair(
  first:
    FinalStageMatch,
  second:
    FinalStageMatch,
): boolean {
  const firstTeams =
    new Set([
      String(
        first.homeTeamId,
      ),

      String(
        first.awayTeamId,
      ),
    ]);

  return (
    firstTeams.has(
      String(
        second.homeTeamId,
      ),
    ) &&
    firstTeams.has(
      String(
        second.awayTeamId,
      ),
    )
  );
}

function sameTieIdentity(
  first:
    FinalStageMatch,
  second:
    FinalStageMatch,
): boolean {
  return (
    first.seasonId ===
      second.seasonId &&
    first.competition ===
      second.competition &&
    first.round ===
      second.round &&
    (
      first.group ??
      ""
    ) ===
      (
        second.group ??
        ""
      ) &&
    (
      first.matchOrder ??
      null
    ) ===
      (
        second.matchOrder ??
        null
      ) &&
    sameTeamPair(
      first,
      second,
    )
  );
}

function getPenaltyWinner({
  match,
}: {
  match:
    FinalStageMatch;
}):
  | {
      winnerTeamId:
        string;

      loserTeamId:
        string;
    }
  | undefined {
  if (
    typeof match.homePenalties !==
      "number" ||
    typeof match.awayPenalties !==
      "number" ||
    !Number.isFinite(
      match.homePenalties,
    ) ||
    !Number.isFinite(
      match.awayPenalties,
    ) ||
    match.homePenalties ===
      match.awayPenalties
  ) {
    return undefined;
  }

  if (
    match.homePenalties >
    match.awayPenalties
  ) {
    return {
      winnerTeamId:
        String(
          match.homeTeamId,
        ),

      loserTeamId:
        String(
          match.awayTeamId,
        ),
    };
  }

  return {
    winnerTeamId:
      String(
        match.awayTeamId,
      ),

    loserTeamId:
      String(
        match.homeTeamId,
      ),
  };
}

/*
 * ============================================================
 * GARA SECCA
 * ============================================================
 */

function resolveSingleMatch(
  match:
    FinalStageMatch,
): FinalStageQualificationResolution {
  if (
    !isCompletedOfficialMatch(
      match,
    )
  ) {
    return {
      status:
        "pending",

      reason:
        "matchNotCompleted",

      matchId:
        String(
          match.id,
        ),
    };
  }

  if (
    !hasValidScore(
      match,
    )
  ) {
    throw new Error(
      "La partita è conclusa e pubblicata ma non contiene un risultato valido.",
    );
  }

  const homeScore =
    match.homeScore as number;

  const awayScore =
    match.awayScore as number;

  if (
    homeScore >
    awayScore
  ) {
    return {
      status:
        "qualified",

      winnerTeamId:
        String(
          match.homeTeamId,
        ),

      loserTeamId:
        String(
          match.awayTeamId,
        ),

      decidedBy:
        match.round ===
      "final" &&
    match.extraTimePlayed ===
      true
      ? "extraTime"
      : "score",

      decidingMatchId:
        String(
          match.id,
        ),
    };
  }

  if (
    awayScore >
    homeScore
  ) {
    return {
      status:
        "qualified",

      winnerTeamId:
        String(
          match.awayTeamId,
        ),

      loserTeamId:
        String(
          match.homeTeamId,
        ),

      decidedBy:
        match.round ===
      "final" &&
    match.extraTimePlayed ===
      true
      ? "extraTime"
      : "score",

      decidingMatchId:
        String(
          match.id,
        ),
    };
  }

  const penaltyWinner =
    getPenaltyWinner({
      match,
    });

  if (
    !penaltyWinner
  ) {
    return {
      status:
        "penaltiesRequired",

      decidingMatchId:
        String(
          match.id,
        ),
    };
  }

  return {
    status:
      "qualified",

    ...penaltyWinner,

    decidedBy:
      "penalties",

    decidingMatchId:
      String(
        match.id,
      ),
  };
}

/*
 * ============================================================
 * RITORNO
 * ============================================================
 */

function resolveSecondLeg({
  match,
  allMatches,
}: {
  match:
    FinalStageMatch;

  allMatches:
    FinalStageMatch[];
}): FinalStageQualificationResolution {
  if (
    !isCompletedOfficialMatch(
      match,
    )
  ) {
    return {
      status:
        "pending",

      reason:
        "matchNotCompleted",

      matchId:
        String(
          match.id,
        ),
    };
  }

  const matchingFirstLegs =
    allMatches.filter(
      (
        candidate,
      ) =>
        candidate.leg ===
          "first" &&
        sameTieIdentity(
          candidate,
          match,
        ),
    );

  if (
    matchingFirstLegs.length ===
    0
  ) {
    throw new Error(
      "Non è stata trovata la gara di andata corrispondente.",
    );
  }

  if (
    matchingFirstLegs.length >
    1
  ) {
    throw new Error(
      "Sono presenti più gare di andata compatibili con questo ritorno.",
    );
  }

  const firstLeg =
    matchingFirstLegs[0];

  if (
    !isCompletedOfficialMatch(
      firstLeg,
    )
  ) {
    return {
      status:
        "pending",

      reason:
        "firstLegNotCompleted",

      matchId:
        String(
          match.id,
        ),
    };
  }

  if (
    !hasValidScore(
      firstLeg,
    ) ||
    !hasValidScore(
      match,
    )
  ) {
    throw new Error(
      "Una delle due gare del confronto non contiene un risultato valido.",
    );
  }

  /*
   * ==========================================================
   * AGGREGATO PER SQUADRA
   * ==========================================================
   *
   * Non assumiamo che casa/ospite abbiano
   * lo stesso ordine tra andata e ritorno.
   * ==========================================================
   */

  const firstTeamId =
    String(
      firstLeg.homeTeamId,
    );

  const secondTeamId =
    String(
      firstLeg.awayTeamId,
    );

  let firstTeamScore =
    0;

  let secondTeamScore =
    0;

  for (
    const currentMatch
    of [
      firstLeg,
      match,
    ]
  ) {
    const homeTeamId =
      String(
        currentMatch.homeTeamId,
      );

    const awayTeamId =
      String(
        currentMatch.awayTeamId,
      );

    const homeScore =
      currentMatch.homeScore as number;

    const awayScore =
      currentMatch.awayScore as number;

    if (
      homeTeamId ===
      firstTeamId
    ) {
      firstTeamScore +=
        homeScore;
    } else if (
      homeTeamId ===
      secondTeamId
    ) {
      secondTeamScore +=
        homeScore;
    } else {
      throw new Error(
        "La gara di ritorno contiene una squadra diversa rispetto all'andata.",
      );
    }

    if (
      awayTeamId ===
      firstTeamId
    ) {
      firstTeamScore +=
        awayScore;
    } else if (
      awayTeamId ===
      secondTeamId
    ) {
      secondTeamScore +=
        awayScore;
    } else {
      throw new Error(
        "La gara di ritorno contiene una squadra diversa rispetto all'andata.",
      );
    }
  }

  const aggregate = {
    firstTeamId,

    secondTeamId,

    firstTeamScore,

    secondTeamScore,
  };

  /*
   * ==========================================================
   * VINCITORE AGGREGATO
   * ==========================================================
   */

  if (
    firstTeamScore >
    secondTeamScore
  ) {
    return {
      status:
        "qualified",

      winnerTeamId:
        firstTeamId,

      loserTeamId:
        secondTeamId,

      decidedBy:
        "aggregate",

      decidingMatchId:
        String(
          match.id,
        ),

      aggregate,
    };
  }

  if (
    secondTeamScore >
    firstTeamScore
  ) {
    return {
      status:
        "qualified",

      winnerTeamId:
        secondTeamId,

      loserTeamId:
        firstTeamId,

      decidedBy:
        "aggregate",

      decidingMatchId:
        String(
          match.id,
        ),

      aggregate,
    };
  }

  /*
   * ==========================================================
   * PARITÀ AGGREGATA → RIGORI DEL RITORNO
   * ==========================================================
   *
   * Non viene applicata la regola dei gol
   * in trasferta.
   * ==========================================================
   */

  const penaltyWinner =
    getPenaltyWinner({
      match,
    });

  if (
    !penaltyWinner
  ) {
    return {
      status:
        "penaltiesRequired",

      decidingMatchId:
        String(
          match.id,
        ),

      aggregate,
    };
  }

  return {
    status:
      "qualified",

    ...penaltyWinner,

    decidedBy:
      "aggregatePenalties",

    decidingMatchId:
      String(
        match.id,
      ),

    aggregate,
  };
}

/*
 * ============================================================
 * PUBLIC API
 * ============================================================
 */

export function resolveFinalStageQualification({
  match,
  allMatches,
}: {
  match:
    FinalStageMatch;

  allMatches:
    FinalStageMatch[];
}): FinalStageQualificationResolution {
  /*
   * I gironi non producono una qualificazione
   * sulla base di una singola partita.
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
   * Gara secca.
   */
  if (
    match.leg ===
    "single"
  ) {
    return resolveSingleMatch(
      match,
    );
  }

  /*
   * L'andata da sola non qualifica nessuno.
   */
  if (
    match.leg ===
    "first"
  ) {
    if (
      !isCompletedOfficialMatch(
        match,
      )
    ) {
      return {
        status:
          "pending",

        reason:
          "matchNotCompleted",

        matchId:
          String(
            match.id,
          ),
      };
    }

    return {
      status:
        "pending",

      reason:
        "secondLegRequired",

      matchId:
        String(
          match.id,
        ),
    };
  }

  /*
   * Ritorno.
   */
  return resolveSecondLeg({
    match,
    allMatches,
  });
}