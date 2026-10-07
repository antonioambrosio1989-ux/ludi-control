import {
  buildPlayerRatings,
  buildTeamStrength,
} from "@/src/services/rating/RatingPlayerBuilder";

import type {
  MatchEngine,
} from "../contracts/MatchEngine";

import type {
  MatchProcessingContext,
} from "../contracts/MatchProcessingContext";

import type {
  AnalyticsProcessingResult,
} from "../results/AnalyticsProcessingResult";

import type {
  RatingProcessingResult,
} from "../results/RatingProcessingResult";

export class RatingEngineAdapter
  implements
    MatchEngine<RatingProcessingResult>
{
  readonly name =
    "rating";

  constructor(
    private readonly getAnalyticsResult:
      () => AnalyticsProcessingResult,
  ) {}

  execute(
    context: MatchProcessingContext,
  ): RatingProcessingResult {
    const analytics =
      this.getAnalyticsResult();

    const playerProfilesById =
      new Map(
        context.players.map(
          (player) => [
            String(player.id),
            player,
          ],
        ),
      );

    const seasonPlayersWithRating =
      context.seasonPlayers.map(
        (seasonPlayer) => {
          const playerProfile =
            playerProfilesById.get(
              String(
                seasonPlayer.playerId,
              ),
            );

          return {
            ...seasonPlayer,

            baseRating:
              playerProfile?.baseRating,
          };
        },
      );

    const ratedPlayers =
      buildPlayerRatings({
        seasonPlayers:
          seasonPlayersWithRating,

        statistics:
          analytics.playerStatistics,
      });

    const home =
      buildTeamStrength({
        teamId:
          context.match.homeTeamId,

        ratedPlayers,
      });

    const away =
      buildTeamStrength({
        teamId:
          context.match.awayTeamId,

        ratedPlayers,
      });

    return {
      players:
        ratedPlayers,

      teams: {
        home,
        away,
      },
    };
  }
}