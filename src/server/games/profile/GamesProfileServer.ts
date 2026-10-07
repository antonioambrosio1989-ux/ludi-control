import "server-only";
import {unstable_cache} from "next/cache";

import {
  adminDb,
} from "@/src/lib/firebaseAdmin";

import {
  calculatePredictionScore,
  type PredictionResultStatus,
  type PredictionSelection,
} from "@/src/types/GamesPrediction";

import {
  buildGamesProfileSummary,
} from "@/src/services/games/GamesProfileProgression";

export const getGamesSeasonScores = unstable_cache(async (gamesSeasonId:string) => {
  const seasonSnapshot =
    await adminDb
      .collection("gamesSeasons")
      .doc(gamesSeasonId)
      .get();

  if (!seasonSnapshot.exists) {
    throw new Error("GAMES_SEASON_NOT_FOUND");
  }

  const season =
    seasonSnapshot.data() ?? {};

  const seasonStartsAt =
    timestampToMillis(
      season.startsAt,
    );

  const seasonEndsAt =
    timestampToMillis(
      season.endsAt,
    );

  const [
    gamesSnapshot,
    predictionSubmissions,
    survivorEntries,
    buildXiSubmissions,
  ] = await Promise.all([
    adminDb
      .collection("gamesGames")
      .get(),

    adminDb
      .collection("gamesPredictionSubmissions")
      .get(),

    adminDb
      .collection("gamesSurvivorEntries")
      .get(),

    adminDb
      .collection("gamesBuildXiSubmissions")
      .get(),
  ]);

  const pointsByUser =
    new Map<string, number>();

  const addParticipant = (
    value:
      unknown,
  ) => {
    const participantId =
      normalizeString(value);

    if (
      participantId &&
      !pointsByUser.has(participantId)
    ) {
      pointsByUser.set(
        participantId,
        0,
      );
    }
  };

  const addPoints = (
    participantId:
      string,
    points:
      number,
  ) => {
    addParticipant(
      participantId,
    );

    pointsByUser.set(
      participantId,
      (pointsByUser.get(participantId) ?? 0) +
        normalizeScore(points),
    );
  };

  const quizGames =
    gamesSnapshot.docs.filter(
      (document) =>
        document.data().gameType ===
        "quiz",
    );

  const quizLeaderboards =
    await Promise.all(
      quizGames.map((game) =>
        adminDb
          .collection("gamesQuizSeasonLeaderboards")
          .doc(`${gamesSeasonId}_${game.id}`)
          .collection("entries")
          .get(),
      ),
    );

  for (
    const leaderboard of
    quizLeaderboards
  ) {
    for (
      const entry of
      leaderboard.docs
    ) {
      const value =
        entry.data();

      addPoints(
        normalizeString(
          value.userId,
        ) || entry.id,
        finiteNumber(
          value.totalScore,
        ) ?? 0,
      );
    }
  }

  const seasonPredictionSubmissions =
    predictionSubmissions.docs.filter(
      (document) =>
        isWithinSeason(
          document.data().submittedAt,
          seasonStartsAt,
          seasonEndsAt,
        ),
    );

  if (
    seasonPredictionSubmissions.length >
    0
  ) {
    const reportsSnapshot =
      await adminDb
        .collection("matchReports")
        .get();

    const resultsByMatchId =
      new Map<
        string,
        {
          matchId:
            string;

          status:
            PredictionResultStatus;

          homeScore?:
            number;

          awayScore?:
            number;
        }
      >();

    for (
      const reportDocument of
      reportsSnapshot.docs
    ) {
      const report =
        reportDocument.data();

      if (
        report.status !==
        "published"
      ) {
        continue;
      }

      const reportData =
        asRecord(
          report.data,
        );

      const status =
        predictionResultStatus(
          reportData.status,
        );

      if (!status) {
        continue;
      }

      const matchId =
        normalizeString(
          report.matchId,
        ) || reportDocument.id;

      const homeScore =
        finiteNumber(
          reportData.homeScore,
        );

      const awayScore =
        finiteNumber(
          reportData.awayScore,
        );

      resultsByMatchId.set(
        matchId,
        {
          matchId,
          status,
          ...(homeScore !== null
            ? { homeScore }
            : {}),
          ...(awayScore !== null
            ? { awayScore }
            : {}),
        },
      );
    }

    for (
      const submissionDocument of
      seasonPredictionSubmissions
    ) {
      const submission =
        submissionDocument.data();

      const participantId =
        normalizeString(
          submission.userId,
        );

      if (!participantId) {
        continue;
      }

      const selections =
        Array.isArray(
          submission.selections,
        )
          ? submission.selections as PredictionSelection[]
          : [];

      const results =
        selections.flatMap(
          (selection) => {
            const result =
              resultsByMatchId.get(
                selection.matchId,
              );

            return result
              ? [result]
              : [];
          },
        );

      addPoints(
        participantId,
        calculatePredictionScore(
          selections,
          results,
        ),
      );
    }
  }

  for (
    const collectionSnapshot of [
      survivorEntries,
      buildXiSubmissions,
    ]
  ) {
    for (
      const document of
      collectionSnapshot.docs
    ) {
      const value =
        document.data();

      if (
        isWithinSeason(
          value.submittedAt ??
            value.createdAt,
          seasonStartsAt,
          seasonEndsAt,
        )
      ) {
        addParticipant(
          value.userId,
        );
      }
    }
  }

  return Array.from(pointsByUser.entries());
},["games-season-scores-v1"],{revalidate:30});

export async function getGamesProfileSummary({
  gamesSeasonId,
  userId,
  displayName,
}: {
  gamesSeasonId:
    string;

  userId:
    string;

  displayName:
    string;
}) {
  return buildGamesProfileSummary({userId,displayName,pointsByUser:new Map(await getGamesSeasonScores(gamesSeasonId))});
}

function isWithinSeason(
  value:
    unknown,
  startsAt:
    number | null,
  endsAt:
    number | null,
) {
  const valueMs =
    timestampToMillis(value);

  if (
    valueMs === null
  ) {
    return true;
  }

  return (
    (startsAt === null || valueMs >= startsAt) &&
    (endsAt === null || valueMs <= endsAt)
  );
}

function timestampToMillis(
  value:
    unknown,
): number | null {
  if (
    value instanceof Date
  ) {
    return value.getTime();
  }

  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  return null;
}

function predictionResultStatus(
  value:
    unknown,
): PredictionResultStatus | null {
  if (
    value === "postponed" ||
    value === "walkover"
  ) {
    return value;
  }

  if (
    value === "played" ||
    value === "finished"
  ) {
    return "played";
  }

  return null;
}

function asRecord(
  value:
    unknown,
): Record<string, unknown> {
  return value &&
    typeof value === "object"
    ? value as Record<string, unknown>
    : {};
}

function finiteNumber(
  value:
    unknown,
): number | null {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null;
}

function normalizeScore(
  value:
    number,
) {
  return Math.max(
    0,
    Math.floor(
      Number.isFinite(value)
        ? value
        : 0,
    ),
  );
}

function normalizeString(
  value:
    unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}
