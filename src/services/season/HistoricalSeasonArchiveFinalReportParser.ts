import * as XLSX from "xlsx";

import {
  SHEETS,
} from "@/src/services/season/HistoricalSeasonArchiveSheetParsers";

import type {
  HistoricalChampionsFinalReport,
  HistoricalFinalPenaltyKick,
  HistoricalFinalPenaltyKickResult,
  HistoricalFinalReportGoalMinute,
  HistoricalFinalReportPlayer,
} from "@/src/services/season/HistoricalSeasonArchiveTypes";

import {
  cleanString,
  integerOrZero,
  normalizeText,
  optionalInteger,
  optionalNumber,
  optionalString,
  requiredInteger,
} from "@/src/services/season/HistoricalSeasonArchiveParserUtils";

/*
 * ============================================================
 * TABELLINO FINALE CHAMPIONS
 *
 * HOME
 *
 * A1 = titolo
 * A2 = teamCode
 * B2 = risultato al 90'
 * C2 = risultato complessivo dopo supplementari
 * D2 = rigori
 * riga 3 = intestazioni
 * riga 4...15 = giocatori
 *
 * AWAY
 *
 * A16 = titolo
 * A17 = teamCode
 * B17 = risultato al 90'
 * C17 = risultato complessivo dopo supplementari
 * D17 = rigori
 * riga 18 = intestazioni
 * riga 19...30 = giocatori
 *
 * RIGORI
 *
 * riga 31 = titoli
 * riga 32 = intestazioni
 * righe 33...42 = sequenza tiri
 * CASA: A ordine, B playerSeasonCode, C esito
 * OSPITI: E ordine, F playerSeasonCode, G esito
 * ============================================================
 */

export function parseChampionsFinalReport(
  workbook:
    XLSX.WorkBook,
): HistoricalChampionsFinalReport | undefined {
  const worksheet =
    workbook.Sheets[
      SHEETS.championsFinalReport
    ];

  if (
    !worksheet
  ) {
    return undefined;
  }

  const matrix =
    XLSX.utils.sheet_to_json<
      unknown[]
    >(
      worksheet,
      {
        header:
          1,

        defval:
          "",

        raw:
          true,
      },
    );

  const homeTeamCode =
    optionalString(
      matrix[1]?.[0],
    );

  const awayTeamCode =
    optionalString(
      matrix[16]?.[0],
    );

  /*
   * Foglio completamente vuoto.
   */

  if (
    !homeTeamCode &&
    !awayTeamCode
  ) {
    return undefined;
  }

  if (
    !homeTeamCode ||
    !awayTeamCode
  ) {
    throw new Error(
      'Il foglio "Tabellino_Finale_Champions" non contiene entrambe le squadre.',
    );
  }

  /*
   * ==========================================================
   * RISULTATO
   * ==========================================================
   */

  const homeScore =
    requiredInteger(
      matrix[1]?.[1],

      "gol squadra casa al 90'",

      SHEETS.championsFinalReport,
    );

  const awayScore =
    requiredInteger(
      matrix[16]?.[1],

      "gol squadra ospite al 90'",

      SHEETS.championsFinalReport,
    );

  const homeExtraTimeScore =
    optionalInteger(
      matrix[1]?.[2],
    );

  const awayExtraTimeScore =
    optionalInteger(
      matrix[16]?.[2],
    );

  const homePenalties =
    optionalInteger(
      matrix[1]?.[3],
    );

  const awayPenalties =
    optionalInteger(
      matrix[16]?.[3],
    );

  validateFinalScoreMetadata({
    homeScore,
    awayScore,
    homeExtraTimeScore,
    awayExtraTimeScore,
    homePenalties,
    awayPenalties,
  });

  /*
   * ==========================================================
   * GIOCATORI
   * ==========================================================
   */

  const homePlayers =
    parseFinalReportPlayers({
      matrix,

      startRowIndex:
        3,

      endRowIndex:
        14,
    });

  const awayPlayers =
    parseFinalReportPlayers({
      matrix,

      startRowIndex:
        18,

      endRowIndex:
        29,
    });

  /*
   * ==========================================================
   * SEQUENZA RIGORI
   * ==========================================================
   */

  const homePenaltyKicks =
    parsePenaltyKicks({
      matrix,

      startRowIndex:
        32,

      endRowIndex:
        41,

      orderColumnIndex:
        0,

      playerColumnIndex:
        1,

      resultColumnIndex:
        2,

      sideLabel:
        "casa",
    });

  const awayPenaltyKicks =
    parsePenaltyKicks({
      matrix,

      startRowIndex:
        32,

      endRowIndex:
        41,

      orderColumnIndex:
        4,

      playerColumnIndex:
        5,

      resultColumnIndex:
        6,

      sideLabel:
        "ospiti",
    });

  validatePenaltyScoreAgainstSequence({
    homePenalties,
    awayPenalties,
    homePenaltyKicks,
    awayPenaltyKicks,
  });

  return {
    homeTeamCode,

    awayTeamCode,

    homeScore,

    awayScore,

    ...(homeExtraTimeScore !==
    undefined
      ? {
          homeExtraTimeScore,
        }
      : {}),

    ...(awayExtraTimeScore !==
    undefined
      ? {
          awayExtraTimeScore,
        }
      : {}),

    ...(homePenalties !==
    undefined
      ? {
          homePenalties,
        }
      : {}),

    ...(awayPenalties !==
    undefined
      ? {
          awayPenalties,
        }
      : {}),

    homePenaltyKicks,

    awayPenaltyKicks,

    homePlayers,

    awayPlayers,
  };
}

/*
 * ============================================================
 * VALIDAZIONE RISULTATO FINALE
 * ============================================================
 */

function validateFinalScoreMetadata({
  homeScore,
  awayScore,
  homeExtraTimeScore,
  awayExtraTimeScore,
  homePenalties,
  awayPenalties,
}: {
  homeScore:
    number;

  awayScore:
    number;

  homeExtraTimeScore?:
    number;

  awayExtraTimeScore?:
    number;

  homePenalties?:
    number;

  awayPenalties?:
    number;
}) {
  const hasHomeExtraTime =
    homeExtraTimeScore !==
    undefined;

  const hasAwayExtraTime =
    awayExtraTimeScore !==
    undefined;

  if (
    hasHomeExtraTime !==
    hasAwayExtraTime
  ) {
    throw new Error(
      'Nel foglio "Tabellino_Finale_Champions" il risultato dopo supplementari deve essere compilato per entrambe le squadre oppure lasciato vuoto per entrambe.',
    );
  }

  if (
    homeExtraTimeScore !==
      undefined &&
    awayExtraTimeScore !==
      undefined
  ) {
    if (
      homeExtraTimeScore <
        homeScore ||
      awayExtraTimeScore <
        awayScore
    ) {
      throw new Error(
        'Nel foglio "Tabellino_Finale_Champions" il risultato dopo supplementari non può essere inferiore al risultato al 90\'.',
      );
    }

    if (
      homeScore !==
      awayScore
    ) {
      throw new Error(
        'Nel foglio "Tabellino_Finale_Champions" i supplementari possono essere indicati solo se il risultato al 90\' è in parità.',
      );
    }
  }

  const hasHomePenalties =
    homePenalties !==
    undefined;

  const hasAwayPenalties =
    awayPenalties !==
    undefined;

  if (
    hasHomePenalties !==
    hasAwayPenalties
  ) {
    throw new Error(
      'Nel foglio "Tabellino_Finale_Champions" il risultato ai rigori deve essere compilato per entrambe le squadre oppure lasciato vuoto per entrambe.',
    );
  }

  if (
    homePenalties !==
      undefined &&
    awayPenalties !==
      undefined
  ) {
    const homeFinalScore =
      homeExtraTimeScore ??
      homeScore;

    const awayFinalScore =
      awayExtraTimeScore ??
      awayScore;

    if (
      homeFinalScore !==
      awayFinalScore
    ) {
      throw new Error(
        'Nel foglio "Tabellino_Finale_Champions" i rigori possono essere indicati solo se la partita è ancora in parità dopo i supplementari (o al 90\' se i supplementari non sono previsti).',
      );
    }

    if (
      homePenalties ===
      awayPenalties
    ) {
      throw new Error(
        'Nel foglio "Tabellino_Finale_Champions" la serie di rigori deve avere un vincitore.',
      );
    }
  }
}

/*
 * ============================================================
 * GIOCATORI TABELLINO FINALE
 * ============================================================
 */

function parseFinalReportPlayers({
  matrix,
  startRowIndex,
  endRowIndex,
}: {
  matrix:
    unknown[][];

  startRowIndex:
    number;

  endRowIndex:
    number;
}): HistoricalFinalReportPlayer[] {
  const players:
    HistoricalFinalReportPlayer[] =
    [];

  for (
    let rowIndex =
      startRowIndex;

    rowIndex <=
    endRowIndex;

    rowIndex +=
      1
  ) {
    const row =
      matrix[
        rowIndex
      ];

    if (
      !row
    ) {
      continue;
    }

    const playerSeasonCode =
      optionalString(
        row[0],
      );

    if (
      !playerSeasonCode
    ) {
      continue;
    }

    /*
     * B = ruolo
     */

    const role =
      optionalString(
        row[1],
      );

    /*
     * C = numero maglia
     */

    const shirtNumber =
      optionalInteger(
        row[2],
      );

    /*
     * D = voto
     */

    const voteResult =
      parseFinalVote(
        row[3],
      );

    /*
     * E = gol
     */

    const goals =
      integerOrZero(
        row[4],
      );

    /*
     * F = assist
     */

    const assists =
      integerOrZero(
        row[5],
      );

    /*
     * G = autoreti
     */

    const ownGoals =
      integerOrZero(
        row[6],
      );

    /*
     * H = gialli
     */

    const yellowCards =
      integerOrZero(
        row[7],
      );

    /*
     * I = rossi
     */

    const redCards =
      integerOrZero(
        row[8],
      );

    /*
     * J = gol subiti
     */

    const goalsConceded =
      optionalInteger(
        row[9],
      );

    /*
     * K = MVP
     */

    const mvp =
      parseMvpValue(
        row[10],
      );

    /*
     * L:R = minuti gol.
     *
     * Prima i gol normali,
     * poi le eventuali autoreti.
     */

    const allGoalMinutes =
      parseGoalMinutes(
        row.slice(
          11,
          18,
        ),
      );

    const goalMinutes =
      allGoalMinutes.slice(
        0,
        goals,
      );

    const ownGoalMinutes =
      allGoalMinutes.slice(
        goals,
        goals +
          ownGoals,
      );

    players.push({
      playerSeasonCode,

      ...(role
        ? {
            role,
          }
        : {}),

      ...(shirtNumber !==
      undefined
        ? {
            shirtNumber,
          }
        : {}),

      ...(voteResult.vote !==
      undefined
        ? {
            vote:
              voteResult.vote,
          }
        : {}),

      withoutVote:
        voteResult.withoutVote,

      goals,

      assists,

      ownGoals,

      yellowCards,

      redCards,

      ...(goalsConceded !==
      undefined
        ? {
            goalsConceded,
          }
        : {}),

      mvp,

      goalMinutes,

      ownGoalMinutes,
    });
  }

  return players;
}

/*
 * ============================================================
 * RIGORI FINALE
 * ============================================================
 */

function parsePenaltyKicks({
  matrix,
  startRowIndex,
  endRowIndex,
  orderColumnIndex,
  playerColumnIndex,
  resultColumnIndex,
  sideLabel,
}: {
  matrix:
    unknown[][];

  startRowIndex:
    number;

  endRowIndex:
    number;

  orderColumnIndex:
    number;

  playerColumnIndex:
    number;

  resultColumnIndex:
    number;

  sideLabel:
    string;
}): HistoricalFinalPenaltyKick[] {
  const result:
    HistoricalFinalPenaltyKick[] =
    [];

  const usedOrders =
    new Set<number>();

  for (
    let rowIndex =
      startRowIndex;

    rowIndex <=
    endRowIndex;

    rowIndex +=
      1
  ) {
    const row =
      matrix[
        rowIndex
      ];

    if (
      !row
    ) {
      continue;
    }

    const playerSeasonCode =
      optionalString(
        row[
          playerColumnIndex
        ],
      );

    const rawResult =
      optionalString(
        row[
          resultColumnIndex
        ],
      );

    /*
     * La colonna ordine è precompilata nel template.
     * Una riga senza giocatore/esito è quindi considerata vuota.
     */

    if (
      !playerSeasonCode &&
      !rawResult
    ) {
      continue;
    }

    const excelRow =
      rowIndex +
      1;

    if (
      !playerSeasonCode ||
      !rawResult
    ) {
      throw new Error(
        `Tabellino_Finale_Champions, rigori ${sideLabel}, riga ${excelRow}: playerSeasonCode ed esito devono essere compilati insieme.`,
      );
    }

    const order =
      optionalInteger(
        row[
          orderColumnIndex
        ],
      );

    if (
      order ===
      undefined ||
      order <
        1
    ) {
      throw new Error(
        `Tabellino_Finale_Champions, rigori ${sideLabel}, riga ${excelRow}: ordine non valido.`,
      );
    }

    if (
      usedOrders.has(
        order,
      )
    ) {
      throw new Error(
        `Tabellino_Finale_Champions, rigori ${sideLabel}: ordine ${order} duplicato.`,
      );
    }

    usedOrders.add(
      order,
    );

    result.push({
      order,

      playerSeasonCode,

      result:
        parsePenaltyKickResult({
          value:
            rawResult,

          sideLabel,

          excelRow,
        }),
    });
  }

  return result.sort(
    (
      first,
      second,
    ) =>
      first.order -
      second.order,
  );
}

function parsePenaltyKickResult({
  value,
  sideLabel,
  excelRow,
}: {
  value:
    string;

  sideLabel:
    string;

  excelRow:
    number;
}): HistoricalFinalPenaltyKickResult {
  const normalized =
    normalizeText(
      value,
    );

  if (
    [
      "segnato",
      "segnata",
      "gol",
      "goal",
      "scored",
    ].includes(
      normalized,
    )
  ) {
    return "scored";
  }

  if (
    [
      "sbagliato",
      "sbagliata",
      "parato",
      "fuori",
      "missed",
    ].includes(
      normalized,
    )
  ) {
    return "missed";
  }

  throw new Error(
    `Tabellino_Finale_Champions, rigori ${sideLabel}, riga ${excelRow}: esito "${value}" non valido. Usa "segnato" oppure "sbagliato".`,
  );
}

function validatePenaltyScoreAgainstSequence({
  homePenalties,
  awayPenalties,
  homePenaltyKicks,
  awayPenaltyKicks,
}: {
  homePenalties?:
    number;

  awayPenalties?:
    number;

  homePenaltyKicks:
    HistoricalFinalPenaltyKick[];

  awayPenaltyKicks:
    HistoricalFinalPenaltyKick[];
}) {
  const hasSequence =
    homePenaltyKicks.length >
      0 ||
    awayPenaltyKicks.length >
      0;

  if (
    !hasSequence
  ) {
    /*
     * Compatibilità con vecchi file che salvavano
     * solo il totale dei rigori e non la sequenza.
     */
    return;
  }

  if (
    homePenalties ===
      undefined ||
    awayPenalties ===
      undefined
  ) {
    throw new Error(
      'Nel foglio "Tabellino_Finale_Champions" è presente la sequenza dei rigori ma manca il risultato RIG in D2/D17.',
    );
  }

  const scoredHome =
    homePenaltyKicks.filter(
      (
        kick,
      ) =>
        kick.result ===
        "scored",
    ).length;

  const scoredAway =
    awayPenaltyKicks.filter(
      (
        kick,
      ) =>
        kick.result ===
        "scored",
    ).length;

  if (
    scoredHome !==
    homePenalties
  ) {
    throw new Error(
      `Tabellino_Finale_Champions: i rigori segnati dalla squadra di casa (${scoredHome}) non corrispondono al valore RIG in D2 (${homePenalties}).`,
    );
  }

  if (
    scoredAway !==
    awayPenalties
  ) {
    throw new Error(
      `Tabellino_Finale_Champions: i rigori segnati dalla squadra ospite (${scoredAway}) non corrispondono al valore RIG in D17 (${awayPenalties}).`,
    );
  }
}

/*
 * ============================================================
 * VOTO FINALE
 * ============================================================
 */

function parseFinalVote(
  value:
    unknown,
): {
  vote?: number;

  withoutVote:
    boolean;
} {
  const text =
    cleanString(
      value,
    );

  if (
    !text
  ) {
    return {
      withoutVote:
        false,
    };
  }

  const normalized =
    normalizeText(
      text,
    );

  if (
    normalized ===
      "sv" ||
    normalized ===
      "senza voto"
  ) {
    return {
      withoutVote:
        true,
    };
  }

  const vote =
    optionalNumber(
      value,
    );

  if (
    vote ===
    undefined
  ) {
    throw new Error(
      `Voto finale non valido: "${text}".`,
    );
  }

  if (
    vote <
      0 ||
    vote >
      10
  ) {
    throw new Error(
      `Voto finale fuori intervallo: "${text}".`,
    );
  }

  return {
    vote,

    withoutVote:
      false,
  };
}

/*
 * ============================================================
 * MVP
 * ============================================================
 */

function parseMvpValue(
  value:
    unknown,
): boolean {
  if (
    typeof value ===
    "number"
  ) {
    return (
      value >
      0
    );
  }

  const normalized =
    normalizeText(
      cleanString(
        value,
      ),
    );

  return [
    "1",
    "x",
    "si",
    "yes",
    "true",
  ].includes(
    normalized,
  );
}

/*
 * ============================================================
 * MINUTI GOL
 * ============================================================
 */

function parseGoalMinutes(
  values:
    unknown[],
): HistoricalFinalReportGoalMinute[] {
  const result:
    HistoricalFinalReportGoalMinute[] =
    [];

  for (
    const value of
      values
  ) {
    const parsed =
      parseGoalMinute(
        value,
      );

    if (
      parsed
    ) {
      result.push(
        parsed,
      );
    }
  }

  return result;
}

/*
 * ============================================================
 * SINGOLO MINUTO
 * ============================================================
 */

function parseGoalMinute(
  value:
    unknown,
): HistoricalFinalReportGoalMinute | undefined {
  if (
    value ===
      undefined ||
    value ===
      null ||
    value ===
      ""
  ) {
    return undefined;
  }

  if (
    typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
  ) {
    return {
      minute:
        Math.trunc(
          value,
        ),
    };
  }

  const text =
    cleanString(
      value,
    )
      .replace(
        /’/g,
        "'",
      )
      .replace(
        /\s+/g,
        "",
      );

  if (
    !text
  ) {
    return undefined;
  }

  /*
   * Formati accettati:
   *
   * 50
   * 50'
   * 50+2
   * 50'+2
   */

  const match =
    text.match(
      /^(\d{1,3})'?\+?(\d+)?$/,
    );

  if (
    !match
  ) {
    throw new Error(
      `Minuto gol non valido nel tabellino finale: "${text}".`,
    );
  }

  const minute =
    Number(
      match[1],
    );

  const stoppageTime =
    match[2]
      ? Number(
          match[2],
        )
      : undefined;

  return {
    minute,

    ...(stoppageTime !==
    undefined
      ? {
          stoppageTime,
        }
      : {}),
  };
}