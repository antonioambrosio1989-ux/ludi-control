import type {
  CompetitionMatch,
  CompetitionMatchReport,
  FinalStageCompetitionMatch,
  RegularSeasonCompetitionMatch,
} from "@/src/types/CompetitionMatch";

import type {
  Match,
} from "@/src/types/Match";

import type {
  FinalStageMatch,
} from "@/src/types/FinalStageMatch";

import type {
  CloudMatchReport,
} from "@/src/services/match/FirebaseMatchReportRepository";

import type {
  CloudFinalStageMatchReport,
} from "@/src/services/final-stage/FirebaseFinalStageMatchReportRepository";

function normalizeId(
  value:
    string | number,
): string {
  return String(
    value,
  );
}

function normalizeRegularReport(
  report:
    CloudMatchReport,
): CompetitionMatchReport {
  return {
    phase:
      "regularSeason",

    matchId:
      String(
        report.matchId,
      ),

    seasonId:
      report.seasonId,

    status:
      report.status,

    version:
      report.version,

    data:
      report.data,

    updatedAt:
      report.updatedAt,

    publishedAt:
      report.publishedAt,
  };
}

function normalizeFinalStageReport(
  report:
    CloudFinalStageMatchReport,
): CompetitionMatchReport {
  return {
    phase:
      "finalStage",

    matchId:
      String(
        report.matchId,
      ),

    seasonId:
      report.seasonId,

    status:
      report.status,

    version:
      report.version,

    data:
      report.data,

    updatedAt:
      report.updatedAt,

    publishedAt:
      report.publishedAt,
  };
}

function buildReportMap(
  reports:
    CompetitionMatchReport[],
): Map<
  string,
  CompetitionMatchReport
> {
  return new Map(
    reports.map(
      (
        report,
      ) => [
        report.matchId,
        report,
      ],
    ),
  );
}

export const CompetitionMatchService = {
  normalizeRegularSeason({
    matches,
    reports = [],
  }: {
    matches:
      Match[];

    reports?:
      CloudMatchReport[];
  }): RegularSeasonCompetitionMatch[] {
    const normalizedReports =
      reports.map(
        normalizeRegularReport,
      );

    const reportsByMatchId =
      buildReportMap(
        normalizedReports,
      );

    return matches.map(
      (
        match,
      ) => ({
        id:
          String(
            match.id,
          ),

        seasonId:
          String(
            match.seasonId,
          ),

        phase:
          "regularSeason",

        matchType:
          match.matchType,

        matchweek:
          Number(
            match.matchweek,
          ),

        matchweekId:
          String(
            match.matchweekId,
          ),

        homeTeamId:
          normalizeId(
            match.homeTeamId,
          ),

        awayTeamId:
          normalizeId(
            match.awayTeamId,
          ),

        date:
          match.date,

        time:
          match.time,

        venue:
          match.venue,

        status:
          match.status,

        published:
          match.published,

        homeScore:
          match.homeScore,

        awayScore:
          match.awayScore,

        report:
          reportsByMatchId.get(
            String(
              match.id,
            ),
          ),

        source:
          match,
      }),
    );
  },

  normalizeFinalStage({
    matches,
    reports = [],
  }: {
    matches:
      FinalStageMatch[];

    reports?:
      CloudFinalStageMatchReport[];
  }): FinalStageCompetitionMatch[] {
    const normalizedReports =
      reports.map(
        normalizeFinalStageReport,
      );

    const reportsByMatchId =
      buildReportMap(
        normalizedReports,
      );

    return matches.map(
      (
        match,
      ) => ({
        id:
          String(
            match.id,
          ),

        seasonId:
          String(
            match.seasonId,
          ),

        phase:
          "finalStage",

        competition:
          match.competition,

        round:
          match.round,

        group:
          match.group,

        leg:
          match.leg,

        matchOrder:
          match.matchOrder,

        finalStageWeek:
          match.finalStageWeek,

        homeTeamId:
          normalizeId(
            match.homeTeamId,
          ),

        awayTeamId:
          normalizeId(
            match.awayTeamId,
          ),

        date:
          match.date,

        time:
          match.time,

        venue:
          match.venue,

        status:
          match.status,

        published:
          match.published,

        homeScore:
          match.homeScore,

        awayScore:
          match.awayScore,

        extraTimePlayed:
          match.extraTimePlayed,

        homePenalties:
          match.homePenalties,

        awayPenalties:
          match.awayPenalties,

        report:
          reportsByMatchId.get(
            String(
              match.id,
            ),
          ),

        source:
          match,
      }),
    );
  },

  merge({
    regularSeasonMatches,
    regularSeasonReports = [],
    finalStageMatches,
    finalStageReports = [],
  }: {
    regularSeasonMatches:
      Match[];

    regularSeasonReports?:
      CloudMatchReport[];

    finalStageMatches:
      FinalStageMatch[];

    finalStageReports?:
      CloudFinalStageMatchReport[];
  }): CompetitionMatch[] {
    return [
      ...this.normalizeRegularSeason({
        matches:
          regularSeasonMatches,

        reports:
          regularSeasonReports,
      }),

      ...this.normalizeFinalStage({
        matches:
          finalStageMatches,

        reports:
          finalStageReports,
      }),
    ].sort(
      (
        first,
        second,
      ) => {
        const dateComparison =
          `${first.date} ${first.time}`.localeCompare(
            `${second.date} ${second.time}`,
          );

        if (
          dateComparison !==
          0
        ) {
          return dateComparison;
        }

        return first.id.localeCompare(
          second.id,
        );
      },
    );
  },

  getRegularSeason(
    matches:
      CompetitionMatch[],
  ): RegularSeasonCompetitionMatch[] {
    return matches.filter(
      (
        match,
      ): match is RegularSeasonCompetitionMatch =>
        match.phase ===
        "regularSeason",
    );
  },

  getFinalStage(
    matches:
      CompetitionMatch[],
  ): FinalStageCompetitionMatch[] {
    return matches.filter(
      (
        match,
      ): match is FinalStageCompetitionMatch =>
        match.phase ===
        "finalStage",
    );
  },
};
