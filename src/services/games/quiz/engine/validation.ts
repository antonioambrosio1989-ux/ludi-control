import type { WeeklyQuizGenerationConfig, WeeklyQuizGenerationInput } from "@/src/types/GamesWeeklyQuiz";
import { DEFAULT_WEEKLY_QUIZ_GENERATION_CONFIG, DEFAULT_WEEKLY_QUIZ_MIX } from "@/src/types/GamesWeeklyQuiz";

export function mergeConfig(input?: Partial<WeeklyQuizGenerationConfig>): WeeklyQuizGenerationConfig {
  return {
    ...DEFAULT_WEEKLY_QUIZ_GENERATION_CONFIG,
    ...input,
    // Il vecchio mix eventualmente salvato nel pannello non può alterare il 3+2+1+1.
    mix: DEFAULT_WEEKLY_QUIZ_MIX,
  };
}

export function validateInput(input: WeeklyQuizGenerationInput) {
  if (!input.gamesSeasonId.trim() || !input.gameId.trim()) {
    throw new Error("gamesSeasonId e gameId sono obbligatori.");
  }
  if (!Number.isInteger(input.weekNumber) || input.weekNumber < 1) {
    throw new Error("weekNumber non valido.");
  }
  if (
    Number.isNaN(input.startsAt.getTime()) ||
    Number.isNaN(input.endsAt.getTime()) ||
    input.endsAt.getTime() <= input.startsAt.getTime()
  ) {
    throw new Error("Intervallo Weekly Quiz non valido.");
  }
}

export function validateConfig(config: WeeklyQuizGenerationConfig) {
  const mixCount =
    config.mix.statsChallenge +
    config.mix.historyChallenge +
    config.mix.higherOrLower +
    config.mix.whosThePlayer;
  if (mixCount !== 7 || config.questionCount !== 7) {
    throw new Error("La Weekly Challenge deve contenere esattamente 7 domande.");
  }
  if (
    config.mix.historyChallenge !== 3 ||
    config.mix.statsChallenge !== 2 ||
    config.mix.higherOrLower !== 1 ||
    config.mix.whosThePlayer !== 1
  ) {
    throw new Error("Il mix obbligatorio della Weekly Challenge è 3+2+1+1.");
  }
  if (config.pointsPerQuestion !== 100) {
    throw new Error("Ogni domanda della Weekly Challenge deve valere 100 punti.");
  }
}
