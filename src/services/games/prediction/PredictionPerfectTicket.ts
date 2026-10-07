import {
  calculatePredictionMaxScore,
  calculatePredictionScore,
  type PredictionResultStatus,
  type PredictionSelection,
} from "@/src/types/GamesPrediction";

export type PerfectPredictionResult = {
  matchId: string;
  status: PredictionResultStatus;
  homeScore?: number;
  awayScore?: number;
};

/**
 * Una schedina è perfetta solo quando:
 * - tutte le selezioni hanno un esito definitivo;
 * - il massimo punteggio disponibile è maggiore di zero;
 * - il punteggio ottenuto coincide esattamente con quel massimo.
 *
 * Il massimo dipende dagli esiti reali:
 * - gara normale: 50 punti;
 * - tavolino: 30 punti;
 * - rinviata: 0 punti.
 */
export function isPerfectPredictionTicket(
  selections:
    PredictionSelection[],
  results:
    PerfectPredictionResult[],
): boolean {
  if (
    selections.length === 0 ||
    results.length !==
      selections.length
  ) {
    return false;
  }

  const selectedMatchIds =
    selections.map(
      (selection) =>
        selection.matchId,
    );

  const resultMatchIds =
    results.map(
      (result) =>
        result.matchId,
    );

  if (
    new Set(
      selectedMatchIds,
    ).size !==
      selections.length ||
    new Set(
      resultMatchIds,
    ).size !==
      results.length ||
    selectedMatchIds.some(
      (matchId) =>
        !resultMatchIds.includes(
          matchId,
        ),
    )
  ) {
    return false;
  }

  const maximumScore =
    calculatePredictionMaxScore(
      results,
    );

  if (
    maximumScore <=
    0
  ) {
    return false;
  }

  return (
    calculatePredictionScore(
      selections,
      results,
    ) ===
    maximumScore
  );
}
