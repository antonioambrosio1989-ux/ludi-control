import type { WeeklyQuizKnowledgeBase, WeeklyQuizGenerationConfig, QuizCurrentPlayerStats, QuizHistoricalPlayerSeasonStats } from "@/src/types/GamesWeeklyQuiz";
import type { Candidate, MetricDefinition, ComparableRow } from "./types";
import { groupByCompetitionAndSeason, groupHistoricalByCompetitionAndSeason, deduplicateCandidates, competitionNameFromId, normalizeSeasonName, semanticFingerprint, snapshot } from "./utils";

/* ============================================================
 * HIGHER / LOWER: close, non-tied comparisons.
 * ============================================================ */

export function generateHigherOrLowerCandidates(
  kb: WeeklyQuizKnowledgeBase,
  config: WeeklyQuizGenerationConfig,
  allowedCurrentGroupKeys: Set<string>,
): Candidate[] {
  const candidates: Candidate[] = [];
  const currentMetrics: MetricDefinition<QuizCurrentPlayerStats>[] = [
    { family: "goals", label: "gol", value: (row) => row.goals, minimum: 1 },
    { family: "assists", label: "assist", value: (row) => row.assists, minimum: 1 },
    { family: "mvp", label: "MVP", value: (row) => row.mvp, minimum: 1 },
    {
      family: "clean_sheets",
      label: "clean sheet",
      value: (row) => row.cleanSheets,
      minimum: 1,
    },
  ];

  for (const [groupKey, rows] of groupByCompetitionAndSeason(
    kb.currentPlayers,
  )) {
    if (!allowedCurrentGroupKeys.has(groupKey)) continue;
    const eligible = rows.filter(
      (row) =>
        row.availableTeamMatches > 0 &&
        row.appearances / row.availableTeamMatches >= config.currentMinAppearanceRate,
    );
    for (const metric of currentMetrics) {
      const ranked = eligible
        .map((row) => ({
          player: row.player,
          competitionId: row.team.competitionId,
          seasonId: row.team.seasonId,
          seasonName: row.seasonName,
          teamName: row.team.teamName,
          value: metric.value(row),
        }))
        .filter(isComparableValue);
      candidates.push(
        ...createComparisonCandidates(kb, ranked, metric, "current"),
      );
    }
  }

  const historicalMetrics: MetricDefinition<QuizHistoricalPlayerSeasonStats>[] = [
    { family: "goals", label: "gol", value: (row) => row.goals, minimum: 1 },
    { family: "assists", label: "assist", value: (row) => row.assists, minimum: 1 },
  ];
  for (const rows of groupHistoricalByCompetitionAndSeason(
    kb.historicalPlayerSeasons,
  ).values()) {
    const eligible = rows.filter(
      (row) => row.appearances >= config.historicalMinAppearances,
    );
    for (const metric of historicalMetrics) {
      const ranked = eligible
        .map((row) => ({
          player: row.player,
          competitionId: row.competitionId,
          seasonId: row.seasonId,
          seasonName: row.seasonName,
          teamName: row.teamName ?? "",
          value: metric.value(row),
        }))
        .filter(isComparableValue);
      candidates.push(
        ...createComparisonCandidates(kb, ranked, metric, "historical"),
      );
    }
  }
  return deduplicateCandidates(candidates);
}

export function isComparableValue(row: ComparableRow): row is ComparableRow & { value: number } {
  return (
    row.teamName.trim().length > 0 &&
    row.value !== undefined &&
    Number.isFinite(row.value) &&
    row.value > 0
  );
}

export function createComparisonCandidates(
  kb: WeeklyQuizKnowledgeBase,
  rows: Array<ComparableRow & { value: number }>,
  metric: Pick<MetricDefinition<QuizCurrentPlayerStats>, "family" | "label">,
  scope: "current" | "historical",
): Candidate[] {
  const sorted = [...rows].sort((first, second) => second.value - first.value);
  const result: Candidate[] = [];
  const leadingValue = sorted[0]?.value ?? 0;

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const first = sorted[index];
    const second = sorted[index + 1];
    if (first.value === second.value || first.player.playerId === second.player.playerId) {
      continue;
    }
    // Mantiene il confronto nella parte alta della classifica statistica.
    if (second.value < leadingValue * 0.6) continue;
    const closeness = Math.min(first.value, second.value) / Math.max(first.value, second.value);
    if (closeness < 0.55) continue;

    const shown = Math.random() < 0.5 ? [first, second] : [second, first];
    const winnerIndex = shown[0].value > shown[1].value ? 0 : 1;
    const competitionName = competitionNameFromId(first.competitionId);
    const sortedIds = [first.player.playerId, second.player.playerId].sort();

    result.push({
      challengeType: "higher_or_lower",
      kind: "higher_or_lower",
      questionFamily: "higher_or_lower",
      difficulty: closeness >= 0.85 ? "hard" : "medium",
      prompt: `Chi ha totalizzato più ${metric.label} nella ${competitionName}, stagione ${normalizeSeasonName(first.seasonName)}?`,
      answers: shown.map(
        (item) => `${item.player.displayName} (${item.teamName})`,
      ),
      answerImageUrls: shown.map(
        (item) => item.player.photoUrl?.trim() || "/players/player-placeholder.png",
      ),
      correctAnswerIndex: winnerIndex,
      explanation: `${first.player.displayName} (${first.teamName}): ${first.value} ${metric.label}. ${second.player.displayName} (${second.teamName}): ${second.value} ${metric.label}.`,
      fingerprint: semanticFingerprint(
        "higher_or_lower",
        scope,
        metric.family,
        first.competitionId,
        first.seasonId,
        ...sortedIds,
      ),
      sourceSnapshot: snapshot(kb, {
        competitionIds: [first.competitionId],
        seasonIds: [first.seasonId],
        playerIds: sortedIds,
        facts: {
          scope,
          metric: metric.family,
          competitionName,
          seasonName: first.seasonName,
          playerA: first.player.displayName,
          valueA: first.value,
          playerB: second.player.displayName,
          valueB: second.value,
        },
      }),
    });
  }
  return result;
}
