import type { WeeklyQuizKnowledgeBase, QuizPlayerIdentity } from "@/src/types/GamesWeeklyQuiz";
import type { Candidate, CompetitionFamily, CareerProfile, PlayerClue } from "./types";
import { unique, competitionFamilyFromId, shuffle, combinations, WHOS_THE_PLAYER_MAX_CLUE_SETS, WHOS_THE_PLAYER_MIN_SIGNIFICANT_GOALS, playerIdentityKey, createChoiceSetFromExactDistractors, semanticFingerprint, snapshot, WHOS_THE_PLAYER_MAX_CANDIDATES, deduplicateCandidates, normalizeKey, sameCompetitionFamily, competitionNameFromId, classifyRelevantAward, normalizeText } from "./utils";

/* ============================================================
 * WHO'S THE PLAYER: three/four historical clues, one unique solution.
 * ============================================================ */

export function generateWhosThePlayerCandidates(
  kb: WeeklyQuizKnowledgeBase,
  recentFingerprints: Set<string>,
): Candidate[] {
  const profiles = buildCareerProfiles(kb);
  const result: Candidate[] = [];

  /*
   * Questa parte del motore è la più costosa. La Weekly Challenge usa una
   * sola domanda "Who's the Player", quindi non serve costruire centinaia di
   * candidati per poi scartarli. Precalcoliamo una sola volta i profili per
   * famiglia di competizione e ci fermiamo dopo un piccolo pool di candidati
   * validi e non usati di recente.
   */
  const families = unique(
    profiles.flatMap((profile) =>
      profile.historical.map((row) =>
        competitionFamilyFromId(row.competitionId),
      ),
    ),
  );

  const scopedProfilesByFamily = new Map<CompetitionFamily, CareerProfile[]>();
  for (const family of families) {
    const titleLookup = buildPlayerPalmaresLookup(kb, family);
    scopedProfilesByFamily.set(
      family,
      profiles
        .map((profile) =>
          scopeCareerProfile(
            profile,
            family,
            titleLookup,
          ),
        )
        .filter((profile) => profile.historical.length > 0),
    );
  }

  const answerLabels = new Map<string, string>();
  for (const profile of profiles) {
    const label = formatCareerProfileAnswer(profile, profiles);
    if (label) {
      answerLabels.set(profile.player.playerId, label);
    }
  }

  const shuffledFamilies = shuffle(families);
  for (const family of shuffledFamilies) {
    const scopedProfiles = scopedProfilesByFamily.get(family) ?? [];
    if (scopedProfiles.length < 4) continue;

    for (const target of shuffle(scopedProfiles)) {
      const targetLabel = answerLabels.get(target.player.playerId);
      if (!targetLabel) continue;

      const clues = buildCluesForTarget(target).filter(
        (clue) => clue.source !== "current",
      );

      const clueSets = [4, 3]
        .flatMap((clueCount) =>
          combinations(clues, clueCount).filter((set) => {
            const categories = new Set(set.map((clue) => clue.category));
            return categories.size === clueCount;
          }),
        )
        .sort((first, second) =>
          clueSetPriority(second) - clueSetPriority(first),
        )
        .slice(0, WHOS_THE_PLAYER_MAX_CLUE_SETS);

      for (const clueSet of clueSets) {
        const compatible = scopedProfiles.filter((profile) =>
          clueSet.every((clue) => clue.matches(profile)),
        );
        if (
          compatible.length !== 1 ||
          compatible[0].player.playerId !== target.player.playerId
        ) {
          continue;
        }

        const hasSignificantGoalsClue = clueSet.some(
          (clue) => clue.category === "season_goals",
        );

        const distractors = scopedProfiles
          .filter((profile) => profile.player.playerId !== target.player.playerId)
          .filter(
            (profile) =>
              !hasSignificantGoalsClue ||
              !isGoalkeeperProfile(profile) ||
              maxHistoricalGoals(profile) >= WHOS_THE_PLAYER_MIN_SIGNIFICANT_GOALS,
          )
          .map((profile) => ({
            profile,
            score: clueSet.filter((clue) => clue.matches(profile)).length,
          }))
          .sort((first, second) => second.score - first.score);

        const minimumDistractorScore = clueSet.length === 4 ? 2 : 1;
        if (
          distractors.filter((item) => item.score >= minimumDistractorScore).length < 2
        ) {
          continue;
        }

        const chosenDistractors: typeof distractors = [];
        const usedIdentityKeys = new Set<string>([playerIdentityKey(target.player)]);
        for (const item of distractors) {
          const identityKey = playerIdentityKey(item.profile.player);
          if (usedIdentityKeys.has(identityKey)) continue;
          const label = answerLabels.get(item.profile.player.playerId);
          if (!label) continue;
          chosenDistractors.push(item);
          usedIdentityKeys.add(identityKey);
          if (chosenDistractors.length === 3) break;
        }
        if (chosenDistractors.length < 3) continue;

        const distractorLabels = chosenDistractors
          .map((item) => answerLabels.get(item.profile.player.playerId))
          .filter((value): value is string => value !== undefined);
        if (distractorLabels.length < 3) continue;

        const choiceSet = createChoiceSetFromExactDistractors(
          targetLabel,
          distractorLabels,
        );
        if (!choiceSet) continue;

        const competitionIds = unique(
          target.historical.map((row) => row.competitionId),
        );
        const seasonIds = unique(
          target.historical.map((row) => row.seasonId),
        );
        const fingerprint = semanticFingerprint(
          "whos_the_player",
          family,
          target.player.playerId,
          ...clueSet.map((clue) => clue.key).sort(),
        );

        /* Evitiamo di spendere lavoro per candidati che verranno poi scartati. */
        if (recentFingerprints.has(fingerprint)) {
          continue;
        }

        result.push({
          challengeType: "whos_the_player",
          kind: "multiple_choice",
          questionFamily: "whos_the_player",
          difficulty: "hard",
          prompt: `Chi è il giocatore?\n${clueSet
            .map((clue, index) => `${index + 1}. ${clue.text}`)
            .join("\n")}`,
          answers: choiceSet.answers,
          correctAnswerIndex: choiceSet.correctAnswerIndex,
          explanation: `Risposta individuata nell’archivio: ${targetLabel}. Riscontri utilizzati: ${clueSet.map((clue) => clue.text).join(" ")}. I dati sono quelli storici registrati per la competizione; eventuali lacune nell’archivio devono essere verificate prima della pubblicazione.`,
          fingerprint,
          sourceSnapshot: snapshot(kb, {
            competitionIds,
            seasonIds,
            playerIds: [
              target.player.playerId,
              ...chosenDistractors.map((item) => item.profile.player.playerId),
            ],
            teamIds: unique([
              ...target.historical.map((row) => row.teamId ?? ""),
            ]),
            facts: {
              family: "whos_the_player",
              competitionFamily: family,
              correctPlayer: target.player.displayName,
              clue1: clueSet[0].text,
              clue2: clueSet[1].text,
              clue3: clueSet[2].text,
              clue4: clueSet[3]?.text ?? null,
              distractor1Matches: chosenDistractors[0].score,
              distractor2Matches: chosenDistractors[1].score,
              distractor3Matches: chosenDistractors[2].score,
            },
          }),
        });

        if (result.length >= WHOS_THE_PLAYER_MAX_CANDIDATES) {
          return deduplicateCandidates(result);
        }
        break;
      }
    }
  }

  return deduplicateCandidates(result);
}

export function buildCareerProfiles(kb: WeeklyQuizKnowledgeBase): CareerProfile[] {
  const profiles = new Map<string, CareerProfile>();

  const ensure = (player: QuizPlayerIdentity) => {
    const canonicalId = player.playerId.trim();
    if (!canonicalId) return null;
    const existing = profiles.get(canonicalId);
    if (existing) {
      if (existing.player.birthYear === undefined && player.birthYear !== undefined) {
        existing.player.birthYear = player.birthYear;
      }
      if (!existing.player.role && player.role) existing.player.role = player.role;
      if (!existing.player.photoUrl && player.photoUrl) existing.player.photoUrl = player.photoUrl;
      return existing;
    }
    const created: CareerProfile = {
      player: { ...player, playerId: canonicalId },
      historical: [],
      current: [],
      awards: [],
      titleCount: 0,
    };
    profiles.set(canonicalId, created);
    return created;
  };

  for (const row of kb.historicalPlayerSeasons) {
    // Essere presenti in una rosa o in un documento statistico non prova
    // di aver giocato una stagione: evitiamo indizi su presenze fittizie.
    if (!Number.isFinite(row.appearances) || row.appearances <= 0) continue;
    if (!row.seasonId.trim() || !row.competitionId.trim()) continue;
    ensure(row.player)?.historical.push(row);
  }
  for (const row of kb.currentPlayers) {
    ensure(row.player)?.current.push(row);
  }

  for (const award of kb.historicalAwards) {
    if (!award.playerName) continue;

    if (award.playerId) {
      const exact = profiles.get(award.playerId);
      if (exact) exact.awards.push(award);
      continue;
    }

    const candidates = Array.from(profiles.values()).filter(
      (profile) =>
        normalizeKey(profile.player.displayName) === normalizeKey(award.playerName ?? "") &&
        (award.birthYear === undefined || profile.player.birthYear === award.birthYear),
    );

    const seasonCandidates = candidates.filter((profile) =>
      profile.historical.some(
        (row) =>
          row.seasonId === award.seasonId &&
          sameCompetitionFamily(row.competitionId, award.competitionId) &&
          (!award.teamId || row.teamId === award.teamId) &&
          (!award.teamName ||
            normalizeKey(row.teamName ?? "") === normalizeKey(award.teamName)),
      ),
    );

    const resolved = seasonCandidates.length === 1
      ? seasonCandidates[0]
      : candidates.length === 1
        ? candidates[0]
        : undefined;

    if (resolved) resolved.awards.push(award);
  }

  return Array.from(profiles.values()).filter(
    (profile) => profile.player.displayName.trim(),
  );
}

/**
 * I titoli appartengono al palmarès INDIVIDUALE del giocatore.
 * Non vanno attribuiti automaticamente a tutta la rosa di una squadra
 * vincitrice: una squadra può avere più trofei di un singolo giocatore.
 */
export function buildPlayerPalmaresLookup(
  kb: WeeklyQuizKnowledgeBase,
  family: CompetitionFamily,
): Map<string, Set<string>> {
  const titlesByPlayerId = new Map<string, Set<string>>();

  for (const title of kb.historicalPlayerPalmaresTitles ?? []) {
    if (competitionFamilyFromId(title.competitionId) !== family) continue;
    const playerId = title.playerId.trim();
    if (!playerId) continue;
    const titleKey = [
      title.competitionId,
      title.seasonId,
      title.phase,
      normalizeKey(title.title),
    ].join("::");
    const titles = titlesByPlayerId.get(playerId) ?? new Set<string>();
    titles.add(titleKey);
    titlesByPlayerId.set(playerId, titles);
  }

  return titlesByPlayerId;
}

export function scopeCareerProfile(
  profile: CareerProfile,
  family: CompetitionFamily,
  playerPalmaresLookup: Map<string, Set<string>>,
): CareerProfile {
  const historical = profile.historical.filter(
    (row) => competitionFamilyFromId(row.competitionId) === family,
  );
  const current = profile.current.filter(
    (row) => competitionFamilyFromId(row.team.competitionId) === family,
  );
  const awards = profile.awards.filter(
    (award) => competitionFamilyFromId(award.competitionId) === family,
  );

  return {
    player: profile.player,
    historical,
    current,
    awards,
    titleCount: playerPalmaresLookup.get(profile.player.playerId)?.size ?? 0,
  };
}

export function buildCluesForTarget(target: CareerProfile): PlayerClue[] {
  const clues: PlayerClue[] = [];

  const teamAppearances = new Map<string, { teamName: string; appearances: number }>();
  for (const row of target.historical) {
    const teamName = row.teamName?.trim();
    if (!teamName) continue;
    const key = normalizeKey(teamName);
    const previous = teamAppearances.get(key);
    teamAppearances.set(key, {
      teamName: previous?.teamName ?? teamName,
      appearances: (previous?.appearances ?? 0) + row.appearances,
    });
  }

  for (const { teamName } of [...teamAppearances.values()]
    .sort((first, second) => second.appearances - first.appearances)
    .slice(0, 3)) {
    clues.push({
      key: `historical_team:${normalizeKey(teamName)}`,
      category: "team",
      source: "historical",
      text: `Ha giocato nel ${teamName}.`,
      priority: 700,
      matches: (profile) =>
        profile.historical.some(
          (row) => normalizeKey(row.teamName ?? "") === normalizeKey(teamName),
        ),
    });
  }

  for (const row of [...target.historical]
    .filter((item) => item.goals >= WHOS_THE_PLAYER_MIN_SIGNIFICANT_GOALS)
    .sort((first, second) => second.goals - first.goals)
    .slice(0, 3)) {
    const competitionName = competitionNameFromId(row.competitionId);
    clues.push({
      key: `historical_goals:${row.competitionId}:${row.seasonId}:${row.goals}`,
      category: "season_goals",
      source: "historical",
      text: `Ha realizzato ${row.goals} gol nella ${competitionName} ${row.seasonName}.`,
      priority: 1000 + Math.min(row.goals, 100),
      matches: (profile) =>
        profile.historical.some(
          (item) =>
            item.competitionId === row.competitionId &&
            item.seasonId === row.seasonId &&
            item.goals === row.goals,
        ),
    });
  }

  const competitions = unique(target.historical.map((row) => row.competitionId));
  for (const competitionId of competitions) {
    const editions = new Set(
      target.historical
        .filter((row) => row.competitionId === competitionId)
        .map((row) => row.seasonId),
    ).size;
    if (editions < 2) continue;
    const competitionName = competitionNameFromId(competitionId);
    clues.push({
      key: `editions:${competitionId}:${editions}`,
      category: "editions",
      source: "career",
      // L'archivio potrebbe non contenere tutte le stagioni della carriera:
      // non scrivere mai "SOLO" o "ESATTAMENTE" come dato assoluto.
      text: `Nell'archivio risultano ${editions} stagioni disputate nella ${competitionName}.`,
      priority: 820,
      matches: (profile) =>
        new Set(
          profile.historical
            .filter((row) => row.competitionId === competitionId)
            .map((row) => row.seasonId),
        ).size === editions,
    });
  }

  for (const family of ["top_scorer", "best_player", "best_goalkeeper"] as const) {
    const count = target.awards.filter(
      (award) => classifyRelevantAward(award) === family,
    ).length;
    if (count === 0) continue;
    const label =
      family === "top_scorer"
        ? "titolo di capocannoniere"
        : family === "best_goalkeeper"
          ? "premio di miglior portiere"
          : "premio di miglior giocatore";
    clues.push({
      key: `award:${family}:${count}`,
      category: "award",
      source: "career",
      text: `Ha conquistato ${count} ${count === 1 ? "volta" : "volte"} il ${label}.`,
      priority: 950,
      matches: (profile) =>
        profile.awards.filter(
          (award) => classifyRelevantAward(award) === family,
        ).length === count,
    });
  }

  if (target.titleCount > 0) {
    clues.push({
      key: `titles:${target.titleCount}`,
      category: "titles",
      source: "career",
      // Dato esclusivo del palmarès personale salvato nell'anagrafica.
      text: `Nel suo palmarès risultano ${target.titleCount} ${target.titleCount === 1 ? "titolo" : "titoli"} conquistati.`,
      priority: 900,
      matches: (profile) => profile.titleCount === target.titleCount,
    });
  }
  return clues;
}

export function clueSetPriority(clues: PlayerClue[]): number {
  return clues.reduce(
    (total, clue) => total + clue.priority,
    0,
  );
}

export function maxHistoricalGoals(profile: CareerProfile): number {
  return profile.historical.reduce(
    (maximum, row) => Math.max(maximum, row.goals),
    0,
  );
}

export function isGoalkeeperProfile(profile: CareerProfile): boolean {
  const roles = [
    profile.player.role,
    ...profile.historical.map((row) => row.player.role),
    ...profile.current.map((row) => row.player.role),
  ]
    .map((role) => normalizeText(role ?? ""))
    .filter(Boolean);

  return roles.some((role) => /portiere|goalkeeper|keeper/.test(role));
}

export function formatCareerProfileAnswer(
  profile: CareerProfile,
  allProfiles: CareerProfile[],
): string | null {
  const playerName = profile.player.displayName.trim();
  if (!playerName) return null;

  const homonyms = allProfiles.filter(
    (candidate) =>
      normalizeKey(candidate.player.displayName) === normalizeKey(playerName) &&
      playerIdentityKey(candidate.player) !== playerIdentityKey(profile.player),
  );

  if (homonyms.length === 0) return playerName;
  if (profile.player.birthYear === undefined) return null;
  if (homonyms.some((candidate) => candidate.player.birthYear === undefined)) return null;
  if (homonyms.some((candidate) => candidate.player.birthYear === profile.player.birthYear)) {
    return null;
  }

  return `${playerName} (${profile.player.birthYear})`;
}
