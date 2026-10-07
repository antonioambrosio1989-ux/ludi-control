import {
  MatchweekDisciplinaryPlayersService,
  type PublishedMatchReportForDiscipline,
} from "@/src/services/discipline/MatchweekDisciplinaryPlayersService";

import type {
  MatchweekDisciplinaryPlayer,
} from "@/src/services/discipline/DisciplinaryEngine";

import type {
  CloudFinalStageMatchReport,
} from "@/src/services/final-stage/FirebaseFinalStageMatchReportRepository";

import type {
  FinalStageMatch,
} from "@/src/types/FinalStageMatch";

import type {
  MatchWizardPlayerPerformance,
} from "@/src/types/MatchWizardData";

import {
  getFinalStageWeek,
} from "@/src/lib/publicRoutes/finalStageWeeks";

export type FinalStageDisciplinaryWeekData = {
  matches:
    FinalStageMatch[];

  disciplinaryPlayers:
    MatchweekDisciplinaryPlayer[];

  playedTeamIds:
    string[];
};

export const FinalStageDisciplinaryPlayersService =
  {
    async buildWeekData({
      seasonId,
      finalStageWeek,
      matches,
      reports,
    }: {
      seasonId:
        string;

      finalStageWeek:
        number;

      matches:
        FinalStageMatch[];

      reports:
        CloudFinalStageMatchReport[];
    }): Promise<
      FinalStageDisciplinaryWeekData
    > {
      const week =
        getFinalStageWeek(
          matches,
          finalStageWeek,
        );

      if (
        !week
      ) {
        return {
          matches: [],
          disciplinaryPlayers: [],
          playedTeamIds: [],
        };
      }

      const weekMatchIds =
        new Set(
          week.matches.map(
            (match) =>
              String(
                match.id,
              ),
          ),
        );

      const adaptedReports:
        PublishedMatchReportForDiscipline[] =
        reports
          .filter(
            (report) =>
              report.status ===
                "published" &&
              weekMatchIds.has(
                String(
                  report.matchId,
                ),
              ),
          )
          .map(
            (report) => {
              const match =
                week.matches.find(
                  (candidate) =>
                    String(
                      candidate.id,
                    ) ===
                    String(
                      report.matchId,
                    ),
                );

              return {
                id:
                  String(
                    report.matchId,
                  ),

                seasonId,

                /*
                 * MatchweekDisciplinaryPlayersService usa questo
                 * campo solo per filtrare i report. Non viene
                 * persistito dal servizio di estrazione.
                 */
                matchweek:
                  finalStageWeek,

                status:
                  report.status,

                isPublished:
                  true,

                performances:
                  (
                    Object.values(
                      report.data
                        .performances ??
                        {},
                    ) as
                      MatchWizardPlayerPerformance[]
                  ).map(
                    (
                      performance,
                    ) => ({
                      playerId:
                        String(
                          performance
                            .playerId,
                        ),

                      teamId:
                        String(
                          performance
                            .teamId,
                        ),

                      yellowCards:
                        performance
                          .yellowCards ??
                        0,

                      redCards:
                        performance
                          .redCards ??
                        0,

                      directRedCards:
                        performance
                          .directRedCards ??
                        0,
                    }),
                  ),

                events:
                  [],

                /*
                 * La presenza di match serve soltanto a rendere
                 * esplicito che il report appartiene alla FS.
                 */
                ...(match
                  ? {}
                  : {}),
              };
            },
          );

      const extracted =
        MatchweekDisciplinaryPlayersService
          .extract({
            seasonId,
            matchweek:
              finalStageWeek,
            reports:
              adaptedReports,
          });

      const disciplinaryPlayers =
        await MatchweekDisciplinaryPlayersService
          .resolveNames(
            extracted,
          );

      const playedMatches =
        week.matches.filter(
          (match) =>
            match.status ===
              "played" ||
            match.status ===
              "walkover",
        );

      const playedTeamIds =
        Array.from(
          new Set(
            playedMatches.flatMap(
              (match) => [
                String(
                  match.homeTeamId,
                ),
                String(
                  match.awayTeamId,
                ),
              ],
            ),
          ),
        );

      return {
        matches:
          week.matches,
        disciplinaryPlayers,
        playedTeamIds,
      };
    },
  };
