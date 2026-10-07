import type { PlayerProfile } from "@/src/types/PlayerProfile";

import type {
  HistoricalPlayerSeasonStats,
} from "@/src/types/HistoricalPlayerSeasonStats";

export type AllTimeGoalscorer = {
  playerId: string;

  firstName: string;
  lastName: string;

  photoUrl?: string;
  coverImageUrl?: string;

  totalGoals: number;
  totalAppearances: number;

  seasonsPlayed: number;
};

export function buildAllTimeGoalscorers({
  players,
  historicalStats,
  limit = 20,
}: {
  players: PlayerProfile[];

  historicalStats:
    HistoricalPlayerSeasonStats[];

  limit?: number;
}): AllTimeGoalscorer[] {
  const playerById = new Map(
    players.map((player) => [
      player.id,
      player,
    ]),
  );

  const totalsByPlayerId =
    new Map<
      string,
      {
        totalGoals: number;
        totalAppearances: number;
        seasonIds: Set<string>;
      }
    >();

  historicalStats.forEach(
    (stats) => {
      const current =
        totalsByPlayerId.get(
          stats.playerId,
        ) ?? {
          totalGoals: 0,
          totalAppearances: 0,
          seasonIds: new Set<string>(),
        };

      current.totalGoals +=
        stats.goals;

      current.totalAppearances +=
        stats.appearances;

      current.seasonIds.add(
        stats.seasonId,
      );

      totalsByPlayerId.set(
        stats.playerId,
        current,
      );
    },
  );

  const ranking:
    AllTimeGoalscorer[] = [];

  totalsByPlayerId.forEach(
    (
      totals,
      playerId,
    ) => {
      const player =
        playerById.get(
          playerId,
        );

      if (!player) {
        return;
      }

      if (
        totals.totalGoals <=
        0
      ) {
        return;
      }

      ranking.push({
        playerId,

        firstName:
          player.firstName,

        lastName:
          player.lastName,

        photoUrl:
          player.photoUrl,

        coverImageUrl:
          player.coverImageUrl,

        totalGoals:
          totals.totalGoals,

        totalAppearances:
          totals.totalAppearances,

        seasonsPlayed:
          totals.seasonIds.size,
      });
    },
  );

  ranking.sort(
    (a, b) => {
      /*
       * 1. Più gol.
       */
      if (
        b.totalGoals !==
        a.totalGoals
      ) {
        return (
          b.totalGoals -
          a.totalGoals
        );
      }

      /*
       * 2. A parità di gol:
       * meno presenze.
       */
      if (
        a.totalAppearances !==
        b.totalAppearances
      ) {
        return (
          a.totalAppearances -
          b.totalAppearances
        );
      }

      /*
       * 3. Ordine alfabetico.
       */
      const lastNameCompare =
        a.lastName.localeCompare(
          b.lastName,
          "it",
        );

      if (
        lastNameCompare !==
        0
      ) {
        return lastNameCompare;
      }

      return a.firstName.localeCompare(
        b.firstName,
        "it",
      );
    },
  );

  return ranking.slice(
    0,
    Math.max(
      0,
      limit,
    ),
  );
}