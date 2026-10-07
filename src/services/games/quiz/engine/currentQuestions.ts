import type { WeeklyQuizKnowledgeBase, WeeklyQuizGenerationConfig, QuizCurrentPlayerStats, WeeklyQuizQuestionFamily } from "@/src/types/GamesWeeklyQuiz";
import type { Candidate, MetricDefinition } from "./types";
import { groupByCompetitionAndSeason, unique, competitionNameFromId, createChoiceSet, formatMetricValue, semanticFingerprint, snapshot, deduplicateCandidates, CURRENT_MIN_COMPLETED_MATCHES } from "./utils";

/* ============================================================
 * CURRENT SEASON
 * ============================================================ */

export function generateCurrentCandidates(
  kb: WeeklyQuizKnowledgeBase,
  config: WeeklyQuizGenerationConfig,
  allowedGroupKeys: Set<string>,
): Candidate[] {
  const metrics: MetricDefinition<QuizCurrentPlayerStats>[] = [
    { family: "goals", label: "gol", value: (row) => row.goals, minimum: 1 },
    { family: "assists", label: "assist", value: (row) => row.assists, minimum: 1 },
    { family: "mvp", label: "premi MVP", value: (row) => row.mvp, minimum: 1 },
    {
      family: "appearances",
      label: "presenze",
      value: (row) => row.appearances,
      minimum: 1,
    },
    {
      family: "average_vote",
      label: "media voto",
      value: (row) => row.averageVote,
      minimum: 5,
    },
    {
      family: "clean_sheets",
      label: "clean sheet",
      value: (row) => row.cleanSheets,
      minimum: 1,
    },
  ];

  const candidates: Candidate[] = [];
  for (const [groupKey, rows] of groupByCompetitionAndSeason(
    kb.currentPlayers,
  )) {
    if (!allowedGroupKeys.has(groupKey)) continue;
    const eligible = rows.filter((row) => {
      if (row.availableTeamMatches <= 0) return false;
      return row.appearances / row.availableTeamMatches >= config.currentMinAppearanceRate;
    });
    if (unique(eligible.map((row) => row.player.displayName)).length < 4) continue;

    for (const metric of metrics) {
      const ranked = eligible
        .map((row) => ({ row, value: metric.value(row) }))
        .filter(
          (item): item is { row: QuizCurrentPlayerStats; value: number } =>
            item.value !== undefined && Number.isFinite(item.value),
        )
        .sort((first, second) => second.value - first.value);
      const maximum = ranked[0]?.value;
      if (maximum === undefined || maximum < metric.minimum) continue;
      const leaders = ranked.filter((item) => item.value === maximum);
      if (leaders.length !== 1) continue;

      const leader = leaders[0].row;
      const competitionId = leader.team.competitionId;
      const competitionName = competitionNameFromId(competitionId);
      const leaderLabel = `${leader.player.displayName} (${leader.team.teamName})`;
      const answers = createChoiceSet(
        leaderLabel,
        ranked.map(
          (item) => `${item.row.player.displayName} (${item.row.team.teamName})`,
        ),
      );
      if (!answers) continue;

      candidates.push({
        challengeType: "stats_challenge",
        kind: "multiple_choice",
        questionFamily: metric.family,
        difficulty: metric.family === "goals" ? "easy" : "medium",
        prompt: currentLeaderPrompt(
          metric.family,
          metric.label,
          competitionName,
          leader.seasonName,
        ),
        answers: answers.answers,
        correctAnswerIndex: answers.correctAnswerIndex,
        explanation: `Al momento della generazione, ${leaderLabel} è in testa con ${formatMetricValue(metric.family, maximum)}.`,
        fingerprint: semanticFingerprint(
          "current_leader",
          metric.family,
          competitionId,
          leader.team.seasonId,
          leader.player.playerId,
        ),
        sourceSnapshot: snapshot(kb, {
          competitionIds: [competitionId],
          seasonIds: [leader.team.seasonId],
          playerIds: ranked.map((item) => item.row.player.playerId),
          teamIds: ranked.map((item) => item.row.team.teamId),
          facts: {
            family: metric.family,
            competitionName,
            seasonName: leader.seasonName,
            leaderName: leader.player.displayName,
            value: maximum,
          },
        }),
      });
    }
  }
  return deduplicateCandidates(candidates);
}

export function currentLeaderPrompt(
  family: WeeklyQuizQuestionFamily,
  label: string,
  competitionName: string,
  seasonName: string,
): string {
  if (family === "goals") {
    return `Chi è il capocannoniere della ${competitionName} ${seasonName} al momento della generazione?`;
  }
  return `Chi è in testa per ${label} nella ${competitionName} ${seasonName} al momento della generazione?`;
}

export function getSignificantCurrentGroupKeys(
  kb: WeeklyQuizKnowledgeBase,
): Set<string> {
  const significant = new Set<string>();

  for (const [groupKey, rows] of groupByCompetitionAndSeason(
    kb.currentPlayers,
  )) {
    const matchesByTeam = new Map<string, number>();

    for (const row of rows) {
      matchesByTeam.set(
        row.team.teamId,
        Math.max(
          matchesByTeam.get(row.team.teamId) ?? 0,
          row.availableTeamMatches,
        ),
      );
    }

    if (matchesByTeam.size < 2) continue;

    const teamsBeyondThreshold = Array.from(matchesByTeam.values()).filter(
      (completedMatches) =>
        completedMatches >= CURRENT_MIN_COMPLETED_MATCHES,
    ).length;

    /*
     * La competizione diventa utilizzabile quando almeno metà delle squadre
     * ha raggiunto tre gare: così un singolo anticipo non sblocca il quiz.
     */
    if (teamsBeyondThreshold >= Math.ceil(matchesByTeam.size / 2)) {
      significant.add(groupKey);
    }
  }

  return significant;
}
