import type { WeeklyQuizGenerationInput, WeeklyQuizGeneratedWeek, WeeklyQuizQuestion } from "@/src/types/GamesWeeklyQuiz";
import { validateInput, mergeConfig, validateConfig } from "./engine/validation";
import { getSignificantCurrentGroupKeys, generateCurrentCandidates } from "./engine/currentQuestions";
import { generateHistoricalCandidates } from "./engine/historicalQuestions";
import { generateHigherOrLowerCandidates } from "./engine/higherLowerQuestions";
import { generateWhosThePlayerCandidates } from "./engine/playerGuessQuestions";
import type { Candidate } from "./engine/types";
import { shuffle } from "./engine/utils";
import { selectHistoricalQuestions, selectDiverseQuestions, takeQuestions, assertCategoryCount } from "./engine/questionSelection";
import { WEEKLY_QUIZ_GENERATION_VERSION } from "@/src/types/GamesWeeklyQuiz";

export class WeeklyQuizEngine {
  static generate(input: WeeklyQuizGenerationInput): WeeklyQuizGeneratedWeek {
    validateInput(input);
    const config = mergeConfig(input.config);
    validateConfig(config);

    const significantCurrentGroups = getSignificantCurrentGroupKeys(
      input.knowledgeBase,
    );

    const currentPool = generateCurrentCandidates(
      input.knowledgeBase,
      config,
      significantCurrentGroups,
    );

    /*
     * Anche dopo la soglia, pareggi o dati incompleti possono impedire la
     * creazione di due domande corrette. In quel caso restiamo sullo storico.
     */
    const useCurrentQuestions =
      significantCurrentGroups.size > 0 &&
      currentPool.length >= config.mix.statsChallenge;

    const recent = new Set(input.recentFingerprints);

    const pools = {
      history: generateHistoricalCandidates(input.knowledgeBase),
      current: useCurrentQuestions ? currentPool : [],
      higherOrLower: generateHigherOrLowerCandidates(
        input.knowledgeBase,
        config,
        useCurrentQuestions ? significantCurrentGroups : new Set<string>(),
      ),
      whosThePlayer: generateWhosThePlayerCandidates(
        input.knowledgeBase,
        recent,
      ),
    };

    const availableCandidateCount =
      pools.history.length +
      pools.current.length +
      pools.higherOrLower.length +
      pools.whosThePlayer.length;

    const used = new Set<string>();
    let rejectedCandidateCount = 0;

    const usable = (values: Candidate[]) =>
      shuffle(values).filter((candidate) => {
        if (recent.has(candidate.fingerprint)) {
          rejectedCandidateCount += 1;
          return false;
        }
        return true;
      });

    const requiredHistoryQuestions =
      config.mix.historyChallenge +
      (useCurrentQuestions ? 0 : config.mix.statsChallenge);

    const requiredCurrentQuestions =
      useCurrentQuestions ? config.mix.statsChallenge : 0;

    const history = selectHistoricalQuestions(
      usable(pools.history),
      requiredHistoryQuestions,
      used,
    );
    const current = selectDiverseQuestions(
      usable(pools.current),
      requiredCurrentQuestions,
      used,
    );
    const higherOrLower = takeQuestions(
      usable(pools.higherOrLower),
      config.mix.higherOrLower,
      used,
    );
    const whosThePlayer = takeQuestions(
      usable(pools.whosThePlayer),
      config.mix.whosThePlayer,
      used,
    );

    assertCategoryCount("storiche", history, requiredHistoryQuestions);
    assertCategoryCount(
      "sulla stagione corrente",
      current,
      requiredCurrentQuestions,
    );
    assertCategoryCount("Higher/Lower", higherOrLower, 1);
    assertCategoryCount("Indovina il giocatore", whosThePlayer, 1);

    const selected = [
      ...history,
      ...current,
      ...higherOrLower,
      ...whosThePlayer,
    ];

    const questions: WeeklyQuizQuestion[] = selected.map((candidate, index) => ({
      ...candidate,
      id: `q${index + 1}`,
      order: index + 1,
      points: config.pointsPerQuestion,
    }));

    const weekId = createWeekId({
      gamesSeasonId: input.gamesSeasonId,
      gameId: input.gameId,
      weekNumber: input.weekNumber,
    });

    return {
      week: {
        id: weekId,
        gamesSeasonId: input.gamesSeasonId,
        gameId: input.gameId,
        weekNumber: input.weekNumber,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: "draft",
        questionCount: questions.length,
        maxScore: questions.reduce((total, question) => total + question.points, 0),
        generationVersion: WEEKLY_QUIZ_GENERATION_VERSION,
      },
      questions,
      rejectedCandidateCount,
      availableCandidateCount,
    };
  }
}

export function createWeekId({
  gamesSeasonId,
  gameId,
  weekNumber,
}: {
  gamesSeasonId: string;
  gameId: string;
  weekNumber: number;
}): string {
  return `${gamesSeasonId}__${gameId}__week-${weekNumber}`;
}
