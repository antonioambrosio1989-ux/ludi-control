import {
  AnalyticsEngine,
} from "@/src/capabilities/analytics";

import type {
  MatchEngine,
} from "../contracts/MatchEngine";

import type {
  MatchProcessingContext,
} from "../contracts/MatchProcessingContext";

import type {
  AnalyticsProcessingResult,
} from "../results/AnalyticsProcessingResult";

export class AnalyticsEngineAdapter
  implements
    MatchEngine<AnalyticsProcessingResult>
{
  readonly name =
    "analytics";

  execute(
    context:
      MatchProcessingContext,
  ): AnalyticsProcessingResult {
    /*
     * =========================================================
     * REPORTS
     * =========================================================
     */

    const reports = [
      ...context.previousReports,
      context.report,
    ];

    /*
     * =========================================================
     * MATCHES
     * =========================================================
     */

    const matches = [
      ...context.previousMatches,
      context.match,
    ];

    /*
     * =========================================================
     * COMPETITION
     * =========================================================
     *
     * Il motore ufficiale della classifica deve conoscere
     * la competizione per applicare il corretto ordinamento:
     *
     * Premier League / League One:
     * punti -> differenza reti -> scontri diretti -> gol fatti
     *
     * Championship:
     * punti -> scontri diretti -> differenza reti -> gol fatti
     * =========================================================
     */

    const competitionId =
      context.season
        .competitionId
        ?.trim();

    if (
      !competitionId
    ) {
      throw new Error(
        "La stagione non è associata a una competizione.",
      );
    }

    /*
     * =========================================================
     * SEASON TEAMS
     * =========================================================
     *
     * Passiamo anche tutte le squadre iscritte alla stagione.
     *
     * In questo modo il calculator ufficiale può mostrare
     * correttamente anche una squadra che non ha ancora
     * disputato alcuna partita.
     * =========================================================
     */

    const teamIds =
      context.seasonTeams.map(
        (
          seasonTeam,
        ) =>
          String(
            seasonTeam.teamId,
          ),
      );

    /*
     * =========================================================
     * ANALYTICS ENGINE
     * =========================================================
     */

    const result =
      AnalyticsEngine.execute({
        seasonId:
          String(
            context.season.id,
          ),

        competitionId,

        teamIds,

        reports,

        matches,

        teams:
          context.teams,

        players:
          context.players,

        seasonPlayers:
          context.seasonPlayers,
      });

    /*
     * =========================================================
     * RESULT
     * =========================================================
     */

    return {
      playerStatistics:
        result.playerStatistics,

      teamStatistics:
        result.teamStatistics,

      standings:
        result.standings,

      processedReportsCount:
        result.metadata
          .processedReportsCount,

      processedMatchesCount:
        result.metadata
          .processedMatchesCount,
    };
  }
}