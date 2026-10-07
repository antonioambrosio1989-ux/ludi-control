import type {
  ScorePredictionAdminResult,
  ScorePredictionPublicResult,
} from "@/src/types/GamesVoting";

export function buildScorePredictionPublicResult({
  adminResult,
  userId,
}: {
  adminResult:
    ScorePredictionAdminResult;
  userId:
    string;
}): ScorePredictionPublicResult {
  const normalizedUserId =
    String(
      userId ??
      "",
    ).trim();

  if (
    adminResult.status ===
    "pending"
  ) {
    return {
      status:
        "pending",
      matchId:
        adminResult.matchId,
      matchLabel:
        adminResult.matchLabel,
      topScorers:
        [],
      exactScoreWinnerCount:
        0,
      topScorerWinnerCount:
        0,
      perfectWinnerCount:
        0,
    };
  }

  const exactScoreWinnerIds =
    new Set(
      adminResult
        .exactScoreWinners
        .map(
          (
            winner,
          ) =>
            winner.userId,
        ),
    );

  const topScorerWinnerIds =
    new Set(
      adminResult
        .topScorerWinners
        .map(
          (
            winner,
          ) =>
            winner.userId,
        ),
    );

  const perfectWinnerIds =
    new Set(
      adminResult
        .perfectWinners
        .map(
          (
            winner,
          ) =>
            winner.userId,
        ),
    );

  const ownExactScore =
    Boolean(
      normalizedUserId &&
      exactScoreWinnerIds.has(
        normalizedUserId,
      ),
    );

  const ownTopScorer =
    Boolean(
      normalizedUserId &&
      topScorerWinnerIds.has(
        normalizedUserId,
      ),
    );

  const ownPerfect =
    Boolean(
      normalizedUserId &&
      perfectWinnerIds.has(
        normalizedUserId,
      ),
    );

  return {
    status:
      "completed",
    matchId:
      adminResult.matchId,
    matchLabel:
      adminResult.matchLabel,
    actualHomeScore:
      adminResult.actualHomeScore,
    actualAwayScore:
      adminResult.actualAwayScore,
    topScorers:
      adminResult.topScorers,
    exactScoreWinnerCount:
      exactScoreWinnerIds.size,
    topScorerWinnerCount:
      topScorerWinnerIds.size,
    perfectWinnerCount:
      perfectWinnerIds.size,
    ...(normalizedUserId
      ? {
          ownResult: {
            exactScore:
              ownExactScore,
            topScorer:
              ownTopScorer,
            perfect:
              ownPerfect,
          },
        }
      : {}),
  };
}
