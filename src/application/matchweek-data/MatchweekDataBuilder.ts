import type {
  MatchweekAwardPlayer,
} from "@/src/application/matchweek-awards/MatchweekAwardsEngine";

import type {
  MatchWizardData,
} from "@/src/types/MatchWizardData";

/*
 * ============================================================
 * INPUT
 * ============================================================
 */

type MatchweekDataMatch = {
  id:
    | string
    | number;

  matchweek:
    number;

  homeTeamId:
    | string
    | number;

  awayTeamId:
    | string
    | number;

  status?: string;
};

type MatchweekDataReport = {
  matchId:
    | string
    | number;

  status:
    string;

  data:
    MatchWizardData;
};

type MatchweekDataPlayerProfile = {
  id:
    | string
    | number;

  firstName:
    string;

  lastName:
    string;

  photoUrl?:
    string;
};

type MatchweekDataTeam = {
  id:
    | string
    | number;

  name:
    string;

  aliasName?:
    string;
};

type MatchweekDataSeasonPlayer = {
  playerId:
    | string
    | number;

  teamId:
    | string
    | number;

  role?:
    MatchweekAwardPlayer["role"];
};

/*
 * ============================================================
 * OUTPUT
 * ============================================================
 */

export type MatchweekDataResult = {
  matchweek:
    number;

  matches:
    MatchweekDataMatch[];

  publishedReports:
    MatchweekDataReport[];

  players:
    MatchweekAwardPlayer[];

  isComplete:
    boolean;
};

/*
 * ============================================================
 * BUILDER
 * ============================================================
 */

export class MatchweekDataBuilder {
  static build({
    matchweek,
    matches,
    reports,
    players,
    teams,
    seasonPlayers,
  }: {
    matchweek:
      number;

    matches:
      MatchweekDataMatch[];

    reports:
      MatchweekDataReport[];

    players:
      MatchweekDataPlayerProfile[];

    teams:
      MatchweekDataTeam[];

    seasonPlayers:
      MatchweekDataSeasonPlayer[];
  }): MatchweekDataResult {
    /*
     * ========================================================
     * PARTITE DELLA GIORNATA
     * ========================================================
     */

    const matchweekMatches =
      matches.filter(
        (
          match,
        ) =>
          Number(
            match.matchweek,
          ) ===
          Number(
            matchweek,
          ),
      );

    const matchIds =
      new Set(
        matchweekMatches.map(
          (
            match,
          ) =>
            String(
              match.id,
            ),
        ),
      );

    /*
     * ========================================================
     * REPORT PUBBLICATI
     * ========================================================
     */

    const publishedReports =
      reports.filter(
        (
          report,
        ) =>
          report.status ===
            "published" &&
          matchIds.has(
            String(
              report.matchId,
            ),
          ),
      );

    const publishedReportIds =
      new Set(
        publishedReports.map(
          (
            report,
          ) =>
            String(
              report.matchId,
            ),
        ),
      );

    /*
     * ========================================================
     * COMPLETEZZA GIORNATA
     *
     * Una partita rinviata viene considerata
     * chiusa ai fini di MATCHWEEK HUB.
     *
     * Tutte le altre richiedono un report pubblicato.
     * ========================================================
     */

    const isComplete =
      matchweekMatches.length >
        0 &&
      matchweekMatches.every(
        (
          match,
        ) => {
          if (
            match.status ===
            "postponed"
          ) {
            return true;
          }

          return publishedReportIds.has(
            String(
              match.id,
            ),
          );
        },
      );

    /*
     * ========================================================
     * LOOKUP
     * ========================================================
     */

    const matchesById =
      new Map(
        matchweekMatches.map(
          (
            match,
          ) => [
            String(
              match.id,
            ),

            match,
          ],
        ),
      );

    const playersById =
      new Map(
        players.map(
          (
            player,
          ) => [
            String(
              player.id,
            ),

            player,
          ],
        ),
      );

    const teamsById =
      new Map(
        teams.map(
          (
            team,
          ) => [
            String(
              team.id,
            ),

            team,
          ],
        ),
      );

    const seasonPlayersByPlayerId =
      new Map(
        seasonPlayers.map(
          (
            seasonPlayer,
          ) => [
            String(
              seasonPlayer.playerId,
            ),

            seasonPlayer,
          ],
        ),
      );

    /*
     * ========================================================
     * GIOCATORI AGGREGATI
     * ========================================================
     */

    const accumulators =
      new Map<
        string,
        MatchweekAwardPlayer
      >();

    function getPlayer({
      playerId,
      teamId,
    }: {
      playerId:
        string;

      teamId:
        string;
    }): MatchweekAwardPlayer {
      const existing =
        accumulators.get(
          playerId,
        );

      if (
        existing
      ) {
        /*
         * Nei casi in cui il giocatore sia stato
         * inizializzato senza teamId valido
         * proviamo a correggerlo successivamente.
         */
        if (
          !existing.teamId &&
          teamId
        ) {
          const team =
            teamsById.get(
              teamId,
            );

          existing.teamId =
            teamId;

          existing.teamName =
            team?.aliasName ||
            team?.name ||
            existing.teamName;
        }

        return existing;
      }

      const player =
        playersById.get(
          playerId,
        );

      const seasonPlayer =
        seasonPlayersByPlayerId.get(
          playerId,
        );

      const resolvedTeamId =
        teamId ||
        String(
          seasonPlayer?.teamId ??
            "",
        );

      const team =
        teamsById.get(
          resolvedTeamId,
        );

      const created:
        MatchweekAwardPlayer = {
        playerId,

        playerName:
  player
    ? `${player.firstName} ${player.lastName}`.trim()
    : "Giocatore non disponibile",

photoUrl:
  player?.photoUrl
    ?.trim() ||
  undefined,

teamId:
  resolvedTeamId,

        teamName:
          team?.aliasName ||
          team?.name ||
          "Squadra non disponibile",

        role:
          seasonPlayer?.role,

        appearances:
          0,

        goals:
          0,

        assists:
          0,

        mvp:
          0,

        cleanSheets:
          0,

        voteTotal:
          0,

        voteCount:
          0,

        matchImportance:
          1,
      };

      accumulators.set(
        playerId,
        created,
      );

      return created;
    }

    /*
     * ========================================================
     * ANALISI REPORT
     * ========================================================
     */

    for (
      const report of
        publishedReports
    ) {
      const match =
        matchesById.get(
          String(
            report.matchId,
          ),
        );

      if (
        !match
      ) {
        continue;
      }

      /*
       * Una partita rinviata non produce
       * statistiche individuali.
       */
      if (
        match.status ===
          "postponed" ||
        report.data.status ===
          "postponed"
      ) {
        continue;
      }

      const homeTeamId =
        String(
          match.homeTeamId,
        );

      const awayTeamId =
        String(
          match.awayTeamId,
        );

      /*
       * ======================================================
       * PRESENZE CASA
       * ======================================================
       */

      for (
        const playerId of
          new Set(
            (
              report.data
                .homePresentPlayerIds ??
              []
            ).map(
              String,
            ),
          )
      ) {
        getPlayer({
          playerId,

          teamId:
            homeTeamId,
        }).appearances +=
          1;
      }

      /*
       * ======================================================
       * PRESENZE OSPITE
       * ======================================================
       */

      for (
        const playerId of
          new Set(
            (
              report.data
                .awayPresentPlayerIds ??
              []
            ).map(
              String,
            ),
          )
      ) {
        getPlayer({
          playerId,

          teamId:
            awayTeamId,
        }).appearances +=
          1;
      }

      /*
       * ======================================================
       * VITTORIA A TAVOLINO
       *
       * Le presenze sono già state assegnate.
       *
       * Non assegniamo:
       * - gol
       * - assist
       * - voti
       * - MVP
       * - clean sheet
       * ======================================================
       */

      if (
        report.data.status ===
        "walkover"
      ) {
        continue;
      }

      /*
       * ======================================================
       * GOL / ASSIST
       * ======================================================
       */

      for (
        const goal of
          report.data.goals ??
          []
      ) {
        /*
         * Autorete:
         * non viene attribuita come gol
         * al giocatore.
         */

        if (
          goal.type !==
          "ownGoal"
        ) {
          const scorer =
            getPlayer({
              playerId:
                String(
                  goal.scorerPlayerId,
                ),

              teamId:
                String(
                  goal.teamId,
                ),
            });

          scorer.goals +=
            1;

          /*
           * Compatibilità con vecchi report
           * privi degli array presenze.
           */
          scorer.appearances =
            Math.max(
              scorer.appearances,
              1,
            );
        }

        /*
         * ASSIST
         */

        if (
          goal.type !==
            "ownGoal" &&
          goal.assistPlayerId !==
            undefined
        ) {
          const assistant =
            getPlayer({
              playerId:
                String(
                  goal.assistPlayerId,
                ),

              teamId:
                String(
                  goal.teamId,
                ),
            });

          assistant.assists +=
            1;

          assistant.appearances =
            Math.max(
              assistant.appearances,
              1,
            );
        }
      }

      /*
       * ======================================================
       * MVP
       * ======================================================
       */

      if (
        report.data
          .mvpPlayerId
      ) {
        const mvpPlayerId =
          String(
            report.data
              .mvpPlayerId,
          );

        const seasonPlayer =
          seasonPlayersByPlayerId.get(
            mvpPlayerId,
          );

        const mvpPlayer =
          getPlayer({
            playerId:
              mvpPlayerId,

            teamId:
              String(
                seasonPlayer?.teamId ??
                  "",
              ),
          });

        mvpPlayer.mvp +=
          1;

        mvpPlayer.appearances =
          Math.max(
            mvpPlayer.appearances,
            1,
          );
      }

      /*
       * ======================================================
       * PERFORMANCE / VOTI
       * ======================================================
       */

      for (
        const performance of
          Object.values(
            report.data
              .performances ??
              {},
          )
      ) {
        const player =
          getPlayer({
            playerId:
              String(
                performance.playerId,
              ),

            teamId:
              String(
                performance.teamId,
              ),
          });

        /*
         * Una performance conferma comunque
         * la presenza, anche per vecchi report
         * senza presentPlayerIds.
         */
        player.appearances =
          Math.max(
            player.appearances,
            1,
          );

        if (
          performance.status ===
            "rated" &&
          typeof performance.vote ===
            "number" &&
          Number.isFinite(
            performance.vote,
          )
        ) {
          player.voteTotal +=
            performance.vote;

          player.voteCount +=
            1;
        }
      }

      /*
       * ======================================================
       * CLEAN SHEET CASA
       * ======================================================
       */

      if (
        report.data
          .awayScore ===
        0
      ) {
        addGoalkeeperCleanSheet({
          playerIds:
            report.data
              .homePresentPlayerIds ??
            [],

          teamId:
            homeTeamId,

          seasonPlayersByPlayerId,

          getPlayer,
        });
      }

      /*
       * ======================================================
       * CLEAN SHEET OSPITE
       * ======================================================
       */

      if (
        report.data
          .homeScore ===
        0
      ) {
        addGoalkeeperCleanSheet({
          playerIds:
            report.data
              .awayPresentPlayerIds ??
            [],

          teamId:
            awayTeamId,

          seasonPlayersByPlayerId,

          getPlayer,
        });
      }
    }

    return {
      matchweek,

      matches:
        matchweekMatches,

      publishedReports,

      players:
        Array.from(
          accumulators.values(),
        ),

      isComplete,
    };
  }
}

/*
 * ============================================================
 * CLEAN SHEET PORTIERE
 * ============================================================
 */

function addGoalkeeperCleanSheet({
  playerIds,
  teamId,
  seasonPlayersByPlayerId,
  getPlayer,
}: {
  playerIds:
    Array<
      string | number
    >;

  teamId:
    string;

  seasonPlayersByPlayerId:
    Map<
      string,
      MatchweekDataSeasonPlayer
    >;

  getPlayer: ({
    playerId,
    teamId,
  }: {
    playerId:
      string;

    teamId:
      string;
  }) =>
    MatchweekAwardPlayer;
}) {
  for (
    const playerId of
      new Set(
        playerIds.map(
          String,
        ),
      )
  ) {
    const seasonPlayer =
      seasonPlayersByPlayerId.get(
        playerId,
      );

    if (
      seasonPlayer?.role !==
      "Portiere"
    ) {
      continue;
    }

    getPlayer({
      playerId,

      teamId,
    }).cleanSheets +=
      1;
  }
}