import type {
  BestOfMonthAwardKey,
  BestOfMonthPublicWinner,
  GamesVotingPoll,
} from "@/src/types/GamesVoting";

const KEYS:
  BestOfMonthAwardKey[] = [
    "player_of_the_month",
    "goal_of_the_month",
    "save_of_the_month",
  ];

export function buildBestOfMonthPublicWinners(
  poll:
    GamesVotingPoll,
): Partial<
  Record<
    BestOfMonthAwardKey,
    BestOfMonthPublicWinner
  >
> {
  if (
    poll.type !==
      "best_of_the_month" ||
    !poll.bestOfMonth
  ) {
    return {};
  }

  const result:
    Partial<
      Record<
        BestOfMonthAwardKey,
        BestOfMonthPublicWinner
      >
    > = {};

  for (
    const key of
    KEYS
  ) {
    const decision =
      poll
        .bestOfMonthDecisions?.[
          key
        ];

    if (
      !decision ||
      decision.status !==
        "finalized"
    ) {
      continue;
    }

    const candidate =
      poll.bestOfMonth
        .awards[
          key
        ]
        .candidates
        .find(
          (
            current,
          ) =>
            current.id ===
            decision
              .winnerCandidateId,
        );

    if (
      !candidate
    ) {
      continue;
    }

    result[
      key
    ] = {
      awardKey:
        key,
      candidate,
      playerId:
        decision
          .winnerPlayerId,
      ...(typeof decision.finalizedAtMs ===
      "number"
        ? {
            finalizedAtMs:
              decision.finalizedAtMs,
          }
        : {}),
    };
  }

  return result;
}

export function sanitizePublicVotingPoll(
  poll:
    GamesVotingPoll,
): GamesVotingPoll {
  if (
    poll.type !==
    "best_of_the_month"
  ) {
    return poll;
  }

  const publicPoll:
    GamesVotingPoll = {
      ...poll,
    };

  delete publicPoll
    .bestOfMonthDecisions;

  return publicPoll;
}
