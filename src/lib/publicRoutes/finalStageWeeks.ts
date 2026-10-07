import type {
  FinalStageMatch,
} from "@/src/types/FinalStageMatch";

export type FinalStageWeek = {
  number: number;
  slug: string;
  startDate: string;
  endDate: string;
  matches: FinalStageMatch[];
};

function parseDate(
  value:
    string,
): Date | null {
  const date =
    new Date(
      `${value}T12:00:00`,
    );

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date;
}

function mondayKey(
  value:
    string,
): string | null {
  const date =
    parseDate(
      value,
    );

  if (!date) {
    return null;
  }

  const day =
    date.getDay();

  const distance =
    day === 0
      ? -6
      : 1 - day;

  date.setDate(
    date.getDate() +
      distance,
  );

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
        1,
    ).padStart(
      2,
      "0",
    );

  const dayOfMonth =
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${dayOfMonth}`;
}

/*
 * Compatibilità temporanea per i documenti legacy che non
 * possiedono ancora finalStageWeek.
 *
 * I nuovi documenti e tutte le modifiche Admin salvano invece
 * sempre finalStageWeek in Firestore.
 */
function buildLegacyWeekMap(
  matches:
    FinalStageMatch[],
): Map<
  string,
  number
> {
  const mondayKeys =
    Array.from(
      new Set(
        matches
          .filter(
            (match) =>
              match.finalStageWeek ===
              undefined,
          )
          .map(
            (match) =>
              mondayKey(
                match.date,
              ),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(
                value,
              ),
          ),
      ),
    ).sort(
      (
        first,
        second,
      ) =>
        first.localeCompare(
          second,
        ),
    );

  return new Map(
    mondayKeys.map(
      (
        key,
        index,
      ) => [
        key,
        index + 1,
      ],
    ),
  );
}

function resolveFinalStageWeekNumber(
  match:
    FinalStageMatch,
  legacyWeekMap:
    Map<
      string,
      number
    >,
): number | null {
  if (
    typeof match.finalStageWeek ===
      "number" &&
    Number.isInteger(
      match.finalStageWeek,
    ) &&
    match.finalStageWeek >
      0
  ) {
    return match.finalStageWeek;
  }

  const key =
    mondayKey(
      match.date,
    );

  return key
    ? legacyWeekMap.get(
        key,
      ) ??
        null
    : null;
}

export function buildFinalStageWeeks(
  matches:
    FinalStageMatch[],
): FinalStageWeek[] {
  const grouped =
    new Map<
      number,
      FinalStageMatch[]
    >();

  const legacyWeekMap =
    buildLegacyWeekMap(
      matches,
    );

  for (
    const match of
    matches
  ) {
    const weekNumber =
      resolveFinalStageWeekNumber(
        match,
        legacyWeekMap,
      );

    if (
      !weekNumber
    ) {
      continue;
    }

    const current =
      grouped.get(
        weekNumber,
      ) ?? [];

    current.push(
      match,
    );

    grouped.set(
      weekNumber,
      current,
    );
  }

  return Array.from(
    grouped.entries(),
  )
    .sort(
      (
        [first],
        [second],
      ) =>
        first -
        second,
    )
    .map(
      (
        [
          number,
          weekMatches,
        ],
      ) => {
        const sortedMatches =
          [...weekMatches].sort(
            (
              first,
              second,
            ) =>
              `${first.date} ${first.time}`.localeCompare(
                `${second.date} ${second.time}`,
              ),
          );

        const startDate =
          sortedMatches[0]
            ?.date ??
          "";

        const endDate =
          sortedMatches.at(
            -1,
          )?.date ??
          startDate;

        return {
          number,
          slug:
            `fs${number}`,
          startDate,
          endDate,
          matches:
            sortedMatches,
        };
      },
    );
}

export function getFinalStageWeek(
  matches:
    FinalStageMatch[],
  number:
    number,
): FinalStageWeek | undefined {
  return buildFinalStageWeeks(
    matches,
  ).find(
    (week) =>
      week.number ===
      number,
  );
}
