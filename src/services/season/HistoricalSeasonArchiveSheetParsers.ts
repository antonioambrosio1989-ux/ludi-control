import type {
  WorkBook,
} from "xlsx";

import type {
  HistoricalAward,
  HistoricalAwardSection,
  HistoricalChampionsMatch,
  HistoricalChampionsPlayerStats,
  HistoricalRegularSeasonPlayer,
  HistoricalSeasonData,
  HistoricalStanding,
  HistoricalTeamData,
} from "@/src/services/season/HistoricalSeasonArchiveTypes";

import {
  excelDateToIso,
  excelTimeToText,
  integerOrZero,
  numberOrZero,
  optionalInteger,
  optionalNumber,
  optionalString,
  readSheetRows,
  requiredInteger,
  requiredString,
} from "@/src/services/season/HistoricalSeasonArchiveParserUtils";

/*
 * ============================================================
 * NOMI FOGLI
 * ============================================================
 */

export const SHEETS = {
  season:
    "Stagione",

  teams:
    "Squadre",

  regularSeasonPlayers:
    "Rose_Statistiche_RS",

  finalStandings:
    "Classifica_Finale_RS",

  championsMatches:
    "Calendario_Champions",

  championsPlayerStats:
    "Rose_Statistiche_Champions",

  championsFinalReport:
    "Tabellino_Finale_Champions",

  awards:
    "Premiazioni",
} as const;

/*
 * ============================================================
 * STAGIONE
 * ============================================================
 */

export function parseSeason(
  workbook:
    WorkBook,
): HistoricalSeasonData {
  const rows =
    readSheetRows(
      workbook,
      SHEETS.season,
    );

  const row =
    rows[0];

  if (
    !row
  ) {
    throw new Error(
      "Il foglio Stagione non contiene i dati della stagione.",
    );
  }

  return {
    seasonCode:
      requiredString(
        row.seasonCode,
        "seasonCode",
        SHEETS.season,
      ),

    seasonName:
      requiredString(
        row.nomeStagione,
        "nomeStagione",
        SHEETS.season,
      ),

    competitionName:
      requiredString(
        row.competizione,
        "competizione",
        SHEETS.season,
      ),

    startYear:
      requiredInteger(
        row.annoInizio,
        "annoInizio",
        SHEETS.season,
      ),

    endYear:
      requiredInteger(
        row.annoFine,
        "annoFine",
        SHEETS.season,
      ),

    status:
      optionalString(
        row.stato,
      ) ??
      "archived",

    finalCompetitionName:
      optionalString(
        row.finalCompetitionName,
      ),
  };
}

/*
 * ============================================================
 * SQUADRE
 * ============================================================
 */

export function parseTeams(
  workbook:
    WorkBook,
): HistoricalTeamData[] {
  const rows =
    readSheetRows(
      workbook,
      SHEETS.teams,
    );

  return rows.map(
    (
      row,
      index,
    ) => ({
      teamCode:
        requiredString(
          row.teamCode,
          "teamCode",
          SHEETS.teams,
          index,
        ),

      name:
        requiredString(
          row.nomeSquadra,
          "nomeSquadra",
          SHEETS.teams,
          index,
        ),

      aliasName:
        optionalString(
          row.alias,
        ),

      logoUrl:
        optionalString(
          row.logoUrl,
        ),

      colors:
        optionalString(
          row.coloriSociali,
        ),

      president:
        optionalString(
          row.presidente,
        ),

      captain:
        optionalString(
          row.capitano,
        ),
    }),
  );
}

/*
 * ============================================================
 * REGULAR SEASON
 * ============================================================
 */

export function parseRegularSeasonPlayers(
  workbook:
    WorkBook,
): HistoricalRegularSeasonPlayer[] {
  const rows =
    readSheetRows(
      workbook,
      SHEETS.regularSeasonPlayers,
    );

  return rows.map(
    (
      row,
      index,
    ) => ({
      playerSeasonCode:
        requiredString(
          row.playerSeasonCode,
          "playerSeasonCode",
          SHEETS.regularSeasonPlayers,
          index,
        ),

      teamCode:
        requiredString(
          row.teamCode,
          "teamCode",
          SHEETS.regularSeasonPlayers,
          index,
        ),

      firstName:
        requiredString(
          row.nome,
          "nome",
          SHEETS.regularSeasonPlayers,
          index,
        ),

      lastName:
        requiredString(
          row.cognome,
          "cognome",
          SHEETS.regularSeasonPlayers,
          index,
        ),

      birthYear:
        optionalInteger(
          row.annoNascita,
        ),

      role:
        optionalString(
          row.ruolo,
        ),

      shirtNumber:
        optionalInteger(
          row.numeroMaglia,
        ),

      transferOrder:
        optionalInteger(
          row.ordineTrasferimento,
        ) ??
        1,

      startDate:
        excelDateToIso(
          row.dataInizio,
        ),

      endDate:
        excelDateToIso(
          row.dataFine,
        ),

      appearances:
        integerOrZero(
          row.presenze,
        ),

      ratedMatches:
        integerOrZero(
          row.partiteConVoto,
        ),

      withoutVote:
        integerOrZero(
          row.senzaVoto,
        ),

      averageVote:
        optionalNumber(
          row.mediaVoto,
        ),

      goals:
        integerOrZero(
          row.gol,
        ),

      assists:
        integerOrZero(
          row.assist,
        ),

      goalsConceded:
        integerOrZero(
          row.golSubiti,
        ),

      cleanSheets:
        integerOrZero(
          row.cleanSheet,
        ),

      yellowCards:
        integerOrZero(
          row.gialli,
        ),

      redCards:
        integerOrZero(
          row.rossi,
        ),

      ownGoals:
        integerOrZero(
          row.autoreti,
        ),

      mvps:
        integerOrZero(
          row.mvp,
        ),

      status:
        optionalString(
          row.stato,
        ),
    }),
  );
}

/*
 * ============================================================
 * CLASSIFICA FINALE
 * ============================================================
 */

export function parseFinalStandings(
  workbook:
    WorkBook,
): HistoricalStanding[] {
  const rows =
    readSheetRows(
      workbook,
      SHEETS.finalStandings,
    );

  return rows
    .map(
      (
        row,
        index,
      ) => ({
        position:
          requiredInteger(
            row.posizione,
            "posizione",
            SHEETS.finalStandings,
            index,
          ),

        teamCode:
          requiredString(
            row.teamCode,
            "teamCode",
            SHEETS.finalStandings,
            index,
          ),

        played:
          integerOrZero(
            row.giocate,
          ),

        won:
          integerOrZero(
            row.vinte,
          ),

        drawn:
          integerOrZero(
            row.pareggiate,
          ),

        lost:
          integerOrZero(
            row.perse,
          ),

        goalsFor:
          integerOrZero(
            row.golFatti,
          ),

        goalsAgainst:
          integerOrZero(
            row.golSubiti,
          ),

        goalDifference:
          numberOrZero(
            row.differenzaReti,
          ),

        points:
          integerOrZero(
            row.punti,
          ),

        checkMatches:
          optionalNumber(
            row.checkPartite,
          ),

        checkGoalDifference:
          optionalNumber(
            row.checkDR,
          ),
      }),
    )
    .sort(
      (
        first,
        second,
      ) =>
        first.position -
        second.position,
    );
}

/*
 * ============================================================
 * CALENDARIO CHAMPIONS
 * ============================================================
 */

export function parseChampionsMatches(
  workbook:
    WorkBook,
): HistoricalChampionsMatch[] {
  const rows =
    readSheetRows(
      workbook,
      SHEETS.championsMatches,
    );

  return rows.map(
    (
      row,
      index,
    ) => ({
      matchCode:
        requiredString(
          row.matchCode,
          "matchCode",
          SHEETS.championsMatches,
          index,
        ),

      round:
        requiredString(
          row.turno,
          "turno",
          SHEETS.championsMatches,
          index,
        ),

      leg:
        optionalString(
          row.gara,
        ),

      date:
        excelDateToIso(
          row.data,
        ),

      time:
        excelTimeToText(
          row.ora,
        ),

      homeTeamCode:
        requiredString(
          row.homeTeamCode,
          "homeTeamCode",
          SHEETS.championsMatches,
          index,
        ),

      awayTeamCode:
        requiredString(
          row.awayTeamCode,
          "awayTeamCode",
          SHEETS.championsMatches,
          index,
        ),

      status:
        optionalString(
          row.status,
        ),

      homeScore:
        optionalInteger(
          row.homeScore,
        ),

      awayScore:
        optionalInteger(
          row.awayScore,
        ),

      homeExtraTimeScore:
        optionalInteger(
          row.homeExtraTimeScore,
        ),

      awayExtraTimeScore:
        optionalInteger(
          row.awayExtraTimeScore,
        ),

      homePenalties:
        optionalInteger(
          row.homePenalties,
        ),

      awayPenalties:
        optionalInteger(
          row.awayPenalties,
        ),

      venue:
        optionalString(
          row.venue,
        ),

      notes:
        optionalString(
          row.note,
        ),
    }),
  );
}

/*
 * ============================================================
 * STATISTICHE CHAMPIONS
 * ============================================================
 */

export function parseChampionsPlayerStats(
  workbook:
    WorkBook,
): HistoricalChampionsPlayerStats[] {
  const rows =
    readSheetRows(
      workbook,
      SHEETS.championsPlayerStats,
    );

  return rows.map(
    (
      row,
      index,
    ) => ({
      playerSeasonCode:
        requiredString(
          row.playerSeasonCode,
          "playerSeasonCode",
          SHEETS.championsPlayerStats,
          index,
        ),

      teamCode:
        requiredString(
          row.teamCode,
          "teamCode",
          SHEETS.championsPlayerStats,
          index,
        ),

      firstName:
        requiredString(
          row.nome,
          "nome",
          SHEETS.championsPlayerStats,
          index,
        ),

      lastName:
        requiredString(
          row.cognome,
          "cognome",
          SHEETS.championsPlayerStats,
          index,
        ),

      birthYear:
        optionalInteger(
          row.annoNascita,
        ),

      role:
        optionalString(
          row.ruolo,
        ),

      shirtNumber:
        optionalInteger(
          row.numeroMaglia,
        ),

      appearances:
        integerOrZero(
          row.presenze,
        ),

      ratedMatches:
        optionalInteger(
          row.partiteConVoto,
        ),

      withoutVote:
        optionalInteger(
          row.senzaVoto,
        ),

      averageVote:
        optionalNumber(
          row.mediaVoto,
        ),

      goals:
        integerOrZero(
          row.gol,
        ),

      assists:
        integerOrZero(
          row.assist,
        ),

      ownGoals:
        integerOrZero(
          row.autoreti,
        ),

      yellowCards:
        integerOrZero(
          row.gialli,
        ),

      redCards:
        integerOrZero(
          row.rossi,
        ),

      goalsConceded:
        optionalInteger(
          row.golSubiti,
        ),

      cleanSheets:
        optionalInteger(
          row.cleanSheet,
        ),

      mvps:
        integerOrZero(
          row.mvp,
        ),
    }),
  );
}

/*
 * ============================================================
 * PREMIAZIONI
 * ============================================================
 */

export function parseAwards(
  workbook:
    WorkBook,
): HistoricalAward[] {
  const rows =
    readSheetRows(
      workbook,
      SHEETS.awards,
    );

  return rows.map(
    (
      row,
      index,
    ) => {
      const section =
        parseAwardSection(
          row.sezione,
          index,
        );

      return {
        teamCode:
          optionalString(
            row.teamCode,
          ),

        firstName:
          requiredString(
            row.nome,
            "nome",
            SHEETS.awards,
            index,
          ),

        lastName:
          requiredString(
            row.cognome,
            "cognome",
            SHEETS.awards,
            index,
          ),

        birthYear:
          optionalInteger(
            row.annoNascita,
          ),

        section,

        award:
          requiredString(
            row.premio,
            "premio",
            SHEETS.awards,
            index,
          ),

          awardDescription:
  optionalString(
    row.awardDescription,
  ),

        awardLabel:
          optionalString(
            row.awardLabel,
          ),

        notes:
          optionalString(
            row.note,
          ),
      };
    },
  );
}

/*
 * ============================================================
 * SEZIONE PREMIO
 * ============================================================
 */

function parseAwardSection(
  value:
    unknown,

  rowIndex:
    number,
): HistoricalAwardSection {
  const section =
    optionalString(
      value,
    );

  if (
    section ===
      "bestOfSeason" ||
    section ===
      "teamOfSeason" ||
    section ===
      "goalAndSave" ||
    section ===
      "otherAwards"
  ) {
    return section;
  }

  const excelRow =
    rowIndex +
    5;

  throw new Error(
    [
      `Foglio "${SHEETS.awards}", riga ${excelRow}: sezione premio non valida.`,
      "",
      `Valore trovato: "${section ?? ""}"`,
      "",
      "Valori consentiti:",
      "• bestOfSeason",
      "• teamOfSeason",
      "• goalAndSave",
      "• otherAwards",
    ].join(
      "\n",
    ),
  );
}