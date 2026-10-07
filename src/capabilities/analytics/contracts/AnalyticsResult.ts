import type {
  PlayerSeasonStatistics,
} from "./PlayerStatistics";

import type {
  StandingRow,
} from "./Standings";

import type {
  TeamSeasonStatistics,
} from "./TeamStatistics";

export type AnalyticsResult = {
  playerStatistics:
    PlayerSeasonStatistics[];

  teamStatistics:
    TeamSeasonStatistics[];

  standings:
    StandingRow[];

  metadata: {
    seasonId: string;
    processedMatchesCount: number;
    processedReportsCount: number;
  };
};