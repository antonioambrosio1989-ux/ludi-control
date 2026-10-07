import type { QuizPlayerIdentity, QuizHistoricalAwardFact, QuizHistoricalFinalFact, WeeklyQuizKnowledgeBase, WeeklyQuizQuestionFamily, QuizCurrentPlayerStats, QuizHistoricalPlayerSeasonStats, QuizHistoricalFinalScorer, WeeklyQuizSourceSnapshot } from "@/src/types/GamesWeeklyQuiz";
import type { CompetitionFamily, TeamTitleFact, ResolvedHistoricalPlayer, OccurrenceRankingEntry, Candidate } from "./types";

/**
 * Prima di tre partite disputate per squadra i dati correnti sono ancora
 * troppo instabili per produrre classifiche statistiche significative.
 */
export const CURRENT_MIN_COMPLETED_MATCHES = 3;

export const WHOS_THE_PLAYER_MIN_SIGNIFICANT_GOALS = 15;

export const WHOS_THE_PLAYER_MAX_CANDIDATES = 8;

export const WHOS_THE_PLAYER_MAX_CLUE_SETS = 40;

export function playerIdentityKey(player: QuizPlayerIdentity): string {
  if (player.playerId.trim()) return `id:${player.playerId.trim()}`;
  return `name:${normalizeKey(player.displayName)}:${player.birthYear ?? ""}`;
}

/* ============================================================
 * Utilities
 * ============================================================ */

export function classifyRelevantAward(
  award: QuizHistoricalAwardFact,
): "best_player" | "best_goalkeeper" | "top_scorer" | null {
  const value = normalizeText(`${award.award} ${award.awardLabel}`);
  if (/capocannoniere|top scorer|best ludi scorer|classifica marcatori|miglior marcatore/.test(value)) {
    return "top_scorer";
  }
  if (/miglior portiere|best goalkeeper|goalkeeper|portiere dell/.test(value)) {
    return "best_goalkeeper";
  }
  if (/miglior giocatore|best(?: ludi)? player|player of the season|mvp/.test(value)) {
    return "best_player";
  }
  return null;
}

export function getFinalParticipantNames(
  final: QuizHistoricalFinalFact,
  kb: WeeklyQuizKnowledgeBase,
): string[] {
  const finalTeamIds = new Set(
    [final.homeTeamId, final.awayTeamId]
      .map(normalizeKey)
      .filter(Boolean),
  );
  const finalTeamNames = new Set(
    [final.homeTeamName, final.awayTeamName]
      .map(normalizeKey)
      .filter(Boolean),
  );

  return unique([
    ...(final.scorers ?? []).map((scorer) => scorer.playerName),
    ...final.scorerNames,
    ...kb.historicalPlayerSeasons
      .filter(
        (row) =>
          sameCompetitionFamily(row.competitionId, final.competitionId) &&
          row.seasonId === final.seasonId &&
          (finalTeamIds.has(normalizeKey(row.teamId ?? "")) ||
            finalTeamNames.has(normalizeKey(row.teamName ?? ""))),
      )
      .map((row) => row.player.displayName),
  ]);
}

export function competitionFamilyFromId(competitionId: string): CompetitionFamily {
  const normalized = normalizeKey(competitionId);

  /* "championship" contiene la sequenza "champions": va controllata prima. */
  if (/championship/.test(normalized) || /europa/.test(normalized)) {
    return "championship";
  }
  if (/champions(?:-league)?/.test(normalized) || /premier/.test(normalized)) {
    return "premier";
  }
  return normalized;
}

export function sameCompetitionFamily(first: string, second: string): boolean {
  return competitionFamilyFromId(first) === competitionFamilyFromId(second);
}

export function teamIdentityKey(teamId: string | undefined, teamName: string): string {
  return teamId?.trim()
    ? `id:${teamId.trim()}`
    : `name:${normalizeKey(teamName)}`;
}

export function isTeamTitleAward(award: QuizHistoricalAwardFact): boolean {
  if (award.winnerType !== "team" || !award.teamName?.trim()) return false;
  const value = normalizeText(`${award.award} ${award.awardLabel}`);
  return /regular season|campion|champion|vincitore|winner|classifica finale/.test(value);
}

export function inferTeamTitlePhase(
  competitionId: string,
  label = "",
): TeamTitleFact["phase"] {
  const normalized =
    normalizeText(
      `${competitionId} ${label}`,
    );

  return /champions|europa|final stage|finalstage/.test(
    normalized,
  )
    ? "finalStage"
    : "regularSeason";
}

export function collectTeamTitleFacts(kb: WeeklyQuizKnowledgeBase): TeamTitleFact[] {
  const facts: TeamTitleFact[] = kb.historicalFinals.map((final) => ({
    competitionId: final.competitionId,
    seasonId: final.seasonId,
    seasonName: final.seasonName,
    phase: "finalStage",
    teamId: final.winnerTeamId,
    teamName: final.winnerTeamName,
  }));

  for (const title of kb.historicalTeamTitles ?? []) {
    facts.push({
      competitionId: title.competitionId,
      seasonId: title.seasonId,
      seasonName: title.seasonName,
      phase: title.phase,
      teamId: title.teamId,
      teamName: title.teamName,
    });
  }

  for (const award of kb.historicalAwards) {
    if (!isTeamTitleAward(award) || !award.teamName) continue;
    facts.push({
      competitionId: award.competitionId,
      seasonId: award.seasonId,
      seasonName: award.seasonName,
      phase: inferTeamTitlePhase(
        award.competitionId,
        `${award.award} ${award.awardLabel}`,
      ),
      teamId: award.teamId,
      teamName: award.teamName,
    });
  }

  const used = new Set<string>();
  return facts.filter((fact) => {
    const key = [
      competitionFamilyFromId(fact.competitionId),
      fact.seasonId,
      fact.phase,
      teamIdentityKey(fact.teamId, fact.teamName),
    ].join("::");
    if (used.has(key)) return false;
    used.add(key);
    return true;
  });
}

export function formatTeamArticle(teamName: string): string {
  const trimmed = teamName.trim();
  if (!trimmed) return trimmed;
  return /^[aeiouàèéìòóù]/i.test(trimmed)
    ? `dell'${trimmed}`
    : `del ${trimmed}`;
}

export function formatTopScorerGoalsPrompt({
  winner,
  competitionName,
  seasonName,
}: {
  winner: ResolvedHistoricalPlayer;
  competitionName: string;
  seasonName: string;
}): string {
  const playerLabel = winner.teamName
    ? `${winner.playerName} (${winner.teamName})`
    : winner.playerName;

  return `Con quanti gol il capocannoniere ${playerLabel} ha chiuso la ${competitionName} ${seasonName}?`;
}

export function normalizeSeasonName(value: string): string {
  return value.trim().replace(/^stagione\s+/i, "");
}

export function rankOccurrences(
  values: Array<{ key: string; label: string }>,
): OccurrenceRankingEntry[] {
  const totals = new Map<string, OccurrenceRankingEntry>();
  for (const value of values) {
    const key = value.key || normalizeKey(value.label);
    if (!key || !value.label.trim()) continue;
    const previous = totals.get(key);
    totals.set(key, {
      key,
      label: previous?.label ?? value.label.trim(),
      count: (previous?.count ?? 0) + 1,
    });
  }
  return [...totals.values()].sort((first, second) => second.count - first.count);
}

export function uniqueLeader<T extends { count: number }>(
  ranking: T[],
): T | null {
  const first = ranking[0];
  if (!first || ranking[1]?.count === first.count) return null;
  return first;
}

export function formatMetricValue(family: WeeklyQuizQuestionFamily, value: number): string {
  if (family === "average_vote") return `una media voto di ${value.toFixed(2)}`;
  const labels: Partial<Record<WeeklyQuizQuestionFamily, string>> = {
    goals: "gol",
    assists: "assist",
    mvp: "MVP",
    appearances: "presenze",
    clean_sheets: "clean sheet",
  };
  return `${value} ${labels[family] ?? "punti"}`;
}

export function groupByCompetitionAndSeason(rows: QuizCurrentPlayerStats[]) {
  const result = new Map<string, QuizCurrentPlayerStats[]>();
  for (const row of rows) {
    const key = `${row.team.competitionId}::${row.team.seasonId}`;
    result.set(key, [...(result.get(key) ?? []), row]);
  }
  return result;
}

export function groupHistoricalByCompetitionAndSeason(rows: QuizHistoricalPlayerSeasonStats[]) {
  const result = new Map<string, QuizHistoricalPlayerSeasonStats[]>();
  for (const row of rows) {
    const key = `${row.competitionId}::${row.seasonId}`;
    result.set(key, [...(result.get(key) ?? []), row]);
  }
  return result;
}

export function createChoiceSet(correct: string, pool: string[]) {
  const normalizedCorrect = normalizeKey(correct);
  const distractors = unique(pool).filter(
    (value) => normalizeKey(value) !== normalizedCorrect,
  );
  if (!correct.trim() || distractors.length < 3) return null;
  const answers = shuffle([correct, ...shuffle(distractors).slice(0, 3)]);
  return { answers, correctAnswerIndex: answers.indexOf(correct) };
}

export function createChoiceSetFromExactDistractors(
  correct: string,
  distractors: string[],
) {
  const normalizedCorrect = normalizeKey(correct);
  const selectedDistractors = unique(distractors)
    .filter((value) => normalizeKey(value) !== normalizedCorrect)
    .slice(0, 3);

  if (!correct.trim() || selectedDistractors.length < 3) return null;

  const answers = shuffle([correct, ...selectedDistractors]);
  return { answers, correctAnswerIndex: answers.indexOf(correct) };
}

export function createNumericChoiceSet(correct: number) {
  const offsets = shuffle([-4, -3, -2, -1, 1, 2, 3, 4]);
  const values = [correct];
  for (const offset of offsets) {
    const candidate = correct + offset;
    if (candidate >= 0 && !values.includes(candidate)) values.push(candidate);
    if (values.length === 4) break;
  }
  while (values.length < 4) values.push(correct + values.length);
  const answers = shuffle(values).map(String);
  return { answers, correctAnswerIndex: answers.indexOf(String(correct)) };
}

export function scorersFromNames(names: string[]): QuizHistoricalFinalScorer[] {
  const totals = new Map<string, QuizHistoricalFinalScorer>();
  for (const playerName of names) {
    const key = normalizeKey(playerName);
    if (!key) continue;
    const previous = totals.get(key);
    totals.set(key, {
      playerName: previous?.playerName ?? playerName,
      goals: (previous?.goals ?? 0) + 1,
    });
  }
  return Array.from(totals.values()).sort(
    (first, second) => second.goals - first.goals,
  );
}

export function snapshot(
  kb: WeeklyQuizKnowledgeBase,
  values: Partial<Omit<WeeklyQuizSourceSnapshot, "generatedAtMs">>,
): WeeklyQuizSourceSnapshot {
  return {
    generatedAtMs: kb.generatedAtMs,
    competitionIds: unique(values.competitionIds ?? []),
    seasonIds: unique(values.seasonIds ?? []),
    playerIds: unique(values.playerIds ?? []),
    teamIds: unique(values.teamIds ?? []),
    facts: values.facts ?? {},
  };
}

export function semanticFingerprint(...parts: Array<string | number>) {
  return parts.map((part) => normalizeKey(String(part))).join("|");
}

export function competitionNameFromId(competitionId: string): string {
  const names: Record<string, string> = {
    "premier-league": "Premier League",
    championship: "Championship",
    "league-one": "League One",
    "champions-league": "Champions League",
    "europa-league": "Europa League",
  };
  return (
    names[competitionId] ??
    competitionId
      .split("-")
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ")
  );
}

export function deduplicateCandidates(values: Candidate[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value.fingerprint)) return false;
    seen.add(value.fingerprint);
    return true;
  });
}

export function unique(values: string[]) {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    const key = normalizeKey(trimmed);
    if (!trimmed || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase("it-IT").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeKey(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function combinations<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  const visit = (start: number, selected: T[]) => {
    if (selected.length === size) {
      result.push([...selected]);
      return;
    }
    for (let index = start; index <= values.length - (size - selected.length); index += 1) {
      selected.push(values[index]);
      visit(index + 1, selected);
      selected.pop();
    }
  };
  visit(0, []);
  return shuffle(result);
}
