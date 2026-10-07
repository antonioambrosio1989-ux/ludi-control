import type {
  HistoricalSeasonArchiveImport,
} from "@/src/services/season/HistoricalSeasonArchiveExcelParser";

import type {
  PlayerAchievement,
} from "@/src/types/PlayerAchievement";

export type HistoricalPlayerAchievementAssignment = {
  playerSeasonCode: string;

  achievement:
    Omit<
      PlayerAchievement,
      "competitionId"
    >;
};

export function buildHistoricalSeasonAchievements({
  archive,
}: {
  archive: HistoricalSeasonArchiveImport;
}): HistoricalPlayerAchievementAssignment[] {
  const assignments:
    HistoricalPlayerAchievementAssignment[] = [];

  /*
   * ========================================================
   * REGULAR SEASON - PODIO
   *
   * 1° → Campione Regular Season
   * 2° → 2° class. Regular Season
   * 3° → 3° class. Regular Season
   *
   * Come per il titolo di campione, assegniamo il Palmarès
   * soltanto ai giocatori presenti nella lista ufficiale
   * delle fasi finali (Rose_Statistiche_Champions).
   * ========================================================
   */

  const regularSeasonPlacements = [
    {
      position: 1,
      idSuffix: "regularSeason-champion",
      title: "Campione Regular Season",
    },
    {
      position: 2,
      idSuffix: "regularSeason-second",
      title: "2° class. Regular Season",
    },
    {
      position: 3,
      idSuffix: "regularSeason-third",
      title: "3° class. Regular Season",
    },
  ] as const;

  for (
    const placement of
      regularSeasonPlacements
  ) {
    const standing =
      archive.finalStandings.find(
        (currentStanding) =>
          currentStanding.position ===
          placement.position,
      );

    if (!standing) {
      continue;
    }

    const team =
      archive.teams.find(
        (currentTeam) =>
          currentTeam.teamCode ===
          standing.teamCode,
      );

    if (!team) {
      continue;
    }

    const eligiblePlayers =
      archive.championsPlayerStats.filter(
        (player) =>
          player.teamCode ===
          standing.teamCode,
      );

    for (
      const player of
        eligiblePlayers
    ) {
      assignments.push({
        playerSeasonCode:
          player.playerSeasonCode,

        achievement: {
          id:
            `${archive.season.seasonCode}-${placement.idSuffix}`,

          seasonId:
            archive.season.seasonCode,

          seasonLabel:
            archive.season.seasonName,

          competition:
            "regularSeason",

          title:
            placement.title,

          teamId:
            team.teamCode,

          teamName:
            team.name,
        },
      });
    }
  }

  const championsWinnerTeamCode =
    getHistoricalChampionsWinnerTeamCode(
      archive,
    );

  if (championsWinnerTeamCode) {
    const winnerTeam =
      archive.teams.find(
        (team) =>
          team.teamCode ===
          championsWinnerTeamCode,
      );

    if (winnerTeam) {
      const eligiblePlayers =
        archive.championsPlayerStats.filter(
          (player) =>
            player.teamCode ===
            championsWinnerTeamCode,
        );

      const finalCompetitionTitle =
        getHistoricalFinalCompetitionTitle(
          archive,
        );

      for (const player of eligiblePlayers) {
        assignments.push({
          playerSeasonCode:
            player.playerSeasonCode,

          achievement: {
            id:
              `${archive.season.seasonCode}-championsLeague`,

            seasonId:
              archive.season.seasonCode,

            seasonLabel:
              archive.season.seasonName,

            /*
             * Manteniamo il valore tecnico "championsLeague"
             * per compatibilità con il tipo PlayerAchievement.
             * Il titolo pubblico usa invece la competizione
             * finale reale della stagione.
             */
            competition:
              "championsLeague",

            title:
              `Campione ${finalCompetitionTitle}`,

            teamId:
              winnerTeam.teamCode,

            teamName:
              winnerTeam.name,
          },
        });
      }
    }
  }

  return assignments;
}

function getHistoricalFinalCompetitionTitle(
  archive:
    HistoricalSeasonArchiveImport,
): string {
  const configuredName =
    archive.season
      .finalCompetitionName
      ?.trim();

  if (
    configuredName
  ) {
    return configuredName.replace(
      /^ludi\s+/i,
      "",
    );
  }

  const competitionName =
    archive.season
      .competitionName
      .trim()
      .toLocaleLowerCase(
        "it",
      );

  if (
    competitionName.includes(
      "championship",
    )
  ) {
    return "Europa League";
  }

  if (
    competitionName.includes(
      "league one",
    )
  ) {
    return "Conference League";
  }

  return "Champions League";
}

/*
 * ============================================================
 * VINCITORE FINALE STORICA
 * ============================================================
 */

function getHistoricalChampionsWinnerTeamCode(
  archive:
    HistoricalSeasonArchiveImport,
): string | undefined {
  const finalReport =
    archive.championsFinalReport;

  if (!finalReport) {
    return undefined;
  }

  /*
   * Vittoria nei tempi regolamentari.
   */

  if (
    finalReport.homeScore >
    finalReport.awayScore
  ) {
    return finalReport.homeTeamCode;
  }

  if (
    finalReport.awayScore >
    finalReport.homeScore
  ) {
    return finalReport.awayTeamCode;
  }

  /*
   * Finale in parità:
   * cerchiamo l'esito ai rigori
   * nel Calendario_Champions.
   */

  const finalMatch =
    archive.championsMatches.find(
      (match) =>
        normalizeRound(
          match.round,
        ) ===
        "finale",
    );

  if (!finalMatch) {
    return undefined;
  }

  if (
    typeof finalMatch.homePenalties !==
      "number" ||
    typeof finalMatch.awayPenalties !==
      "number"
  ) {
    return undefined;
  }

  /*
   * Il calendario potrebbe avere
   * casa/trasferta nello stesso ordine
   * del tabellino oppure invertiti.
   *
   * Il vincitore viene ricavato
   * direttamente dai teamCode
   * del calendario.
   */

  if (
    finalMatch.homePenalties >
    finalMatch.awayPenalties
  ) {
    return finalMatch.homeTeamCode;
  }

  if (
    finalMatch.awayPenalties >
    finalMatch.homePenalties
  ) {
    return finalMatch.awayTeamCode;
  }

  return undefined;
}

function normalizeRound(
  value: string,
): string {
  return value
    .trim()
    .toLocaleLowerCase("it")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    );
}