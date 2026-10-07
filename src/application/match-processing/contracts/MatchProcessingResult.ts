import type {
  EngineExecutionResult,
} from "./MatchEngine";

import type {
  AnalyticsProcessingResult,
} from "../results/AnalyticsProcessingResult";

import type {
  RatingProcessingResult,
} from "../results/RatingProcessingResult";

export type ProcessingError = {
  engine: string;
  message: string;
};

export type MatchProcessingResult = {
  matchId: string;
  success: boolean;

  analytics?: EngineExecutionResult<
    AnalyticsProcessingResult
  >;

  rating?: EngineExecutionResult<
    RatingProcessingResult
  >;

  errors: ProcessingError[];

  startedAt: string;
  completedAt: string;
  durationMs: number;
};