import type {
  BestOfMonthAwardDecision,
  BestOfMonthAwardKey,
  VotingCandidate,
} from "@/src/types/GamesVoting";

type RankedPublicCandidate = {
  id:
    string;
  votes:
    number;
};

export type BestOfMonthDecisionBase =
  Omit<
    BestOfMonthAwardDecision,
    | "winnerPlayerId"
    | "status"
    | "finalizedAtMs"
  >;

export function buildBestOfMonthFinalDecision({
  awardKey,
  candidates,
  ranked,
  resolvedPublicWinnerCandidateId,
  refereeCandidateId,
  organizer1CandidateId,
  organizer2CandidateId,
}: {
  awardKey:
    BestOfMonthAwardKey;
  candidates:
    VotingCandidate[];
  ranked:
    RankedPublicCandidate[];
  resolvedPublicWinnerCandidateId?:
    string;
  refereeCandidateId:
    string;
  organizer1CandidateId:
    string;
  organizer2CandidateId:
    string;
}): BestOfMonthDecisionBase {
  const candidatesById =
    new Map(
      candidates.map(
        (
          candidate,
        ) => [
          candidate.id,
          candidate,
        ],
      ),
    );

  if (
    candidatesById.size <
      2 ||
    candidatesById.size !==
      candidates.length
  ) {
    throw new Error(
      "INVALID_BEST_OF_MONTH_AWARD",
    );
  }

  const internalVoteIds =
    [
      refereeCandidateId,
      organizer1CandidateId,
      organizer2CandidateId,
    ].map(
      normalizeId,
    );

  if (
    internalVoteIds.some(
      (
        candidateId,
      ) =>
        !candidateId ||
        !candidatesById.has(
          candidateId,
        ),
    )
  ) {
    throw new Error(
      "INVALID_BEST_OF_MONTH_SELECTION",
    );
  }

  const votesByCandidateId =
    new Map<
      string,
      number
    >(
      candidates.map(
        (
          candidate,
        ) => [
          candidate.id,
          0,
        ],
      ),
    );

  for (
    const entry of
    ranked
  ) {
    const id =
      normalizeId(
        entry.id,
      );

    if (
      !votesByCandidateId.has(
        id,
      )
    ) {
      continue;
    }

    const votes =
      Number(
        entry.votes,
      );

    if (
      Number.isFinite(
        votes,
      ) &&
      votes >
        0
    ) {
      votesByCandidateId.set(
        id,
        votes,
      );
    }
  }

  const highestVotes =
    Math.max(
      ...votesByCandidateId.values(),
    );

  if (
    highestVotes <=
    0
  ) {
    throw new Error(
      "BEST_OF_MONTH_NO_PUBLIC_RESULT",
    );
  }

  const topCandidateIds =
    candidates
      .map(
        (
          candidate,
        ) =>
          candidate.id,
      )
      .filter(
        (
          candidateId,
        ) =>
          votesByCandidateId.get(
            candidateId,
          ) ===
          highestVotes,
      );

  const isTie =
    topCandidateIds.length >
    1;

  const requestedResolvedWinner =
    normalizeId(
      resolvedPublicWinnerCandidateId,
    );

  const publicWinnerCandidateId =
    isTie
      ? requestedResolvedWinner
      : topCandidateIds[
          0
        ];

  if (
    !publicWinnerCandidateId ||
    !topCandidateIds.includes(
      publicWinnerCandidateId,
    )
  ) {
    throw new Error(
      isTie
        ? "BEST_OF_MONTH_POLL_TIE_REQUIRES_WINNER"
        : "BEST_OF_MONTH_NO_PUBLIC_RESULT",
    );
  }

  const pointsByCandidateId:
    Record<
      string,
      number
    > =
    Object.fromEntries(
      candidates.map(
        (
          candidate,
        ) => [
          candidate.id,
          0,
        ],
      ),
    );

  for (
    const candidateId of [
      publicWinnerCandidateId,
      ...internalVoteIds,
    ]
  ) {
    pointsByCandidateId[
      candidateId
    ] =
      (
        pointsByCandidateId[
          candidateId
        ] ??
        0
      ) +
      1;
  }

  const maxPoints =
    Math.max(
      ...Object.values(
        pointsByCandidateId,
      ),
    );

  const leaders =
    Object.entries(
      pointsByCandidateId,
    )
      .filter(
        (
          [
            ,
            points,
          ],
        ) =>
          points ===
          maxPoints,
      )
      .map(
        (
          [
            candidateId,
          ],
        ) =>
          candidateId,
      );

  /*
   * Se anche i 4 selettori finali producono una parità,
   * prevale il vincitore del voto pubblico. È il criterio già
   * previsto dal prodotto, ora isolato e coperto da test.
   */
  const winnerCandidateId =
    leaders.length ===
      1
      ? leaders[
          0
        ]
      : publicWinnerCandidateId;

  if (
    !leaders.includes(
      winnerCandidateId,
    )
  ) {
    throw new Error(
      "BEST_OF_MONTH_WINNER_NOT_FOUND",
    );
  }

  return {
    awardKey,

    pollResult: {
      topCandidateIds,
      isTie,
      ...(isTie
        ? {
            resolvedWinnerId:
              publicWinnerCandidateId,
          }
        : {}),
      winnerId:
        publicWinnerCandidateId,
    },

    refereeCandidateId:
      internalVoteIds[
        0
      ],

    organizer1CandidateId:
      internalVoteIds[
        1
      ],

    organizer2CandidateId:
      internalVoteIds[
        2
      ],

    pointsByCandidateId,
    winnerCandidateId,

    tieBreak:
      leaders.length >
      1
        ? "public_poll"
        : null,
  };
}

function normalizeId(
  value:
    unknown,
): string {
  return String(
    value ??
    "",
  ).trim();
}
