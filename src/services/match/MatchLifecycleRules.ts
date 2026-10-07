import type {
  Match,
} from "@/src/types/Match";

export const LIVE_KICKOFF_DELAY_MINUTES =
  15;

export const MATCHDAY_CHANGE_HOUR =
  2;

export type MatchLifecycleSelection =
  | {
      status:
        "already-live";
      match:
        Match;
    }
  | {
      status:
        "start";
      match:
        Match;
    }
  | {
      status:
        "idle";
    };

export function resolveMatchdayDateKey(
  currentTime: Date,
): string {
  const effectiveDate =
    new Date(
      currentTime,
    );

  if (
    effectiveDate.getHours() <
    MATCHDAY_CHANGE_HOUR
  ) {
    effectiveDate.setDate(
      effectiveDate.getDate() -
        1,
    );
  }

  const year =
    effectiveDate.getFullYear();

  const month =
    String(
      effectiveDate.getMonth() +
        1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      effectiveDate.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}`;
}

export function getAutomaticLiveStartsAt(
  match: Pick<
    Match,
    "date" | "time"
  >,
): Date | null {
  const scheduled =
    createLocalMatchDate(
      match.date,
      match.time,
    );

  if (!scheduled) {
    return null;
  }

  return new Date(
    scheduled.getTime() +
      LIVE_KICKOFF_DELAY_MINUTES *
        60 *
        1000,
  );
}

export function selectAutomaticLiveMatch({
  matches,
  currentTime,
}: {
  matches: Match[];
  currentTime: Date;
}): MatchLifecycleSelection {
  const matchdayDate =
    resolveMatchdayDateKey(
      currentTime,
    );

  const matchdayMatches =
    matches
      .filter(
        (match) =>
          match.published &&
          match.date ===
            matchdayDate,
      )
      .sort(
        (
          first,
          second,
        ) =>
          first.time.localeCompare(
            second.time,
          ),
      );

  const currentLive =
    matchdayMatches.find(
      (match) =>
        match.status ===
        "live",
    );

  if (currentLive) {
    return {
      status:
        "already-live",
      match:
        currentLive,
    };
  }

  const dueMatch =
    matchdayMatches.find(
      (match) => {
        if (
          match.status !==
          "scheduled"
        ) {
          return false;
        }

        const startsAt =
          getAutomaticLiveStartsAt(
            match,
          );

        return (
          startsAt !==
            null &&
          currentTime.getTime() >=
            startsAt.getTime()
        );
      },
    );

  if (!dueMatch) {
    return {
      status:
        "idle",
    };
  }

  return {
    status:
      "start",
    match:
      dueMatch,
  };
}

export function assertLiveScore(
  homeScore: number,
  awayScore: number,
): void {
  if (
    !Number.isInteger(
      homeScore,
    ) ||
    !Number.isInteger(
      awayScore,
    ) ||
    homeScore < 0 ||
    awayScore < 0
  ) {
    throw new Error(
      "Il risultato deve contenere numeri interi maggiori o uguali a zero.",
    );
  }
}

function createLocalMatchDate(
  matchDate: string,
  matchTime: string,
): Date | null {
  const [
    yearValue,
    monthValue,
    dayValue,
  ] =
    matchDate.split(
      "-",
    );

  const [
    hourValue,
    minuteValue,
  ] =
    matchTime.split(
      ":",
    );

  const year =
    Number(
      yearValue,
    );

  const month =
    Number(
      monthValue,
    );

  const day =
    Number(
      dayValue,
    );

  const hour =
    Number(
      hourValue,
    );

  const minute =
    Number(
      minuteValue,
    );

  const values = [
    year,
    month,
    day,
    hour,
    minute,
  ];

  if (
    values.some(
      (value) =>
        !Number.isInteger(
          value,
        ),
    )
  ) {
    return null;
  }

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    0,
    0,
  );
}
