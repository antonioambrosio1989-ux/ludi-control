import {
  PlayerStatisticsCalculator,
} from "./calculators/players/PlayerStatisticsCalculator";

import {
  TeamStatisticsCalculator,
} from "./calculators/teams/TeamStatisticsCalculator";

import {
  calculateStandings,
} from "@/src/services/standings/StandingsCalculator";

import type {
  AnalyticsContext,
} from "./contracts/AnalyticsContext";

import type {
  AnalyticsResult,
} from "./contracts/AnalyticsResult";

export const AnalyticsEngine =
  {
    execute(
      context:
        AnalyticsContext,
    ): AnalyticsResult {
      /*
       * ======================================================
       * PLAYER STATISTICS
       * ======================================================
       */

      const playerStatistics =
        PlayerStatisticsCalculator
          .calculate({
            seasonId:
              context.seasonId,

            matches:
              context.matches,

            reports:
              context.reports,
          });

      /*
       * ======================================================
       * TEAM STATISTICS
       * ======================================================
       */

      const teamStatistics =
        TeamStatisticsCalculator
          .calculate({
            seasonId:
              context.seasonId,

            matches:
              context.matches,

            reports:
              context.reports,
          });

      /*
       * ======================================================
       * OFFICIAL STANDINGS
       * ======================================================
       *
       * La classifica NON viene più ricostruita
       * dalle teamStatistics.
       *
       * Utilizziamo direttamente il motore ufficiale
       * della Regular Season.
       *
       * In questo modo Analytics eredita automaticamente:
       *
       * - regole Premier League / League One
       * - regole Championship
       * - scontri diretti
       * - differenza reti
       * - gol fatti
       * - esclusione titlePlayoff
       * - squadre con 0 partite
       * ======================================================
       */

      const officialStandings =
        calculateStandings(
          context.matches,
          context.reports,
          {
            competitionId:
              context.competitionId,

            teamIds:
              context.teamIds,
          },
        );

      /*
       * Il contratto Analytics utilizza:
       *
       * wins / draws / losses
       *
       * mentre il calculator ufficiale utilizza:
       *
       * won / drawn / lost
       *
       * Qui effettuiamo soltanto il mapping
       * del formato, senza ricalcolare alcuna regola.
       */

      const standings =
        officialStandings.map(
          (
            row,
            index,
          ) => ({
            position:
              index + 1,

            teamId:
              row.teamId,

            played:
              row.played,

            wins:
              row.won,

            draws:
              row.drawn,

            losses:
              row.lost,

            goalsFor:
              row.goalsFor,

            goalsAgainst:
              row.goalsAgainst,

            goalDifference:
              row.goalDifference,

            points:
              row.points,
          }),
        );

      return {
        playerStatistics,

        teamStatistics,

        standings,

        metadata: {
          seasonId:
            context.seasonId,

          processedMatchesCount:
            context.matches.length,

          processedReportsCount:
            context.reports.length,
        },
      };
    },
  };