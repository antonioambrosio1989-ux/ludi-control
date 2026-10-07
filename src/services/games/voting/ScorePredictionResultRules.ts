export type ScorePredictionResultSubmission = {
  userId:
    string;
  homeScore:
    unknown;
  awayScore:
    unknown;
  topScorerPlayerId:
    unknown;
};

export type ScorePredictionGoal = {
  type?:
    unknown;
  scorerPlayerId?:
    unknown;
};

export type ScorePredictionResolvedOutcome =
  | {
      status:
        "pending";
    }
  | {
      status:
        "completed";
      actualHomeScore:
        number;
      actualAwayScore:
        number;
      topScorerPlayerIds:
        string[];
      exactScoreWinnerIds:
        string[];
      topScorerWinnerIds:
        string[];
      perfectWinnerIds:
        string[];
    };

export function resolveScorePredictionOutcome({
  matchStatus,
  homeScore,
  awayScore,
  goals,
  submissions,
}: {
  matchStatus:
    unknown;
  homeScore:
    unknown;
  awayScore:
    unknown;
  goals:
    ScorePredictionGoal[];
  submissions:
    ScorePredictionResultSubmission[];
}): ScorePredictionResolvedOutcome {
  /*
   * Un report pubblicato "postponed" o "cancelled" non è un
   * risultato sportivo definitivo. Evitiamo di trasformarlo in
   * uno 0-0 e di assegnare vincitori inesistenti.
   */
  if (
    matchStatus !==
      "played" &&
    matchStatus !==
      "walkover"
  ) {
    return {
      status:
        "pending",
    };
  }

  const actualHomeScore =
    completedScore(
      homeScore,
    );

  const actualAwayScore =
    completedScore(
      awayScore,
    );

  if (
    actualHomeScore ===
      null ||
    actualAwayScore ===
      null
  ) {
    return {
      status:
        "pending",
    };
  }

  const goalCountByPlayerId =
    new Map<
      string,
      number
    >();

  /*
   * Nei walkover non esiste un marcatore sportivo reale, anche se
   * vecchi documenti dovessero contenere accidentalmente eventi goal.
   */
  if (
    matchStatus ===
    "played"
  ) {
    for (
      const goal of
      goals
    ) {
      if (
        String(
          goal.type ??
          "",
        ) ===
        "ownGoal"
      ) {
        continue;
      }

      const scorerPlayerId =
        String(
          goal.scorerPlayerId ??
          "",
        ).trim();

      if (
        !scorerPlayerId
      ) {
        continue;
      }

      goalCountByPlayerId.set(
        scorerPlayerId,
        (
          goalCountByPlayerId.get(
            scorerPlayerId,
          ) ??
          0
        ) +
          1,
      );
    }
  }

  const maxGoals =
    goalCountByPlayerId.size >
      0
      ? Math.max(
          ...goalCountByPlayerId.values(),
        )
      : 0;

  const topScorerPlayerIds =
    maxGoals >
      0
      ? Array.from(
          goalCountByPlayerId.entries(),
        )
          .filter(
            (
              [
                ,
                goalsScored,
              ],
            ) =>
              goalsScored ===
              maxGoals,
          )
          .map(
            (
              [
                playerId,
              ],
            ) =>
              playerId,
          )
          .sort()
      : [];

  const topScorerSet =
    new Set(
      topScorerPlayerIds,
    );

  const exactScoreWinnerIds:
    string[] = [];

  const topScorerWinnerIds:
    string[] = [];

  const perfectWinnerIds:
    string[] = [];

  /*
   * La collection dovrebbe avere un solo documento per utente, ma
   * deduplichiamo comunque per rendere il calcolo resistente a dati
   * legacy o importati manualmente.
   */
  const seenUsers =
    new Set<
      string
    >();

  for (
    const submission of
    submissions
  ) {
    const userId =
      String(
        submission.userId ??
        "",
      ).trim();

    if (
      !userId ||
      seenUsers.has(
        userId,
      )
    ) {
      continue;
    }

    seenUsers.add(
      userId,
    );

    const predictedHomeScore =
      storedPredictionScore(
        submission.homeScore,
      );

    const predictedAwayScore =
      storedPredictionScore(
        submission.awayScore,
      );

    if (
      predictedHomeScore ===
        null ||
      predictedAwayScore ===
        null
    ) {
      continue;
    }

    const predictedTopScorerPlayerId =
      normalizeStoredScorer(
        submission
          .topScorerPlayerId,
      );

    const predictedGoals =
      predictedHomeScore +
      predictedAwayScore;

    /*
     * Una submission legacy incoerente non può diventare vincitrice:
     * - 0-0 => marcatore obbligatoriamente null
     * - almeno un gol => marcatore obbligatoriamente presente
     */
    if (
      (
        predictedGoals ===
          0 &&
        predictedTopScorerPlayerId !==
          null
      ) ||
      (
        predictedGoals >
          0 &&
        predictedTopScorerPlayerId ===
          null
      )
    ) {
      continue;
    }

    const exactScore =
      predictedHomeScore ===
        actualHomeScore &&
      predictedAwayScore ===
        actualAwayScore;

    const topScorer =
      topScorerPlayerIds.length ===
        0
        ? predictedTopScorerPlayerId ===
          null
        : Boolean(
            predictedTopScorerPlayerId &&
            topScorerSet.has(
              predictedTopScorerPlayerId,
            ),
          );

    if (
      exactScore
    ) {
      exactScoreWinnerIds.push(
        userId,
      );
    }

    if (
      topScorer
    ) {
      topScorerWinnerIds.push(
        userId,
      );
    }

    if (
      exactScore &&
      topScorer
    ) {
      perfectWinnerIds.push(
        userId,
      );
    }
  }

  return {
    status:
      "completed",
    actualHomeScore,
    actualAwayScore,
    topScorerPlayerIds,
    exactScoreWinnerIds,
    topScorerWinnerIds,
    perfectWinnerIds,
  };
}

function completedScore(
  value:
    unknown,
): number |
  null {
  const score =
    Number(
      value,
    );

  return (
    Number.isInteger(
      score,
    ) &&
    score >=
      0 &&
    score <=
      99
  )
    ? score
    : null;
}

function storedPredictionScore(
  value:
    unknown,
): number |
  null {
  /*
   * Non coercizziamo stringhe/null: le submission create dal server
   * sono numeriche. Dati legacy corrotti vengono esclusi.
   */
  return (
    typeof value ===
      "number" &&
    Number.isInteger(
      value,
    ) &&
    value >=
      0 &&
    value <=
      99
  )
    ? value
    : null;
}

function normalizeStoredScorer(
  value:
    unknown,
): string |
  null {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null;
  }

  const normalized =
    String(
      value,
    ).trim();

  return normalized ||
    null;
}
