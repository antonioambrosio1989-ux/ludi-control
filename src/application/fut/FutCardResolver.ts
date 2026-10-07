export type FutRatingTier =
  | "bronze"
  | "silver"
  | "gold"
  | "emerald";

export type FutMonthlyAward =
  | "potm"
  | "gotm"
  | "sotm";

export type FutFinalStageCompetition =
  | "champions"
  | "europa"
  | "conference";

export type FutCardTemplate =
  | `player-${FutRatingTier}`
  | `totw-${FutRatingTier}`
  | FutMonthlyAward
  | FutFinalStageCompetition
  | `${FutFinalStageCompetition}-final`;

export type FutCardResolution = {
  template: FutCardTemplate;
  tier: FutRatingTier;
  imageUrl: string;
  reason:
    | "base"
    | "totw"
    | "monthlyAward"
    | "finalStage"
    | "finalStageFinal";
};

export type ResolveFutCardInput = {
  rating: number;
  isTotwActive: boolean;
  monthlyAward?: FutMonthlyAward;
  finalStageCompetition?: FutFinalStageCompetition;
  isFinalStageFinalist?: boolean;
};

export function getFutRatingTier(
  rating: number,
): FutRatingTier {
  const normalized = Math.round(rating);

  if (normalized >= 90) {
    return "emerald";
  }

  if (normalized >= 80) {
    return "gold";
  }

  if (normalized >= 70) {
    return "silver";
  }

  return "bronze";
}

export function resolveFutCard({
  rating,
  isTotwActive,
  monthlyAward,
  finalStageCompetition,
  isFinalStageFinalist = false,
}: ResolveFutCardInput): FutCardResolution {
  const tier = getFutRatingTier(rating);

  if (finalStageCompetition && isFinalStageFinalist) {
    const template =
      `${finalStageCompetition}-final` as FutCardTemplate;

    return {
      template,
      tier,
      imageUrl: `/FUT/${template}.png`,
      reason: "finalStageFinal",
    };
  }

  if (finalStageCompetition) {
    return {
      template: finalStageCompetition,
      tier,
      imageUrl: `/FUT/${finalStageCompetition}.png`,
      reason: "finalStage",
    };
  }

  if (monthlyAward) {
    return {
      template: monthlyAward,
      tier,
      imageUrl: `/FUT/${monthlyAward}.png`,
      reason: "monthlyAward",
    };
  }

  if (isTotwActive) {
    const template =
      `totw-${tier}` as FutCardTemplate;

    return {
      template,
      tier,
      imageUrl: `/FUT/${template}.png`,
      reason: "totw",
    };
  }

  const template =
    `player-${tier}` as FutCardTemplate;

  return {
    template,
    tier,
    imageUrl: `/FUT/${template}.png`,
    reason: "base",
  };
}
