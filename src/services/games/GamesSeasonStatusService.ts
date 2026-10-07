import type {
  GamesSeason,
} from "@/src/types/GamesSeason";

export type GamesSeasonTemporalStatus =
  | "upcoming"
  | "active"
  | "expired"
  | "legacy_archived"
  | "invalid";

/*
 * ============================================================
 * TEMPORAL STATUS
 * ============================================================
 */

export function getGamesSeasonTemporalStatus(
  gamesSeason: GamesSeason,
  now: Date = new Date(),
): GamesSeasonTemporalStatus {
  if (
    gamesSeason.status ===
    "archived"
  ) {
    return "legacy_archived";
  }

  const startsAt =
    toGamesDate(
      gamesSeason.startsAt,
    );

  const endsAt =
    toGamesDate(
      gamesSeason.endsAt,
    );

  if (
    !startsAt ||
    !endsAt
  ) {
    return "invalid";
  }

  const nowTime =
    now.getTime();

  const startsAtTime =
    startsAt.getTime();

  const endsAtTime =
    getEndOfDayTimestamp(
      endsAt,
    );

  if (
    nowTime <
    startsAtTime
  ) {
    return "upcoming";
  }

  if (
    nowTime >
    endsAtTime
  ) {
    return "expired";
  }

  return "active";
}

export function isGamesSeasonEffectivelyActive(
  gamesSeason: GamesSeason,
  now: Date = new Date(),
): boolean {
  return (
    getGamesSeasonTemporalStatus(
      gamesSeason,
      now,
    ) ===
    "active"
  );
}

export function isGamesSeasonManageable(
  gamesSeason: GamesSeason,
  now: Date = new Date(),
): boolean {
  const status =
    getGamesSeasonTemporalStatus(
      gamesSeason,
      now,
    );

  return (
    status ===
      "active" ||
    status ===
      "upcoming"
  );
}

/*
 * ============================================================
 * SELECTION
 * ============================================================
 */

export function selectActiveGamesSeason(
  gamesSeasons: GamesSeason[],
  now: Date = new Date(),
): GamesSeason | undefined {
  return gamesSeasons
    .filter(
      (
        gamesSeason,
      ) =>
        isGamesSeasonEffectivelyActive(
          gamesSeason,
          now,
        ),
    )
    .sort(
      compareByStartsAtDesc,
    )[0];
}

export function selectManagedGamesSeason(
  gamesSeasons: GamesSeason[],
  now: Date = new Date(),
): GamesSeason | undefined {
  const active =
    selectActiveGamesSeason(
      gamesSeasons,
      now,
    );

  if (
    active
  ) {
    return active;
  }

  return gamesSeasons
    .filter(
      (
        gamesSeason,
      ) =>
        getGamesSeasonTemporalStatus(
          gamesSeason,
          now,
        ) ===
        "upcoming",
    )
    .sort(
      compareByStartsAtAsc,
    )[0];
}

/*
 * ============================================================
 * NEXT BOUNDARY
 * ============================================================
 *
 * Serve a far scattare automaticamente in UI:
 *
 * - l'inizio di una Games Season futura;
 * - la fine della Games Season corrente.
 * ============================================================
 */

export function getNextGamesSeasonBoundaryTimestamp(
  gamesSeasons: GamesSeason[],
  now: Date = new Date(),
): number | null {
  const nowTime =
    now.getTime();

  const boundaries:
    number[] = [];

  for (
    const gamesSeason of
    gamesSeasons
  ) {
    if (
      gamesSeason.status ===
      "archived"
    ) {
      continue;
    }

    const startsAt =
      toGamesDate(
        gamesSeason.startsAt,
      );

    const endsAt =
      toGamesDate(
        gamesSeason.endsAt,
      );

    if (
      startsAt &&
      startsAt.getTime() >
        nowTime
    ) {
      boundaries.push(
        startsAt.getTime(),
      );
    }

    if (
      endsAt
    ) {
      const expiration =
        getEndOfDayTimestamp(
          endsAt,
        ) +
        1;

      if (
        expiration >
        nowTime
      ) {
        boundaries.push(
          expiration,
        );
      }
    }
  }

  if (
    boundaries.length ===
    0
  ) {
    return null;
  }

  return Math.min(
    ...boundaries,
  );
}

/*
 * ============================================================
 * OVERLAP
 * ============================================================
 */

export function gamesSeasonsOverlap(
  firstStartsAt: Date,
  firstEndsAt: Date,
  secondStartsAt: Date,
  secondEndsAt: Date,
): boolean {
  const firstStart =
    firstStartsAt.getTime();

  const firstEnd =
    getEndOfDayTimestamp(
      firstEndsAt,
    );

  const secondStart =
    secondStartsAt.getTime();

  const secondEnd =
    getEndOfDayTimestamp(
      secondEndsAt,
    );

  return (
    firstStart <=
      secondEnd &&
    secondStart <=
      firstEnd
  );
}

/*
 * ============================================================
 * DATE HELPERS
 * ============================================================
 */

export function toGamesDate(
  value: unknown,
): Date | undefined {
  if (
    !value
  ) {
    return undefined;
  }

  if (
    value instanceof
    Date
  ) {
    return value;
  }

  if (
    typeof value ===
      "object" &&
    value !==
      null &&
    "toDate" in
      value &&
    typeof (
      value as {
        toDate?: unknown;
      }
    ).toDate ===
      "function"
  ) {
    return (
      value as {
        toDate: () => Date;
      }
    ).toDate();
  }

  return undefined;
}

export function getEndOfDayTimestamp(
  date: Date,
): number {
  const endOfDay =
    new Date(
      date,
    );

  endOfDay.setHours(
    23,
    59,
    59,
    999,
  );

  return endOfDay.getTime();
}

function compareByStartsAtAsc(
  first: GamesSeason,
  second: GamesSeason,
): number {
  return (
    getStartTimestamp(
      first,
    ) -
    getStartTimestamp(
      second,
    )
  );
}

function compareByStartsAtDesc(
  first: GamesSeason,
  second: GamesSeason,
): number {
  return (
    getStartTimestamp(
      second,
    ) -
    getStartTimestamp(
      first,
    )
  );
}

function getStartTimestamp(
  gamesSeason: GamesSeason,
): number {
  return (
    toGamesDate(
      gamesSeason.startsAt,
    )?.getTime() ??
    0
  );
}
