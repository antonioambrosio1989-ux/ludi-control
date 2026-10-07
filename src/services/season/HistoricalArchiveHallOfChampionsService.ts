import {
  FirebaseHallOfChampionsRepository,
} from "@/src/services/awards/FirebaseHallOfChampionsRepository";

import type {
  HistoricalSeasonArchiveImport,
} from "@/src/services/season/HistoricalSeasonArchiveExcelParser";

import type {
  AggregatedHistoricalPlayer,
} from "@/src/services/season/HistoricalArchivePlayerAggregator";

import type {
  HallOfChampionsFinalPlayer,
  HallOfChampionsFinalReport,
} from "@/src/types/HallOfChampionsEntry";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

export type DerivedHallOfChampionsGoal = {
  minute: number;

  stoppageTime?: number;

  scorerName: string;

  team:
    | "champion"
    | "runnerUp";

  isOwnGoal?: boolean;
};

export type DerivedHallOfChampionsPlayer = {
  playerId?: string;

  firstName: string;
  lastName: string;

  role?: string;

  shirtNumber?: number;

  appearances: number;
  goals: number;
};

export type DerivedHallOfChampions = {
  seasonName: string;

  competitionId?: string;
  competitionName: string;

  championTeamName: string;
  runnerUpTeamName: string;

  championScore: number;
  runnerUpScore: number;

  championPenalties?: number;
  runnerUpPenalties?: number;

  finalGoals:
    DerivedHallOfChampionsGoal[];

  finalReport?:
    HallOfChampionsFinalReport;

  roster:
    DerivedHallOfChampionsPlayer[];
};

/*
 * ============================================================
 * BUILD ALBO D'ORO
 * ============================================================
 */

export function buildHistoricalHallOfChampions({
  archive,
  aggregatedPlayers,
}: {
  archive:
    HistoricalSeasonArchiveImport;

  aggregatedPlayers:
    Map<
      string,
      AggregatedHistoricalPlayer
    >;
}): DerivedHallOfChampions | undefined {
  const finalMatch =
    findChampionsFinal(
      archive,
    );

  if (
    !finalMatch
  ) {
    return undefined;
  }

  const winnerCode =
    getMatchWinnerCode(
      finalMatch,
    );

  if (
    !winnerCode
  ) {
    return undefined;
  }

  const runnerUpCode =
    winnerCode ===
    finalMatch.homeTeamCode
      ? finalMatch.awayTeamCode
      : finalMatch.homeTeamCode;

  const championTeamName =
    getTeamName(
      archive,
      winnerCode,
    );

  const runnerUpTeamName =
    getTeamName(
      archive,
      runnerUpCode,
    );

  const finalScore =
    getEffectiveMatchScore(
      finalMatch,
    );

  if (
    !championTeamName ||
    !runnerUpTeamName ||
    finalScore.home ===
      undefined ||
    finalScore.away ===
      undefined
  ) {
    return undefined;
  }

  const championIsHome =
    winnerCode ===
    finalMatch.homeTeamCode;

  /*
   * homeScore / awayScore nel nuovo template
   * rappresentano il risultato al 90'.
   * Nell'Albo d'Oro mostriamo invece il risultato
   * effettivo della finale, quindi dopo DTS se presenti.
   */

  const championScore =
    championIsHome
      ? finalScore.home
      : finalScore.away;

  const runnerUpScore =
    championIsHome
      ? finalScore.away
      : finalScore.home;

  const championPenalties =
    championIsHome
      ? finalMatch.homePenalties
      : finalMatch.awayPenalties;

  const runnerUpPenalties =
    championIsHome
      ? finalMatch.awayPenalties
      : finalMatch.homePenalties;

  /*
   * ==========================================================
   * MARCATORI FINALE
   * ==========================================================
   */

  const finalGoals =
    buildFinalGoalsFromReport({
      archive,

      aggregatedPlayers,

      championTeamCode:
        winnerCode,
    });

  /*
   * ==========================================================
   * TABELLINO FINALE
   * ==========================================================
   */

  const finalReport =
    buildHallOfChampionsFinalReport({
      archive,

      aggregatedPlayers,

      finalMatch,
    });

  /*
   * ==========================================================
   * ROSA CAMPIONE
   * ==========================================================
   */

  const baseRoster =
    buildChampionRoster({
      archive,

      aggregatedPlayers,

      championTeamCode:
        winnerCode,
    });

  /*
   * ==========================================================
   * NUMERI DI MAGLIA DAL TABELLINO FINALE
   * ==========================================================
   */

  const finalReportPlayers =
    finalReport
      ? [
          ...finalReport.homePlayers,

          ...finalReport.awayPlayers,
        ]
      : [];

  const roster =
    baseRoster.map(
      (
        player,
      ) => {
        const finalPlayerById =
          player.playerId
            ? finalReportPlayers.find(
                (
                  finalPlayer,
                ) =>
                  finalPlayer.playerId ===
                  player.playerId,
              )
            : undefined;

        const finalPlayerByName =
          finalPlayerById ??
          finalReportPlayers.find(
            (
              finalPlayer,
            ) =>
              normalizeText(
                `${finalPlayer.firstName} ${finalPlayer.lastName}`,
              ) ===
              normalizeText(
                `${player.firstName} ${player.lastName}`,
              ),
          );

        const shirtNumber =
          finalPlayerByName
            ?.shirtNumber;

        return {
          ...player,

          ...(shirtNumber !==
          undefined
            ? {
                shirtNumber,
              }
            : {}),
        };
      },
    );

  return {
    seasonName:
      archive.season.seasonName,

    competitionId:
  getHistoricalCompetitionId(
    archive.season.competitionName,
  ),

    competitionName:
      archive.season
        .finalCompetitionName ??
      "Ludi Champions League",

    championTeamName,

    runnerUpTeamName,

    championScore,

    runnerUpScore,

    championPenalties,

    runnerUpPenalties,

    finalGoals,

    finalReport,

    roster,
  };
}

/*
 * ============================================================
 * SALVATAGGIO ALBO D'ORO
 * ============================================================
 */

export async function saveHistoricalHallOfChampions({
  seasonId,
  hallOfChampions,
}: {
  seasonId:
    string;

  hallOfChampions:
    DerivedHallOfChampions;
}) {
  const existingBySeasonId =
    await FirebaseHallOfChampionsRepository
      .getBySeasonId(
        seasonId,
      );

  const allEntries =
    await FirebaseHallOfChampionsRepository
      .getAll();

  const existingBySeasonName =
  allEntries.find(
    (
      entry,
    ) => {
      const sameSeason =
        normalizeSeasonLabel(
          entry.seasonName,
        ) ===
        normalizeSeasonLabel(
          hallOfChampions
            .seasonName,
        );

      if (
        !sameSeason
      ) {
        return false;
      }

      if (
        hallOfChampions
          .competitionId
      ) {
        return (
          entry.competitionId ===
          hallOfChampions
            .competitionId
        );
      }

      return (
        entry.competitionId ===
        undefined
      );
    },
  );

  const existingEntry =
    existingBySeasonId ??
    existingBySeasonName;

  const finalGoals =
    hallOfChampions.finalGoals.map(
      (
        goal,
        index,
      ) => ({
        id:
          `final-goal-${index + 1}`,

        minute:
          goal.minute,

        ...(goal.stoppageTime !==
        undefined
          ? {
              stoppageTime:
                goal.stoppageTime,
            }
          : {}),

        scorerName:
          goal.scorerName,

        team:
          goal.team,

        isOwnGoal:
          goal.isOwnGoal ??
          false,
      }),
    );

  const roster =
    hallOfChampions.roster.map(
      (
        player,
      ) => ({
        ...(player.playerId
          ? {
              playerId:
                player.playerId,
            }
          : {}),

        firstName:
          player.firstName,

        lastName:
          player.lastName,

        ...(player.role
          ? {
              role:
                player.role,
            }
          : {}),

        ...(player.shirtNumber !==
        undefined
          ? {
              shirtNumber:
                player.shirtNumber,
            }
          : {}),

        appearances:
          player.appearances,

        goals:
          player.goals,
      }),
    );

  /*
   * ==========================================================
   * UPDATE ENTRY ESISTENTE
   * ==========================================================
   */

  if (
    existingEntry
  ) {
    await FirebaseHallOfChampionsRepository.update({
      entryId:
        existingEntry.id,

      seasonId,

      seasonName:
        hallOfChampions
          .seasonName,

      competitionId:
  hallOfChampions
    .competitionId,

      competitionName:
        hallOfChampions
          .competitionName,

      championTeamId:
        existingEntry
          .championTeamId,

      championTeamName:
        hallOfChampions
          .championTeamName,

      runnerUpTeamId:
        existingEntry
          .runnerUpTeamId,

      runnerUpTeamName:
        hallOfChampions
          .runnerUpTeamName,

      championScore:
        hallOfChampions
          .championScore,

      runnerUpScore:
        hallOfChampions
          .runnerUpScore,

      championPenalties:
        hallOfChampions
          .championPenalties,

      runnerUpPenalties:
        hallOfChampions
          .runnerUpPenalties,

      finalReport:
        hallOfChampions
          .finalReport,

      finalGoals,

      /*
       * Immagini caricate manualmente:
       * non devono essere cancellate
       * da un nuovo import Excel.
       */

      winnerPhotoUrl:
        existingEntry
          .winnerPhotoUrl,

      winnerPhotoKey:
        existingEntry
          .winnerPhotoKey,

      finalMvpPhotoUrl:
        existingEntry
          .finalMvpPhotoUrl,

      finalMvpPhotoKey:
        existingEntry
          .finalMvpPhotoKey,

      roster,
    });

    return;
  }

  /*
   * ==========================================================
   * NUOVA ENTRY
   * ==========================================================
   */

  await FirebaseHallOfChampionsRepository.create({
    seasonId,

    seasonName:
      hallOfChampions
        .seasonName,

    competitionId:
  hallOfChampions
    .competitionId,

    competitionName:
      hallOfChampions
        .competitionName,

    championTeamName:
      hallOfChampions
        .championTeamName,

    runnerUpTeamName:
      hallOfChampions
        .runnerUpTeamName,

    championScore:
      hallOfChampions
        .championScore,

    runnerUpScore:
      hallOfChampions
        .runnerUpScore,

    championPenalties:
      hallOfChampions
        .championPenalties,

    runnerUpPenalties:
      hallOfChampions
        .runnerUpPenalties,

    finalReport:
      hallOfChampions
        .finalReport,

    finalGoals,

    roster,
  });
}

/*
 * ============================================================
 * MARCATORI FINALE
 * ============================================================
 */

function buildFinalGoalsFromReport({
  archive,
  aggregatedPlayers,
  championTeamCode,
}: {
  archive:
    HistoricalSeasonArchiveImport;

  aggregatedPlayers:
    Map<
      string,
      AggregatedHistoricalPlayer
    >;

  championTeamCode:
    string;
}): DerivedHallOfChampionsGoal[] {
  const report =
    archive.championsFinalReport;

  if (
    !report
  ) {
    return [];
  }

  const sides = [
    {
      teamCode:
        report.homeTeamCode,

      opponentTeamCode:
        report.awayTeamCode,

      players:
        report.homePlayers,
    },

    {
      teamCode:
        report.awayTeamCode,

      opponentTeamCode:
        report.homeTeamCode,

      players:
        report.awayPlayers,
    },
  ];

  const goals:
    DerivedHallOfChampionsGoal[] =
    [];

  for (
    const side of
      sides
  ) {
    for (
      const reportPlayer of
        side.players
    ) {
      const aggregated =
        findAggregatedPlayerByPlayerSeasonCode({
          result:
            aggregatedPlayers,

          playerSeasonCode:
            reportPlayer
              .playerSeasonCode,
        });

      const scorerName =
        aggregated
          ? `${aggregated.firstName} ${aggregated.lastName}`.trim()
          : reportPlayer
              .playerSeasonCode;

      const {
        normalGoalMinutes,
        ownGoalMinutes,
      } =
        splitHistoricalFinalGoalMinutes(
          reportPlayer,
        );

      /*
       * ======================================================
       * GOL NORMALI
       * ======================================================
       */

      for (
        const goalMinute of
          normalGoalMinutes
      ) {
        goals.push({
          minute:
            goalMinute.minute,

          ...(goalMinute
            .stoppageTime !==
          undefined
            ? {
                stoppageTime:
                  goalMinute
                    .stoppageTime,
              }
            : {}),

          scorerName,

          team:
            side.teamCode ===
            championTeamCode
              ? "champion"
              : "runnerUp",

          isOwnGoal:
            false,
        });
      }

      /*
       * ======================================================
       * AUTORETI
       *
       * L'autorete viene assegnata alla squadra avversaria.
       * ======================================================
       */

      for (
        const goalMinute of
          ownGoalMinutes
      ) {
        goals.push({
          minute:
            goalMinute.minute,

          ...(goalMinute
            .stoppageTime !==
          undefined
            ? {
                stoppageTime:
                  goalMinute
                    .stoppageTime,
              }
            : {}),

          scorerName,

          team:
            side
              .opponentTeamCode ===
            championTeamCode
              ? "champion"
              : "runnerUp",

          isOwnGoal:
            true,
        });
      }
    }
  }

  return goals.sort(
    (
      first,
      second,
    ) => {
      if (
        first.minute !==
        second.minute
      ) {
        return (
          first.minute -
          second.minute
        );
      }

      return (
        (
          first.stoppageTime ??
          0
        ) -
        (
          second.stoppageTime ??
          0
        )
      );
    },
  );
}

/*
 * ============================================================
 * SPLIT MINUTI GOL / AUTORETI
 * ============================================================
 */

function splitHistoricalFinalGoalMinutes(
  player:
    NonNullable<
      HistoricalSeasonArchiveImport[
        "championsFinalReport"
      ]
    >["homePlayers"][number],
) {
  /*
   * Struttura nuova.
   */

  if (
    player.ownGoalMinutes &&
    player.ownGoalMinutes.length >
      0
  ) {
    return {
      normalGoalMinutes:
        (
          player.goalMinutes ??
          []
        ).slice(
          0,
          player.goals,
        ),

      ownGoalMinutes:
        player.ownGoalMinutes.slice(
          0,
          player.ownGoals,
        ),
    };
  }

  /*
   * Fallback struttura legacy.
   */

  const allMinutes =
    player.goalMinutes ??
    [];

  const normalGoalMinutes =
    allMinutes.slice(
      0,
      player.goals,
    );

  const ownGoalMinutes =
    allMinutes.slice(
      player.goals,

      player.goals +
        player.ownGoals,
    );

  return {
    normalGoalMinutes,

    ownGoalMinutes,
  };
}

/*
 * ============================================================
 * FINAL REPORT ALBO D'ORO
 * ============================================================
 */

function buildHallOfChampionsFinalReport({
  archive,
  aggregatedPlayers,
  finalMatch,
}: {
  archive:
    HistoricalSeasonArchiveImport;

  aggregatedPlayers:
    Map<
      string,
      AggregatedHistoricalPlayer
    >;

  finalMatch:
    HistoricalSeasonArchiveImport[
      "championsMatches"
    ][number];
}): HallOfChampionsFinalReport | undefined {
  const report =
    archive.championsFinalReport;

  if (
    !report
  ) {
    return undefined;
  }

  const homeTeamName =
    getTeamName(
      archive,
      report.homeTeamCode,
    );

  const awayTeamName =
    getTeamName(
      archive,
      report.awayTeamCode,
    );

  const homeTeamAliasName =
    getTeamAliasName(
      archive,
      report.homeTeamCode,
    );

  const awayTeamAliasName =
    getTeamAliasName(
      archive,
      report.awayTeamCode,
    );

  if (
    !homeTeamName ||
    !awayTeamName
  ) {
    return undefined;
  }

  const homePlayers =
    report.homePlayers.map(
      (
        player,
      ) =>
        buildHallOfChampionsFinalPlayer({
          player,

          aggregatedPlayers,
        }),
    );

  const awayPlayers =
    report.awayPlayers.map(
      (
        player,
      ) =>
        buildHallOfChampionsFinalPlayer({
          player,

          aggregatedPlayers,
        }),
    );

  const finalReport:
    HallOfChampionsFinalReport = {
    homeTeamCode:
      report.homeTeamCode,

    homeTeamName,

    ...(homeTeamAliasName
      ? {
          homeTeamAliasName,
        }
      : {}),

    awayTeamCode:
      report.awayTeamCode,

    awayTeamName,

    ...(awayTeamAliasName
      ? {
          awayTeamAliasName,
        }
      : {}),

    /*
     * Il tipo HallOfChampionsFinalReport usa homeScore/awayScore
     * come risultato visualizzato. Con il nuovo template deve
     * quindi ricevere il totale dopo DTS, quando presente.
     */

    homeScore:
      report.homeExtraTimeScore ??
      report.homeScore,

    awayScore:
      report.awayExtraTimeScore ??
      report.awayScore,

    /*
     * Conserviamo anche il risultato al 90' separatamente.
     * Serve alla UI per distinguere una finale conclusa
     * nei tempi regolamentari da una conclusa ai DTS.
     */

    homeRegulationScore:
      report.homeScore,

    awayRegulationScore:
      report.awayScore,

    wentToExtraTime:
      report.homeExtraTimeScore !==
        undefined &&
      report.awayExtraTimeScore !==
        undefined,

    /*
     * Sequenza rigori del nuovo template.
     *
     * Non viene ricostruita dal totale: manteniamo esattamente
     * ordine, playerSeasonCode ed esito letti dal foglio Excel.
     */

    homePenaltyKicks:
      (
        report.homePenaltyKicks ??
        []
      ).map(
        (
          kick,
        ) => ({
          order:
            kick.order,

          playerSeasonCode:
            kick.playerSeasonCode,

          result:
            kick.result,
        }),
      ),

    awayPenaltyKicks:
      (
        report.awayPenaltyKicks ??
        []
      ).map(
        (
          kick,
        ) => ({
          order:
            kick.order,

          playerSeasonCode:
            kick.playerSeasonCode,

          result:
            kick.result,
        }),
      ),

    homePlayers,

    awayPlayers,
  };

  /*
   * ==========================================================
   * RIGORI DAL CALENDARIO CHAMPIONS
   * ==========================================================
   */

  const sameDirection =
    finalMatch.homeTeamCode ===
      report.homeTeamCode &&
    finalMatch.awayTeamCode ===
      report.awayTeamCode;

  /*
   * Il nuovo Tabellino_Finale_Champions contiene direttamente
   * D2/D17. Li preferiamo quando presenti; per i vecchi file
   * resta il fallback ai valori del Calendario_Champions.
   */

  const calendarHomePenalties =
    sameDirection
      ? finalMatch.homePenalties
      : finalMatch.awayPenalties;

  const calendarAwayPenalties =
    sameDirection
      ? finalMatch.awayPenalties
      : finalMatch.homePenalties;

  const homePenalties =
    report.homePenalties ??
    calendarHomePenalties;

  const awayPenalties =
    report.awayPenalties ??
    calendarAwayPenalties;

  if (
    homePenalties !==
    undefined
  ) {
    finalReport.homePenalties =
      homePenalties;
  }

  if (
    awayPenalties !==
    undefined
  ) {
    finalReport.awayPenalties =
      awayPenalties;
  }

  return finalReport;
}

/*
 * ============================================================
 * GIOCATORE FINAL REPORT
 * ============================================================
 */

function buildHallOfChampionsFinalPlayer({
  player,
  aggregatedPlayers,
}: {
  player:
    NonNullable<
      HistoricalSeasonArchiveImport[
        "championsFinalReport"
      ]
    >["homePlayers"][number];

  aggregatedPlayers:
    Map<
      string,
      AggregatedHistoricalPlayer
    >;
}): HallOfChampionsFinalPlayer {
  const aggregated =
    findAggregatedPlayerByPlayerSeasonCode({
      result:
        aggregatedPlayers,

      playerSeasonCode:
        player.playerSeasonCode,
    });

  const {
    normalGoalMinutes,
    ownGoalMinutes,
  } =
    splitHistoricalFinalGoalMinutes(
      player,
    );

  return {
    ...(aggregated?.playerId
      ? {
          playerId:
            aggregated.playerId,
        }
      : {}),

    playerSeasonCode:
      player.playerSeasonCode,

    firstName:
      aggregated?.firstName ??
      player.playerSeasonCode,

    lastName:
      aggregated?.lastName ??
      "",

    ...(player.role
      ? {
          role:
            player.role,
        }
      : {}),

    ...(player.shirtNumber !==
    undefined
      ? {
          shirtNumber:
            player.shirtNumber,
        }
      : {}),

    ...(player.vote !==
    undefined
      ? {
          vote:
            player.vote,
        }
      : {}),

    withoutVote:
      player.withoutVote,

    goals:
      player.goals,

    assists:
      player.assists,

    ownGoals:
      player.ownGoals,

    yellowCards:
      player.yellowCards,

    redCards:
      player.redCards,

    ...(player.goalsConceded !==
    undefined
      ? {
          goalsConceded:
            player.goalsConceded,
        }
      : {}),

    mvp:
      player.mvp,

    goalMinutes:
      normalGoalMinutes.map(
        (
          goalMinute,
        ) => ({
          minute:
            goalMinute.minute,

          ...(goalMinute
            .stoppageTime !==
          undefined
            ? {
                stoppageTime:
                  goalMinute
                    .stoppageTime,
              }
            : {}),
        }),
      ),

    ownGoalMinutes:
      ownGoalMinutes.map(
        (
          goalMinute,
        ) => ({
          minute:
            goalMinute.minute,

          ...(goalMinute
            .stoppageTime !==
          undefined
            ? {
                stoppageTime:
                  goalMinute
                    .stoppageTime,
              }
            : {}),
        }),
      ),
  };
}

/*
 * ============================================================
 * ROSA CAMPIONE
 *
 * Regular Season + Champions.
 *
 * I totali Champions comprendono già
 * la finale e non devono essere sommati
 * nuovamente con il tabellino finale.
 * ============================================================
 */

function buildChampionRoster({
  archive,
  aggregatedPlayers,
  championTeamCode,
}: {
  archive:
    HistoricalSeasonArchiveImport;

  aggregatedPlayers:
    Map<
      string,
      AggregatedHistoricalPlayer
    >;

  championTeamCode:
    string;
}): DerivedHallOfChampionsPlayer[] {
  const roster:
    DerivedHallOfChampionsPlayer[] =
    [];

  const finalReportPlayers =
    archive.championsFinalReport
      ? [
          ...archive
            .championsFinalReport
            .homePlayers,

          ...archive
            .championsFinalReport
            .awayPlayers,
        ]
      : [];

  for (
    const player of
      aggregatedPlayers.values()
  ) {
    if (
      !player.championsTeamCodes.has(
        championTeamCode,
      )
    ) {
      continue;
    }

    const championsPlayer =
      archive.championsPlayerStats.find(
        (
          currentPlayer,
        ) =>
          normalizeText(
            currentPlayer
              .playerSeasonCode,
          ) ===
          normalizeText(
            player.playerSeasonCode,
          ),
      );

    const finalReportPlayer =
      finalReportPlayers.find(
        (
          currentPlayer,
        ) =>
          normalizeText(
            currentPlayer
              .playerSeasonCode,
          ) ===
          normalizeText(
            player.playerSeasonCode,
          ),
      );

    const regularSeasonPlayer =
      archive.regularSeasonPlayers.find(
        (
          currentPlayer,
        ) =>
          normalizeText(
            currentPlayer
              .playerSeasonCode,
          ) ===
          normalizeText(
            player.playerSeasonCode,
          ),
      );

    /*
     * Priorità ruolo:
     *
     * 1. Tabellino finale
     * 2. Champions
     * 3. Regular Season
     * 4. Aggregato
     */

    const role =
      finalReportPlayer?.role ??
      championsPlayer?.role ??
      regularSeasonPlayer?.role ??
      player.role;

    /*
     * Priorità numero:
     *
     * 1. Tabellino finale
     * 2. Champions
     * 3. Regular Season
     * 4. Aggregato
     */

    const shirtNumber =
      finalReportPlayer
        ?.shirtNumber ??
      championsPlayer
        ?.shirtNumber ??
      regularSeasonPlayer
        ?.shirtNumber ??
      player.shirtNumbers[0];

    roster.push({
      ...(player.playerId
        ? {
            playerId:
              player.playerId,
          }
        : {}),

      firstName:
        player.firstName,

      lastName:
        player.lastName,

      ...(role
        ? {
            role:
              role.trim(),
          }
        : {}),

      ...(shirtNumber !==
      undefined
        ? {
            shirtNumber:
              Number(
                shirtNumber,
              ),
          }
        : {}),

      appearances:
        player.regularAppearances +
        player.championsAppearances,

      goals:
        player.regularGoals +
        player.championsGoals,
    });
  }

  return roster.sort(
    (
      first,
      second,
    ) => {
      const firstIsGoalkeeper =
        normalizeText(
          first.role ??
            "",
        ) ===
        "portiere";

      const secondIsGoalkeeper =
        normalizeText(
          second.role ??
            "",
        ) ===
        "portiere";

      if (
        firstIsGoalkeeper &&
        !secondIsGoalkeeper
      ) {
        return -1;
      }

      if (
        !firstIsGoalkeeper &&
        secondIsGoalkeeper
      ) {
        return 1;
      }

      const lastNameComparison =
        first.lastName.localeCompare(
          second.lastName,
          "it",
        );

      if (
        lastNameComparison !==
        0
      ) {
        return lastNameComparison;
      }

      return first.firstName.localeCompare(
        second.firstName,
        "it",
      );
    },
  );
}

/*
 * ============================================================
 * RICERCA FINALE CHAMPIONS
 * ============================================================
 */

function findChampionsFinal(
  archive:
    HistoricalSeasonArchiveImport,
) {
  return (
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
    )
  );
}

/*
 * ============================================================
 * VINCITORE FINALE
 * ============================================================
 */

function getMatchWinnerCode(
  match:
    HistoricalSeasonArchiveImport[
      "championsMatches"
    ][number],
) {
  const score =
    getEffectiveMatchScore(
      match,
    );

  if (
    score.home ===
      undefined ||
    score.away ===
      undefined
  ) {
    return undefined;
  }

  if (
    score.home >
    score.away
  ) {
    return match.homeTeamCode;
  }

  if (
    score.away >
    score.home
  ) {
    return match.awayTeamCode;
  }

  if (
    match.homePenalties !==
      undefined &&
    match.awayPenalties !==
      undefined
  ) {
    if (
      match.homePenalties >
      match.awayPenalties
    ) {
      return match.homeTeamCode;
    }

    if (
      match.awayPenalties >
      match.homePenalties
    ) {
      return match.awayTeamCode;
    }
  }

  return undefined;
}

/*
 * ============================================================
 * RISULTATO EFFETTIVO PARTITA
 * ============================================================
 *
 * Nel nuovo template:
 * - homeScore / awayScore = risultato al 90'
 * - homeExtraTimeScore / awayExtraTimeScore = totale dopo DTS
 * - i rigori non si sommano al risultato partita
 * ============================================================
 */

function getEffectiveMatchScore(
  match:
    HistoricalSeasonArchiveImport[
      "championsMatches"
    ][number],
): {
  home?: number;
  away?: number;
} {
  return {
    home:
      match.homeExtraTimeScore ??
      match.homeScore,

    away:
      match.awayExtraTimeScore ??
      match.awayScore,
  };
}

/*
 * ============================================================
 * RICERCA GIOCATORE PER PLAYER SEASON CODE
 * ============================================================
 */

function findAggregatedPlayerByPlayerSeasonCode({
  result,
  playerSeasonCode,
}: {
  result:
    Map<
      string,
      AggregatedHistoricalPlayer
    >;

  playerSeasonCode:
    string;
}) {
  const normalizedCode =
    normalizeText(
      playerSeasonCode,
    );

  return Array.from(
    result.values(),
  ).find(
    (
      player,
    ) =>
      normalizeText(
        player.playerSeasonCode,
      ) ===
      normalizedCode,
  );
}

/*
 * ============================================================
 * NOME SQUADRA
 * ============================================================
 */

function getTeamName(
  archive:
    HistoricalSeasonArchiveImport,

  teamCode:
    string,
) {
  return archive.teams.find(
    (
      team,
    ) =>
      team.teamCode ===
      teamCode,
  )?.name;
}

/*
 * ============================================================
 * ALIAS SQUADRA
 * ============================================================
 */

function getTeamAliasName(
  archive:
    HistoricalSeasonArchiveImport,

  teamCode:
    string,
) {
  const team =
    archive.teams.find(
      (
        currentTeam,
      ) =>
        currentTeam.teamCode ===
        teamCode,
    );

  return (
    team?.aliasName?.trim() ||
    team?.name
  );
}

/*
 * ============================================================
 * NORMALIZZAZIONE STAGIONE
 * ============================================================
 */

function normalizeSeasonLabel(
  value:
    string,
) {
  const normalized =
    normalizeText(
      value,
    );

  const match =
    normalized.match(
      /(20\d{2})\s*[/-]\s*(\d{2,4})/,
    );

  if (
    !match
  ) {
    return normalized;
  }

  return `${match[1]}/${match[2].slice(-2)}`;
}

/*
 * ============================================================
 * NORMALIZZAZIONE TESTO
 * ============================================================
 */

function normalizeText(
  value:
    string,
) {
  return value
    .trim()
    .toLocaleLowerCase(
      "it",
    )
    .normalize(
      "NFD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /\s+/g,
      " ",
    );
}

function getHistoricalCompetitionId(
  competitionName: string,
): string | undefined {
  const normalized =
    normalizeText(
      competitionName,
    );

  if (
    normalized.includes(
      "premier",
    )
  ) {
    return "premier-league";
  }

  if (
    normalized.includes(
      "championship",
    )
  ) {
    return "championship";
  }

  if (
    normalized.includes(
      "league one",
    )
  ) {
    return "league-one";
  }

  return undefined;
}