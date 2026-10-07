import {
  resolveFutCard,
  type FutCardResolution,
  type FutFinalStageCompetition,
  type FutMonthlyAward,
} from "@/src/application/fut/FutCardResolver";

import {
  buildPlayerRatings,
} from "@/src/services/rating/RatingPlayerBuilder";

import {
  calculateFirebasePlayerStats,
} from "@/src/services/stats/FirebasePlayerStatsCalculator";

import type {
  Match,
} from "@/src/types/Match";

import type {
  Team,
} from "@/src/types/Team";

import type {
  FinalStageMatch,
} from "@/src/types/FinalStageMatch";

import type {
  CloudMatchReport,
} from "@/src/services/match/FirebaseMatchReportRepository";

import type {
  CloudFinalStageMatchReport,
} from "@/src/services/final-stage/FirebaseFinalStageMatchReportRepository";

type PlainDoc = {
  id: string;
  data: Record<string, unknown>;
};

export type BuildXiFutSnapshot = {
  futRating?: number;
  futCard?: FutCardResolution;
};

export function buildBuildXiFutSnapshot({
  playerId,
  teamId,
  role,
  baseRating,
  seasonId,
  competitionId,
  matches,
  reports,
  finalStageMatches,
  finalStageReports,
  teams,
  players,
  matchweekAwards,
  finalStagePlayers,
  nowMs = Date.now(),
}: {
  playerId: string;
  teamId: string;
  role: string;
  baseRating: unknown;
  seasonId: string;
  competitionId: string;
  matches: PlainDoc[];
  reports: PlainDoc[];
  finalStageMatches: PlainDoc[];
  finalStageReports: PlainDoc[];
  teams: PlainDoc[];
  players: PlainDoc[];
  matchweekAwards: PlainDoc[];
  finalStagePlayers: PlainDoc[];
  nowMs?: number;
}): BuildXiFutSnapshot {
  const regularMatches =
    matches.map(
      (entry) => ({
        id:
          entry.id,
        ...entry.data,
      }),
    ) as unknown as Match[];

  const regularReports =
    reports.map(
      (entry) => ({
        id:
          entry.id,
        ...entry.data,
      }),
    ) as unknown as CloudMatchReport[];

  const visibleFinalStageMatches =
    finalStageMatches
      .filter(
        (entry) =>
          entry.data.seasonId ===
            seasonId &&
          entry.data.published ===
            true,
      )
      .map(
        (entry) => ({
          id:
            entry.id,
          ...entry.data,
        }),
      ) as unknown as FinalStageMatch[];

  const visibleFinalStageMatchIds =
    new Set(
      visibleFinalStageMatches.map(
        (match) =>
          String(
            match.id,
          ),
      ),
    );

  const visibleFinalStageReports =
    finalStageReports
      .filter(
        (entry) =>
          entry.data.status ===
            "published" &&
          (
            !entry.data.seasonId ||
            entry.data.seasonId ===
              seasonId
          ) &&
          visibleFinalStageMatchIds.has(
            String(
              entry.data.matchId ??
                entry.id,
            ),
          ),
      )
      .map(
        (entry) => ({
          id:
            entry.id,
          ...entry.data,
        }),
      ) as unknown as CloudFinalStageMatchReport[];

  const mappedTeams =
    teams.map(
      (entry) => ({
        id:
          entry.id,
        ...entry.data,
      }),
    ) as unknown as Team[];

  const calculated =
    calculateFirebasePlayerStats({
      playerId,
      matches:
        regularMatches,
      reports:
        regularReports,
      finalStageMatches:
        visibleFinalStageMatches,
      finalStageReports:
        visibleFinalStageReports,
      teams:
        mappedTeams,
      role,
    });

  const ratedPlayer =
    buildPlayerRatings({
      seasonPlayers: [
        {
          playerId,
          teamId,
          role,
          baseRating:
            toFiniteNumber(
              baseRating,
            ),
        },
      ],
      statistics: [
        {
          playerId,
          teamId,
          goals:
            calculated.stats.goals,
          assists:
            calculated.stats.assists,
          mvp:
            calculated.stats.mvp,
          appearances:
            calculated.stats.appearances,
          averageRating:
            calculated.stats.averageVote ??
            0,
          yellowCards:
            calculated.stats.yellowCards,
          redCards:
            calculated.stats.redCards,
          cleanSheetCount:
            calculated.stats.cleanSheets,
          goalsConceded:
            0,
          ratingVariation:
            calculated.stats.ratingVariation,
        },
      ],
    })[0];

  if (
    !ratedPlayer?.hasRating ||
    typeof ratedPlayer.currentRating !==
      "number" ||
    !Number.isFinite(
      ratedPlayer.currentRating,
    )
  ) {
    return {};
  }

  const monthlyAward =
    resolveMonthlyAward({
      playerId,
      seasonId,
      competitionId,
      players,
    });

  const isTotwActive =
    resolveTotwActive({
      playerId,
      seasonId,
      matchweekAwards,
      nowMs,
    });

  const finalStage =
    resolveFinalStageCard({
      playerId,
      seasonId,
      finalStagePlayers,
      finalStageMatches:
        visibleFinalStageMatches,
    });

  return {
    futRating:
      ratedPlayer.currentRating,
    futCard:
      resolveFutCard({
        rating:
          ratedPlayer.currentRating,
        isTotwActive,
        monthlyAward,
        finalStageCompetition:
          finalStage?.competition,
        isFinalStageFinalist:
          finalStage?.isFinalist ??
          false,
      }),
  };
}

function resolveMonthlyAward({
  playerId,
  seasonId,
  competitionId,
  players,
}: {
  playerId: string;
  seasonId: string;
  competitionId: string;
  players: PlainDoc[];
}): FutMonthlyAward | undefined {
  const definitions:
    Array<{
      type: FutMonthlyAward;
      prefix: string;
    }> = [
      {
        type:
          "potm",
        prefix:
          "POTM",
      },
      {
        type:
          "gotm",
        prefix:
          "GOTM",
      },
      {
        type:
          "sotm",
        prefix:
          "SOTM",
      },
    ];

  const activeForPlayer:
    Array<{
      type: FutMonthlyAward;
      achievedAtMs: number;
    }> = [];

  for (
    const definition of
      definitions
  ) {
    const candidates =
      players.flatMap(
        (entry) =>
          readRecordArray(
            entry.data.achievements,
          )
            .filter(
              (achievement) =>
                String(
                  achievement.seasonId ??
                    "",
                ) ===
                  seasonId &&
                String(
                  achievement.competitionId ??
                    "",
                ) ===
                  competitionId &&
                String(
                  achievement.title ??
                    "",
                )
                  .trim()
                  .toLocaleUpperCase(
                    "it",
                  )
                  .startsWith(
                    definition.prefix,
                  ),
            )
            .map(
              (achievement) => ({
                playerId:
                  entry.id,
                achievedAtMs:
                  toTimestampMs(
                    achievement.createdAt,
                  ),
              }),
            ),
      );

    const latest =
      [...candidates].sort(
        (
          first,
          second,
        ) =>
          second.achievedAtMs -
          first.achievedAtMs,
      )[0];

    if (
      latest?.playerId ===
      playerId
    ) {
      activeForPlayer.push({
        type:
          definition.type,
        achievedAtMs:
          latest.achievedAtMs,
      });
    }
  }

  return activeForPlayer
    .sort(
      (
        first,
        second,
      ) =>
        second.achievedAtMs -
        first.achievedAtMs,
    )[0]
    ?.type;
}

function resolveTotwActive({
  playerId,
  seasonId,
  matchweekAwards,
  nowMs,
}: {
  playerId: string;
  seasonId: string;
  matchweekAwards: PlainDoc[];
  nowMs: number;
}): boolean {
  const publications =
    matchweekAwards
      .filter(
        (entry) =>
          String(
            entry.data.seasonId ??
              "",
          ) ===
            seasonId &&
          entry.data.status ===
            "published",
      )
      .map(
        (entry) => ({
          entry,
          matchweek:
            Number(
              entry.data.matchweek ??
                0,
            ),
          achievedAtMs:
            toTimestampMs(
              entry.data.updatedAt ??
                entry.data.createdAt,
            ),
          containsPlayer:
            readRecordArray(
              entry.data.confirmedTeamOfWeekPlayers,
            ).some(
              (player) =>
                String(
                  player.playerId ??
                    "",
                ) ===
                playerId,
            ),
        }),
      )
      .sort(
        (
          first,
          second,
        ) => {
          if (
            first.achievedAtMs !==
            second.achievedAtMs
          ) {
            return (
              second.achievedAtMs -
              first.achievedAtMs
            );
          }

          return (
            second.matchweek -
            first.matchweek
          );
        },
      );

  const latestForPlayer =
    publications.find(
      (publication) =>
        publication.containsPlayer,
    );

  if (!latestForPlayer) {
    return false;
  }

  if (
    latestForPlayer.achievedAtMs >
    0
  ) {
    return (
      nowMs -
        latestForPlayer.achievedAtMs
    ) <=
      7 *
        24 *
        60 *
        60 *
        1000;
  }

  const latestPublished =
    [...publications].sort(
      (
        first,
        second,
      ) =>
        first.matchweek -
        second.matchweek,
    ).at(
      -1,
    );

  return (
    latestPublished?.entry.id ===
    latestForPlayer.entry.id
  );
}

function resolveFinalStageCard({
  playerId,
  seasonId,
  finalStagePlayers,
  finalStageMatches,
}: {
  playerId: string;
  seasonId: string;
  finalStagePlayers: PlainDoc[];
  finalStageMatches: FinalStageMatch[];
}):
  | {
      competition:
        FutFinalStageCompetition;
      isFinalist:
        boolean;
    }
  | undefined {
  const finalStagePlayer =
    finalStagePlayers.find(
      (entry) =>
        String(
          entry.data.seasonId ??
            "",
        ) ===
          seasonId &&
        String(
          entry.data.playerId ??
            "",
        ) ===
          playerId,
    );

  if (!finalStagePlayer) {
    return undefined;
  }

  const stageStillActive =
    finalStageMatches.some(
      (match) =>
        ![
          "played",
          "walkover",
          "cancelled",
        ].includes(
          String(
            match.status,
          ),
        ),
    );

  if (!stageStillActive) {
    return undefined;
  }

  const teamId =
    String(
      finalStagePlayer.data.teamId ??
        "",
    );

  const mapped =
    finalStageMatches
      .filter(
        (match) =>
          String(
            match.homeTeamId,
          ) ===
            teamId ||
          String(
            match.awayTeamId,
          ) ===
            teamId,
      )
      .map(
        (match) => ({
          competition:
            mapFinalStageCompetition(
              String(
                match.competition,
              ),
            ),
          isFinal:
            String(
              match.round,
            ) ===
            "final",
          status:
            String(
              match.status,
            ),
        }),
      )
      .filter(
        (
          entry,
        ): entry is {
          competition:
            FutFinalStageCompetition;
          isFinal:
            boolean;
          status:
            string;
        } =>
          Boolean(
            entry.competition,
          ),
      );

  const finalist =
    mapped.find(
      (entry) =>
        entry.isFinal &&
        ![
          "played",
          "walkover",
          "cancelled",
        ].includes(
          entry.status,
        ),
    );

  if (finalist) {
    return {
      competition:
        finalist.competition,
      isFinalist:
        true,
    };
  }

  const first =
    mapped[0];

  return first
    ? {
        competition:
          first.competition,
        isFinalist:
          false,
      }
    : undefined;
}

function mapFinalStageCompetition(
  value: string,
): FutFinalStageCompetition | undefined {
  if (
    value ===
    "championsLeague"
  ) {
    return "champions";
  }

  if (
    value ===
    "europaLeague"
  ) {
    return "europa";
  }

  if (
    value ===
    "conferenceLeague"
  ) {
    return "conference";
  }

  return undefined;
}

function readRecordArray(
  value: unknown,
): Record<string, unknown>[] {
  return Array.isArray(
    value,
  )
    ? value.filter(
        (
          entry,
        ): entry is
          Record<
            string,
            unknown
          > =>
          Boolean(
            entry,
          ) &&
          typeof entry ===
            "object",
      )
    : [];
}

function toFiniteNumber(
  value: unknown,
): number | undefined {
  const numeric =
    Number(
      value,
    );

  return Number.isFinite(
    numeric,
  )
    ? numeric
    : undefined;
}

function toTimestampMs(
  value: unknown,
): number {
  if (
    typeof value ===
      "number"
  ) {
    return Number.isFinite(
      value,
    )
      ? value
      : 0;
  }

  if (
    typeof value ===
      "string"
  ) {
    const parsed =
      Date.parse(
        value,
      );

    return Number.isFinite(
      parsed,
    )
      ? parsed
      : 0;
  }

  if (
    value instanceof Date
  ) {
    return value.getTime();
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    const candidate =
      value as {
        toMillis?:
          () => number;
        seconds?:
          number;
      };

    if (
      typeof candidate.toMillis ===
      "function"
    ) {
      const millis =
        candidate.toMillis();

      return Number.isFinite(
        millis,
      )
        ? millis
        : 0;
    }

    if (
      typeof candidate.seconds ===
      "number"
    ) {
      return (
        candidate.seconds *
        1000
      );
    }
  }

  return 0;
}
