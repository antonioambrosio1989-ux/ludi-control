import type { QuizHistoricalFinalFact, WeeklyQuizKnowledgeBase, QuizHistoricalPlayerSeasonStats, QuizHistoricalAwardFact } from "@/src/types/GamesWeeklyQuiz";
import { competitionFamilyFromId, teamIdentityKey, collectTeamTitleFacts, createChoiceSetFromExactDistractors, playerIdentityKey, normalizeKey, sameCompetitionFamily, classifyRelevantAward, normalizeText, shuffle } from "./utils";
import type { ResolvedHistoricalPlayer, PlayerOption } from "./types";

export function createChampionChoiceSet(
  final: QuizHistoricalFinalFact,
  kb: WeeklyQuizKnowledgeBase,
) {
  const family = competitionFamilyFromId(final.competitionId);
  const correctKey = teamIdentityKey(final.winnerTeamId, final.winnerTeamName);
  const targetYear = seasonStartYear(final.seasonName) ?? seasonStartYear(final.seasonId);

  const titleCandidates = collectTeamTitleFacts(kb)
    .filter((fact) => competitionFamilyFromId(fact.competitionId) === family)
    .filter(
      (fact) => teamIdentityKey(fact.teamId, fact.teamName) !== correctKey,
    )
    .map((fact) => {
      const year = seasonStartYear(fact.seasonName) ?? seasonStartYear(fact.seasonId);
      const distance =
        targetYear !== undefined && year !== undefined
          ? Math.abs(year - targetYear)
          : Number.MAX_SAFE_INTEGER;
      const sameSeason = fact.seasonId === final.seasonId;
      const samePhase = fact.phase === "finalStage";
      const priority = sameSeason && !samePhase
        ? 0
        : distance === 1 && samePhase
          ? 10
          : distance === 1
            ? 20
            : distance * 10 + (samePhase ? 0 : 2);
      return { fact, priority };
    })
    .sort((first, second) => first.priority - second.priority);

  const distractors: string[] = [];
  const used = new Set<string>([correctKey]);
  for (const { fact } of titleCandidates) {
    const key = teamIdentityKey(fact.teamId, fact.teamName);
    if (used.has(key)) continue;
    distractors.push(fact.teamName);
    used.add(key);
    if (distractors.length === 3) break;
  }

  if (distractors.length < 3) {
    const fallbackTeams = kb.historicalFinals
      .filter((item) => competitionFamilyFromId(item.competitionId) === family)
      .flatMap((item) => [
        {
          teamId: item.homeTeamId,
          teamName: item.homeTeamName,
          seasonId: item.seasonId,
          seasonName: item.seasonName,
        },
        {
          teamId: item.awayTeamId,
          teamName: item.awayTeamName,
          seasonId: item.seasonId,
          seasonName: item.seasonName,
        },
      ])
      .map((team) => ({
        team,
        distance: Math.abs(
          (seasonStartYear(team.seasonName) ?? seasonStartYear(team.seasonId) ?? 0) -
          (targetYear ?? 0),
        ),
      }))
      .sort((first, second) => first.distance - second.distance);

    for (const { team } of fallbackTeams) {
      const key = teamIdentityKey(team.teamId, team.teamName);
      if (used.has(key)) continue;
      distractors.push(team.teamName);
      used.add(key);
      if (distractors.length === 3) break;
    }
  }

  return createChoiceSetFromExactDistractors(
    final.winnerTeamName,
    distractors,
  );
}

export function historicalRowIdentityKey(row: QuizHistoricalPlayerSeasonStats): string {
  return playerIdentityKey(row.player);
}

export function resolveUniqueRow(
  rows: QuizHistoricalPlayerSeasonStats[],
  {
    playerId,
    playerName,
    birthYear,
    teamId,
    teamName,
    expectedGoals,
  }: {
    playerId?: string;
    playerName: string;
    birthYear?: number;
    teamId?: string;
    teamName?: string;
    expectedGoals?: number;
  },
): QuizHistoricalPlayerSeasonStats | null {
  let candidates = rows.filter((row) => {
    if (playerId) return row.player.playerId === playerId;
    if (normalizeKey(row.player.displayName) !== normalizeKey(playerName)) return false;
    return birthYear === undefined || row.player.birthYear === birthYear;
  });

  if (expectedGoals !== undefined) {
    const goalsMatched = candidates.filter((row) => row.goals === expectedGoals);
    if (goalsMatched.length === 0) return null;
    candidates = goalsMatched;
  }

  if (teamId || teamName) {
    const teamMatched = candidates.filter(
      (row) =>
        (!teamId || row.teamId === teamId) &&
        (!teamName || normalizeKey(row.teamName ?? "") === normalizeKey(teamName)),
    );
    if (teamMatched.length === 0) return null;
    candidates = teamMatched;
  }

  const identities = new Set(candidates.map(historicalRowIdentityKey));
  if (identities.size !== 1) return null;

  return candidates
    .filter((row) => Boolean(row.teamName?.trim()))
    .sort((first, second) => second.appearances - first.appearances)[0] ??
    candidates[0] ??
    null;
}

export function resolveAwardPlayerContext(
  award: QuizHistoricalAwardFact,
  kb: WeeklyQuizKnowledgeBase,
): ResolvedHistoricalPlayer | null {
  const playerName = award.playerName?.trim() ?? "";
  if (!playerName) return null;

  const familyRows = kb.historicalPlayerSeasons.filter(
    (row) => sameCompetitionFamily(row.competitionId, award.competitionId),
  );
  const exactCompetitionRows = familyRows.filter(
    (row) => row.competitionId === award.competitionId && row.seasonId === award.seasonId,
  );
  const exactFamilyRows = familyRows.filter((row) => row.seasonId === award.seasonId);
  const expectedGoals = classifyRelevantAward(award) === "top_scorer"
    ? award.value ??
      exactCompetitionRows.reduce(
        (maximum, row) => Math.max(maximum, row.goals),
        0,
      )
    : undefined;

  let exactRow = resolveUniqueRow(exactCompetitionRows, {
    playerId: award.playerId,
    playerName,
    birthYear: award.birthYear,
    teamId: award.teamId,
    teamName: award.teamName,
    expectedGoals,
  });
  if (!exactRow) {
    exactRow = resolveUniqueRow(exactFamilyRows, {
      playerId: award.playerId,
      playerName,
      birthYear: award.birthYear,
      teamId: award.teamId,
      teamName: award.teamName,
      expectedGoals,
    });
  }

  /*
   * Gli archivi più vecchi possono contenere un playerId agganciato a un
   * omonimo. Se i fatti della stagione (gol/squadra) smentiscono quell'ID,
   * proviamo una sola risoluzione per nome + anno di nascita + fatti ufficiali.
   * La domanda viene mantenuta soltanto se emerge una sola identità.
   */
  if (!exactRow && award.playerId) {
    exactRow = resolveUniqueRow(exactCompetitionRows, {
      playerName,
      birthYear: award.birthYear,
      teamId: award.teamId,
      teamName: award.teamName,
      expectedGoals,
    });

    if (!exactRow) {
      exactRow = resolveUniqueRow(exactFamilyRows, {
        playerName,
        birthYear: award.birthYear,
        teamId: award.teamId,
        teamName: award.teamName,
        expectedGoals,
      });
    }
  }

  if (
    !exactRow &&
    expectedGoals !== undefined &&
    exactFamilyRows.length > 0
  ) {
    return null;
  }

  let identityKey: string | null = null;
  let resolvedPlayerId = award.playerId;
  let resolvedBirthYear = award.birthYear;

  if (exactRow) {
    identityKey = historicalRowIdentityKey(exactRow);
    resolvedPlayerId = exactRow.player.playerId;
    resolvedBirthYear = exactRow.player.birthYear ?? resolvedBirthYear;
  } else if (award.playerId) {
    identityKey = `id:${award.playerId}`;
  } else {
    const nameRows = familyRows.filter(
      (row) =>
        normalizeKey(row.player.displayName) === normalizeKey(playerName) &&
        (award.birthYear === undefined || row.player.birthYear === award.birthYear),
    );
    const identities = new Map<string, QuizHistoricalPlayerSeasonStats>();
    for (const row of nameRows) identities.set(historicalRowIdentityKey(row), row);
    if (identities.size !== 1) return null;
    const only = [...identities.values()][0];
    identityKey = historicalRowIdentityKey(only);
    resolvedPlayerId = only.player.playerId;
    resolvedBirthYear = only.player.birthYear ?? resolvedBirthYear;
  }

  if (!identityKey) return null;

  const targetYear = seasonStartYear(award.seasonName) ?? seasonStartYear(award.seasonId);
  const identityRows = familyRows.filter(
    (row) =>
      historicalRowIdentityKey(row) === identityKey ||
      (resolvedPlayerId !== undefined && row.player.playerId === resolvedPlayerId),
  );

  const previousRow = targetYear === undefined
    ? undefined
    : identityRows
        .map((row) => ({
          row,
          year: seasonStartYear(row.seasonName) ?? seasonStartYear(row.seasonId),
        }))
        .filter(
          (entry): entry is { row: QuizHistoricalPlayerSeasonStats; year: number } =>
            entry.year !== undefined && entry.year < targetYear && Boolean(entry.row.teamName?.trim()),
        )
        .sort(
          (first, second) =>
            second.year - first.year ||
            Number(second.row.competitionId === award.competitionId) -
              Number(first.row.competitionId === award.competitionId),
        )[0]?.row;

  const teamName =
    exactRow?.teamName?.trim() ||
    award.teamName?.trim() ||
    previousRow?.teamName?.trim();
  if (!teamName) return null;

  const teamId = exactRow?.teamId ?? award.teamId ?? previousRow?.teamId;
  const displayName = exactRow?.player.displayName?.trim() || playerName;

  return {
    identityKey,
    label: `${displayName} (${teamName})`,
    playerId: resolvedPlayerId,
    playerName: displayName,
    birthYear: resolvedBirthYear,
    teamId,
    teamName,
    competitionId: award.competitionId,
    seasonId: award.seasonId,
    seasonName: award.seasonName,
    row: exactRow ?? undefined,
  };
}

export function resolveHistoricalPlayerForSeason({
  kb,
  competitionId,
  seasonId,
  seasonName,
  playerId,
  playerName,
  birthYear,
}: {
  kb: WeeklyQuizKnowledgeBase;
  competitionId: string;
  seasonId: string;
  seasonName: string;
  playerId?: string;
  playerName: string;
  birthYear?: number;
}): ResolvedHistoricalPlayer | null {
  const normalizedName = playerName.trim();
  if (!normalizedName) return null;

  const familyRows = kb.historicalPlayerSeasons.filter(
    (row) => sameCompetitionFamily(row.competitionId, competitionId),
  );
  const exactRows = familyRows.filter((row) => row.seasonId === seasonId);
  const exact = resolveUniqueRow(exactRows, {
    playerId,
    playerName: normalizedName,
    birthYear,
  });

  let identityKey: string | null = null;
  let resolvedPlayerId = playerId;
  let resolvedBirthYear = birthYear;

  if (exact) {
    identityKey = historicalRowIdentityKey(exact);
    resolvedPlayerId = exact.player.playerId;
    resolvedBirthYear = exact.player.birthYear ?? resolvedBirthYear;
  } else if (playerId) {
    identityKey = `id:${playerId}`;
  } else {
    const nameRows = familyRows.filter(
      (row) =>
        normalizeKey(row.player.displayName) === normalizeKey(normalizedName) &&
        (birthYear === undefined || row.player.birthYear === birthYear),
    );
    const identities = new Map<string, QuizHistoricalPlayerSeasonStats>();
    for (const row of nameRows) identities.set(historicalRowIdentityKey(row), row);
    if (identities.size !== 1) return null;
    const only = [...identities.values()][0];
    identityKey = historicalRowIdentityKey(only);
    resolvedPlayerId = only.player.playerId;
    resolvedBirthYear = only.player.birthYear ?? resolvedBirthYear;
  }

  if (!identityKey) return null;

  const targetYear = seasonStartYear(seasonName) ?? seasonStartYear(seasonId);
  const previous = targetYear === undefined
    ? undefined
    : familyRows
        .filter(
          (row) =>
            historicalRowIdentityKey(row) === identityKey ||
            (resolvedPlayerId !== undefined && row.player.playerId === resolvedPlayerId),
        )
        .map((row) => ({
          row,
          year: seasonStartYear(row.seasonName) ?? seasonStartYear(row.seasonId),
        }))
        .filter(
          (entry): entry is { row: QuizHistoricalPlayerSeasonStats; year: number } =>
            entry.year !== undefined && entry.year < targetYear && Boolean(entry.row.teamName?.trim()),
        )
        .sort((first, second) => second.year - first.year)[0]?.row;

  const chosen = exact?.teamName?.trim() ? exact : previous;
  if (!chosen?.teamName?.trim()) return null;

  const displayName = exact?.player.displayName?.trim() || chosen.player.displayName.trim() || normalizedName;
  return {
    identityKey,
    label: `${displayName} (${chosen.teamName.trim()})`,
    playerId: resolvedPlayerId,
    playerName: displayName,
    birthYear: resolvedBirthYear,
    teamId: chosen.teamId,
    teamName: chosen.teamName.trim(),
    competitionId,
    seasonId,
    seasonName,
    row: exact ?? undefined,
  };
}

export function formatHistoricalPlayerForSeason({
  kb,
  competitionId,
  seasonId,
  seasonName,
  playerId,
  playerName,
}: {
  kb: WeeklyQuizKnowledgeBase;
  competitionId: string;
  seasonId: string;
  seasonName: string;
  playerId?: string;
  playerName: string;
}): string | null {
  return resolveHistoricalPlayerForSeason({
    kb,
    competitionId,
    seasonId,
    seasonName,
    playerId,
    playerName,
  })?.label ?? null;
}

export function findAwardForOccurrenceKey(
  awards: QuizHistoricalAwardFact[],
  occurrenceKey: string,
): QuizHistoricalAwardFact | undefined {
  return awards.find((award) => {
    if (!award.playerName) return false;

    return award.playerId
      ? award.playerId === occurrenceKey
      : normalizeKey(award.playerName) === occurrenceKey;
  });
}

/**
 * Le domande multi-stagione non associano il giocatore a una singola squadra:
 * la squadra cambierebbe nel tempo e diventerebbe un'informazione arbitraria.
 *
 * Se esistono omonimi nella stessa famiglia di competizione, mostriamo
 * esclusivamente l'anno di nascita. Se l'anno non permette una distinzione
 * univoca, la risposta viene scartata invece di rischiare uno scambio di persona.
 */
export function formatMultiSeasonPlayerAnswer({
  kb,
  competitionId,
  playerId,
  playerName,
  birthYear,
}: {
  kb: WeeklyQuizKnowledgeBase;
  competitionId: string;
  playerId?: string;
  playerName: string;
  birthYear?: number;
}): string | null {
  const normalizedPlayerName = playerName.trim();
  if (!normalizedPlayerName) return null;

  const familyRows = kb.historicalPlayerSeasons.filter(
    (row) => sameCompetitionFamily(row.competitionId, competitionId),
  );

  let resolvedBirthYear = birthYear;

  if (resolvedBirthYear === undefined && playerId) {
    const years = [
      ...new Set(
        familyRows
          .filter((row) => row.player.playerId === playerId)
          .map((row) => row.player.birthYear)
          .filter((year): year is number => year !== undefined),
      ),
    ];

    if (years.length === 1) {
      resolvedBirthYear = years[0];
    }
  }

  const homonymIdentities = new Map<
    string,
    number | undefined
  >();

  for (const row of familyRows) {
    if (
      normalizeKey(row.player.displayName) !==
      normalizeKey(normalizedPlayerName)
    ) {
      continue;
    }

    homonymIdentities.set(
      playerIdentityKey(row.player),
      row.player.birthYear,
    );
  }

  for (const award of kb.historicalAwards) {
    if (
      !sameCompetitionFamily(
        award.competitionId,
        competitionId,
      ) ||
      normalizeKey(award.playerName ?? "") !==
        normalizeKey(normalizedPlayerName)
    ) {
      continue;
    }

    const identityKey = award.playerId
      ? `id:${award.playerId}`
      : award.birthYear !== undefined
        ? `name:${normalizeKey(normalizedPlayerName)}:${award.birthYear}`
        : null;

    if (identityKey) {
      homonymIdentities.set(
        identityKey,
        award.birthYear,
      );
    }

    if (
      resolvedBirthYear === undefined &&
      playerId &&
      award.playerId === playerId &&
      award.birthYear !== undefined
    ) {
      resolvedBirthYear = award.birthYear;
    }
  }

  for (const final of kb.historicalFinals) {
    if (
      !sameCompetitionFamily(
        final.competitionId,
        competitionId,
      )
    ) {
      continue;
    }

    for (const scorer of final.scorers ?? []) {
      if (
        normalizeKey(scorer.playerName) !==
        normalizeKey(normalizedPlayerName) ||
        !scorer.playerId
      ) {
        continue;
      }

      const scorerRow = familyRows.find(
        (row) =>
          row.player.playerId ===
          scorer.playerId,
      );

      homonymIdentities.set(
        `id:${scorer.playerId}`,
        scorerRow?.player.birthYear,
      );

      if (
        resolvedBirthYear === undefined &&
        playerId === scorer.playerId &&
        scorerRow?.player.birthYear !== undefined
      ) {
        resolvedBirthYear =
          scorerRow.player.birthYear;
      }
    }
  }

  if (homonymIdentities.size <= 1) {
    return normalizedPlayerName;
  }

  if (resolvedBirthYear === undefined) {
    return null;
  }

  const sameBirthYearCount =
    [...homonymIdentities.values()].filter(
      (year) => year === resolvedBirthYear,
    ).length;

  if (sameBirthYearCount !== 1) {
    return null;
  }

  return `${normalizedPlayerName} (${resolvedBirthYear})`;
}

export function seasonStartYear(value: string): number | undefined {
  const fourDigit = value.match(/(?:19|20)\d{2}/)?.[0];
  if (fourDigit) return Number(fourDigit);

  const twoDigit = value.match(/(?:^|\D)(\d{2})\s*[\/-]\s*\d{2}(?:\D|$)/)?.[1];
  if (!twoDigit) return undefined;

  const numeric = Number(twoDigit);
  return numeric >= 70
    ? 1900 + numeric
    : 2000 + numeric;
}

export function isTopFiveAward(award: QuizHistoricalAwardFact): boolean {
  if (award.section === "teamOfSeason") return true;

  const value = normalizeText(`${award.award} ${award.awardLabel}`);
  return /\btop\s*(?:five|5)\b|\bmigliori\s+cinque\b/.test(value);
}

export function isSameAwardPlayer(
  first: QuizHistoricalAwardFact,
  second: QuizHistoricalAwardFact,
): boolean {
  if (first.playerId && second.playerId) {
    return first.playerId === second.playerId;
  }
  if (
    first.birthYear !== undefined &&
    second.birthYear !== undefined &&
    first.birthYear !== second.birthYear
  ) {
    return false;
  }
  return normalizeKey(first.playerName ?? "") === normalizeKey(second.playerName ?? "");
}

export function dedupePlayerOptions(options: PlayerOption[]): PlayerOption[] {
  const seen = new Set<string>();
  const result: PlayerOption[] = [];
  for (const option of options) {
    if (seen.has(option.identityKey)) continue;
    seen.add(option.identityKey);
    result.push(option);
  }
  return result;
}

export function createPlayerChoiceSet(
  correct: ResolvedHistoricalPlayer,
  preferred: PlayerOption[],
  fallback: PlayerOption[],
) {
  const distractors = dedupePlayerOptions([
    ...preferred,
    ...fallback,
  ]).filter((option) => option.identityKey !== correct.identityKey);

  if (distractors.length < 3) return null;
  return createChoiceSetFromExactDistractors(
    correct.label,
    distractors.slice(0, 3).map((option) => option.label),
  );
}

export function getSameAwardOptions(
  award: QuizHistoricalAwardFact,
  family: "best_player" | "best_goalkeeper" | "top_scorer",
  kb: WeeklyQuizKnowledgeBase,
): PlayerOption[] {
  const targetYear = seasonStartYear(award.seasonName) ?? seasonStartYear(award.seasonId);
  return kb.historicalAwards
    .filter(
      (item) =>
        item.id !== award.id &&
        item.competitionId === award.competitionId &&
        classifyRelevantAward(item) === family &&
        Boolean(item.playerName),
    )
    .map((item) => ({
      item,
      resolved: resolveAwardPlayerContext(item, kb),
      year: seasonStartYear(item.seasonName) ?? seasonStartYear(item.seasonId),
    }))
    .filter(
      (entry): entry is {
        item: QuizHistoricalAwardFact;
        resolved: ResolvedHistoricalPlayer;
        year: number | undefined;
      } => entry.resolved !== null,
    )
    .sort((first, second) => {
      const firstDistance =
        targetYear !== undefined && first.year !== undefined
          ? Math.abs(first.year - targetYear)
          : Number.MAX_SAFE_INTEGER;
      const secondDistance =
        targetYear !== undefined && second.year !== undefined
          ? Math.abs(second.year - targetYear)
          : Number.MAX_SAFE_INTEGER;
      return firstDistance - secondDistance;
    })
    .map((entry) => entry.resolved);
}

export function getTopFivePreferredOptions(
  award: QuizHistoricalAwardFact,
  family: "best_player" | "best_goalkeeper",
  kb: WeeklyQuizKnowledgeBase,
): PlayerOption[] {
  const topFive = kb.historicalAwards
    .filter(
      (item) =>
        item.competitionId === award.competitionId &&
        item.seasonId === award.seasonId &&
        isTopFiveAward(item) &&
        Boolean(item.playerName),
    )
    .sort(
      (first, second) =>
        (first.sortOrder ?? Number.MAX_SAFE_INTEGER) -
        (second.sortOrder ?? Number.MAX_SAFE_INTEGER),
    );

  const candidates = family === "best_goalkeeper"
    ? topFive.slice(0, 1)
    : topFive.slice(1);

  return shuffle(candidates)
    .filter((item) => !isSameAwardPlayer(item, award))
    .map((item) => resolveAwardPlayerContext(item, kb))
    .filter((value): value is ResolvedHistoricalPlayer => value !== null);
}

export function getTopScorerPreferredOptions(
  award: QuizHistoricalAwardFact,
  kb: WeeklyQuizKnowledgeBase,
  correct: ResolvedHistoricalPlayer,
): PlayerOption[] {
  const targetYear = seasonStartYear(award.seasonName) ?? seasonStartYear(award.seasonId);
  const sameAwardEntries = kb.historicalAwards
    .filter(
      (item) =>
        item.id !== award.id &&
        item.competitionId === award.competitionId &&
        classifyRelevantAward(item) === "top_scorer" &&
        Boolean(item.playerName),
    )
    .map((item) => ({
      item,
      year: seasonStartYear(item.seasonName) ?? seasonStartYear(item.seasonId),
      resolved: resolveAwardPlayerContext(item, kb),
    }))
    .filter(
      (entry): entry is {
        item: QuizHistoricalAwardFact;
        year: number;
        resolved: ResolvedHistoricalPlayer;
      } => entry.year !== undefined && entry.resolved !== null,
    );

  const previous = targetYear === undefined
    ? undefined
    : sameAwardEntries
        .filter((entry) => entry.year < targetYear)
        .sort((first, second) => second.year - first.year)[0]?.resolved;
  const next = targetYear === undefined
    ? undefined
    : sameAwardEntries
        .filter((entry) => entry.year > targetYear)
        .sort((first, second) => first.year - second.year)[0]?.resolved;

  const rankingOptions = kb.historicalPlayerSeasons
    .filter(
      (row) =>
        row.competitionId === award.competitionId &&
        row.seasonId === award.seasonId &&
        row.goals > 0 &&
        Boolean(row.teamName?.trim()),
    )
    .sort(
      (first, second) =>
        second.goals - first.goals ||
        second.appearances - first.appearances,
    )
    .map((row): PlayerOption => ({
      identityKey: historicalRowIdentityKey(row),
      label: `${row.player.displayName} (${row.teamName})`,
      playerId: row.player.playerId,
      playerName: row.player.displayName,
      birthYear: row.player.birthYear,
      teamId: row.teamId,
      teamName: row.teamName,
    }))
    .filter((option) => option.identityKey !== correct.identityKey);

  const nearbyAwardOptions = sameAwardEntries
    .sort((first, second) => {
      const firstDistance = targetYear === undefined ? 999 : Math.abs(first.year - targetYear);
      const secondDistance = targetYear === undefined ? 999 : Math.abs(second.year - targetYear);
      return firstDistance - secondDistance;
    })
    .map((entry) => entry.resolved)
    .filter((option) => option.identityKey !== correct.identityKey);

  return dedupePlayerOptions([
    ...(previous ? [previous] : []),
    ...(next ? [next] : []),
    ...rankingOptions,
    ...nearbyAwardOptions,
  ]);
}

export function createAwardChoiceSet({
  award,
  family,
  kb,
  correctLabel,
}: {
  award: QuizHistoricalAwardFact;
  family: "best_player" | "best_goalkeeper" | "top_scorer";
  kb: WeeklyQuizKnowledgeBase;
  correctLabel: string;
}) {
  const correct = resolveAwardPlayerContext(award, kb);
  if (!correct) return null;
  correct.label = correctLabel;

  const fallback = getSameAwardOptions(award, family, kb);
  const preferred = family === "top_scorer"
    ? getTopScorerPreferredOptions(award, kb, correct)
    : getTopFivePreferredOptions(award, family, kb);

  return createPlayerChoiceSet(correct, preferred, fallback);
}

export function findAwardWinnerGoals(
  award: QuizHistoricalAwardFact,
  kb: WeeklyQuizKnowledgeBase,
): number | undefined {
  const resolved = resolveAwardPlayerContext(award, kb);
  if (!resolved) return undefined;
  if (
    resolved.row &&
    resolved.row.competitionId === award.competitionId &&
    resolved.row.seasonId === award.seasonId
  ) {
    return resolved.row.goals;
  }

  return kb.historicalPlayerSeasons.find(
    (row) =>
      row.competitionId === award.competitionId &&
      row.seasonId === award.seasonId &&
      historicalRowIdentityKey(row) === resolved.identityKey,
  )?.goals;
}
