import type {
  MatchEngine,
  EngineExecutionResult,
} from "./contracts/MatchEngine";

import type {
  MatchProcessingContext,
} from "./contracts/MatchProcessingContext";

import type {
  MatchProcessingResult,
  ProcessingError,
} from "./contracts/MatchProcessingResult";

import type {
  AnalyticsProcessingResult,
} from "./results/AnalyticsProcessingResult";

import type {
  RatingProcessingResult,
} from "./results/RatingProcessingResult";

type MatchProcessingEngines = {
  analytics?: MatchEngine<
    AnalyticsProcessingResult
  >;

  rating?: MatchEngine<
    RatingProcessingResult
  >;
};

export class MatchProcessingOrchestrator {
  constructor(
    private readonly engines:
      MatchProcessingEngines,
  ) {}

  async process(
    context: MatchProcessingContext,
  ): Promise<MatchProcessingResult> {
    const startedTimestamp =
      Date.now();

    const errors:
      ProcessingError[] = [];

    let analytics:
      EngineExecutionResult<
        AnalyticsProcessingResult
      > | undefined;

    let rating:
      EngineExecutionResult<
        RatingProcessingResult
      > | undefined;

    if (this.engines.analytics) {
      analytics =
        await this.executeEngine(
          this.engines.analytics,
          context,
          errors,
        );
    }

    if (this.engines.rating) {
      rating =
        await this.executeEngine(
          this.engines.rating,
          context,
          errors,
        );
    }

    const completedTimestamp =
      Date.now();

    return {
      matchId:
        String(context.match.id),

      success:
        errors.length === 0,

      analytics,
      rating,

      errors,

      startedAt:
        new Date(
          startedTimestamp,
        ).toISOString(),

      completedAt:
        new Date(
          completedTimestamp,
        ).toISOString(),

      durationMs:
        completedTimestamp -
        startedTimestamp,
    };
  }

  private async executeEngine<T>(
    engine: MatchEngine<T>,
    context: MatchProcessingContext,
    errors: ProcessingError[],
  ): Promise<
    EngineExecutionResult<T>
  > {
    const startedAt =
      Date.now();

    try {
      const data =
        await engine.execute(
          context,
        );

      return {
        success: true,
        data,
        durationMs:
          Date.now() -
          startedAt,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore sconosciuto";

      errors.push({
        engine:
          engine.name,
        message,
      });

      return {
        success: false,
        error: message,
        durationMs:
          Date.now() -
          startedAt,
      };
    }
  }
}