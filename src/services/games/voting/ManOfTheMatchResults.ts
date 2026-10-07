import type {
  RankedVotingCandidate,
  VotingCandidate,
} from "@/src/types/GamesVoting";

export type ManOfTheMatchVotingResult = {
  validSubmissionCount: number;
  ranking: RankedVotingCandidate[];
  winnerCandidateIds: string[];
  isTie: boolean;
  winners: RankedVotingCandidate[];
};

export function buildManOfTheMatchVotingResult({
  candidates,
  submissions,
}: {
  candidates: VotingCandidate[];
  submissions: Array<Record<string, unknown>>;
}): ManOfTheMatchVotingResult {
  const candidateById =
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

  const votes =
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

  const seenUsers =
    new Set<
      string
    >();

  let validSubmissionCount =
    0;

  for (
    const submission of
    submissions
  ) {
    if (
      submission.type !==
      "man_of_the_match"
    ) {
      continue;
    }

    const userId =
      String(
        submission.userId ??
        "",
      ).trim();

    const optionId =
      String(
        submission.optionId ??
        "",
      ).trim();

    if (
      !userId ||
      seenUsers.has(
        userId,
      ) ||
      !candidateById.has(
        optionId,
      )
    ) {
      continue;
    }

    seenUsers.add(
      userId,
    );

    validSubmissionCount +=
      1;

    votes.set(
      optionId,
      (
        votes.get(
          optionId,
        ) ??
        0
      ) +
        1,
    );
  }

  const ranking =
    candidates
      .map(
        (
          candidate,
        ) => {
          const candidateVotes =
            votes.get(
              candidate.id,
            ) ??
            0;

          return {
            ...candidate,
            votes:
              candidateVotes,
            percentage:
              percentage(
                candidateVotes,
                validSubmissionCount,
              ),
          };
        },
      )
      .sort(
        (
          first,
          second,
        ) =>
          second.votes -
            first.votes ||
          first.label.localeCompare(
            second.label,
            "it",
          ),
      );

  const maxVotes =
    ranking[
      0
    ]?.votes ??
    0;

  const winners =
    maxVotes >
      0
      ? ranking.filter(
          (
            candidate,
          ) =>
            candidate.votes ===
            maxVotes,
        )
      : [];

  return {
    validSubmissionCount,
    ranking,
    winnerCandidateIds:
      winners.map(
        (
          candidate,
        ) =>
          candidate.id,
      ),
    isTie:
      winners.length >
      1,
    winners,
  };
}

function percentage(
  votes:
    number,
  total:
    number,
): number {
  if (
    total <=
    0
  ) {
    return 0;
  }

  return Math.round(
    (
      votes /
      total
    ) *
      1000,
  ) /
    10;
}
