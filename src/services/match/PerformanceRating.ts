import type { MatchWizardPlayerPerformance } from "@/src/types/MatchWizardData";

export function hasCompletePerformanceRating(performance?: MatchWizardPlayerPerformance): boolean {
  if (!performance) return false;
  if (performance.status === "sv") return true;
  const vote = performance.vote;
  return performance.status === "rated" && typeof vote === "number" && Number.isFinite(vote) && vote >= 4 && vote <= 10 && Number.isInteger(vote * 2);
}
