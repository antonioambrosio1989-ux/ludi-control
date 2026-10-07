import {
  RatingEngine,
  type PlayerRatingResult,
  type TeamStrengthResult,
} from "./RatingEngine";

import type {
  PlayerSeasonStatistics,
} from "@/src/capabilities/analytics";

export type RatingSeasonPlayer = {
  playerId: string;
  teamId: string;

  role?: string;

  /*
   * Rating iniziale facoltativo.
   *
   * Se assente il giocatore deve
   * essere mostrato come "NP".
   */
  baseRating?: number;

  status?: string;
};

export type RatedPlayer = {
  playerId: string;
  teamId: string;

  role?: string;

  /*
   * undefined = rating non pervenuto.
   */
  baseRating?: number;
  currentRating?: number;

  variation: number;

  trend:
    | "rising"
    | "stable"
    | "falling";

  performanceScore: number;

  hasRating: boolean;
};

type BuildPlayerRatingsParams = {
  seasonPlayers: RatingSeasonPlayer[];

  statistics:
    PlayerSeasonStatistics[];
};

type BuildTeamStrengthParams = {
  teamId: string | number;

  ratedPlayers: RatedPlayer[];

  availablePlayerIds?: string[];
};

function normalizePlayerId(
  value: string | number,
): string {
  return String(value);
}

function getBaseRating(
  value: unknown,
): number | undefined {
  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue,
    )
  ) {
    return undefined;
  }

  return numericValue;
}

export function buildPlayerRatings({
  seasonPlayers,
  statistics,
}: BuildPlayerRatingsParams): RatedPlayer[] {
  const statisticsByPlayerId =
    new Map(
      statistics.map(
        (playerStatistics) => [
          normalizePlayerId(
            playerStatistics.playerId,
          ),

          playerStatistics,
        ],
      ),
    );

  return seasonPlayers.map(
    (seasonPlayer) => {
      const playerId =
        normalizePlayerId(
          seasonPlayer.playerId,
        );

      const playerStatistics =
        statisticsByPlayerId.get(
          playerId,
        );

      const baseRating =
        getBaseRating(
          seasonPlayer.baseRating,
        );

      /*
       * Nessun rating iniziale:
       *
       * il giocatore resta NP.
       *
       * Le statistiche e le variazioni
       * delle partite vengono comunque
       * calcolate normalmente.
       *
       * Quando successivamente verrà
       * inserito il baseRating, tutte
       * le partite già giocate nella
       * stagione verranno considerate.
       */
      if (
        baseRating === undefined
      ) {
        return {
          playerId,

          teamId:
            normalizePlayerId(
              seasonPlayer.teamId,
            ),

          role:
            seasonPlayer.role,

          baseRating:
            undefined,

          currentRating:
            undefined,

          variation: 0,

          trend:
            "stable",

          performanceScore:
            playerStatistics
              ?.ratingVariation ??
            0,

          hasRating: false,
        };
      }

      const ratingResult:
        PlayerRatingResult =
          RatingEngine
            .calculatePlayerRating({
              playerId,

              baseRating,

              role:
                seasonPlayer.role,

              statistics: {
                playerId,

                appearances:
                  playerStatistics
                    ?.appearances ??
                  0,

                averageVote:
                  playerStatistics
                    ?.averageRating ??
                  0,

                goals:
                  playerStatistics
                    ?.goals ??
                  0,

                assists:
                  playerStatistics
                    ?.assists ??
                  0,

                mvp:
                  playerStatistics
                    ?.mvp ??
                  0,

                cleanSheets:
                  playerStatistics
                    ?.cleanSheetCount ??
                  0,

                yellowCards:
                  playerStatistics
                    ?.yellowCards ??
                  0,

                redCards:
                  playerStatistics
                    ?.redCards ??
                  0,

                ratingVariation:
                  playerStatistics
                    ?.ratingVariation ??
                  0,
              },
            });

      return {
        playerId,

        teamId:
          normalizePlayerId(
            seasonPlayer.teamId,
          ),

        role:
          seasonPlayer.role,

        baseRating:
          ratingResult.baseRating,

        currentRating:
          ratingResult.currentRating,

        variation:
          ratingResult.variation,

        trend:
          ratingResult.trend,

        performanceScore:
          ratingResult.performanceScore,

        hasRating: true,
      };
    },
  );
}

export function buildTeamStrength({
  teamId,
  ratedPlayers,
  availablePlayerIds,
}: BuildTeamStrengthParams): TeamStrengthResult {
  const normalizedTeamId =
    normalizePlayerId(
      teamId,
    );

  const availableIds =
    availablePlayerIds
      ? new Set(
          availablePlayerIds.map(
            normalizePlayerId,
          ),
        )
      : undefined;

  /*
   * I giocatori con rating NP
   * non partecipano al calcolo
   * della forza squadra.
   */
  const teamPlayers =
    ratedPlayers
      .filter(
        (player) =>
          player.teamId ===
          normalizedTeamId,
      )
      .filter(
        (
          player,
        ): player is RatedPlayer & {
          currentRating: number;
        } =>
          typeof player.currentRating ===
            "number" &&
          Number.isFinite(
            player.currentRating,
          ),
      )
      .map((player) => ({
        playerId:
          player.playerId,

        rating:
          player.currentRating,

        isAvailable:
          availableIds
            ? availableIds.has(
                player.playerId,
              )
            : true,
      }));

  return RatingEngine
    .calculateTeamStrength(
      teamPlayers,
    );
}

export const RatingPlayerBuilder = {
  buildPlayerRatings,
  buildTeamStrength,
};