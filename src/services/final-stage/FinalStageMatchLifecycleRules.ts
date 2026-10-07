import type {
  FinalStageMatch,
} from "@/src/types/FinalStageMatch";

export const FINAL_STAGE_LIVE_KICKOFF_DELAY_MINUTES =
  15;

export const FINAL_STAGE_MATCHDAY_CHANGE_HOUR =
  2;

export type FinalStageAutomaticLiveSelection =
  | {
      status:
        "idle";
    }
  | {
      status:
        "already-live";
      match:
        FinalStageMatch;
    }
  | {
      status:
        "start";
      match:
        FinalStageMatch;
    };

export function resolveFinalStageMatchdayDateKey(
  currentTime:
    Date,
): string {
  const effectiveDate =
    new Date(
      currentTime,
    );

  if (
    effectiveDate.getHours() <
    FINAL_STAGE_MATCHDAY_CHANGE_HOUR
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

export function getFinalStageAutomaticLiveStartsAt(
  match:
    FinalStageMatch,
): Date | null {
  const scheduled =
    createLocalMatchDate(
      match.date,
      match.time,
    );

  if (
    !scheduled
  ) {
    return null;
  }

  return new Date(
    scheduled.getTime() +
      FINAL_STAGE_LIVE_KICKOFF_DELAY_MINUTES *
        60 *
        1000,
  );
}

export function selectAutomaticFinalStageLiveMatch({
  matches,
  currentTime,
}: {
  matches:
    FinalStageMatch[];

  currentTime:
    Date;
}): FinalStageAutomaticLiveSelection {
  const matchdayDate =
    resolveFinalStageMatchdayDateKey(
      currentTime,
    );

  const eligibleMatches =
    matches
      .filter(
        (
          match,
        ) =>
          match.published &&
          match.date ===
            matchdayDate,
      )
      .slice()
      .sort(
        (
          first,
          second,
        ) =>
          first.time.localeCompare(
            second.time,
          ) ||
          (
            first.matchOrder ??
            999
          ) -
          (
            second.matchOrder ??
            999
          ),
      );

  const alreadyLive =
    eligibleMatches.find(
      (
        match,
      ) =>
        match.status ===
        "live",
    );

  if (
    alreadyLive
  ) {
    return {
      status:
        "already-live",
      match:
        alreadyLive,
    };
  }

  /*
   * La prima gara ancora scheduled rappresenta il blocco della
   * sequenza: finché non viene chiusa manualmente nessuna gara
   * successiva può entrare LIVE.
   */
  for (
    const match of
    eligibleMatches
  ) {
    if (
      match.status ===
        "finished" ||
      match.status ===
        "played" ||
      match.status ===
        "walkover" ||
      match.status ===
        "postponed" ||
      match.status ===
        "cancelled"
    ) {
      continue;
    }

    if (
      match.status !==
      "scheduled"
    ) {
      return {
        status:
          "idle",
      };
    }

    const liveStartsAt =
      getFinalStageAutomaticLiveStartsAt(
        match,
      );

    if (
      !liveStartsAt ||
      currentTime <
        liveStartsAt
    ) {
      return {
        status:
          "idle",
      };
    }

    return {
      status:
        "start",
      match,
    };
  }

  return {
    status:
      "idle",
  };
}

function createLocalMatchDate(
  matchDate:
    string,
  matchTime:
    string,
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

  const values = [
    Number(
      yearValue,
    ),
    Number(
      monthValue,
    ),
    Number(
      dayValue,
    ),
    Number(
      hourValue,
    ),
    Number(
      minuteValue,
    ),
  ];

  if (
    values.some(
      (
        value,
      ) =>
        !Number.isInteger(
          value,
        ),
    )
  ) {
    return null;
  }

  const [
    year,
    month,
    day,
    hour,
    minute,
  ] =
    values;

  if (
    month <
      1 ||
    month >
      12 ||
    day <
      1 ||
    day >
      31 ||
    hour <
      0 ||
    hour >
      23 ||
    minute <
      0 ||
    minute >
      59
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
