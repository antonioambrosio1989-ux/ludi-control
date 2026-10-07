import type { WeeklyQuizKnowledgeBase, QuizHistoricalAwardFact } from "@/src/types/GamesWeeklyQuiz";
import type { Candidate } from "./types";
import { competitionNameFromId, normalizeSeasonName, semanticFingerprint, snapshot, scorersFromNames, getFinalParticipantNames, createChoiceSet, normalizeKey, classifyRelevantAward, createNumericChoiceSet, formatTopScorerGoalsPrompt, formatTeamArticle, deduplicateCandidates, unique, rankOccurrences, uniqueLeader, createChoiceSetFromExactDistractors } from "./utils";
import { createChampionChoiceSet, formatHistoricalPlayerForSeason, resolveAwardPlayerContext, createAwardChoiceSet, findAwardWinnerGoals, formatMultiSeasonPlayerAnswer, findAwardForOccurrenceKey } from "./answerOptions";
import { localizeQuizText } from "@/src/services/games/quiz/QuizText";

/* ============================================================
 * HISTORICAL: only titles, official awards and final records.
 * ============================================================ */

export function generateHistoricalCandidates(kb: WeeklyQuizKnowledgeBase): Candidate[] {
  const candidates: Candidate[] = [];

  for (const final of kb.historicalFinals) {
    const competitionName =
      final.competitionName || competitionNameFromId(final.competitionId);
    const seasonName = normalizeSeasonName(final.seasonName);
    const championAnswers = createChampionChoiceSet(
      final,
      kb,
    );

    if (championAnswers) {
      candidates.push({
        challengeType: "history_challenge",
        kind: "multiple_choice",
        questionFamily: "champion",
        difficulty: "easy",
        prompt: `Quale squadra ha vinto la ${competitionName} nella stagione ${seasonName}?`,
        answers: championAnswers.answers,
        correctAnswerIndex: championAnswers.correctAnswerIndex,
        explanation: `${final.winnerTeamName} ha vinto la ${competitionName} nella stagione ${seasonName}.`,
        fingerprint: semanticFingerprint(
          "historical_champion",
          final.competitionId,
          final.seasonId,
          final.winnerTeamId,
        ),
        sourceSnapshot: snapshot(kb, {
          competitionIds: [final.competitionId],
          seasonIds: [final.seasonId],
          teamIds: [final.winnerTeamId, final.homeTeamId, final.awayTeamId],
          facts: {
            family: "champion",
            competitionName,
            seasonName,
            winnerTeamName: final.winnerTeamName,
          },
        }),
      });
    }

    const finalScorers =
      final.scorers ?? scorersFromNames(final.scorerNames);
    const finalParticipantLabels = getFinalParticipantNames(final, kb)
      .map((playerName) =>
        formatHistoricalPlayerForSeason({
          kb,
          competitionId: final.competitionId,
          seasonId: final.seasonId,
          seasonName: final.seasonName,
          playerName,
        }),
      )
      .filter((value): value is string => value !== null);
    const finalLabel = `${final.homeTeamName} - ${final.awayTeamName}`;
    const topScorers = finalScorers.filter(
      (scorer) => scorer.goals === finalScorers[0]?.goals,
    );
    if (topScorers.length === 1 && topScorers[0].goals >= 2) {
      const topScorer = topScorers[0];
      const topScorerLabel = formatHistoricalPlayerForSeason({
        kb,
        competitionId: final.competitionId,
        seasonId: final.seasonId,
        seasonName: final.seasonName,
        playerId: topScorer.playerId,
        playerName: topScorer.playerName,
      });
      const answers = topScorerLabel
        ? createChoiceSet(topScorerLabel, [
            topScorerLabel,
            ...finalParticipantLabels,
          ])
        : null;
      if (answers && topScorerLabel) {
        candidates.push({
          challengeType: "history_challenge",
          kind: "multiple_choice",
          questionFamily: "final_record",
          difficulty: "hard",
          prompt: `Chi ha realizzato più gol nella finale ${finalLabel} di ${competitionName} ${seasonName}?`,
          answers: answers.answers,
          correctAnswerIndex: answers.correctAnswerIndex,
          explanation: `${topScorerLabel} ha segnato ${topScorer.goals} gol nella finale ${finalLabel} di ${competitionName} ${seasonName}.`,
          fingerprint: semanticFingerprint(
            "historical_final_top_scorer",
            final.competitionId,
            final.seasonId,
            topScorer.playerId ?? normalizeKey(topScorer.playerName),
          ),
          sourceSnapshot: snapshot(kb, {
            competitionIds: [final.competitionId],
            seasonIds: [final.seasonId],
            playerIds: topScorer.playerId ? [topScorer.playerId] : [],
            teamIds: [final.homeTeamId, final.awayTeamId],
            facts: {
              family: "final_record",
              competitionName,
              seasonName,
              finalLabel,
              playerName: topScorer.playerName,
              goals: topScorer.goals,
            },
          }),
        });
      }
    }

    const hatTrickScorerNames =
      final.hatTrickScorerNames ??
      finalScorers
        .filter((scorer) => scorer.goals >= 3)
        .map((scorer) => scorer.playerName);
    if (hatTrickScorerNames.length === 1) {
      const playerName = hatTrickScorerNames[0];
      const scorer = finalScorers.find(
        (item) => normalizeKey(item.playerName) === normalizeKey(playerName),
      );
      const playerLabel = formatHistoricalPlayerForSeason({
        kb,
        competitionId: final.competitionId,
        seasonId: final.seasonId,
        seasonName: final.seasonName,
        playerId: scorer?.playerId,
        playerName,
      });
      const answers = playerLabel
        ? createChoiceSet(playerLabel, [
            playerLabel,
            ...finalParticipantLabels,
          ])
        : null;
      if (answers && playerLabel) {
        candidates.push({
          challengeType: "history_challenge",
          kind: "multiple_choice",
          questionFamily: "final_record",
          difficulty: "hard",
          prompt: `Chi ha realizzato una tripletta nella finale ${finalLabel} di ${competitionName} ${seasonName}?`,
          answers: answers.answers,
          correctAnswerIndex: answers.correctAnswerIndex,
          explanation: `${playerLabel} ha realizzato una tripletta nella finale ${finalLabel} di ${competitionName} ${seasonName}.`,
          fingerprint: semanticFingerprint(
            "historical_final_hat_trick",
            final.competitionId,
            final.seasonId,
            normalizeKey(playerName),
          ),
          sourceSnapshot: snapshot(kb, {
            competitionIds: [final.competitionId],
            seasonIds: [final.seasonId],
            teamIds: [final.homeTeamId, final.awayTeamId],
            facts: {
              family: "final_record",
              competitionName,
              seasonName,
              finalLabel,
              playerName,
              achievement: "hat_trick",
            },
          }),
        });
      }
    }
  }

  for (const award of kb.historicalAwards) {
    const family = classifyRelevantAward(award);
    if (!family || !award.playerName) continue;

    const competitionName =
      award.competitionName || competitionNameFromId(award.competitionId);
    const seasonName = normalizeSeasonName(award.seasonName);
    const winnerContext = resolveAwardPlayerContext(award, kb);
    const answerLabel = winnerContext?.label ?? null;
    if (!winnerContext || !answerLabel) continue;
    const answers = createAwardChoiceSet({
      award,
      family,
      kb,
      correctLabel: answerLabel,
    });

    if (answers) {
      candidates.push({
        challengeType: "history_challenge",
        kind: "multiple_choice",
        questionFamily: family,
        difficulty: family === "top_scorer" ? "medium" : "medium",
        prompt: `Chi ha vinto il premio “${localizeQuizText(award.awardLabel)}” nella ${competitionName} ${seasonName}?`,
        answers: answers.answers,
        correctAnswerIndex: answers.correctAnswerIndex,
        explanation: `${answerLabel} ha vinto il premio “${localizeQuizText(award.awardLabel)}” nella ${competitionName} ${seasonName}.`,
        fingerprint: semanticFingerprint(
          `historical_${family}`,
          award.competitionId,
          award.seasonId,
          winnerContext.playerId ?? winnerContext.identityKey,
        ),
        sourceSnapshot: snapshot(kb, {
          competitionIds: [award.competitionId],
          seasonIds: [award.seasonId],
          playerIds: winnerContext.playerId ? [winnerContext.playerId] : [],
          teamIds: winnerContext.teamId ? [winnerContext.teamId] : [],
          facts: {
            family,
            competitionName,
            seasonName,
            awardLabel: award.awardLabel,
            playerName: award.playerName,
          },
        }),
      });
    }

    if (family === "top_scorer") {
      const goals = award.value ?? findAwardWinnerGoals(award, kb);
      if (winnerContext && goals !== undefined && goals > 0) {
        const numericAnswers = createNumericChoiceSet(goals);
        candidates.push({
          challengeType: "history_challenge",
          kind: "multiple_choice",
          questionFamily: "top_scorer_goals",
          difficulty: "hard",
          prompt: formatTopScorerGoalsPrompt({
            winner: winnerContext,
            competitionName,
            seasonName,
          }),
          answers: numericAnswers.answers,
          correctAnswerIndex: numericAnswers.correctAnswerIndex,
          explanation: `${winnerContext.playerName} ha conquistato il titolo di capocannoniere con ${goals} gol${
            winnerContext.teamName
              ? ` con la maglia ${formatTeamArticle(winnerContext.teamName)}`
              : ""
          }.`,
          fingerprint: semanticFingerprint(
            "historical_top_scorer_goals",
            award.competitionId,
            award.seasonId,
            winnerContext.playerId ?? winnerContext.identityKey,
          ),
          sourceSnapshot: snapshot(kb, {
            competitionIds: [award.competitionId],
            seasonIds: [award.seasonId],
            playerIds: winnerContext.playerId ? [winnerContext.playerId] : [],
            teamIds: winnerContext.teamId ? [winnerContext.teamId] : [],
            facts: {
              family: "top_scorer_goals",
              competitionName,
              seasonName,
              playerName: award.playerName,
              goals,
            },
          }),
        });
      }
    }
  }

  candidates.push(
    ...generateHistoricalRecordCandidates(kb),
  );

  return deduplicateCandidates(candidates);
}

export function generateHistoricalRecordCandidates(
  kb: WeeklyQuizKnowledgeBase,
): Candidate[] {
  return [
    ...generateMostTitlesCandidates(kb),
    ...generateMostFinalGoalsCandidates(kb),
    ...generateMostAwardsCandidates(kb),
  ];
}

export function generateMostTitlesCandidates(
  kb: WeeklyQuizKnowledgeBase,
): Candidate[] {
  const result: Candidate[] = [];
  const competitionIds = unique(
    kb.historicalFinals.map((final) => final.competitionId),
  ).filter((id) => /champions|europa/i.test(id));

  for (const competitionId of competitionIds) {
    const finals = kb.historicalFinals.filter(
      (final) => final.competitionId === competitionId,
    );
    const ranking = rankOccurrences(
      finals.map((final) => ({
        key: final.winnerTeamId || normalizeKey(final.winnerTeamName),
        label: final.winnerTeamName,
      })),
    );
    const leader = uniqueLeader(ranking);
    if (!leader) continue;
    const answers = createChoiceSet(
      leader.label,
      ranking.map((entry) => entry.label),
    );
    if (!answers) continue;
    const competitionName =
      finals[0]?.competitionName || competitionNameFromId(competitionId);

    result.push({
      challengeType: "history_challenge",
      kind: "multiple_choice",
      questionFamily: "historical_record",
      difficulty: "hard",
      prompt: `Quale squadra ha vinto più volte la ${competitionName}?`,
      answers: answers.answers,
      correctAnswerIndex: answers.correctAnswerIndex,
      explanation: `${leader.label} ha conquistato ${leader.count} edizioni della ${competitionName}.`,
      fingerprint: semanticFingerprint("most_titles", competitionId, leader.key),
      sourceSnapshot: snapshot(kb, {
        competitionIds: [competitionId],
        seasonIds: finals.map((final) => final.seasonId),
        teamIds: finals.map((final) => final.winnerTeamId),
        facts: {
          family: "historical_record",
          record: "most_titles",
          competitionName,
          leader: leader.label,
          value: leader.count,
        },
      }),
    });
  }

  return result;
}

export function generateMostFinalGoalsCandidates(
  kb: WeeklyQuizKnowledgeBase,
): Candidate[] {
  const result: Candidate[] = [];
  const competitionIds = unique(
    kb.historicalFinals.map((final) => final.competitionId),
  ).filter((id) => /champions|europa/i.test(id));

  for (const competitionId of competitionIds) {
    const finals = kb.historicalFinals.filter(
      (final) => final.competitionId === competitionId,
    );
    const totals = new Map<
      string,
      {
        key: string;
        label: string;
        playerId?: string;
        count: number;
        scoringFinals: number;
      }
    >();
    for (const final of finals) {
      for (const scorer of final.scorers ?? scorersFromNames(final.scorerNames)) {
        const key = scorer.playerId || normalizeKey(scorer.playerName);
        const previous = totals.get(key);
        totals.set(key, {
          key,
          label: scorer.playerName,
          playerId: previous?.playerId ?? scorer.playerId,
          count: (previous?.count ?? 0) + scorer.goals,
          scoringFinals: (previous?.scoringFinals ?? 0) + 1,
        });
      }
    }
    const ranking = [...totals.values()].sort(
      (first, second) =>
        second.count - first.count ||
        second.scoringFinals - first.scoringFinals ||
        first.label.localeCompare(second.label, "it"),
    );
    const leader = uniqueLeader(ranking);
    if (!leader) continue;
    const leaderLabel = formatMultiSeasonPlayerAnswer({
      kb,
      competitionId,
      playerId: leader.playerId,
      playerName: leader.label,
    });
    if (!leaderLabel) continue;
    /*
     * Per questa domanda i distrattori devono essere davvero plausibili:
     * privilegiamo chi compare più spesso nei tabellini marcatori delle finali;
     * a parità, chi ha realizzato più gol complessivi.
     */
    const distractorRanking = [...ranking].sort(
      (first, second) =>
        second.scoringFinals - first.scoringFinals ||
        second.count - first.count ||
        first.label.localeCompare(second.label, "it"),
    );

    const rankedLabels = distractorRanking
      .map((entry) => ({
        entry,
        label: formatMultiSeasonPlayerAnswer({
          kb,
          competitionId,
          playerId: entry.playerId,
          playerName: entry.label,
        }),
      }))
      .filter(
        (value): value is {
          entry: (typeof ranking)[number];
          label: string;
        } => value.label !== null,
      );

    const preferredDistractors = rankedLabels
      .filter((value) => normalizeKey(value.label) !== normalizeKey(leaderLabel))
      .slice(0, 3)
      .map((value) => value.label);

    const answers = preferredDistractors.length >= 3
      ? createChoiceSetFromExactDistractors(leaderLabel, preferredDistractors)
      : null;
    if (!answers) continue;
    const competitionName =
      finals[0]?.competitionName || competitionNameFromId(competitionId);

    result.push({
      challengeType: "history_challenge",
      kind: "multiple_choice",
      questionFamily: "historical_record",
      difficulty: "hard",
      prompt: `Chi ha segnato più gol complessivi nelle finali di ${competitionName}?`,
      answers: answers.answers,
      correctAnswerIndex: answers.correctAnswerIndex,
      explanation: `${leaderLabel} ha realizzato ${leader.count} gol complessivi nelle finali di ${competitionName}.`,
      fingerprint: semanticFingerprint("most_final_goals", competitionId, leader.key),
      sourceSnapshot: snapshot(kb, {
        competitionIds: [competitionId],
        seasonIds: finals.map((final) => final.seasonId),
        playerIds: finals.flatMap((final) => final.scorerPlayerIds),
        facts: {
          family: "historical_record",
          record: "most_final_goals",
          competitionName,
          leader: leader.label,
          value: leader.count,
        },
      }),
    });
  }

  return result;
}

export function generateMostAwardsCandidates(
  kb: WeeklyQuizKnowledgeBase,
): Candidate[] {
  const result: Candidate[] = [];
  const groups = new Map<string, QuizHistoricalAwardFact[]>();

  for (const award of kb.historicalAwards) {
    const family = classifyRelevantAward(award);
    if (!family || !award.playerName) continue;
    const key = `${award.competitionId}::${family}`;
    groups.set(key, [...(groups.get(key) ?? []), award]);
  }

  for (const awards of groups.values()) {
    const representative = awards[0];
    const family = classifyRelevantAward(representative);
    if (!family) continue;
    const ranking = rankOccurrences(
      awards.map((award) => ({
        key: award.playerId || normalizeKey(award.playerName ?? ""),
        label: award.playerName ?? "",
      })),
    );
    const leader = uniqueLeader(ranking);
    if (!leader) continue;
    const leaderAward = findAwardForOccurrenceKey(
      awards,
      leader.key,
    );
    if (!leaderAward?.playerName) continue;

    const leaderLabel = formatMultiSeasonPlayerAnswer({
      kb,
      competitionId: representative.competitionId,
      playerId: leaderAward.playerId,
      playerName: leaderAward.playerName,
      birthYear: leaderAward.birthYear,
    });
    if (!leaderLabel) continue;

    const answerPool = ranking
      .map((entry) => {
        const sourceAward = findAwardForOccurrenceKey(
          awards,
          entry.key,
        );
        if (!sourceAward?.playerName) return null;

        return formatMultiSeasonPlayerAnswer({
          kb,
          competitionId: representative.competitionId,
          playerId: sourceAward.playerId,
          playerName: sourceAward.playerName,
          birthYear: sourceAward.birthYear,
        });
      })
      .filter((value): value is string => value !== null);
    const answers = createChoiceSet(
      leaderLabel,
      answerPool,
    );
    if (!answers) continue;
    const competitionName =
      representative.competitionName ||
      competitionNameFromId(representative.competitionId);

    result.push({
      challengeType: "history_challenge",
      kind: "multiple_choice",
      questionFamily: "historical_record",
      difficulty: "hard",
      prompt: `Chi ha conquistato più volte il premio “${localizeQuizText(representative.awardLabel)}” nella ${competitionName}?`,
      answers: answers.answers,
      correctAnswerIndex: answers.correctAnswerIndex,
      explanation: `${leaderLabel} ha conquistato il premio ${leader.count} volte nella ${competitionName}.`,
      fingerprint: semanticFingerprint(
        "most_awards",
        representative.competitionId,
        family,
        leader.key,
      ),
      sourceSnapshot: snapshot(kb, {
        competitionIds: [representative.competitionId],
        seasonIds: awards.map((award) => award.seasonId),
        playerIds: awards.flatMap((award) => award.playerId ? [award.playerId] : []),
        facts: {
          family: "historical_record",
          record: "most_awards",
          awardFamily: family,
          competitionName,
          leader: leader.label,
          value: leader.count,
        },
      }),
    });
  }

  return result;
}
