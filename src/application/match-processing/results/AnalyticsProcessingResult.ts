import type {
  PlayerSeasonStatistics,
  StandingRow,
  TeamSeasonStatistics,
} from "@/src/capabilities/analytics";

export type AnalyticsProcessingResult = {
  playerStatistics:
    PlayerSeasonStatistics[];

  teamStatistics:
    TeamSeasonStatistics[];

  standings:
    StandingRow[];

  processedReportsCount: number;
  processedMatchesCount: number;
};