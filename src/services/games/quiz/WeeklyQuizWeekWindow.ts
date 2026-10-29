const QUIZ_TIME_ZONE =
  "Europe/Rome";

const QUIZ_START_HOUR =
  10;

const QUIZ_ROLLOVER_HOUR =
  2;

const THURSDAY =
  4;


// Nuovo calendario a partire dal rollover di venerdÃ¬ 30 ottobre 2026.
const FRIDAY_SWITCH_AT =
  new Date("2026-10-30T01:00:00.000Z");

const DAY_MS =
  24 * 60 * 60 * 1000;

type LocalDate = {
  year: number;
  month: number;
  day: number;
};

type LocalDateTime =
  LocalDate & {
    hour: number;
    minute: number;
    second: number;
  };

/*
 * Prima finestra ufficiale Ludi Games 2026/27.
 * La Games Season puÃ² essere giÃ  iniziata, ma la Weekly Challenge
 * non deve creare finestre ufficiali prima del 1 ottobre 2026.
 */
const QUIZ_OFFICIAL_FIRST_WEEK_DATE:
  LocalDate = {
    year: 2026,
    month: 10,
    day: 1,
  };

/*
 * ============================================================
 * WEEKLY QUIZ WINDOW
 * ============================================================
 *
 * Regola ufficiale (Europe/Rome):
 *
 * - la Week 1 storica resta ancorata a giovedÃ¬ 1 ottobre 2026 alle 10:00;
 * - dalla Week 5 (30 ottobre 2026) la Weekly Challenge parte il venerdÃ¬ alle 10:00;
 * - la finestra ordinaria termina il venerdÃ¬ successivo alle 02:00;
 * - dalle 02:00 alle 10:00 il nuovo Quiz Ã¨ in finestra di
 *   revisione: la settimana nuova Ã¨ giÃ  quella corrente per
 *   Admin/generazione, ma non Ã¨ ancora giocabile dal pubblico;
 * - dopo il passaggio, il cambio di weekNumber avviene alle 02:00 del venerdÃ¬.
 *
 * Il calcolo usa esplicitamente Europe/Rome e non il fuso orario
 * del browser/server, cosÃ¬ resta corretto anche con ora legale.
 * ============================================================
 */
export function resolveWeekWindow({
  gamesSeasonStartsAt,
  gamesSeasonEndsAt,
  targetDate,
}: {
  gamesSeasonStartsAt:
    Date;

  gamesSeasonEndsAt:
    Date;

  targetDate:
    Date;
}) {
  const seasonStartLocal =
    getRomeParts(
      gamesSeasonStartsAt,
    );

  const seasonEndLocal =
    getRomeParts(
      gamesSeasonEndsAt,
    );

  const seasonStart =
    toRomeDateTime(
      {
        year:
          seasonStartLocal.year,
        month:
          seasonStartLocal.month,
        day:
          seasonStartLocal.day,
      },
      0,
      0,
      0,
      0,
    );

  const seasonEnd =
    toRomeDateTime(
      {
        year:
          seasonEndLocal.year,
        month:
          seasonEndLocal.month,
        day:
          seasonEndLocal.day,
      },
      23,
      59,
      59,
      999,
    );

  const target =
    new Date(
      targetDate,
    );

  if (
    Number.isNaN(
      target.getTime(),
    ) ||
    target.getTime() <
      seasonStart.getTime() ||
    target.getTime() >
      seasonEnd.getTime()
  ) {
    throw new Error(
      "La data selezionata non rientra nella Games Season.",
    );
  }

  const useFriday =
    target.getTime() >= FRIDAY_SWITCH_AT.getTime();

  const seasonFirstThursday =
    findFirstThursday(
      {
        year:
          seasonStartLocal.year,
        month:
          seasonStartLocal.month,
        day:
          seasonStartLocal.day,
      },
    );

  /*
   * Per la stagione di lancio non devono esistere Weekly Challenge
   * ufficiali prima del 1 ottobre 2026. Per eventuali Games Season
   * future, iniziate dopo quella data, resta valido il primo giovedÃ¬
   * della relativa stagione.
   */
  const firstThursday =
    localDateOrdinal(
      seasonFirstThursday,
    ) <
    localDateOrdinal(
      QUIZ_OFFICIAL_FIRST_WEEK_DATE,
    )
      ? QUIZ_OFFICIAL_FIRST_WEEK_DATE
      : seasonFirstThursday;

  // Manteniamo la numerazione storica: Week 1 = 1/2 ottobre,
  // Week 5 = 29/30 ottobre. Dopo il passaggio, le nuove finestre
  // iniziano il venerdÃ¬ senza rinumerare le settimane precedenti.
  const firstWeekDate = useFriday
    ? addLocalDays(firstThursday, 1)
    : firstThursday;

  const firstRolloverDate =
    addLocalDays(
      firstWeekDate,
      7,
    );

  const firstRolloverAt =
    toRomeDateTime(
      firstRolloverDate,
      QUIZ_ROLLOVER_HOUR,
      0,
      0,
      0,
    );

  let weekNumber =
    1;

  /*
   * Prima delle 02:00 del giorno di rollover siamo ancora nella
   * Week 1. Dalle 02:00 in poi l'Admin deve invece vedere/preparare
   * immediatamente la Week 2, anche se inizierÃ  pubblicamente alle 10.
   */
  if (
    target.getTime() >=
    firstRolloverAt.getTime()
  ) {
    const targetLocal =
      getRomeParts(
        target,
      );

    const daysFromFirstRollover =
      localDateOrdinal({
        year:
          targetLocal.year,
        month:
          targetLocal.month,
        day:
          targetLocal.day,
      }) -
      localDateOrdinal(
        firstRolloverDate,
      );

    let rolloverIndex =
      Math.max(
        0,
        Math.floor(
          daysFromFirstRollover /
            7,
        ),
      );

    const candidateRolloverDate =
      addLocalDays(
        firstRolloverDate,
        rolloverIndex *
          7,
      );

    const candidateRolloverAt =
      toRomeDateTime(
        candidateRolloverDate,
        QUIZ_ROLLOVER_HOUR,
        0,
        0,
        0,
      );

    if (
      target.getTime() <
      candidateRolloverAt.getTime()
    ) {
      rolloverIndex =
        Math.max(
          0,
          rolloverIndex -
            1,
        );
    }

    weekNumber =
      rolloverIndex +
      2;
  }

  const startsLocalDate =
    addLocalDays(
      firstWeekDate,
      (
        weekNumber -
        1
      ) *
        7,
    );

  const endsLocalDate =
    addLocalDays(
      firstWeekDate,
      weekNumber *
        7,
    );

  const startsAt =
    toRomeDateTime(
      startsLocalDate,
      QUIZ_START_HOUR,
      0,
      0,
      0,
    );

  const naturalEndsAt =
    toRomeDateTime(
      endsLocalDate,
      QUIZ_ROLLOVER_HOUR,
      0,
      0,
      0,
    );

  if (
    startsAt.getTime() >
    seasonEnd.getTime()
  ) {
    throw new Error(
      "Non esiste una nuova Weekly Challenge entro la fine della Games Season.",
    );
  }

  const endsAt =
    new Date(
      Math.min(
        naturalEndsAt.getTime(),
        seasonEnd.getTime(),
      ),
    );

  return {
    weekNumber,
    startsAt,
    endsAt,
  };
}

/*
 * ============================================================
 * EUROPE/ROME HELPERS
 * ============================================================
 */

function getRomeParts(
  value:
    Date,
): LocalDateTime {
  const formatter =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          QUIZ_TIME_ZONE,
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
        hour:
          "2-digit",
        minute:
          "2-digit",
        second:
          "2-digit",
        hourCycle:
          "h23",
      },
    );

  const parts =
    Object.fromEntries(
      formatter
        .formatToParts(
          value,
        )
        .filter(
          (
            part,
          ) =>
            part.type !==
            "literal",
        )
        .map(
          (
            part,
          ) => [
            part.type,
            part.value,
          ],
        ),
    );

  return {
    year:
      Number(
        parts.year,
      ),
    month:
      Number(
        parts.month,
      ),
    day:
      Number(
        parts.day,
      ),
    hour:
      Number(
        parts.hour,
      ),
    minute:
      Number(
        parts.minute,
      ),
    second:
      Number(
        parts.second,
      ),
  };
}

function findFirstThursday(
  value:
    LocalDate,
): LocalDate {
  const weekday =
    new Date(
      Date.UTC(
        value.year,
        value.month -
          1,
        value.day,
      ),
    ).getUTCDay();

  const daysUntilThursday =
    (
      THURSDAY -
      weekday +
      7
    ) %
    7;

  return addLocalDays(
    value,
    daysUntilThursday,
  );
}

function addLocalDays(
  value:
    LocalDate,
  days:
    number,
): LocalDate {
  const date =
    new Date(
      Date.UTC(
        value.year,
        value.month -
          1,
        value.day +
          days,
      ),
    );

  return {
    year:
      date.getUTCFullYear(),
    month:
      date.getUTCMonth() +
      1,
    day:
      date.getUTCDate(),
  };
}

function localDateOrdinal(
  value:
    LocalDate,
): number {
  return Math.floor(
    Date.UTC(
      value.year,
      value.month -
        1,
      value.day,
    ) /
      DAY_MS,
  );
}

function toRomeDateTime(
  localDate:
    LocalDate,
  hour:
    number,
  minute:
    number,
  second:
    number,
  millisecond:
    number,
): Date {
  const desiredWallClockMs =
    Date.UTC(
      localDate.year,
      localDate.month -
        1,
      localDate.day,
      hour,
      minute,
      second,
      millisecond,
    );

  let instantMs =
    desiredWallClockMs;

  /*
   * Due correzioni sono sufficienti anche vicino ai cambi DST:
   * riformattiamo l'istante in Europe/Rome e correggiamo la
   * differenza rispetto all'orario locale desiderato.
   */
  for (
    let index =
      0;
    index <
    3;
    index +=
      1
  ) {
    const actual =
      getRomeParts(
        new Date(
          instantMs,
        ),
      );

    const actualWallClockMs =
      Date.UTC(
        actual.year,
        actual.month -
          1,
        actual.day,
        actual.hour,
        actual.minute,
        actual.second,
        millisecond,
      );

    const delta =
      desiredWallClockMs -
      actualWallClockMs;

    if (
      delta ===
      0
    ) {
      break;
    }

    instantMs +=
      delta;
  }

  return new Date(
    instantMs,
  );
}

