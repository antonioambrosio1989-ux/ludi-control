import type {
  PlayerSeasonStatistics,
  StatsMatchReference,
  StatsReportReference,
} from "../../contracts/PlayerStatistics";

type PublishedReportWithMatch = {
  report: StatsReportReference;
  match: StatsMatchReference;
};

type PlayerStatisticsAggregate = {
  playerId: string;
  teamId: string;

  goals: number;
  assists: number;
  mvp: number;
  appearances: number;

  ratingTotal: number;
  ratedAppearances: number;

  yellowCards: number;
  redCards: number;
  directRedCards: number;

  cleanSheetCount: number;
  goalsConceded: number;

  ratingVariation: number;
};

export type PlayerStatisticsCalculatorInput = {
  seasonId: string;
  matches: StatsMatchReference[];
  reports: StatsReportReference[];
};

function getPublishedReportsForSeason({
  reports,
  matches,
  seasonId,
}: {
  reports: StatsReportReference[];
  matches: StatsMatchReference[];
  seasonId?: string;
}): PublishedReportWithMatch[] {
  const matchesById = new Map(
    matches.map((match) => [
      String(match.id),
      match,
    ]),
  );

  return reports.flatMap(
    (
      report,
    ): PublishedReportWithMatch[] => {
      if (
        report.status !==
        "published"
      ) {
        return [];
      }

      const match =
        matchesById.get(
          String(report.matchId),
        );

      if (!match) {
        return [];
      }

      if (
        seasonId &&
        String(match.seasonId) !==
          String(seasonId)
      ) {
        return [];
      }

      return [
        {
          report,
          match,
        },
      ];
    },
  );
}

function createEmptyAggregate({
  playerId,
  teamId,
}: {
  playerId: string;
  teamId: string;
}): PlayerStatisticsAggregate {
  return {
    playerId,
    teamId,

    goals: 0,
    assists: 0,
    mvp: 0,
    appearances: 0,

    ratingTotal: 0,
    ratedAppearances: 0,

    yellowCards: 0,
    redCards: 0,
    directRedCards: 0,

    cleanSheetCount: 0,
    goalsConceded: 0,

    ratingVariation: 0,
  };
}

function convertAggregateToStatistics(
  aggregate: PlayerStatisticsAggregate,
): PlayerSeasonStatistics {
  const averageRating =
    aggregate.ratedAppearances > 0
      ? aggregate.ratingTotal /
        aggregate.ratedAppearances
      : 0;

  return {
    playerId:
      aggregate.playerId,

    teamId:
      aggregate.teamId,

    goals:
      aggregate.goals,

    assists:
      aggregate.assists,

    mvp:
      aggregate.mvp,

    appearances:
      aggregate.appearances,

    averageRating:
      Number(
        averageRating.toFixed(2),
      ),

    yellowCards:
      aggregate.yellowCards,

    redCards:
      aggregate.redCards,

    cleanSheetCount:
      aggregate.cleanSheetCount,

    goalsConceded:
      aggregate.goalsConceded,

    ratingVariation:
      aggregate.ratingVariation,
  };
}

function calculateMatchRatingVariation({
  vote,
  isMvp,
}: {
  vote?: number;
  isMvp: boolean;
}): number {
  let variation =
    isMvp ? 1 : 0;

  if (
    vote === undefined ||
    !Number.isFinite(vote)
  ) {
    return variation;
  }

  if (vote >= 9) {
    variation += 1;
  } else if (vote >= 8) {
    variation += 0.75;
  } else if (vote >= 7) {
    variation += 0.5;
  } else if (vote === 6.5) {
    variation += 0.25;
  } else if (vote === 5.5) {
    variation -= 0.25;
  } else if (vote === 5) {
    variation -= 0.5;
  } else if (vote === 4.5) {
    variation -= 0.75;
  } else if (vote <= 4) {
    variation -= 1;
  }

  return variation;
}

export const PlayerStatisticsCalculator = {
  calculate(
    input: PlayerStatisticsCalculatorInput,
  ): PlayerSeasonStatistics[] {
    const {
      reports,
      matches,
      seasonId,
    } = input;

    const matchingReports =
      getPublishedReportsForSeason({
        reports,
        matches,
        seasonId,
      });

    const aggregates = new Map<
      string,
      PlayerStatisticsAggregate
    >();

    matchingReports.forEach(
      ({ report, match }) => {
        const homePlayerIds =
          new Set(
            report.data.homePresentPlayerIds.map(
              String,
            ),
          );

        const awayPlayerIds =
          new Set(
            report.data.awayPresentPlayerIds.map(
              String,
            ),
          );

        Object.entries(
          report.data.performances,
        ).forEach(
          ([playerId, performance]) => {
            const normalizedPlayerId =
              String(playerId);

            const teamId =
              homePlayerIds.has(
                normalizedPlayerId,
              )
                ? String(
                    match.homeTeamId,
                  )
                : awayPlayerIds.has(
                      normalizedPlayerId,
                    )
                  ? String(
                      match.awayTeamId,
                    )
                  : undefined;

            if (!teamId) {
              return;
            }

            const current =
              aggregates.get(
                normalizedPlayerId,
              ) ??
              createEmptyAggregate({
                playerId:
                  normalizedPlayerId,
                teamId,
              });

            const hasVote =
              performance.status ===
                "rated" &&
              typeof performance.vote ===
                "number" &&
              Number.isFinite(
                performance.vote,
              );

            const isMvp =
              String(
                report.data.mvpPlayerId ??
                  "",
              ) ===
              normalizedPlayerId;

            const matchRatingVariation =
              calculateMatchRatingVariation(
                {
                  vote:
                    hasVote
                      ? performance.vote
                      : undefined,

                  isMvp,
                },
              );

            aggregates.set(
              normalizedPlayerId,
              {
                ...current,

                teamId,

                goals:
                  current.goals +
                  (
                    performance.goals ??
                    0
                  ),

                assists:
                  current.assists +
                  (
                    performance.assists ??
                    0
                  ),

                mvp:
                  current.mvp +
                  (isMvp ? 1 : 0),

                appearances:
                  current.appearances +
                  1,

                ratingTotal:
                  current.ratingTotal +
                  (
                    hasVote
                      ? performance.vote ??
                        0
                      : 0
                  ),

                ratedAppearances:
                  current.ratedAppearances +
                  (hasVote ? 1 : 0),

                yellowCards:
                  current.yellowCards +
                  (
                    performance
                      .yellowCards ?? 0
                  ),

                redCards:
                  current.redCards +
                  (
                    performance
                      .redCards ?? 0
                  ),

                directRedCards:
                  current.directRedCards +
                  (
                    performance
                      .directRedCards ?? 0
                  ),

                goalsConceded:
                  current.goalsConceded +
                  (
                    performance
                      .goalsConceded ?? 0
                  ),

                ratingVariation:
                  current.ratingVariation +
                  matchRatingVariation,
              },
            );
          },
        );
      },
    );

    return Array.from(
      aggregates.values(),
    ).map(
      convertAggregateToStatistics,
    );
  },
};