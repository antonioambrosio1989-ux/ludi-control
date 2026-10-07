import "server-only";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "@/src/lib/firebaseAdmin";

import {
  mapVotingPoll,
} from "@/src/server/games/voting/GamesVotingMappers";
import {
  resolveBestOfMonthEffectiveStatus,
} from "@/src/services/games/voting/BestOfMonthRules";

import {
  buildBestOfMonthFinalDecision,
} from "@/src/services/games/voting/BestOfMonthDecisionRules";
import {
  assertBestOfMonthNotInMaintenance,
} from "@/src/services/games/voting/BestOfMonthMaintenanceRules";

import type {
  BestOfMonthAwardDecision,
  BestOfMonthAwardKey,
  GamesVotingPoll,
  VotingCandidate,
} from "@/src/types/GamesVoting";

const POLLS =
  "gamesVotingPolls";

const SUBMISSIONS =
  "gamesBuildXiSubmissions";

export const BEST_OF_MONTH_KEYS:
  BestOfMonthAwardKey[] = [
    "player_of_the_month",
    "goal_of_the_month",
    "save_of_the_month",
  ];

export async function finalizeBestOfMonthAward(
  pollId:
    string,

  input: {
    awardKey:
      BestOfMonthAwardKey;

    resolvedPublicWinnerCandidateId?:
      string;

    refereeCandidateId:
      string;

    organizer1CandidateId:
      string;

    organizer2CandidateId:
      string;
  },
): Promise<void> {
  const reference =
    adminDb
      .collection(
        POLLS,
      )
      .doc(
        pollId,
      );

  /*
   * La votazione pubblica è già chiusa a questo punto, quindi
   * le submission non possono più cambiare. Calcoliamo il risultato
   * prima della transaction e poi rendiamo atomiche la decisione
   * finale e la scrittura dell'achievement del vincitore.
   */
  const initialSnapshot =
    await reference.get();

  if (
    !initialSnapshot.exists
  ) {
    throw new Error(
      "VOTING_NOT_FOUND",
    );
  }

  const initialData =
    initialSnapshot.data() ??
    {};

  assertBestOfMonthNotInMaintenance(
    initialData.bestOfMonthMaintenanceOperation,
  );

  const initialPoll =
    mapVotingPoll(
      initialSnapshot.id,
      initialData,
    );

  assertBestOfMonthCanFinalize(
    initialPoll,
    input.awardKey,
  );

  const award =
    initialPoll.bestOfMonth!
      .awards[
        input.awardKey
      ];

  if (
    !award
  ) {
    throw new Error(
      "INVALID_BEST_OF_MONTH_AWARD",
    );
  }

  const ranked =
    await getBestOfMonthAwardResults(
      pollId,
      input.awardKey,
      award.candidates,
    );

  const decisionBase =
    buildBestOfMonthFinalDecision({
      awardKey:
        input.awardKey,
      candidates:
        award.candidates,
      ranked:
        ranked.map(
          (
            candidate,
          ) => ({
            id:
              candidate.id,
            votes:
              candidate.votes,
          }),
        ),
      resolvedPublicWinnerCandidateId:
        input
          .resolvedPublicWinnerCandidateId,
      refereeCandidateId:
        input.refereeCandidateId,
      organizer1CandidateId:
        input.organizer1CandidateId,
      organizer2CandidateId:
        input.organizer2CandidateId,
    });

  const winnerCandidate =
    award.candidates.find(
      (
        candidate,
      ) =>
        candidate.id ===
        decisionBase
          .winnerCandidateId,
    );

  if (
    !winnerCandidate
  ) {
    throw new Error(
      "BEST_OF_MONTH_WINNER_NOT_FOUND",
    );
  }

  const winnerPlayerId =
    await resolveCandidatePlayerId({
      candidate:
        winnerCandidate,
      seasonId:
        initialPoll.seasonId,
    });

  const teamSnapshot =
    await resolvePlayerTeamSnapshot({
      playerId:
        winnerPlayerId,
      seasonId:
        initialPoll.seasonId,
      fallbackTeamId:
        winnerCandidate.teamId,
      fallbackTeamName:
        winnerCandidate.teamName,
    });

  const finalizedAtMs =
    Date.now();

  const decision:
    BestOfMonthAwardDecision = {
      ...decisionBase,
      winnerPlayerId,
      status:
        "finalized",
      finalizedAtMs,
    };

  const playerReference =
    adminDb
      .collection(
        "players",
      )
      .doc(
        winnerPlayerId,
      );

  const achievement =
    buildMonthlyPlayerAchievement({
      seasonId:
        initialPoll.seasonId,
      seasonLabel:
        initialPoll.seasonName ||
        initialPoll.seasonId,
      competitionId:
        initialPoll.competitionId,
      awardKey:
        input.awardKey,
      monthKey:
        initialPoll.bestOfMonth!
          .monthKey,
      monthLabel:
        initialPoll.bestOfMonth!
          .monthLabel,
      teamId:
        teamSnapshot.teamId,
      teamName:
        teamSnapshot.teamName,
      createdAtIso:
        new Date(
          finalizedAtMs,
        ).toISOString(),
    });

  await adminDb.runTransaction(
    async (
      transaction,
    ) => {
      const [
        pollSnapshot,
        playerSnapshot,
      ] =
        await Promise.all([
          transaction.get(
            reference,
          ),
          transaction.get(
            playerReference,
          ),
        ]);

      if (
        !pollSnapshot.exists
      ) {
        throw new Error(
          "VOTING_NOT_FOUND",
        );
      }

      const currentData =
        pollSnapshot.data() ??
        {};

      assertBestOfMonthNotInMaintenance(
        currentData.bestOfMonthMaintenanceOperation,
      );

      const currentPoll =
        mapVotingPoll(
          pollSnapshot.id,
          currentData,
        );

      /*
       * Ricontrollo autorevole dentro la transaction:
       * due Admin che finalizzano nello stesso istante non possono
       * produrre due decisioni o due achievement differenti.
       */
      assertBestOfMonthCanFinalize(
        currentPoll,
        input.awardKey,
      );

      const currentAward =
        currentPoll.bestOfMonth!
          .awards[
            input.awardKey
          ];

      if (
        !currentAward ||
        !currentAward.candidates.some(
          (
            candidate,
          ) =>
            candidate.id ===
            decision
              .winnerCandidateId,
        )
      ) {
        throw new Error(
          "BEST_OF_MONTH_WINNER_NOT_FOUND",
        );
      }

      if (
        !playerSnapshot.exists
      ) {
        throw new Error(
          "BEST_OF_MONTH_PLAYER_REQUIRED",
        );
      }

      const existingAchievements =
        Array.isArray(
          playerSnapshot
            .data()
            ?.achievements,
        )
          ? playerSnapshot
              .data()!
              .achievements as
              Array<
                Record<
                  string,
                  unknown
                >
              >
          : [];

      const nextAchievements =
        mergeMonthlyAchievement(
          existingAchievements,
          achievement,
        );

      transaction.update(
        reference,
        {
          [`bestOfMonthDecisions.${input.awardKey}`]:
            decision,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
      );

      transaction.update(
        playerReference,
        {
          achievements:
            nextAchievements,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
      );
    },
  );
}

function assertBestOfMonthCanFinalize(
  poll:
    GamesVotingPoll,
  awardKey:
    BestOfMonthAwardKey,
): void {
  if (
    poll.type !==
      "best_of_the_month" ||
    !poll.bestOfMonth
  ) {
    throw new Error(
      "INVALID_VOTING_TYPE",
    );
  }

  const effectiveStatus =
    resolveBestOfMonthEffectiveStatus({
      persistedStatus:
        poll.status,
      opensAtMs:
        poll.bestOfMonth.opensAtMs,
      closesAtMs:
        poll.bestOfMonth.closesAtMs,
      nowMs:
        Date.now(),
    });

  if (
    effectiveStatus !==
      "closed" &&
    poll.status !==
      "closed"
  ) {
    throw new Error(
      "BEST_OF_MONTH_NOT_CLOSED",
    );
  }

  if (
    poll
      .bestOfMonthDecisions?.[
        awardKey
      ]?.status ===
    "finalized"
  ) {
    throw new Error(
      "BEST_OF_MONTH_ALREADY_FINALIZED",
    );
  }
}


export async function listBestOfMonthPlayerOptions(
  poll:
    GamesVotingPoll,
): Promise<
  VotingCandidate[]
> {
  if (
    !poll.seasonId
  ) {
    return [];
  }

  const [
    seasonPlayersSnapshot,
    playersSnapshot,
    teamsSnapshot,
  ] =
    await Promise.all([
      adminDb
        .collection(
          "seasonPlayers",
        )
        .where(
          "seasonId",
          "==",
          poll.seasonId,
        )
        .get(),

      adminDb
        .collection(
          "players",
        )
        .get(),

      adminDb
        .collection(
          "teams",
        )
        .get(),
    ]);

  const playersById =
    new Map(
      playersSnapshot.docs.map(
        (
          document,
        ) => [
          document.id,
          document.data(),
        ],
      ),
    );

  const teamsById =
    new Map(
      teamsSnapshot.docs.map(
        (
          document,
        ) => [
          document.id,
          document.data(),
        ],
      ),
    );

  return seasonPlayersSnapshot.docs
    .flatMap(
      (
        document,
      ) => {
        const seasonPlayer =
          document.data();

        if (
          seasonPlayer.status ===
          "withdrawn"
        ) {
          return [];
        }

        const playerId =
          String(
            seasonPlayer.playerId ??
            "",
          ).trim();

        const teamId =
          String(
            seasonPlayer.teamId ??
            "",
          ).trim();

        const player =
          playersById.get(
            playerId,
          ) ??
          {};

        if (
          !playerId ||
          !player.firstName ||
          !player.lastName
        ) {
          return [];
        }

        const team =
          teamsById.get(
            teamId,
          ) ??
          {};

        const teamName =
          String(
            team.aliasName ??
            team.name ??
            teamId,
          ).trim();

        const label =
          `${String(
            player.firstName,
          )} ${String(
            player.lastName,
          )}`.trim();

        return [
          {
            id:
              playerId,

            playerId,
            label,
            teamId,
            teamName,

            ...(player.photoUrl
              ? {
                  imageUrl:
                    String(
                      player.photoUrl,
                    ),
                }
              : {}),
          } satisfies VotingCandidate,
        ];
      },
    )
    .sort(
      (
        first,
        second,
      ) =>
        first.label.localeCompare(
          second.label,
          "it",
        ),
    );
}

export async function removeBestOfMonthGeneratedAchievements(
  poll:
    GamesVotingPoll,
): Promise<void> {
  if (
    poll.type !==
      "best_of_the_month" ||
    !poll.bestOfMonth
  ) {
    return;
  }

  const monthKey =
    poll.bestOfMonth.monthKey;

  if (
    !monthKey
  ) {
    return;
  }

  const decisions =
    poll.bestOfMonthDecisions ??
    {};

  for (
    const awardKey of
    BEST_OF_MONTH_KEYS
  ) {
    const decision =
      decisions[
        awardKey
      ];

    if (
      !decision ||
      decision.status !==
        "finalized" ||
      !decision.winnerPlayerId
    ) {
      continue;
    }

    const abbreviation =
      awardKey ===
      "player_of_the_month"
        ? "potm"
        : awardKey ===
            "goal_of_the_month"
          ? "gotm"
          : "sotm";

    const achievementId =
      `${poll.seasonId}-${abbreviation}-${monthKey}`;

    const playerReference =
      adminDb
        .collection(
          "players",
        )
        .doc(
          decision.winnerPlayerId,
        );

    await adminDb.runTransaction(
      async (
        transaction,
      ) => {
        const playerSnapshot =
          await transaction.get(
            playerReference,
          );

        if (
          !playerSnapshot.exists
        ) {
          return;
        }

        const rawAchievements =
          playerSnapshot
            .data()
            ?.achievements;

        const currentAchievements =
          Array.isArray(
            rawAchievements,
          )
            ? rawAchievements as
                Array<
                  Record<
                    string,
                    unknown
                  >
                >
            : [];

        const nextAchievements =
          currentAchievements.filter(
            (
              achievement,
            ) =>
              String(
                achievement.id ??
                "",
              ) !==
              achievementId,
          );

        if (
          nextAchievements.length ===
          currentAchievements.length
        ) {
          return;
        }

        transaction.update(
          playerReference,
          {
            achievements:
              nextAchievements,

            updatedAt:
              FieldValue.serverTimestamp(),
          },
        );
      },
    );
  }
}

async function getBestOfMonthAwardResults(
  pollId:
    string,

  awardKey:
    BestOfMonthAwardKey,

  candidates:
    VotingCandidate[],
) {
  const snapshot =
    await adminDb
      .collection(
        SUBMISSIONS,
      )
      .where(
        "votingId",
        "==",
        pollId,
      )
      .get();

  const awardSubmissions =
    snapshot.docs
      .map(
        (
          document,
        ) =>
          document.data(),
      )
      .filter(
        (
          submission,
        ) =>
          submission.type ===
            "best_of_the_month" &&
          submission.awardKey ===
            awardKey,
      );

  const votes =
    new Map<
      string,
      number
    >();

  for (
    const submission of
    awardSubmissions
  ) {
    const optionId =
      String(
        submission.optionId ??
        "",
      );

    if (
      optionId
    ) {
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
  }

  return candidates
    .map(
      (
        candidate,
      ) => ({
        ...candidate,

        votes:
          votes.get(
            candidate.id,
          ) ??
          0,
      }),
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
}


async function resolveCandidatePlayerId({
  candidate,
  seasonId,
}: {
  candidate:
    VotingCandidate;

  seasonId:
    string;
}): Promise<string> {
  const explicit =
    String(
      candidate.playerId ??
      "",
    ).trim();

  if (
    explicit
  ) {
    return explicit;
  }

  const normalizedLabel =
    candidate.label
      .trim()
      .toLocaleLowerCase(
        "it",
      );

  if (
    !normalizedLabel
  ) {
    throw new Error(
      "BEST_OF_MONTH_PLAYER_REQUIRED",
    );
  }

  const [
    seasonPlayersSnapshot,
    playersSnapshot,
  ] =
    await Promise.all([
      adminDb
        .collection(
          "seasonPlayers",
        )
        .where(
          "seasonId",
          "==",
          seasonId,
        )
        .get(),

      adminDb
        .collection(
          "players",
        )
        .get(),
    ]);

  const eligiblePlayerIds =
    new Set(
      seasonPlayersSnapshot.docs.map(
        (
          document,
        ) =>
          String(
            document
              .data()
              .playerId ??
            "",
          ),
      ),
    );

  const matches =
    playersSnapshot.docs.filter(
      (
        document,
      ) => {
        if (
          !eligiblePlayerIds.has(
            document.id,
          )
        ) {
          return false;
        }

        const player =
          document.data();

        const fullName =
          `${String(
            player.firstName ??
            "",
          )} ${String(
            player.lastName ??
            "",
          )}`
            .trim()
            .toLocaleLowerCase(
              "it",
            );

        return fullName ===
          normalizedLabel;
      },
    );

  if (
    matches.length !==
    1
  ) {
    throw new Error(
      "BEST_OF_MONTH_PLAYER_REQUIRED",
    );
  }

  return matches[
    0
  ].id;
}

async function resolvePlayerTeamSnapshot({
  playerId,
  seasonId,
  fallbackTeamId,
  fallbackTeamName,
}: {
  playerId:
    string;

  seasonId:
    string;

  fallbackTeamId?:
    string;

  fallbackTeamName?:
    string;
}): Promise<{
  teamId:
    string;

  teamName:
    string;
}> {
  let teamId =
    String(
      fallbackTeamId ??
      "",
    ).trim();

  let teamName =
    String(
      fallbackTeamName ??
      "",
    ).trim();

  if (
    !teamId
  ) {
    const snapshot =
      await adminDb
        .collection(
          "seasonPlayers",
        )
        .where(
          "seasonId",
          "==",
          seasonId,
        )
        .where(
          "playerId",
          "==",
          playerId,
        )
        .get();

    const active =
      snapshot.docs.find(
        (
          document,
        ) =>
          document
            .data()
            .status ===
          "active",
      ) ??
      snapshot.docs[
        0
      ];

    teamId =
      String(
        active
          ?.data()
          .teamId ??
        "",
      ).trim();
  }

  if (
    teamId &&
    !teamName
  ) {
    const teamSnapshot =
      await adminDb
        .collection(
          "teams",
        )
        .doc(
          teamId,
        )
        .get();

    const team =
      teamSnapshot.data() ??
      {};

    teamName =
      String(
        team.aliasName ??
        team.name ??
        teamId,
      ).trim();
  }

  return {
    teamId,
    teamName,
  };
}


type MonthlyAchievement =
  Record<
    string,
    unknown
  > & {
    id:
      string;
  };

function buildMonthlyPlayerAchievement({
  seasonId,
  seasonLabel,
  competitionId,
  awardKey,
  monthKey,
  monthLabel,
  teamId,
  teamName,
  createdAtIso,
}: {
  seasonId:
    string;
  seasonLabel:
    string;
  competitionId:
    string;
  awardKey:
    BestOfMonthAwardKey;
  monthKey:
    string;
  monthLabel:
    string;
  teamId:
    string;
  teamName:
    string;
  createdAtIso:
    string;
}): MonthlyAchievement {
  const abbreviation =
    awardKey ===
    "player_of_the_month"
      ? "POTM"
      : awardKey ===
          "goal_of_the_month"
        ? "GOTM"
        : "SOTM";

  const monthOnlyLabel =
    monthLabel.split(
      " ",
    )[
      0
    ] ||
    monthLabel ||
    monthKey;

  return {
    id:
      `${seasonId}-${abbreviation.toLowerCase()}-${monthKey}`,

    seasonId,
    seasonLabel,
    competitionId,

    competition:
      "regularSeason",

    title:
      `${abbreviation} ${monthOnlyLabel}`,

    teamId,
    teamName,
    createdAt:
      createdAtIso,
  };
}

function mergeMonthlyAchievement(
  existing:
    Array<
      Record<
        string,
        unknown
      >
    >,
  achievement:
    MonthlyAchievement,
): Array<
  Record<
    string,
    unknown
  >
> {
  return [
    ...existing.filter(
      (
        item,
      ) =>
        String(
          item.id ??
          "",
        ) !==
        achievement.id,
    ),
    achievement,
  ];
}
