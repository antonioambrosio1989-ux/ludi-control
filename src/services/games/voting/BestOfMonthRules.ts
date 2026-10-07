import type {
  BestOfMonthAwardConfig,
  BestOfMonthConfig,
  VotingStatus,
} from "@/src/types/GamesVoting";

const BEST_OF_MONTH_KEYS =
  [
    "player_of_the_month",
    "goal_of_the_month",
    "save_of_the_month",
  ] as const;

export function isBestOfMonthAwardReady(
  award:
    BestOfMonthAwardConfig |
    undefined,
): boolean {
  if (
    !award ||
    !Array.isArray(
      award.candidates,
    ) ||
    award.candidates.length <
      2
  ) {
    return false;
  }

  const candidateIds =
    award.candidates
      .map(
        (
          candidate,
        ) =>
          String(
            candidate.id ??
              "",
          ).trim(),
      )
      .filter(
        Boolean,
      );

  return (
    candidateIds.length ===
      award.candidates.length &&
    new Set(
      candidateIds,
    ).size ===
      candidateIds.length
  );
}

export function assertBestOfMonthAwardReady(
  award:
    BestOfMonthAwardConfig |
    undefined,
): asserts award is
  BestOfMonthAwardConfig {
  if (
    !isBestOfMonthAwardReady(
      award,
    )
  ) {
    throw new Error(
      "BEST_OF_MONTH_AWARD_NOT_READY",
    );
  }
}

export function isBestOfMonthConfigReady(
  awards:
    BestOfMonthConfig[
      "awards"
    ],
): boolean {
  return BEST_OF_MONTH_KEYS.every(
    (
      key,
    ) =>
      isBestOfMonthAwardReady(
        awards[
          key
        ],
      ),
  );
}

export function resolveBestOfMonthEffectiveStatus({
  persistedStatus,
  opensAtMs,
  closesAtMs,
  nowMs,
}: {
  persistedStatus:
    VotingStatus;
  opensAtMs:
    number;
  closesAtMs:
    number;
  nowMs:
    number;
}): VotingStatus {
  if (
    persistedStatus !==
    "published"
  ) {
    return persistedStatus;
  }

  if (
    !Number.isFinite(
      opensAtMs,
    ) ||
    !Number.isFinite(
      closesAtMs,
    ) ||
    opensAtMs <=
      0 ||
    closesAtMs <=
      opensAtMs
  ) {
    return "closed";
  }

  if (
    nowMs <
    opensAtMs
  ) {
    return "planned";
  }

  if (
    nowMs >=
    closesAtMs
  ) {
    return "closed";
  }

  return "published";
}
