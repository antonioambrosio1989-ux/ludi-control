import "server-only";

import {
  adminDb,
} from "@/src/lib/firebaseAdmin";

import {
  asRecord,
} from "@/src/server/games/voting/GamesVotingMappers";

import {
  resolveScorePredictionOutcome,
} from "@/src/services/games/voting/ScorePredictionResultRules";

import type {
  GamesVotingPoll,
  VotingAdminResults,
  VotingCandidate,
} from "@/src/types/GamesVoting";

export async function buildScorePredictionAdminResult({
  poll,
  submissions,
}: {
  poll:
    GamesVotingPoll;
  submissions:
    Array<
      Record<
        string,
        unknown
      >
    >;
}): Promise<
  NonNullable<
    VotingAdminResults[
      "scorePrediction"
    ]
  >
> {
  const config =
    poll.scorePrediction;

  if (
    !config
  ) {
    throw new Error(
      "VOTING_NOT_READY",
    );
  }

  const matchReport =
    await loadPublishedMatchReport(
      config.match.id,
    );

  if (
    !matchReport
  ) {
    return pendingResult(
      config.match.id,
      config.match.label,
    );
  }

  const reportData =
    asRecord(
      matchReport.data,
    );

  const goals =
    Array.isArray(
      reportData.goals,
    )
      ? reportData.goals.filter(
          (
            goal,
          ): goal is
            Record<
              string,
              unknown
            > =>
            Boolean(
              goal,
            ) &&
            typeof goal ===
              "object",
        )
      : [];

  const scorePredictionSubmissions =
    submissions
      .filter(
        (
          submission,
        ) =>
          submission.type ===
          "score_prediction",
      )
      .map(
        (
          submission,
        ) => ({
          userId:
            String(
              submission.userId ??
              "",
            ).trim(),
          homeScore:
            submission.homeScore,
          awayScore:
            submission.awayScore,
          topScorerPlayerId:
            submission
              .topScorerPlayerId,
        }),
      );

  const outcome =
    resolveScorePredictionOutcome({
      matchStatus:
        reportData.status,
      homeScore:
        reportData.homeScore,
      awayScore:
        reportData.awayScore,
      goals,
      submissions:
        scorePredictionSubmissions,
    });

  if (
    outcome.status ===
    "pending"
  ) {
    return pendingResult(
      config.match.id,
      config.match.label,
    );
  }

  const uniqueWinnerIds =
    Array.from(
      new Set([
        ...outcome
          .exactScoreWinnerIds,
        ...outcome
          .topScorerWinnerIds,
        ...outcome
          .perfectWinnerIds,
      ]),
    );

  const usersById =
    await resolveVotingResultUsers(
      uniqueWinnerIds,
    );

  const toUsers =
    (
      userIds:
        string[],
    ) =>
      userIds.map(
        (
          userId,
        ) =>
          usersById.get(
            userId,
          ) ?? {
            userId,
            displayName:
              userId,
          },
      );

  return {
    status:
      "completed",
    matchId:
      config.match.id,
    matchLabel:
      config.match.label,
    actualHomeScore:
      outcome.actualHomeScore,
    actualAwayScore:
      outcome.actualAwayScore,
    topScorerPlayerIds:
      outcome
        .topScorerPlayerIds,
    topScorers:
      await resolveTopScorerCandidates({
        playerIds:
          outcome
            .topScorerPlayerIds,
        configuredCandidates:
          config.scorerOptions,
      }),
    exactScoreWinners:
      toUsers(
        outcome
          .exactScoreWinnerIds,
      ),
    topScorerWinners:
      toUsers(
        outcome
          .topScorerWinnerIds,
      ),
    perfectWinners:
      toUsers(
        outcome
          .perfectWinnerIds,
      ),
  };
}

function pendingResult(
  matchId:
    string,
  matchLabel:
    string,
): NonNullable<
  VotingAdminResults[
    "scorePrediction"
  ]
> {
  return {
    status:
      "pending",
    matchId,
    matchLabel,
    topScorerPlayerIds:
      [],
    topScorers:
      [],
    exactScoreWinners:
      [],
    topScorerWinners:
      [],
    perfectWinners:
      [],
  };
}

async function loadPublishedMatchReport(
  matchId:
    string,
): Promise<
  Record<
    string,
    unknown
  > |
  null
> {
  const snapshot =
    await adminDb
      .collection(
        "matchReports",
      )
      .doc(
        matchId,
      )
      .get();

  if (
    !snapshot.exists ||
    snapshot.data()?.status !==
      "published"
  ) {
    return null;
  }

  return snapshot.data() ??
    {};
}

async function resolveVotingResultUsers(
  userIds:
    string[],
): Promise<
  Map<
    string,
    {
      userId:
        string;
      displayName:
        string;
    }
  >
> {
  const entries =
    await Promise.all(
      userIds.map(
        async (
          userId,
        ) => {
          const snapshot =
            await adminDb
              .collection(
                "users",
              )
              .doc(
                userId,
              )
              .get();

          const displayName =
            snapshot.exists
              ? String(
                  snapshot
                    .data()
                    ?.displayName ??
                  "",
                ).trim()
              : "";

          return [
            userId,
            {
              userId,
              displayName:
                displayName ||
                userId,
            },
          ] as const;
        },
      ),
    );

  return new Map(
    entries,
  );
}

async function resolveTopScorerCandidates({
  playerIds,
  configuredCandidates,
}: {
  playerIds:
    string[];
  configuredCandidates:
    VotingCandidate[];
}): Promise<
  VotingCandidate[]
> {
  if (
    playerIds.length ===
    0
  ) {
    return [];
  }

  const configuredByPlayerId =
    new Map<
      string,
      VotingCandidate
    >();

  for (
    const candidate of
    configuredCandidates
  ) {
    const playerId =
      String(
        candidate.playerId ??
        candidate.id ??
        "",
      ).trim();

    if (
      playerId
    ) {
      configuredByPlayerId.set(
        playerId,
        candidate,
      );
    }
  }

  return Promise.all(
    playerIds.map(
      async (
        playerId,
      ) => {
        const configured =
          configuredByPlayerId.get(
            playerId,
          );

        if (
          configured
        ) {
          return {
            ...configured,
            playerId,
          };
        }

        const playerSnapshot =
          await adminDb
            .collection(
              "players",
            )
            .doc(
              playerId,
            )
            .get();

        if (
          !playerSnapshot.exists
        ) {
          return {
            id:
              playerId,
            playerId,
            label:
              playerId,
          };
        }

        const player =
          playerSnapshot.data() ??
          {};

        const label =
          [
            String(
              player.firstName ??
              "",
            ).trim(),
            String(
              player.lastName ??
              "",
            ).trim(),
          ]
            .filter(
              Boolean,
            )
            .join(
              " ",
            );

        return {
          id:
            playerId,
          playerId,
          label:
            label ||
            playerId,
          ...(player.photoUrl
            ? {
                imageUrl:
                  String(
                    player.photoUrl,
                  ),
              }
            : {}),
        };
      },
    ),
  );
}
