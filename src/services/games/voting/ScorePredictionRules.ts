import type {
  VotingCandidate,
} from "@/src/types/GamesVoting";

export function normalizeScorePredictionScore(
  value:
    unknown,
): number {
  const score =
    Number(
      value,
    );

  if (
    !Number.isInteger(
      score,
    ) ||
    score <
      0 ||
    score >
      99
  ) {
    throw new Error(
      "INVALID_SCORE",
    );
  }

  return score;
}

export function canonicalScorePredictionScorerId(
  candidate:
    VotingCandidate,
): string {
  return String(
    candidate.playerId ??
    candidate.id ??
    "",
  ).trim();
}

export function validateScorePredictionScorerOptions(
  scorerOptions:
    VotingCandidate[],
): void {
  if (
    scorerOptions.length ===
    0
  ) {
    return;
  }

  const canonicalIds =
    scorerOptions.map(
      canonicalScorePredictionScorerId,
    );

  if (
    canonicalIds.some(
      (
        playerId,
      ) =>
        !playerId,
    )
  ) {
    throw new Error(
      "INVALID_TOP_SCORER_OPTIONS",
    );
  }

  if (
    new Set(
      canonicalIds,
    ).size !==
    canonicalIds.length
  ) {
    throw new Error(
      "DUPLICATE_TOP_SCORER",
    );
  }
}

export function resolveScorePredictionScorerId({
  requestedId,
  totalGoals,
  scorerOptions,
}: {
  requestedId:
    unknown;
  totalGoals:
    number;
  scorerOptions:
    VotingCandidate[];
}): string |
  null {
  if (
    totalGoals ===
    0
  ) {
    return null;
  }

  validateScorePredictionScorerOptions(
    scorerOptions,
  );

  const normalizedRequestedId =
    String(
      requestedId ??
      "",
    ).trim();

  if (
    !normalizedRequestedId
  ) {
    throw new Error(
      "INVALID_TOP_SCORER",
    );
  }

  const match =
    scorerOptions.find(
      (
        candidate,
      ) => {
        const canonicalId =
          canonicalScorePredictionScorerId(
            candidate,
          );

        return (
          canonicalId ===
            normalizedRequestedId ||
          candidate.id ===
            normalizedRequestedId
        );
      },
    );

  if (
    !match
  ) {
    throw new Error(
      "INVALID_TOP_SCORER",
    );
  }

  return canonicalScorePredictionScorerId(
    match,
  );
}
