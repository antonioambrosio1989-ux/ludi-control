import type {
  GamesPassPricePeriod,
} from "@/src/types/GamesSeason";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

export type ResolvedGamesPassPrice = {
  id:
    string;

  name:
    string;

  priceCents:
    number;

  startsAt:
    Date;

  endsAt?:
    Date;
};

/*
 * ============================================================
 * RESOLVE CURRENT PRICE
 * ============================================================
 */

export function resolveCurrentGamesPassPrice(
  periods:
    GamesPassPricePeriod[],

  now:
    Date = new Date(),
): ResolvedGamesPassPrice | null {
  const nowTime =
    now.getTime();

  const matchingPeriods =
    periods
      .map(
        normalizePricePeriod,
      )
      .filter(
        (
          period,
        ): period is ResolvedGamesPassPrice =>
          period !==
          null,
      )
      .filter(
        (
          period,
        ) => {
          if (
            nowTime <
            period.startsAt.getTime()
          ) {
            return false;
          }

          if (
            period.endsAt &&
            nowTime >
              getEndOfDayTimestamp(
                period.endsAt,
              )
          ) {
            return false;
          }

          return true;
        },
      )
      .sort(
        (
          first,
          second,
        ) =>
          second.startsAt.getTime() -
          first.startsAt.getTime(),
      );

  return (
    matchingPeriods[0] ??
    null
  );
}

/*
 * ============================================================
 * NORMALIZATION
 * ============================================================
 */

function normalizePricePeriod(
  period:
    GamesPassPricePeriod,
): ResolvedGamesPassPrice | null {
  const startsAt =
    convertToDate(
      period.startsAt,
    );

  const endsAt =
    convertToDate(
      period.endsAt,
    );

  if (
    !period.id.trim() ||
    !period.name.trim() ||
    !Number.isInteger(
      period.priceCents,
    ) ||
    period.priceCents <=
      0 ||
    !startsAt
  ) {
    return null;
  }

  return {
    id:
      period.id.trim(),

    name:
      period.name.trim(),

    priceCents:
      period.priceCents,

    startsAt,

    endsAt:
      endsAt ??
      undefined,
  };
}

function convertToDate(
  value:
    unknown,
): Date | null {
  if (
    !value
  ) {
    return null;
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

  return null;
}

function getEndOfDayTimestamp(
  date:
    Date,
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