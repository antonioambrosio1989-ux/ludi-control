import type {
  GamesProfileSummary,
} from "@/src/types/GamesProfile";

export const GAMES_POINTS_PER_LEVEL =
  500;

export function resolveGamesLevel(
  points:
    number,
) {
  const safePoints =
    Math.max(
      0,
      Math.floor(
        Number.isFinite(points)
          ? points
          : 0,
      ),
    );

  const level =
    Math.floor(
      safePoints /
        GAMES_POINTS_PER_LEVEL,
    ) + 1;

  const levelStartPoints =
    (level - 1) *
    GAMES_POINTS_PER_LEVEL;

  const nextLevelPoints =
    level *
    GAMES_POINTS_PER_LEVEL;

  const levelProgressPercent =
    Math.round(
      ((safePoints - levelStartPoints) /
        GAMES_POINTS_PER_LEVEL) *
        100,
    );

  return {
    points:
      safePoints,

    level,

    levelStartPoints,

    nextLevelPoints,

    levelProgressPercent,
  };
}

export function buildGamesProfileSummary({
  userId,
  displayName,
  pointsByUser,
}: {
  userId:
    string;

  displayName:
    string;

  pointsByUser:
    Map<string, number>;
}): GamesProfileSummary {
  const ownPoints =
    pointsByUser.get(
      userId,
    ) ?? 0;

  const progression =
    resolveGamesLevel(
      ownPoints,
    );

  const rankedScores =
    [...pointsByUser.values()]
      .map((points) =>
        Math.max(
          0,
          Math.floor(points),
        ),
      )
      .sort((left, right) =>
        right - left,
      );

  const position =
    pointsByUser.has(userId)
      ? rankedScores.findIndex(
          (points) =>
            points ===
            progression.points,
        ) + 1
      : null;

  return {
    displayName,
    ...progression,
    position,
    participants:
      pointsByUser.size,
  };
}
