import {
  DEFAULT_WEEKLY_QUIZ_GENERATION_CONFIG,
  WEEKLY_QUIZ_GENERATION_VERSION,
  type WeeklyQuizWeekWithQuestions,
} from "@/src/types/GamesWeeklyQuiz";

/**
 * Verifica che una settimana salvata appartenga al formato Quiz corrente.
 *
 * Sono validi entrambi i mix prodotti intenzionalmente dal motore:
 * - regime normale: 3 storiche + 2 correnti + 1 Higher/Lower + 1 Who's the Player;
 * - fallback inizio stagione: 5 storiche + 0 correnti + 1 Higher/Lower + 1 Who's the Player.
 *
 * Il fallback viene usato quando i dati della stagione corrente non sono
 * ancora abbastanza significativi. In precedenza questa Week veniva
 * erroneamente considerata obsoleta e quindi rigenerata a ogni retry.
 */
export function isCurrentWeeklyQuiz(
  week:
    WeeklyQuizWeekWithQuestions,
): boolean {
  if (
    week.generationVersion !==
      WEEKLY_QUIZ_GENERATION_VERSION ||
    week.questions.length !==
      DEFAULT_WEEKLY_QUIZ_GENERATION_CONFIG.questionCount
  ) {
    return false;
  }

  const counts =
    week.questions.reduce<
      Record<string, number>
    >(
      (
        result,
        question,
      ) => {
        result[
          question.challengeType
        ] =
          (result[
            question.challengeType
          ] ?? 0) +
          1;

        return result;
      },
      {},
    );

  const mix =
    DEFAULT_WEEKLY_QUIZ_GENERATION_CONFIG.mix;

  const statsChallengeCount =
    counts.stats_challenge ??
    0;

  const historyChallengeCount =
    counts.history_challenge ??
    0;

  const higherOrLowerCount =
    counts.higher_or_lower ??
    0;

  const whosThePlayerCount =
    counts.whos_the_player ??
    0;

  const hasRequiredSpecialModes =
    higherOrLowerCount ===
      mix.higherOrLower &&
    whosThePlayerCount ===
      mix.whosThePlayer;

  if (
    !hasRequiredSpecialModes
  ) {
    return false;
  }

  const isStandardMix =
    statsChallengeCount ===
      mix.statsChallenge &&
    historyChallengeCount ===
      mix.historyChallenge;

  const isEarlySeasonFallbackMix =
    statsChallengeCount ===
      0 &&
    historyChallengeCount ===
      mix.historyChallenge +
        mix.statsChallenge;

  return (
    isStandardMix ||
    isEarlySeasonFallbackMix
  );
}
