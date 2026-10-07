import type {
  CloudMatchReport,
} from "@/src/services/match/FirebaseMatchReportRepository";

import type {
  StatsMatchReference,
} from "../../contracts/PlayerStatistics";

import type {
  TeamSeasonStatistics,
} from "../../contracts/TeamStatistics";

type TeamStatisticsCalculatorInput = {
  seasonId?: string;
  matches: StatsMatchReference[];
  reports: CloudMatchReport[];
};

type TeamAggregate = {
  teamId: string;

  played: number;
  wins: number;
  draws: number;
  losses: number;

  goalsFor: number;
  goalsAgainst: number;

  points: number;
  cleanSheets: number;
};

function createEmptyAggregate(
  teamId: string,
): TeamAggregate {
  return {
    teamId,

    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,

    goalsFor: 0,
    goalsAgainst: 0,

    points: 0,
    cleanSheets: 0,
  };
}

function getPublishedMatchReports({
  seasonId,
  matches,
  reports,
}: TeamStatisticsCalculatorInput) {
  const matchesById = new Map(
    matches.map((match) => [
      String(match.id),
      match,
    ]),
  );

  return reports.flatMap((report) => {
    if (report.status !== "published") {
      return [];
    }

    const match = matchesById.get(
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
  });
}

export const TeamStatisticsCalculator = {
  calculate({
    seasonId,
    matches,
    reports,
  }: TeamStatisticsCalculatorInput): TeamSeasonStatistics[] {
    const aggregates = new Map<
      string,
      TeamAggregate
    >();

    const publishedMatches =
      getPublishedMatchReports({
        seasonId,
        matches,
        reports,
      });

    publishedMatches.forEach(
      ({ report, match }) => {
        const homeTeamId = String(
          match.homeTeamId,
        );

        const awayTeamId = String(
          match.awayTeamId,
        );

        const homeGoals =
          report.data.homeScore ?? 0;

        const awayGoals =
          report.data.awayScore ?? 0;

        const home =
          aggregates.get(homeTeamId) ??
          createEmptyAggregate(homeTeamId);

        const away =
          aggregates.get(awayTeamId) ??
          createEmptyAggregate(awayTeamId);

        home.played += 1;
        away.played += 1;

        home.goalsFor += homeGoals;
        home.goalsAgainst += awayGoals;

        away.goalsFor += awayGoals;
        away.goalsAgainst += homeGoals;

        if (awayGoals === 0) {
          home.cleanSheets += 1;
        }

        if (homeGoals === 0) {
          away.cleanSheets += 1;
        }

        if (homeGoals > awayGoals) {
          home.wins += 1;
          home.points += 3;

          away.losses += 1;
        } else if (
          homeGoals < awayGoals
        ) {
          away.wins += 1;
          away.points += 3;

          home.losses += 1;
        } else {
          home.draws += 1;
          away.draws += 1;

          home.points += 1;
          away.points += 1;
        }

        aggregates.set(homeTeamId, home);
        aggregates.set(awayTeamId, away);
      },
    );

    return Array.from(
      aggregates.values(),
    ).map((aggregate) => ({
      teamId: aggregate.teamId,

      played: aggregate.played,
      wins: aggregate.wins,
      draws: aggregate.draws,
      losses: aggregate.losses,

      goalsFor: aggregate.goalsFor,
      goalsAgainst:
        aggregate.goalsAgainst,

      goalDifference:
        aggregate.goalsFor -
        aggregate.goalsAgainst,

      points: aggregate.points,
      cleanSheets:
        aggregate.cleanSheets,
    }));
  },
};