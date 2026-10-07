import type { Candidate } from "./types";
import type { HistoricalQuestionFamily, WeeklyQuizQuestionFamily } from "@/src/types/GamesWeeklyQuiz";

/* ============================================================
 * Selection and validation
 * ============================================================ */

export function selectHistoricalQuestions(
  candidates: Candidate[],
  count: number,
  used: Set<string>,
): Candidate[] {
  const buckets: Array<Array<HistoricalQuestionFamily>> = [
    ["champion", "final"],
    ["best_player", "best_goalkeeper", "top_scorer"],
    ["top_scorer_goals", "final_record", "historical_record"],
  ];
  const selected: Candidate[] = [];
  for (const families of buckets) {
    const candidate = pickHistoricalCandidate(
      candidates.filter((item) =>
        families.includes(item.questionFamily as HistoricalQuestionFamily),
      ),
      selected,
      used,
    );
    if (candidate) {
      selected.push(candidate);
      used.add(candidate.fingerprint);
    }
  }
  while (selected.length < count) {
    const candidate = pickHistoricalCandidate(candidates, selected, used);
    if (!candidate) break;
    if (selected.length >= count) break;
    selected.push(candidate);
    used.add(candidate.fingerprint);
  }
  return selected.slice(0, count);
}

export function pickHistoricalCandidate(
  candidates: Candidate[],
  selected: Candidate[],
  used: Set<string>,
): Candidate | undefined {
  const championsSelected = selected.filter(isChampionsCandidate).length;
  const europaSelected = selected.filter(isEuropaCandidate).length;
  const selectedFamilies = new Set(selected.map((item) => item.questionFamily));

  return candidates
    .filter((candidate) => {
      if (used.has(candidate.fingerprint)) return false;
      if (candidate.questionFamily === "final_record" && selectedFamilies.has("final_record")) {
        return false;
      }
      return !(isEuropaCandidate(candidate) && europaSelected >= 1);
    })
    .sort((first, second) => {
      const score = (candidate: Candidate) =>
        (isChampionsCandidate(candidate) && championsSelected < 2 ? -10 : 0) +
        (isEuropaCandidate(candidate) ? 4 : 0) +
        (selectedFamilies.has(candidate.questionFamily) ? 3 : 0) +
        (candidate.questionFamily === "final_record" ? 1 : 0);
      return score(first) - score(second);
    })[0];
}

export function isChampionsCandidate(candidate: Candidate): boolean {
  return candidate.sourceSnapshot.competitionIds.some((id) =>
    /champions|champion/i.test(id),
  );
}

export function isEuropaCandidate(candidate: Candidate): boolean {
  return candidate.sourceSnapshot.competitionIds.some((id) =>
    /europa/i.test(id),
  );
}

export function selectDiverseQuestions(
  candidates: Candidate[],
  count: number,
  used: Set<string>,
): Candidate[] {
  const selected: Candidate[] = [];
  const families = new Set<WeeklyQuizQuestionFamily>();
  const competitionIds = new Set<string>();
  const remaining = [...candidates];
  while (selected.length < count) {
    const ranked = remaining
      .filter((candidate) => !used.has(candidate.fingerprint))
      .sort((first, second) => {
        const firstCompetition = first.sourceSnapshot.competitionIds[0] ?? "";
        const secondCompetition = second.sourceSnapshot.competitionIds[0] ?? "";
        const firstPenalty =
          Number(families.has(first.questionFamily)) +
          Number(competitionIds.has(firstCompetition));
        const secondPenalty =
          Number(families.has(second.questionFamily)) +
          Number(competitionIds.has(secondCompetition));
        return firstPenalty - secondPenalty;
      });
    const candidate = ranked[0];
    if (!candidate) break;
    selected.push(candidate);
    used.add(candidate.fingerprint);
    families.add(candidate.questionFamily);
    for (const id of candidate.sourceSnapshot.competitionIds) competitionIds.add(id);
    const index = remaining.indexOf(candidate);
    if (index >= 0) remaining.splice(index, 1);
  }
  return selected;
}

export function takeQuestions(candidates: Candidate[], count: number, used: Set<string>): Candidate[] {
  const result: Candidate[] = [];
  for (const candidate of candidates) {
    if (result.length >= count) break;
    if (used.has(candidate.fingerprint)) continue;
    result.push(candidate);
    used.add(candidate.fingerprint);
  }
  return result;
}

export function assertCategoryCount(label: string, values: Candidate[], expected: number) {
  if (values.length !== expected) {
    throw new Error(
      `Weekly Quiz non generabile: servono ${expected} domande ${label}, ma i dati disponibili e non ripetuti ne producono ${values.length}.`,
    );
  }
}
