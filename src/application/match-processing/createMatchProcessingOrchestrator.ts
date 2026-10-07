import {
  AnalyticsEngineAdapter,
} from "./engines/AnalyticsEngineAdapter";

import {
  RatingEngineAdapter,
} from "./engines/RatingEngineAdapter";

import {
  MatchProcessingOrchestrator,
} from "./MatchProcessingOrchestrator";

import type {
  AnalyticsProcessingResult,
} from "./results/AnalyticsProcessingResult";

export function createMatchProcessingOrchestrator() {
  let analyticsResult:
    AnalyticsProcessingResult | undefined;

  const analyticsEngine =
    new AnalyticsEngineAdapter();

  const ratingEngine =
    new RatingEngineAdapter(
      () => {
        if (!analyticsResult) {
          throw new Error(
            "Analytics deve essere eseguito prima del Rating.",
          );
        }

        return analyticsResult;
      },
    );

  const orchestrator =
    new MatchProcessingOrchestrator({
      analytics: {
        name:
          analyticsEngine.name,

        execute(context) {
          analyticsResult =
            analyticsEngine.execute(
              context,
            );

          return analyticsResult;
        },
      },

      rating:
        ratingEngine,
    });

  return orchestrator;
}