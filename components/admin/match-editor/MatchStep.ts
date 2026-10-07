export type MatchWizardStep =
  | "match"
  | "attendance"
  | "performance"
  | "review";

export const MATCH_WIZARD_STEPS: MatchWizardStep[] = [
  "match",
  "attendance",
  "performance",
  "review",
];

export function getStepNumber(
  step: MatchWizardStep,
): number {
  return MATCH_WIZARD_STEPS.indexOf(step) + 1;
}