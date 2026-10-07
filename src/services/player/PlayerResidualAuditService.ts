import {
  FirebaseHallOfFameRepository,
} from "@/src/services/awards/FirebaseHallOfFameRepository";

import {
  FirebaseHistoricalPlayerStatsRepository,
} from "@/src/services/player/FirebaseHistoricalPlayerStatsRepository";

import {
  FirebasePlayerRepository,
} from "@/src/services/player/FirebasePlayerRepository";

import {
  FirebaseSeasonPlayerRepository,
} from "@/src/services/player/FirebaseSeasonPlayerRepository";

import {
  buildAllTimeGoalscorers,
} from "@/src/services/player/AllTimeGoalscorersService";

import type {
  HallOfFameItem,
} from "@/src/types/HallOfFameItem";

import type {
  HistoricalPlayerSeasonStats,
} from "@/src/types/HistoricalPlayerSeasonStats";

import type {
  PlayerProfile,
} from "@/src/types/PlayerProfile";

import type {
  SeasonPlayer,
} from "@/src/types/SeasonPlayer";

export type ResidualPlayerAuditEntry = {
  player: PlayerProfile;

  hallOfFameItems:
    HallOfFameItem[];

  historicalStats:
    HistoricalPlayerSeasonStats[];

  seasonPlayerEntries:
    SeasonPlayer[];

  isAllTimeTop20:
    boolean;

  canDelete:
    boolean;
};

export type ResidualPlayerAuditResult = {
  competitionId:
    string;

  residualPlayers:
    ResidualPlayerAuditEntry[];

  linkedPlayers:
    ResidualPlayerAuditEntry[];

  deletablePlayers:
    ResidualPlayerAuditEntry[];

  allTimeTop20PlayerIds:
    string[];
};

export class PlayerResidualAuditService {
  static async analyze({
    competitionId,
    players,
  }: {
    competitionId: string;

    players:
      PlayerProfile[];
  }): Promise<
    ResidualPlayerAuditResult
  > {
    const normalizedCompetitionId =
      competitionId.trim();

    if (
      !normalizedCompetitionId
    ) {
      throw new Error(
        "Seleziona una competizione prima di analizzare i residui.",
      );
    }

    const competitionPlayers =
      players.filter(
        (player) =>
          player.competitionId ===
          normalizedCompetitionId,
      );

    const residualPlayers =
      competitionPlayers.filter(
        (player) =>
          !player
            .historicalImportSources
            ?.length,
      );

    const [
      hallOfFameItems,
      historicalStats,
      seasonPlayerEntries,
    ] =
      await Promise.all([
        FirebaseHallOfFameRepository
          .getAll(),

        FirebaseHistoricalPlayerStatsRepository
          .getByCompetition(
            normalizedCompetitionId,
          ),

        FirebaseSeasonPlayerRepository
          .getAll(),
      ]);

    const ranking =
      buildAllTimeGoalscorers({
        players:
          competitionPlayers,

        historicalStats,

        limit:
          20,
      });

    const allTimeTop20PlayerIds =
      new Set(
        ranking.map(
          (entry) =>
            entry.playerId,
        ),
      );

    const hallByPlayerId =
      groupByPlayerId(
        hallOfFameItems.filter(
          (item) =>
            item.winnerType ===
              "player" &&
            Boolean(
              item.playerId,
            ),
        ),
        (item) =>
          item.playerId ??
          "",
      );

    const statsByPlayerId =
      groupByPlayerId(
        historicalStats,
        (item) =>
          item.playerId,
      );

    const seasonPlayersByPlayerId =
      groupByPlayerId(
        seasonPlayerEntries,
        (item) =>
          item.playerId,
      );

    const audited =
      residualPlayers.map(
        (
          player,
        ): ResidualPlayerAuditEntry => {
          const playerId =
            player.id;

          const currentHall =
            hallByPlayerId.get(
              playerId,
            ) ?? [];

          const currentStats =
            statsByPlayerId.get(
              playerId,
            ) ?? [];

          const currentSeasonPlayers =
            seasonPlayersByPlayerId.get(
              playerId,
            ) ?? [];

          const isAllTimeTop20 =
            allTimeTop20PlayerIds.has(
              playerId,
            );

          const canDelete =
            currentHall.length ===
              0 &&
            currentStats.length ===
              0 &&
            currentSeasonPlayers.length ===
              0;

          return {
            player,

            hallOfFameItems:
              currentHall,

            historicalStats:
              currentStats,

            seasonPlayerEntries:
              currentSeasonPlayers,

            isAllTimeTop20,

            canDelete,
          };
        },
      );

    return {
      competitionId:
        normalizedCompetitionId,

      residualPlayers:
        audited,

      linkedPlayers:
        audited.filter(
          (entry) =>
            !entry.canDelete,
        ),

      deletablePlayers:
        audited.filter(
          (entry) =>
            entry.canDelete,
        ),

      allTimeTop20PlayerIds:
        Array.from(
          allTimeTop20PlayerIds,
        ),
    };
  }

  static async deleteIfStillSafe(
    playerId: string,
  ): Promise<void> {
    const normalizedPlayerId =
      playerId.trim();

    if (
      !normalizedPlayerId
    ) {
      throw new Error(
        "playerId non valido.",
      );
    }

    const player =
      await FirebasePlayerRepository
        .getByIdWithPrivate(
          normalizedPlayerId,
        );

    if (!player) {
      return;
    }

    if (
      player
        .historicalImportSources
        ?.length
    ) {
      throw new Error(
        `${player.firstName} ${player.lastName}: il giocatore risulta ora collegato a un archivio storico e non può essere eliminato.`,
      );
    }

    const [
      hallOfFameItems,
      historicalStats,
      seasonPlayerEntries,
    ] =
      await Promise.all([
        FirebaseHallOfFameRepository
          .getByPlayerId(
            normalizedPlayerId,
          ),

        FirebaseHistoricalPlayerStatsRepository
          .getByPlayerId(
            normalizedPlayerId,
          ),

        FirebaseSeasonPlayerRepository
          .getByPlayerId(
            normalizedPlayerId,
          ),
      ]);

    if (
      hallOfFameItems.length >
        0 ||
      historicalStats.length >
        0 ||
      seasonPlayerEntries.length >
        0
    ) {
      throw new Error(
        `${player.firstName} ${player.lastName}: sono comparsi nuovi collegamenti. Eliminazione annullata.`,
      );
    }

    await FirebasePlayerRepository.remove(
      normalizedPlayerId,
    );
  }

  static async deleteAllSafe(
    entries:
      ResidualPlayerAuditEntry[],
  ): Promise<{
    deleted:
      number;

    skipped:
      {
        playerId:
          string;

        playerName:
          string;

        reason:
          string;
      }[];
  }> {
    let deleted =
      0;

    const skipped:
      {
        playerId:
          string;

        playerName:
          string;

        reason:
          string;
      }[] =
      [];

    for (
      const entry of
      entries
    ) {
      if (
        !entry.canDelete
      ) {
        continue;
      }

      try {
        await this.deleteIfStillSafe(
          entry.player.id,
        );

        deleted +=
          1;
      } catch (
        currentError
      ) {
        skipped.push({
          playerId:
            entry.player.id,

          playerName:
            `${entry.player.firstName} ${entry.player.lastName}`.trim(),

          reason:
            currentError instanceof Error
              ? currentError.message
              : "Eliminazione non riuscita.",
        });
      }
    }

    return {
      deleted,
      skipped,
    };
  }
}

function groupByPlayerId<T>(
  items:
    T[],

  getPlayerId: (
    item: T,
  ) => string,
): Map<
  string,
  T[]
> {
  const result =
    new Map<
      string,
      T[]
    >();

  for (
    const item of
      items
  ) {
    const playerId =
      getPlayerId(
        item,
      ).trim();

    if (
      !playerId
    ) {
      continue;
    }

    const current =
      result.get(
        playerId,
      ) ?? [];

    current.push(
      item,
    );

    result.set(
      playerId,
      current,
    );
  }

  return result;
}
