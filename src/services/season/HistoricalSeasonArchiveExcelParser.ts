import * as XLSX from "xlsx";

import type {
  HistoricalFinalPenaltyKick,
  HistoricalFinalReportPlayer,
  HistoricalSeasonArchiveImport,
} from "@/src/services/season/HistoricalSeasonArchiveTypes";

import {
  SHEETS,
  parseAwards,
  parseChampionsMatches,
  parseChampionsPlayerStats,
  parseFinalStandings,
  parseRegularSeasonPlayers,
  parseSeason,
  parseTeams,
} from "@/src/services/season/HistoricalSeasonArchiveSheetParsers";

import {
  parseChampionsFinalReport,
} from "@/src/services/season/HistoricalSeasonArchiveFinalReportParser";

import {
  normalizeText,
} from "@/src/services/season/HistoricalSeasonArchiveParserUtils";

/*
 * ============================================================
 * COMPATIBILITÀ IMPORT ESISTENTI
 * ============================================================
 *
 * Gli altri file possono continuare a importare
 * i tipi da HistoricalSeasonArchiveExcelParser
 * senza alcuna modifica.
 * ============================================================
 */

export type {
  HistoricalSeasonData,
  HistoricalTeamData,
  HistoricalRegularSeasonPlayer,
  HistoricalStanding,
  HistoricalChampionsMatch,
  HistoricalChampionsPlayerStats,
  HistoricalFinalReportGoalMinute,
  HistoricalFinalPenaltyKickResult,
  HistoricalFinalPenaltyKick,
  HistoricalFinalReportPlayer,
  HistoricalChampionsFinalReport,
  HistoricalAwardSection,
  HistoricalAward,
  HistoricalSeasonArchiveImport,
} from "@/src/services/season/HistoricalSeasonArchiveTypes";

/*
 * ============================================================
 * PARSER PRINCIPALE
 * ============================================================
 */

export async function parseHistoricalSeasonArchiveExcel(
  file:
    File,
): Promise<HistoricalSeasonArchiveImport> {
  const buffer =
    await file.arrayBuffer();

  const workbook =
    XLSX.read(
      buffer,
      {
        type:
          "array",

        raw:
          true,
      },
    );

  validateWorkbook(
    workbook,
  );

  const archive:
    HistoricalSeasonArchiveImport = {
    season:
      parseSeason(
        workbook,
      ),

    teams:
      parseTeams(
        workbook,
      ),

    regularSeasonPlayers:
      parseRegularSeasonPlayers(
        workbook,
      ),

    finalStandings:
      parseFinalStandings(
        workbook,
      ),

    championsMatches:
      parseChampionsMatches(
        workbook,
      ),

    championsPlayerStats:
      parseChampionsPlayerStats(
        workbook,
      ),

    championsFinalReport:
      parseChampionsFinalReport(
        workbook,
      ),

    awards:
      parseAwards(
        workbook,
      ),
  };

  validateArchive(
    archive,
  );

  return archive;
}

/*
 * ============================================================
 * VALIDAZIONE WORKBOOK
 * ============================================================
 */

function validateWorkbook(
  workbook:
    XLSX.WorkBook,
) {
  const requiredSheets = [
    SHEETS.season,

    SHEETS.teams,

    SHEETS.regularSeasonPlayers,

    SHEETS.finalStandings,

    SHEETS.championsMatches,

    SHEETS.championsPlayerStats,

    SHEETS.championsFinalReport,

    SHEETS.awards,
  ];

  const missingSheets =
    requiredSheets.filter(
      (
        sheetName,
      ) =>
        !workbook.SheetNames.includes(
          sheetName,
        ),
    );

  if (
    missingSheets.length >
    0
  ) {
    throw new Error(
      [
        "Il file non corrisponde al modello archivio stagionale Ludi.",
        "",
        "Fogli mancanti:",

        ...missingSheets.map(
          (
            name,
          ) =>
            `• ${name}`,
        ),
      ].join(
        "\n",
      ),
    );
  }
}

/*
 * ============================================================
 * VALIDAZIONE ARCHIVIO
 * ============================================================
 */

function validateArchive(
  archive:
    HistoricalSeasonArchiveImport,
) {
  if (
    archive.teams.length ===
    0
  ) {
    throw new Error(
      "Il foglio Squadre non contiene alcuna squadra.",
    );
  }

  /*
 * ========================================================
 * PRESENZA DATI COMPETIZIONE
 * ========================================================
 *
 * Alcune edizioni storiche non prevedevano una
 * Regular Season ma soltanto una fase a gironi /
 * Final Stage.
 *
 * È quindi sufficiente che siano presenti dati
 * nella Regular Season OPPURE nella Final Stage.
 * ========================================================
 */

const hasRegularSeasonData =
  archive.regularSeasonPlayers.length >
    0 ||
  archive.finalStandings.length >
    0;

const hasFinalStageData =
  archive.championsPlayerStats.length >
    0 ||
  archive.championsMatches.length >
    0 ||
  Boolean(
    archive.championsFinalReport,
  );

if (
  !hasRegularSeasonData &&
  !hasFinalStageData
) {
  throw new Error(
    "L’archivio non contiene dati né per la Regular Season né per la Final Stage.",
  );
}

  /*
   * ========================================================
   * TEAM CODE
   * ========================================================
   */

  const teamCodes =
    new Set(
      archive.teams.map(
        (
          team,
        ) =>
          team.teamCode,
      ),
    );

  if (
    teamCodes.size !==
    archive.teams.length
  ) {
    throw new Error(
      "Nel foglio Squadre sono presenti teamCode duplicati.",
    );
  }

  /*
   * ========================================================
   * REGULAR SEASON
   * ========================================================
   */

  for (
    const player of
      archive.regularSeasonPlayers
  ) {
    validateTeamCode({
      teamCode:
        player.teamCode,

      teamCodes,

      context:
        `${player.firstName} ${player.lastName}`,
    });
  }

  /*
   * ========================================================
   * CHAMPIONS
   * ========================================================
   */

  for (
    const player of
      archive.championsPlayerStats
  ) {
    validateTeamCode({
      teamCode:
        player.teamCode,

      teamCodes,

      context:
        `Champions: ${player.firstName} ${player.lastName}`,
    });
  }

  /*
   * ========================================================
   * CLASSIFICA
   * ========================================================
   */

  for (
    const standing of
      archive.finalStandings
  ) {
    validateTeamCode({
      teamCode:
        standing.teamCode,

      teamCodes,

      context:
        "Classifica finale",
    });
  }

  /*
   * ========================================================
   * CALENDARIO CHAMPIONS
   * ========================================================
   */

  for (
    const match of
      archive.championsMatches
  ) {
    validateTeamCode({
      teamCode:
        match.homeTeamCode,

      teamCodes,

      context:
        `Partita ${match.matchCode}`,
    });

    validateTeamCode({
      teamCode:
        match.awayTeamCode,

      teamCodes,

      context:
        `Partita ${match.matchCode}`,
    });

    validateChampionsMatchResult({
      match,
      matches:
        archive.championsMatches,
    });
  }

  /*
   * ========================================================
   * PREMIAZIONI
   * ========================================================
   */

  for (
    const award of
      archive.awards
  ) {
    if (
      award.teamCode
    ) {
      validateTeamCode({
        teamCode:
          award.teamCode,

        teamCodes,

        context:
          `Premiazione: ${award.firstName} ${award.lastName} - ${award.award}`,
      });
    }
  }

  /*
   * ========================================================
   * PRIMA CLASSIFICATA
   * ========================================================
   */

  const regularSeasonChampions =
    archive.finalStandings.filter(
      (
        standing,
      ) =>
        standing.position ===
        1,
    );

  if (
    archive.finalStandings.length >
      0 &&
    regularSeasonChampions.length !==
      1
  ) {
    throw new Error(
      "La classifica finale deve contenere una sola squadra in posizione 1.",
    );
  }

  /*
   * ========================================================
   * TABELLINO FINALE
   * ========================================================
   */

  validateChampionsFinalReport(
    archive,
  );
}

/*
 * ============================================================
 * VALIDAZIONE TABELLINO FINALE
 * ============================================================
 */

function validateChampionsFinalReport(
  archive:
    HistoricalSeasonArchiveImport,
) {
  const report =
    archive.championsFinalReport;

  if (
    !report
  ) {
    return;
  }

  const teamCodes =
    new Set(
      archive.teams.map(
        (
          team,
        ) =>
          team.teamCode,
      ),
    );

  validateTeamCode({
    teamCode:
      report.homeTeamCode,

    teamCodes,

    context:
      "Tabellino finale",
  });

  validateTeamCode({
    teamCode:
      report.awayTeamCode,

    teamCodes,

    context:
      "Tabellino finale",
  });

  /*
   * ========================================================
   * CONFRONTO CON CALENDARIO
   * ========================================================
   */

  const finalMatch =
    archive.championsMatches.find(
      (
        match,
      ) =>
        normalizeText(
          match.round,
        ) ===
        "finale",
    ) ??
    archive.championsMatches.find(
      (
        match,
      ) =>
        normalizeText(
          match.matchCode,
        ) ===
        "final",
    );

  if (
    finalMatch
  ) {
    const sameTeams =
      finalMatch.homeTeamCode ===
        report.homeTeamCode &&
      finalMatch.awayTeamCode ===
        report.awayTeamCode;

    const reversedTeams =
      finalMatch.homeTeamCode ===
        report.awayTeamCode &&
      finalMatch.awayTeamCode ===
        report.homeTeamCode;

    if (
      !sameTeams &&
      !reversedTeams
    ) {
      throw new Error(
        "Le squadre del Tabellino_Finale_Champions non corrispondono alla finale presente in Calendario_Champions.",
      );
    }

    validateFinalReportAgainstCalendar({
      report,
      finalMatch,
      sameTeams,
    });
  }

  /*
   * ========================================================
   * GOL
   *
   * homeScore / awayScore sono il risultato al 90'.
   * Per il totale dei gol del tabellino dobbiamo invece usare
   * il punteggio dopo DTS quando i supplementari sono presenti.
   * ========================================================
   */

  const homeFinalScore =
    report.homeExtraTimeScore ??
    report.homeScore;

  const awayFinalScore =
    report.awayExtraTimeScore ??
    report.awayScore;

  validateFinalReportGoals(
    report.homePlayers,

    homeFinalScore,

    report.homeTeamCode,
  );

  validateFinalReportGoals(
    report.awayPlayers,

    awayFinalScore,

    report.awayTeamCode,
  );

  /*
   * ========================================================
   * TIRATORI DEI RIGORI
   * ========================================================
   */

  validatePenaltyTakers({
    kicks:
      report.homePenaltyKicks ??
      [],

    players:
      report.homePlayers,

    teamCode:
      report.homeTeamCode,
  });

  validatePenaltyTakers({
    kicks:
      report.awayPenaltyKicks ??
      [],

    players:
      report.awayPlayers,

    teamCode:
      report.awayTeamCode,
  });
}

/*
 * ============================================================
 * VALIDAZIONE RISULTATI CALENDARIO CHAMPIONS
 * ============================================================
 */

function validateChampionsMatchResult({
  match,
  matches,
}: {
  match:
    HistoricalSeasonArchiveImport[
      "championsMatches"
    ][number];

  matches:
    HistoricalSeasonArchiveImport[
      "championsMatches"
    ];
}) {
  const hasHomeScore =
    match.homeScore !==
    undefined;

  const hasAwayScore =
    match.awayScore !==
    undefined;

  if (
    hasHomeScore !==
    hasAwayScore
  ) {
    throw new Error(
      `Partita ${match.matchCode}: homeScore e awayScore devono essere compilati insieme.`,
    );
  }

  const hasHomeExtraTime =
    match.homeExtraTimeScore !==
    undefined;

  const hasAwayExtraTime =
    match.awayExtraTimeScore !==
    undefined;

  if (
    hasHomeExtraTime !==
    hasAwayExtraTime
  ) {
    throw new Error(
      `Partita ${match.matchCode}: homeExtraTimeScore e awayExtraTimeScore devono essere compilati insieme.`,
    );
  }

  const firstLeg =
    findFirstLegForReturnMatch({
      match,
      matches,
    });

  /*
   * ========================================================
   * SUPPLEMENTARI
   * ========================================================
   *
   * Gara unica:
   * il risultato della singola partita deve essere in parità.
   *
   * Gara di ritorno:
   * conta invece il risultato AGGREGATO delle due partite.
   * Per esempio:
   *
   * andata  A 3-1 B
   * ritorno B 2-0 A
   *
   * al 90' del ritorno l'aggregato è 3-3, quindi i
   * supplementari sono correttamente ammessi anche se il
   * ritorno, preso da solo, non è terminato in parità.
   * ========================================================
   */

  if (
    match.homeExtraTimeScore !==
      undefined &&
    match.awayExtraTimeScore !==
      undefined
  ) {
    if (
      match.homeScore ===
        undefined ||
      match.awayScore ===
        undefined
    ) {
      throw new Error(
        `Partita ${match.matchCode}: per indicare il risultato dopo supplementari è necessario compilare anche il risultato al 90'.`,
      );
    }

    if (
      isFirstLeg(
        match,
      )
    ) {
      throw new Error(
        `Partita ${match.matchCode}: i supplementari non possono essere disputati nella gara di andata.`,
      );
    }

    if (
      isReturnLeg(
        match,
      )
    ) {
      if (
        !firstLeg
      ) {
        throw new Error(
          `Partita ${match.matchCode}: non è stata trovata la gara di andata necessaria per calcolare il risultato aggregato.`,
        );
      }

      const aggregateAt90 =
        getReturnLegAggregateScore({
          firstLeg,
          returnMatch:
            match,
          useExtraTime:
            false,
        });

      if (
        aggregateAt90.home !==
        aggregateAt90.away
      ) {
        throw new Error(
          `Partita ${match.matchCode}: i supplementari possono essere indicati solo se la doppia sfida è in parità al termine dei 90' della gara di ritorno (aggregato ${aggregateAt90.home}-${aggregateAt90.away}).`,
        );
      }
    } else if (
      match.homeScore !==
      match.awayScore
    ) {
      throw new Error(
        `Partita ${match.matchCode}: i supplementari possono essere indicati solo con risultato al 90' in parità.`,
      );
    }

    if (
      match.homeExtraTimeScore <
        match.homeScore ||
      match.awayExtraTimeScore <
        match.awayScore
    ) {
      throw new Error(
        `Partita ${match.matchCode}: il risultato dopo supplementari non può essere inferiore al risultato al 90'.`,
      );
    }
  }

  const hasHomePenalties =
    match.homePenalties !==
    undefined;

  const hasAwayPenalties =
    match.awayPenalties !==
    undefined;

  if (
    hasHomePenalties !==
    hasAwayPenalties
  ) {
    throw new Error(
      `Partita ${match.matchCode}: homePenalties e awayPenalties devono essere compilati insieme.`,
    );
  }

  /*
   * ========================================================
   * RIGORI
   * ========================================================
   *
   * Anche qui, nel ritorno di una doppia sfida la condizione
   * da controllare non è il pareggio della singola partita,
   * ma il pareggio del risultato aggregato dopo gli eventuali
   * supplementari.
   * ========================================================
   */

  if (
    match.homePenalties !==
      undefined &&
    match.awayPenalties !==
      undefined
  ) {
    const homeFinalScore =
      match.homeExtraTimeScore ??
      match.homeScore;

    const awayFinalScore =
      match.awayExtraTimeScore ??
      match.awayScore;

    if (
      homeFinalScore ===
        undefined ||
      awayFinalScore ===
        undefined
    ) {
      throw new Error(
        `Partita ${match.matchCode}: per indicare i rigori è necessario compilare il risultato della partita.`,
      );
    }

    if (
      isFirstLeg(
        match,
      )
    ) {
      throw new Error(
        `Partita ${match.matchCode}: i rigori non possono essere disputati nella gara di andata.`,
      );
    }

    if (
      isReturnLeg(
        match,
      )
    ) {
      if (
        !firstLeg
      ) {
        throw new Error(
          `Partita ${match.matchCode}: non è stata trovata la gara di andata necessaria per calcolare il risultato aggregato.`,
        );
      }

      const aggregateBeforePenalties =
        getReturnLegAggregateScore({
          firstLeg,
          returnMatch:
            match,
          useExtraTime:
            match.homeExtraTimeScore !==
              undefined &&
            match.awayExtraTimeScore !==
              undefined,
        });

      if (
        aggregateBeforePenalties.home !==
        aggregateBeforePenalties.away
      ) {
        throw new Error(
          `Partita ${match.matchCode}: i rigori possono essere indicati solo se la doppia sfida è in parità prima dello shootout (aggregato ${aggregateBeforePenalties.home}-${aggregateBeforePenalties.away}).`,
        );
      }
    } else if (
      homeFinalScore !==
      awayFinalScore
    ) {
      throw new Error(
        `Partita ${match.matchCode}: i rigori possono essere indicati solo se la partita è in parità prima dello shootout.`,
      );
    }

    if (
      match.homePenalties ===
      match.awayPenalties
    ) {
      throw new Error(
        `Partita ${match.matchCode}: la serie di rigori deve avere un vincitore.`,
      );
    }
  }
}

/*
 * ============================================================
 * DOPPIA SFIDA CHAMPIONS
 * ============================================================
 */

function isFirstLeg(
  match:
    HistoricalSeasonArchiveImport[
      "championsMatches"
    ][number],
) {
  const normalizedLeg =
    normalizeText(
      match.leg ??
        "",
    );

  const normalizedCode =
    normalizeText(
      match.matchCode,
    );

  return (
    normalizedLeg ===
      "andata" ||
    normalizedLeg ===
      "a" ||
    normalizedLeg ===
      "prima" ||
    normalizedLeg ===
      "1" ||
    /(?:^|[-_])a$/.test(
      normalizedCode,
    )
  );
}

function isReturnLeg(
  match:
    HistoricalSeasonArchiveImport[
      "championsMatches"
    ][number],
) {
  const normalizedLeg =
    normalizeText(
      match.leg ??
        "",
    );

  const normalizedCode =
    normalizeText(
      match.matchCode,
    );

  return (
    normalizedLeg ===
      "ritorno" ||
    normalizedLeg ===
      "r" ||
    normalizedLeg ===
      "seconda" ||
    normalizedLeg ===
      "2" ||
    /(?:^|[-_])r$/.test(
      normalizedCode,
    )
  );
}

function findFirstLegForReturnMatch({
  match,
  matches,
}: {
  match:
    HistoricalSeasonArchiveImport[
      "championsMatches"
    ][number];

  matches:
    HistoricalSeasonArchiveImport[
      "championsMatches"
    ];
}) {
  if (
    !isReturnLeg(
      match,
    )
  ) {
    return undefined;
  }

  const normalizedRound =
    normalizeText(
      match.round,
    );

  const reversedCandidates =
    matches.filter(
      (
        candidate,
      ) =>
        candidate !==
          match &&
        normalizeText(
          candidate.round,
        ) ===
          normalizedRound &&
        candidate.homeTeamCode ===
          match.awayTeamCode &&
        candidate.awayTeamCode ===
          match.homeTeamCode,
    );

  return (
    reversedCandidates.find(
      (
        candidate,
      ) =>
        isFirstLeg(
          candidate,
        ),
    ) ??
    reversedCandidates.find(
      (
        candidate,
      ) =>
        !isReturnLeg(
          candidate,
        ),
    )
  );
}

function getReturnLegAggregateScore({
  firstLeg,
  returnMatch,
  useExtraTime,
}: {
  firstLeg:
    HistoricalSeasonArchiveImport[
      "championsMatches"
    ][number];

  returnMatch:
    HistoricalSeasonArchiveImport[
      "championsMatches"
    ][number];

  useExtraTime:
    boolean;
}) {
  if (
    firstLeg.homeScore ===
      undefined ||
    firstLeg.awayScore ===
      undefined
  ) {
    throw new Error(
      `Partita ${returnMatch.matchCode}: per calcolare la doppia sfida è necessario compilare il risultato della gara di andata ${firstLeg.matchCode}.`,
    );
  }

  const returnHomeScore =
    useExtraTime
      ? returnMatch.homeExtraTimeScore
      : returnMatch.homeScore;

  const returnAwayScore =
    useExtraTime
      ? returnMatch.awayExtraTimeScore
      : returnMatch.awayScore;

  if (
    returnHomeScore ===
      undefined ||
    returnAwayScore ===
      undefined
  ) {
    throw new Error(
      `Partita ${returnMatch.matchCode}: risultato della gara di ritorno incompleto.`,
    );
  }

  /*
   * Le squadre sono invertite nel ritorno:
   *
   * andata  HOME A - AWAY B
   * ritorno HOME B - AWAY A
   *
   * Per questo il punteggio dell'attuale squadra di casa va
   * sommato all'awayScore dell'andata, e viceversa.
   */

  return {
    home:
      firstLeg.awayScore +
      returnHomeScore,

    away:
      firstLeg.homeScore +
      returnAwayScore,
  };
}

/*
 * ============================================================
 * CONFRONTO TABELLINO / CALENDARIO FINALE
 * ============================================================
 */

function validateFinalReportAgainstCalendar({
  report,
  finalMatch,
  sameTeams,
}: {
  report:
    NonNullable<
      HistoricalSeasonArchiveImport[
        "championsFinalReport"
      ]
    >;

  finalMatch:
    HistoricalSeasonArchiveImport[
      "championsMatches"
    ][number];

  sameTeams:
    boolean;
}) {
  const calendarHomeScore =
    sameTeams
      ? finalMatch.homeScore
      : finalMatch.awayScore;

  const calendarAwayScore =
    sameTeams
      ? finalMatch.awayScore
      : finalMatch.homeScore;

  const calendarHomeExtraTimeScore =
    sameTeams
      ? finalMatch.homeExtraTimeScore
      : finalMatch.awayExtraTimeScore;

  const calendarAwayExtraTimeScore =
    sameTeams
      ? finalMatch.awayExtraTimeScore
      : finalMatch.homeExtraTimeScore;

  const calendarHomePenalties =
    sameTeams
      ? finalMatch.homePenalties
      : finalMatch.awayPenalties;

  const calendarAwayPenalties =
    sameTeams
      ? finalMatch.awayPenalties
      : finalMatch.homePenalties;

  assertSameRequiredScore({
    label:
      "risultato casa al 90'",

    reportValue:
      report.homeScore,

    calendarValue:
      calendarHomeScore,
  });

  assertSameRequiredScore({
    label:
      "risultato ospite al 90'",

    reportValue:
      report.awayScore,

    calendarValue:
      calendarAwayScore,
  });

  assertSameOptionalScore({
    label:
      "risultato casa dopo supplementari",

    reportValue:
      report.homeExtraTimeScore,

    calendarValue:
      calendarHomeExtraTimeScore,
  });

  assertSameOptionalScore({
    label:
      "risultato ospite dopo supplementari",

    reportValue:
      report.awayExtraTimeScore,

    calendarValue:
      calendarAwayExtraTimeScore,
  });

  assertSameOptionalScore({
    label:
      "rigori casa",

    reportValue:
      report.homePenalties,

    calendarValue:
      calendarHomePenalties,

    allowMissingReportValue:
      true,
  });

  assertSameOptionalScore({
    label:
      "rigori ospite",

    reportValue:
      report.awayPenalties,

    calendarValue:
      calendarAwayPenalties,

    allowMissingReportValue:
      true,
  });
}

function assertSameRequiredScore({
  label,
  reportValue,
  calendarValue,
}: {
  label:
    string;

  reportValue:
    number;

  calendarValue?:
    number;
}) {
  /*
   * ==========================================================
   * COMPATIBILITA ARCHIVI LEGACY
   * ==========================================================
   *
   * Nei vecchi file storici Calendario_Champions poteva
   * contenere l'accoppiamento della finale senza il risultato,
   * mentre il punteggio completo era presente esclusivamente
   * nel Tabellino_Finale_Champions.
   *
   * Il nuovo template compila invece il risultato in entrambi
   * i fogli. Per questo:
   *
   * - calendario vuoto -> il tabellino resta la fonte valida;
   * - calendario compilato -> i due valori devono coincidere.
   *
   * In questo modo manteniamo la retrocompatibilita senza
   * rinunciare al controllo di coerenza del nuovo template.
   * ==========================================================
   */

  if (
    calendarValue ===
    undefined
  ) {
    return;
  }

  if (
    reportValue !==
    calendarValue
  ) {
    throw new Error(
      `Finale Champions: ${label} non coerente tra Calendario_Champions (${calendarValue}) e Tabellino_Finale_Champions (${reportValue}).`,
    );
  }
}

function assertSameOptionalScore({
  label,
  reportValue,
  calendarValue,
  allowMissingReportValue =
    false,
}: {
  label:
    string;

  reportValue?:
    number;

  calendarValue?:
    number;

  allowMissingReportValue?:
    boolean;
}) {
  if (
    reportValue ===
      undefined &&
    (
      calendarValue ===
        undefined ||
      allowMissingReportValue
    )
  ) {
    return;
  }

  if (
    reportValue !==
    calendarValue
  ) {
    throw new Error(
      `Finale Champions: ${label} non coerente tra Calendario_Champions (${calendarValue ?? "vuoto"}) e Tabellino_Finale_Champions (${reportValue ?? "vuoto"}).`,
    );
  }
}

/*
 * ============================================================
 * VALIDAZIONE TIRATORI RIGORI
 * ============================================================
 */

function validatePenaltyTakers({
  kicks,
  players,
  teamCode,
}: {
  kicks:
    HistoricalFinalPenaltyKick[];

  players:
    HistoricalFinalReportPlayer[];

  teamCode:
    string;
}) {
  if (
    kicks.length ===
    0
  ) {
    return;
  }

  const playerCodes =
    new Set(
      players.map(
        (
          player,
        ) =>
          player.playerSeasonCode,
      ),
    );

  for (
    const kick of
      kicks
  ) {
    if (
      !playerCodes.has(
        kick.playerSeasonCode,
      )
    ) {
      throw new Error(
        `Tabellino finale ${teamCode}: il tiratore ${kick.playerSeasonCode} non è presente nell'elenco giocatori della finale.`,
      );
    }
  }
}

/*
 * ============================================================
 * VALIDAZIONE GOL TABELLINO
 * ============================================================
 */

function validateFinalReportGoals(
  players:
    HistoricalFinalReportPlayer[],

  teamScore:
    number,

  teamCode:
    string,
) {
  const playerGoals =
    players.reduce(
      (
        total,
        player,
      ) =>
        total +
        player.goals,
      0,
    );

  const ownGoals =
    players.reduce(
      (
        total,
        player,
      ) =>
        total +
        player.ownGoals,
      0,
    );

  /*
   * Le autoreti sono attribuite al giocatore
   * che le commette.
   *
   * Non possiamo quindi pretendere che:
   *
   * somma gol giocatori === risultato squadra
   *
   * perché il risultato può includere
   * autoreti della squadra avversaria.
   */

  if (
    playerGoals >
    teamScore
  ) {
    throw new Error(
      `Tabellino finale ${teamCode}: la somma dei gol dei giocatori (${playerGoals}) supera il risultato della squadra (${teamScore}).`,
    );
  }

  if (
    ownGoals >
    teamScore +
      20
  ) {
    throw new Error(
      `Tabellino finale ${teamCode}: numero di autoreti non valido.`,
    );
  }
}

/*
 * ============================================================
 * VALIDAZIONE TEAM CODE
 * ============================================================
 */

function validateTeamCode({
  teamCode,
  teamCodes,
  context,
}: {
  teamCode:
    string;

  teamCodes:
    Set<string>;

  context:
    string;
}) {
  if (
    !teamCodes.has(
      teamCode,
    )
  ) {
    throw new Error(
      `${context}: teamCode "${teamCode}" non presente nel foglio Squadre.`,
    );
  }
}