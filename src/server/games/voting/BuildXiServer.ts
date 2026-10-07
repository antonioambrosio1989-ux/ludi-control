import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import * as XLSX from "xlsx";

import { adminDb } from "@/src/lib/firebaseAdmin";
import {
  asRecord,
  emptyRoleCounts,
  isVotingType,
  mapVotingPoll,
  parseBuildXiRole,
  readStringArray,
} from "@/src/server/games/voting/GamesVotingMappers";
import {
  buildScorePredictionAdminResult,
} from "@/src/server/games/voting/ScorePredictionVotingResults";
import {
  buildScorePredictionPublicResult,
} from "@/src/services/games/voting/ScorePredictionPublicResults";
import {
  normalizeScorePredictionScore,
  resolveScorePredictionScorerId,
  validateScorePredictionScorerOptions,
} from "@/src/services/games/voting/ScorePredictionRules";
import {
  assertScorePredictionMatchIdentity,
  resolveScorePredictionLifecycle,
} from "@/src/services/games/voting/ScorePredictionLifecycleRules";
import {
  canonicalizeManOfTheMatchCandidates,
  validateManOfTheMatchReady,
} from "@/src/services/games/voting/ManOfTheMatchRules";
import {
  buildManOfTheMatchVotingResult,
} from "@/src/services/games/voting/ManOfTheMatchResults";
import {
  buildManOfTheMatchPublicResult,
} from "@/src/services/games/voting/ManOfTheMatchPublicResults";
import {
  assertManOfTheMatchMatchIdentity,
} from "@/src/services/games/voting/ManOfTheMatchLifecycleRules";
import {
  normalizeCeremonyAwardCandidates,
  normalizeCeremonyAwardName,
  validateCeremonyAwardReady,
} from "@/src/services/games/voting/CeremonyAwardRules";
import {
  buildCeremonyAwardVotingResult,
} from "@/src/services/games/voting/CeremonyAwardResults";
import {
  buildCeremonyAwardPublicResult,
} from "@/src/services/games/voting/CeremonyAwardPublicResults";
import {
  resolveCeremonyAwardMaintenanceOperation,
} from "@/src/services/games/voting/CeremonyAwardMaintenanceRules";
import {
  BEST_OF_MONTH_KEYS,
  listBestOfMonthPlayerOptions,
  removeBestOfMonthGeneratedAchievements,
} from "@/src/server/games/voting/BestOfMonthVotingService";
import {
  assertBestOfMonthMaintenanceCanStart,
  type BestOfMonthMaintenanceOperation,
} from "@/src/services/games/voting/BestOfMonthMaintenanceRules";
import {
  assertBuildXiCandidateSnapshot,
  assertBuildXiLineup,
} from "@/src/services/games/voting/BuildXiRules";
import {
  assertBuildXiPublicationSnapshotUnchanged,
  applyBuildXiPublicationFutSnapshots,
} from "@/src/services/games/voting/BuildXiPublicationRules";
import {
  buildBuildXiFutSnapshot,
} from "@/src/services/games/voting/BuildXiFutSnapshot";
import {
  buildBuildXiVotingResults,
} from "@/src/services/games/voting/BuildXiVotingResults";
import {
  buildBestOfMonthPublicWinners,
  sanitizePublicVotingPoll,
} from "@/src/services/games/voting/BestOfMonthPublicResults";
import {
  assertBestOfMonthAwardReady,
  isBestOfMonthConfigReady,
  resolveBestOfMonthEffectiveStatus,
} from "@/src/services/games/voting/BestOfMonthRules";

export {
  finalizeBestOfMonthAward,
} from "@/src/server/games/voting/BestOfMonthVotingService";
import {
  BEST_OF_MONTH_AWARD_LABELS,
  BUILD_XI_REQUIRED_ROLE_COUNTS,
  BUILD_XI_ROLE_LABELS,
  type BestOfMonthAwardKey,
  type BestOfMonthConfig,
  type BuildXiCandidate,
  type BuildXiLineup,
  type BuildXiRole,
  type BuildXiTieBreakDecisions,
  type CeremonyAwardConfig,
  type GamesVotingPoll,
  type ManOfTheMatchConfig,
  type ScorePredictionConfig,
  type VotingAdminResults,
  type VotingCandidate,
  type VotingMatchOption,
  type VotingStatus,
  type VotingType,
} from "@/src/types/GamesVoting";

const POLLS = "gamesVotingPolls";
/* Nome storico mantenuto per non perdere le submission BUILD XI esistenti. */
const SUBMISSIONS = "gamesBuildXiSubmissions";
const ELIGIBILITY_RATE = 0.6;
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
type PlainDoc = { id: string; data: Record<string, unknown> };

type CompetitionIdentity = {
  competitionId: string;
  competitionName: string;
  seasonId: string;
  seasonName: string;
};

export async function listVotingPolls(gameId: string): Promise<GamesVotingPoll[]> {
  const snapshot = await adminDb.collection(POLLS).where("gameId", "==", gameId).get();
  return snapshot.docs
    .map((document) => mapVotingPoll(document.id, document.data()))
    .filter((poll) => poll.status !== "archived")
    .sort(
      (a, b) =>
        a.displayOrder - b.displayOrder ||
        a.title.localeCompare(b.title, "it"),
    );
}

export async function listPublicVotingPolls(
  gameId:
    string,
) {
  const now =
    Date.now();

  const polls =
    await listVotingPolls(
      gameId,
    );

  const refreshedPolls =
    await Promise.all(
      polls.map(
        async (
          poll,
        ) =>
          refreshManOfTheMatchMatchSnapshot(
            await refreshScorePredictionMatchSnapshot(
              poll,
            ),
          ),
      ),
    );

  return refreshedPolls.map(
    (
      poll,
    ) => {
      const status =
        getEffectiveVotingStatus(
          poll,
          now,
        );

      const publicPoll =
        sanitizePublicVotingPoll(
          poll,
        );

      return {
        ...publicPoll,
        status,
        isClickable:
          poll.type ===
            "best_of_the_month" ||
          status ===
            "published" ||
          status ===
            "closed",
      };
    },
  );
}

export async function reorderVotingPolls(
  gameId: string,
  orderedPollIds: string[],
): Promise<void> {
  const normalizedGameId = gameId.trim();
  const normalizedIds = orderedPollIds
    .map((pollId) => pollId.trim())
    .filter(Boolean);

  const currentPolls = await listVotingPolls(normalizedGameId);
  const currentIds = currentPolls.map((poll) => poll.id);

  if (
    normalizedIds.length !== currentIds.length ||
    new Set(normalizedIds).size !== normalizedIds.length ||
    currentIds.some((pollId) => !normalizedIds.includes(pollId))
  ) {
    throw new Error("INVALID_VOTING_ORDER");
  }

  const batch = adminDb.batch();

  normalizedIds.forEach((pollId, index) => {
    batch.update(
      adminDb.collection(POLLS).doc(pollId),
      {
        displayOrder: index,
        updatedAt: FieldValue.serverTimestamp(),
      },
    );
  });

  await batch.commit();
}

export async function getVotingPoll(pollId: string): Promise<GamesVotingPoll> {
  const snapshot = await adminDb.collection(POLLS).doc(pollId).get();
  if (!snapshot.exists) throw new Error("VOTING_NOT_FOUND");
  return mapVotingPoll(snapshot.id, snapshot.data() ?? {});
}

export async function createVotingPoll(input: {
  gameId: string;
  title: string;
  description?: string;
  competitionId?: string;
  type: VotingType;
  createdBy: string;
}): Promise<string> {
  const title = input.title.trim();
  const description = input.description?.trim() ?? "";
  if (!title) throw new Error("TITLE_REQUIRED");
  if (!isVotingType(input.type)) throw new Error("INVALID_VOTING_TYPE");

  const requiresCompetition = ["build_xi", "best_of_the_month"].includes(input.type);
  const requestedCompetitionId = input.competitionId?.trim() ?? "";
  if (requiresCompetition && !requestedCompetitionId) {
    throw new Error("ACTIVE_COMPETITION_REQUIRED");
  }

  const identity = requestedCompetitionId
    ? await resolveCompetitionIdentity(requestedCompetitionId)
    : emptyCompetitionIdentity();

  if (input.type === "build_xi") {
    const duplicate = (await listVotingPolls(input.gameId)).find(
      (poll) => poll.competitionId === identity.competitionId &&
        poll.seasonId === identity.seasonId &&
        poll.type === "build_xi" &&
        !["closed", "archived"].includes(poll.status),
    );
    if (duplicate) throw new Error("DUPLICATE_BUILD_XI");
  }

  const reference = adminDb.collection(POLLS).doc();
  const nextDisplayOrder = (await listVotingPolls(input.gameId)).length;

  await reference.set({
    gameId: input.gameId,
    title,
    description,
    type: input.type,
    ...identity,
    competitionIds: identity.competitionId ? [identity.competitionId] : [],
    competitionNames: identity.competitionName ? [identity.competitionName] : [],
    status: "setup",
    displayOrder: nextDisplayOrder,
    candidateCount: 0,
    roleCounts: emptyRoleCounts(),
    eligibilityRate: ELIGIBILITY_RATE,
    createdBy: input.createdBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return reference.id;
}

export async function createBuildXiPoll(input: {
  gameId: string;
  title: string;
  description?: string;
  competitionId: string;
  createdBy: string;
}): Promise<string> {
  return createVotingPoll({ ...input, type: "build_xi" });
}

export async function updateVotingMetadata(
  pollId: string,
  input: { title?: string; description?: string; competitionId?: string },
): Promise<void> {
  const reference = adminDb.collection(POLLS).doc(pollId);
  const snapshot = await reference.get();
  if (!snapshot.exists) throw new Error("VOTING_NOT_FOUND");

  const poll = mapVotingPoll(snapshot.id, snapshot.data() ?? {});
  const title = input.title === undefined ? undefined : input.title.trim();
  if (title !== undefined && !title) throw new Error("TITLE_REQUIRED");

  let competitionUpdate: Record<string, unknown> = {};
  if (poll.type === "best_of_the_month" && input.competitionId !== undefined) {
    const requestedCompetitionId = input.competitionId.trim();
    if (!requestedCompetitionId) throw new Error("ACTIVE_COMPETITION_REQUIRED");
    const identity = await resolveCompetitionIdentity(requestedCompetitionId);
    competitionUpdate = {
      ...identity,
      competitionIds: [identity.competitionId],
      competitionNames: [identity.competitionName],
    };
  }

  await reference.update({
    ...(title !== undefined ? { title } : {}),
    ...(input.description !== undefined ? { description: input.description.trim() } : {}),
    ...competitionUpdate,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function updateBestOfMonthConfig(
  pollId: string,
  input: {
    monthKey: string;
    opensAtMs: number;
    awards: Partial<Record<BestOfMonthAwardKey, VotingCandidate[]>>;
  },
): Promise<void> {
  const poll = await getVotingPoll(pollId);
  assertEditableType(poll, "best_of_the_month");
  if (!poll.competitionId) throw new Error("ACTIVE_COMPETITION_REQUIRED");

  const monthKey = input.monthKey.trim();
  if (!/^\d{4}-\d{2}$/.test(monthKey)) throw new Error("INVALID_MONTH");
  const opensAtMs = Number(input.opensAtMs);
  if (!Number.isFinite(opensAtMs) || opensAtMs <= 0) throw new Error("INVALID_VOTING_WINDOW");
  const closesAtMs = opensAtMs + FIVE_DAYS_MS;

  const awards = Object.fromEntries(
    BEST_OF_MONTH_KEYS.map((key) => [
      key,
      {
        key,
        title: BEST_OF_MONTH_AWARD_LABELS[key],
        candidates: normalizeCandidates(input.awards[key] ?? [], 0),
      },
    ]),
  ) as BestOfMonthConfig["awards"];

  const monthLabel = formatMonthLabel(monthKey);

  await adminDb.collection(POLLS).doc(pollId).update({
    bestOfMonthDecisions: FieldValue.delete(),
    bestOfMonth: {
      monthKey,
      monthLabel,
      opensAtMs,
      closesAtMs,
      awards,
    },
    status:
      isBestOfMonthConfigReady(
        awards,
      )
        ? "ready"
        : "setup",
    updatedAt: FieldValue.serverTimestamp(),
  });
}


export async function updateScorePredictionConfig(
  pollId: string,
  input: {
    matchId: string;
    posterImageUrl?: string;
    scorerOptions: VotingCandidate[];
  },
): Promise<void> {
  const poll = await getVotingPoll(pollId);
  assertEditableType(poll, "score_prediction");

  const match =
    await requireVotingMatch(
      input.matchId,
      true,
    );

  const posterImageUrl =
    String(
      input.posterImageUrl ??
        "",
    ).trim();

  const scorerOptions =
    normalizeCandidates(
      input.scorerOptions,
      0,
    );

  validateScorePredictionScorerOptions(
    scorerOptions,
  );

  await adminDb.collection(POLLS).doc(pollId).update({
    scorePrediction: {
      match,
      ...(posterImageUrl ? { posterImageUrl } : {}),
      scorerOptions,
    } satisfies ScorePredictionConfig,
    ...competitionIdentityFromMatch(match),
    competitionIds: [match.competitionId],
    competitionNames: [match.competitionName],
    status: scorerOptions.length > 0 && Boolean(posterImageUrl) ? "ready" : "setup",
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function updateManOfTheMatchConfig(
  pollId: string,
  input: {
    matchId: string;
    candidates: VotingCandidate[];
  },
): Promise<void> {
  const poll = await getVotingPoll(pollId);
  assertEditableType(poll, "man_of_the_match");

  const match =
    await requireVotingMatch(
      input.matchId,
      false,
    );

  const requestedCandidates =
    normalizeCandidates(
      input.candidates,
      0,
    );

  if (
    requestedCandidates.length >
    4
  ) {
    throw new Error(
      "MOTM_EXACTLY_FOUR",
    );
  }

  const eligibleCandidates =
    await getMatchVotingPlayerCandidates(
      match.id,
      "roster",
    );

  const candidates =
    canonicalizeManOfTheMatchCandidates({
      requestedCandidates,
      eligibleCandidates,
      homeTeamId:
        match.homeTeamId,
      awayTeamId:
        match.awayTeamId,
    });

  await adminDb.collection(POLLS).doc(pollId).update({
    manOfTheMatch: { match, candidates } satisfies ManOfTheMatchConfig,
    ...competitionIdentityFromMatch(match),
    competitionIds: [match.competitionId],
    competitionNames: [match.competitionName],
    status: candidates.length === 4 ? "ready" : "setup",
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function updateCeremonyAwardConfig(
  pollId: string,
  input: {
    awardName: string;
    candidates: VotingCandidate[];
  },
): Promise<void> {
  const poll = await getVotingPoll(pollId);
  assertEditableType(poll, "ceremony_award");

  const awardName =
    normalizeCeremonyAwardName(
      input.awardName,
    );

  const candidates =
    normalizeCeremonyAwardCandidates(
      normalizeCandidates(
        input.candidates,
        0,
      ),
    );

  await adminDb.collection(POLLS).doc(pollId).update({
    ceremonyAward: {
      awardName,
      candidates,
    } satisfies CeremonyAwardConfig,
    status:
      candidates.length >=
      2
        ? "ready"
        : "setup",
    updatedAt:
      FieldValue.serverTimestamp(),
  });
}


export async function resetVotingPoll(
  pollId:
    string,
): Promise<void> {
  const reference =
    adminDb
      .collection(
        POLLS,
      )
      .doc(
        pollId,
      );

  const initialSnapshot =
    await reference.get();

  if (
    !initialSnapshot.exists
  ) {
    throw new Error(
      "VOTING_NOT_FOUND",
    );
  }

  const initialPoll =
    mapVotingPoll(
      initialSnapshot.id,
      initialSnapshot.data() ??
        {},
    );

  if (
    initialPoll.type ===
    "best_of_the_month"
  ) {
    await beginBestOfMonthMaintenance(
      pollId,
      "reset",
    );
  }

  if (
    initialPoll.type ===
    "ceremony_award"
  ) {
    await beginCeremonyAwardMaintenance(
      pollId,
      "reset",
    );
  }

  /*
   * Rileggiamo dopo il lock: in caso di retry usiamo sempre lo
   * snapshot autorevole con le decisioni ancora presenti, così la
   * rimozione degli achievement resta idempotente.
   */
  const lockedSnapshot =
    await reference.get();

  if (
    !lockedSnapshot.exists
  ) {
    throw new Error(
      "VOTING_NOT_FOUND",
    );
  }

  const poll =
    mapVotingPoll(
      lockedSnapshot.id,
      lockedSnapshot.data() ??
        {},
    );

  await removeBestOfMonthGeneratedAchievements(
    poll,
  );

  await deleteVotingSubmissions(
    pollId,
  );

  await reference.update({
    status:
      "setup",
    candidates:
      FieldValue.delete(),
    candidateCount:
      0,
    roleCounts:
      emptyRoleCounts(),
    bestOfMonth:
      FieldValue.delete(),
    bestOfMonthDecisions:
      FieldValue.delete(),
    bestOfMonthMaintenanceOperation:
      FieldValue.delete(),
    scorePrediction:
      FieldValue.delete(),
    manOfTheMatch:
      FieldValue.delete(),
    ceremonyAward:
      FieldValue.delete(),
    ceremonyAwardMaintenanceOperation:
      FieldValue.delete(),
    ...([
      "build_xi",
      "best_of_the_month",
    ].includes(
      poll.type,
    )
      ? {}
      : {
          competitionId:
            "",
          competitionName:
            "Ludi Experience",
          competitionIds:
            [],
          competitionNames:
            [],
          seasonId:
            "",
          seasonName:
            "",
        }),
    snapshotCreatedAt:
      FieldValue.delete(),
    publishedAt:
      FieldValue.delete(),
    closedAt:
      FieldValue.delete(),
    updatedAt:
      FieldValue.serverTimestamp(),
  });
}

export async function deleteVotingPoll(
  pollId:
    string,
): Promise<void> {
  const reference =
    adminDb
      .collection(
        POLLS,
      )
      .doc(
        pollId,
      );

  const initialSnapshot =
    await reference.get();

  if (
    !initialSnapshot.exists
  ) {
    throw new Error(
      "VOTING_NOT_FOUND",
    );
  }

  const initialPoll =
    mapVotingPoll(
      initialSnapshot.id,
      initialSnapshot.data() ??
        {},
    );

  if (
    initialPoll.type ===
    "best_of_the_month"
  ) {
    await beginBestOfMonthMaintenance(
      pollId,
      "delete",
    );
  }

  if (
    initialPoll.type ===
    "ceremony_award"
  ) {
    await beginCeremonyAwardMaintenance(
      pollId,
      "delete",
    );
  }

  const lockedSnapshot =
    await reference.get();

  if (
    !lockedSnapshot.exists
  ) {
    return;
  }

  const poll =
    mapVotingPoll(
      lockedSnapshot.id,
      lockedSnapshot.data() ??
        {},
    );

  await removeBestOfMonthGeneratedAchievements(
    poll,
  );

  await deleteVotingSubmissions(
    pollId,
  );

  await adminDb.recursiveDelete(
    reference,
  );
}

async function beginCeremonyAwardMaintenance(
  pollId:
    string,
  operation:
    "reset" |
    "delete",
): Promise<void> {
  const reference =
    adminDb
      .collection(
        POLLS,
      )
      .doc(
        pollId,
      );

  await adminDb.runTransaction(
    async (
      transaction,
    ) => {
      const snapshot =
        await transaction.get(
          reference,
        );

      if (
        !snapshot.exists
      ) {
        if (
          operation ===
          "delete"
        ) {
          return;
        }

        throw new Error(
          "VOTING_NOT_FOUND",
        );
      }

      const data =
        snapshot.data() ??
        {};

      const poll =
        mapVotingPoll(
          snapshot.id,
          data,
        );

      if (
        poll.type !==
        "ceremony_award"
      ) {
        return;
      }

      const currentOperation =
        String(
          data.ceremonyAwardMaintenanceOperation ??
          "",
        ).trim();

      const resolution =
        resolveCeremonyAwardMaintenanceOperation({
          currentOperation,
          requestedOperation:
            operation,
        });

      if (
        resolution ===
        "conflict"
      ) {
        throw new Error(
          "VOTING_MAINTENANCE_IN_PROGRESS",
        );
      }

      if (
        resolution ===
        "already_started"
      ) {
        return;
      }

      /*
       * Impostare closed nello stesso lock impedisce nuove submission
       * mentre reset/delete sta cancellando quelle esistenti.
       */
      transaction.update(
        reference,
        {
          status:
            "closed",
          ceremonyAwardMaintenanceOperation:
            operation,
          updatedAt:
            FieldValue.serverTimestamp(),
        },
      );
    },
  );
}

async function beginBestOfMonthMaintenance(
  pollId:
    string,
  operation:
    BestOfMonthMaintenanceOperation,
): Promise<void> {
  const reference =
    adminDb
      .collection(
        POLLS,
      )
      .doc(
        pollId,
      );

  await adminDb.runTransaction(
    async (
      transaction,
    ) => {
      const snapshot =
        await transaction.get(
          reference,
        );

      if (
        !snapshot.exists
      ) {
        throw new Error(
          "VOTING_NOT_FOUND",
        );
      }

      const data =
        snapshot.data() ??
        {};

      const poll =
        mapVotingPoll(
          snapshot.id,
          data,
        );

      if (
        poll.type !==
        "best_of_the_month"
      ) {
        return;
      }

      assertBestOfMonthMaintenanceCanStart({
        current:
          data.bestOfMonthMaintenanceOperation,
        requested:
          operation,
      });

      transaction.update(
        reference,
        {
          bestOfMonthMaintenanceOperation:
            operation,
          updatedAt:
            FieldValue.serverTimestamp(),
        },
      );
    },
  );
}

async function deleteVotingSubmissions(pollId: string): Promise<void> {
  const snapshot = await adminDb.collection(SUBMISSIONS).where("votingId", "==", pollId).get();
  for (const document of snapshot.docs) {
    await adminDb.recursiveDelete(document.ref);
  }
}

export async function getVotingAdminPreview(pollId: string) {
  const snapshot = await adminDb.collection(POLLS).doc(pollId).get();
  if (!snapshot.exists) throw new Error("VOTING_NOT_FOUND");
  const data = snapshot.data() ?? {};
  const poll = await enrichVotingPollTeamLogos(mapVotingPoll(snapshot.id, data));
  return {
    poll,
    candidates: Array.isArray(data.candidates)
      ? data.candidates as BuildXiCandidate[]
      : [],
    matchOptions: await listVotingMatchOptions(),
    results: await getVotingAdminResults(pollId, poll, data),
    bestOfMonthPlayerOptions: poll.type === "best_of_the_month"
      ? await listBestOfMonthPlayerOptions(poll)
      : [],
  };
}

export async function listVotingMatchOptions(): Promise<VotingMatchOption[]> {
  const [matches, seasons, competitions, teams] = await Promise.all([
    loadCollection("matches"),
    loadCollection("seasons"),
    loadCollection("competitions"),
    loadCollection("teams"),
  ]);

  const activeSeasonIds = new Set(
    seasons
      .filter((entry) => entry.data.status === "active" || entry.data.isCurrent === true)
      .map((entry) => entry.id),
  );
  const seasonById = new Map(seasons.map((entry) => [entry.id, entry.data]));
  const competitionById = new Map(competitions.map((entry) => [entry.id, entry.data]));
  const teamById = new Map(teams.map((entry) => [entry.id, entry.data]));
  const now = Date.now();

  return matches.flatMap((entry) => {
    const data = entry.data;
    const seasonId = String(data.seasonId ?? "");
    if (!activeSeasonIds.has(seasonId) || data.published === false) return [];

    const date = String(data.date ?? "").trim();
    const time = String(data.time ?? "").trim();
    const kickoffAtMs = parseRomeKickoffMs(date, time);
    if (kickoffAtMs === null) return [];

    const homeTeamId = String(data.homeTeamId ?? "");
    const awayTeamId = String(data.awayTeamId ?? "");
    if (!homeTeamId || !awayTeamId) return [];

    const season = seasonById.get(seasonId) ?? {};
    const competitionId = String(data.competitionId ?? season.competitionId ?? "");
    const competition = competitionById.get(competitionId) ?? {};
    const competitionName = String(competition.name ?? competition.shortName ?? competitionId ?? "Competizione");
    const homeTeam = teamById.get(homeTeamId) ?? {};
    const awayTeam = teamById.get(awayTeamId) ?? {};
    const homeTeamName = String(homeTeam.aliasName ?? homeTeam.name ?? homeTeamId);
    const awayTeamName = String(awayTeam.aliasName ?? awayTeam.name ?? awayTeamId);

    return [{
      id: entry.id,
      seasonId,
      competitionId,
      competitionName,
      date,
      time,
      kickoffAtMs,
      homeTeamId,
      homeTeamName,
      ...(homeTeam.logoUrl ? { homeTeamLogoUrl: String(homeTeam.logoUrl) } : {}),
      awayTeamId,
      awayTeamName,
      ...(awayTeam.logoUrl ? { awayTeamLogoUrl: String(awayTeam.logoUrl) } : {}),
      label: `${competitionName} · ${homeTeamName} - ${awayTeamName} · ${formatItalianDate(date)} ${time}`,
      isUpcoming: kickoffAtMs > now,
    } satisfies VotingMatchOption];
  }).sort((a, b) => a.kickoffAtMs - b.kickoffAtMs);
}

export async function getMatchVotingPlayerCandidates(
  matchId: string,
  source: "lineup" | "roster",
): Promise<VotingCandidate[]> {
  const matchReference = adminDb.collection("matches").doc(matchId);
  const matchSnapshot = await matchReference.get();
  if (!matchSnapshot.exists) throw new Error("MATCH_NOT_FOUND");
  const match = matchSnapshot.data() ?? {};
  const homeTeamId = String(match.homeTeamId ?? "");
  const awayTeamId = String(match.awayTeamId ?? "");
  const seasonId = String(match.seasonId ?? "");
  if (!homeTeamId || !awayTeamId || !seasonId) throw new Error("MATCH_NOT_FOUND");

  const [players, teams] = await Promise.all([
    loadCollection("players"),
    loadCollection("teams"),
  ]);
  const playerById = new Map(players.map((entry) => [entry.id, entry.data]));
  const teamById = new Map(teams.map((entry) => [entry.id, entry.data]));

  let playerEntries: Array<{ playerId: string; teamId: string }> = [];

  if (source === "lineup") {
    const lineupSnapshot = await adminDb.collection("matchLineups").doc(matchId).get();
    const lineup = lineupSnapshot.data() ?? {};
    const home = asRecord(lineup.home);
    const away = asRecord(lineup.away);
    playerEntries = [
      ...readStringArray(home.playerIds).map((playerId) => ({ playerId, teamId: homeTeamId })),
      ...readStringArray(away.playerIds).map((playerId) => ({ playerId, teamId: awayTeamId })),
    ];
  } else {
    const rosterSnapshot = await adminDb.collection("seasonPlayers").where("seasonId", "==", seasonId).get();
    playerEntries = rosterSnapshot.docs.flatMap((document) => {
      const data = document.data();
      const teamId = String(data.teamId ?? "");
      const playerId = String(data.playerId ?? "");
      if (
        !playerId ||
        ![homeTeamId, awayTeamId].includes(teamId) ||
        data.status === "inactive" ||
        data.status === "withdrawn" ||
        data.status === "transferred"
      ) return [];
      return [{ playerId, teamId }];
    });
  }

  const seen = new Set<string>();
  return playerEntries.flatMap(({ playerId, teamId }) => {
    if (seen.has(playerId)) return [];
    seen.add(playerId);
    const player = playerById.get(playerId) ?? {};
    const team = teamById.get(teamId) ?? {};
    const firstName = String(player.firstName ?? "").trim();
    const lastName = String(player.lastName ?? "").trim();
    const label = `${firstName} ${lastName}`.trim() || String(player.name ?? playerId);
    const teamName = String(team.aliasName ?? team.name ?? teamId);
    return [{
      id: playerId,
      playerId,
      teamId,
      teamName,
      label,
      description: teamName,
      ...(typeof player.photoUrl === "string" && player.photoUrl.trim()
        ? { imageUrl: player.photoUrl.trim() }
        : {}),
    } satisfies VotingCandidate];
  }).sort((a, b) => a.teamName!.localeCompare(b.teamName!, "it") || a.label.localeCompare(b.label, "it"));
}

export async function buildEligibleCandidates(
  pollId: string,
): Promise<
  Omit<
    BuildXiCandidate,
    "buildXiRole"
  >[]
> {
  const poll =
    await getVotingPoll(
      pollId,
    );

  if (
    poll.type !==
    "build_xi"
  ) {
    throw new Error(
      "BUILD_XI_ONLY",
    );
  }

  const [
    seasonPlayers,
    players,
    teams,
    matches,
    reports,
    finalStageMatches,
    finalStageReports,
    matchweekAwards,
    finalStagePlayers,
    competitions,
  ] =
    await Promise.all([
      loadCollection(
        "seasonPlayers",
      ),
      loadCollection(
        "players",
      ),
      loadCollection(
        "teams",
      ),
      loadCollection(
        "matches",
      ),
      loadCollection(
        "matchReports",
      ),
      loadCollection(
        "finalStageMatches",
      ),
      loadCollection(
        "finalStageMatchReports",
      ),
      loadCollection(
        "matchweekAwards",
      ),
      loadCollection(
        "finalStagePlayers",
      ),
      loadCollection(
        "competitions",
      ),
    ]);

  const roster =
    seasonPlayers.filter(
      (entry) =>
        entry.data.seasonId ===
          poll.seasonId &&
        entry.data.status !==
          "inactive" &&
        entry.data.status !==
          "withdrawn" &&
        entry.data.status !==
          "transferred",
    );

  const playerById =
    new Map(
      players.map(
        (entry) => [
          entry.id,
          entry.data,
        ],
      ),
    );

  const teamById =
    new Map(
      teams.map(
        (entry) => [
          entry.id,
          entry.data,
        ],
      ),
    );

  const matchById =
    new Map(
      matches
        .filter(
          (entry) =>
            entry.data.seasonId ===
            poll.seasonId,
        )
        .map(
          (entry) => [
            entry.id,
            entry.data,
          ],
        ),
    );

  const competition =
    competitions.find(
      (entry) =>
        entry.id ===
        poll.competitionId,
    )?.data;

  const competitionLogoUrl =
    typeof competition
      ?.logoUrl ===
      "string" &&
    competition.logoUrl.trim()
      ? competition.logoUrl.trim()
      : undefined;

  const appearances =
    new Map<
      string,
      number
    >();

  const available =
    new Map<
      string,
      number
    >();

  for (
    const report of
      reports
  ) {
    const matchId =
      String(
        report.data.matchId ??
          report.id,
      );

    const match =
      matchById.get(
        matchId,
      );

    if (
      !match ||
      report.data.status !==
        "published"
    ) {
      continue;
    }

    const reportData =
      asRecord(
        report.data.data,
      );

    const homeTeamId =
      String(
        match.homeTeamId ??
          "",
      );

    const awayTeamId =
      String(
        match.awayTeamId ??
          "",
      );

    if (homeTeamId) {
      available.set(
        homeTeamId,
        (
          available.get(
            homeTeamId,
          ) ??
          0
        ) +
          1,
      );
    }

    if (awayTeamId) {
      available.set(
        awayTeamId,
        (
          available.get(
            awayTeamId,
          ) ??
          0
        ) +
          1,
      );
    }

    for (
      const value of
        readStringArray(
          reportData.homePresentPlayerIds,
        )
    ) {
      appearances.set(
        value,
        (
          appearances.get(
            value,
          ) ??
          0
        ) +
          1,
      );
    }

    for (
      const value of
        readStringArray(
          reportData.awayPresentPlayerIds,
        )
    ) {
      appearances.set(
        value,
        (
          appearances.get(
            value,
          ) ??
          0
        ) +
          1,
      );
    }
  }

  return roster
    .flatMap(
      (entry) => {
        const playerId =
          String(
            entry.data.playerId ??
              "",
          );

        const teamId =
          String(
            entry.data.teamId ??
              "",
          );

        const player =
          playerById.get(
            playerId,
          );

        const team =
          teamById.get(
            teamId,
          );

        const played =
          available.get(
            teamId,
          ) ??
          0;

        const playerAppearances =
          appearances.get(
            playerId,
          ) ??
          0;

        if (
          !player ||
          !team ||
          played <=
            0 ||
          playerAppearances <=
            0 ||
          playerAppearances /
            played <
            ELIGIBILITY_RATE
        ) {
          return [];
        }

        const firstName =
          String(
            player.firstName ??
              "",
          ).trim();

        const lastName =
          String(
            player.lastName ??
              "",
          ).trim();

        const originalRole =
          String(
            entry.data.role ??
              "",
          );

        const futSnapshot =
          buildBuildXiFutSnapshot({
            playerId,
            teamId,
            role:
              originalRole,
            baseRating:
              player.baseRating,
            seasonId:
              poll.seasonId,
            competitionId:
              poll.competitionId,
            matches:
              matches.filter(
                (currentMatch) =>
                  currentMatch.data.seasonId ===
                  poll.seasonId,
              ),
            reports,
            finalStageMatches,
            finalStageReports,
            teams,
            players,
            matchweekAwards,
            finalStagePlayers,
          });

        return [
          {
            playerId,
            seasonPlayerId:
              entry.id,
            teamId,
            playerName:
              `${firstName} ${lastName}`.trim() ||
              String(
                player.name ??
                  playerId,
              ),
            teamName:
              String(
                team.aliasName ??
                  team.name ??
                  teamId,
              ),
            originalRole,
            appearances:
              playerAppearances,
            availableTeamMatches:
              played,
            appearanceRate:
              playerAppearances /
              played,
            ...(
              typeof player.photoUrl ===
                "string" &&
              player.photoUrl.trim()
                ? {
                    photoUrl:
                      player.photoUrl.trim(),
                  }
                : {}
            ),
            ...(
              typeof team.logoUrl ===
                "string" &&
              team.logoUrl.trim()
                ? {
                    teamLogoUrl:
                      team.logoUrl.trim(),
                  }
                : {}
            ),
            competitionName:
              poll.competitionName,
            ...(
              competitionLogoUrl
                ? {
                    competitionLogoUrl,
                  }
                : {}
            ),
            ...futSnapshot,
          },
        ];
      },
    )
    .sort(
      (
        first,
        second,
      ) =>
        first.teamName.localeCompare(
          second.teamName,
          "it",
        ) ||
        first.playerName.localeCompare(
          second.playerName,
          "it",
        ),
    );
}

export async function createBuildXiWorkbook(pollId: string): Promise<Buffer> {
  const poll = await getVotingPoll(pollId);
  if (poll.type !== "build_xi") throw new Error("BUILD_XI_ONLY");
  const candidates = await buildEligibleCandidates(pollId);
  const rows = candidates.map((candidate) => ({
    "Nome giocatore": candidate.playerName,
    Squadra: candidate.teamName,
    "Ruolo giocatore": candidate.originalRole,
    "Ruolo BUILD XI": "",
    playerId: candidate.playerId,
    seasonPlayerId: candidate.seasonPlayerId,
    teamId: candidate.teamId,
    appearances: candidate.appearances,
    availableTeamMatches: candidate.availableTeamMatches,
  }));
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [
    "Nome giocatore", "Squadra", "Ruolo giocatore", "Ruolo BUILD XI",
    "playerId", "seasonPlayerId", "teamId", "appearances", "availableTeamMatches",
  ] });
  sheet["!cols"] = [
    { wch: 30 }, { wch: 24 }, { wch: 20 }, { wch: 22 },
    { hidden: true }, { hidden: true }, { hidden: true }, { hidden: true }, { hidden: true },
  ];
  const instructions = XLSX.utils.aoa_to_sheet([
    ["BUILD XI", poll.title],
    ["Competizione", poll.competitionName],
    ["Stagione", poll.seasonName],
    ["Istruzioni", "Compila soltanto la colonna D scegliendo: Portiere, Difensore, Centrocampista o Attaccante."],
    ["Eleggibilità", "Giocatori attivi con almeno il 60% delle presenze possibili e almeno una presenza."],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Giocatori votabili");
  XLSX.utils.book_append_sheet(workbook, instructions, "Istruzioni");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

export async function importBuildXiWorkbook(pollId: string, bytes: ArrayBuffer): Promise<GamesVotingPoll> {
  const poll = await getVotingPoll(pollId);
  if (poll.type !== "build_xi") throw new Error("BUILD_XI_ONLY");
  if (!["setup", "ready"].includes(poll.status)) throw new Error("VOTING_NOT_EDITABLE");
  const eligible = await buildEligibleCandidates(pollId);
  const eligibleBySeasonPlayerId = new Map(eligible.map((candidate) => [candidate.seasonPlayerId, candidate]));
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheet = workbook.Sheets["Giocatori votabili"] ?? workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("INVALID_WORKBOOK");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const candidates: BuildXiCandidate[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const seasonPlayerId = String(row.seasonPlayerId ?? "").trim();
    const source = eligibleBySeasonPlayerId.get(seasonPlayerId);
    if (!source || seen.has(seasonPlayerId)) throw new Error("INVALID_CANDIDATE_ROWS");
    const buildXiRole = parseBuildXiRole(row["Ruolo BUILD XI"]);
    if (!buildXiRole) throw new Error(`INVALID_BUILD_XI_ROLE:${source.playerName}`);
    seen.add(seasonPlayerId);
    candidates.push({ ...source, buildXiRole });
  }
  if (candidates.length !== eligible.length) throw new Error("INCOMPLETE_CANDIDATE_LIST");
  const roleCounts = emptyRoleCounts();
  for (const candidate of candidates) roleCounts[candidate.buildXiRole] += 1;
  for (const role of Object.keys(BUILD_XI_REQUIRED_ROLE_COUNTS) as BuildXiRole[]) {
    if (roleCounts[role] < BUILD_XI_REQUIRED_ROLE_COUNTS[role]) throw new Error(`NOT_ENOUGH_ROLE:${BUILD_XI_ROLE_LABELS[role]}`);
  }
  await adminDb.collection(POLLS).doc(pollId).update({
    candidates,
    candidateCount: candidates.length,
    roleCounts,
    buildXiTieBreakDecisions:
      FieldValue.delete(),
    buildXiTieBreakUpdatedAt:
      FieldValue.delete(),
    buildXiTieBreakResolvedBy:
      FieldValue.delete(),
    status: "ready",
    snapshotCreatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { ...poll, candidateCount: candidates.length, roleCounts, status: "ready" };
}


export async function resolveBuildXiTieBreak({
  pollId,
  role,
  selectedPlayerIds,
  resolvedBy,
}: {
  pollId:
    string;
  role:
    BuildXiRole;
  selectedPlayerIds:
    string[];
  resolvedBy:
    string;
}): Promise<void> {
  if (
    ![
      "goalkeeper",
      "defender",
      "midfielder",
      "forward",
    ].includes(
      role,
    )
  ) {
    throw new Error(
      "INVALID_BUILD_XI_TIE_ROLE",
    );
  }

  const submissionsSnapshot =
    await adminDb
      .collection(
        SUBMISSIONS,
      )
      .where(
        "votingId",
        "==",
        pollId,
      )
      .get();

  const submissions =
    submissionsSnapshot.docs.map(
      (
        document,
      ) =>
        document.data(),
    );

  const reference =
    adminDb
      .collection(
        POLLS,
      )
      .doc(
        pollId,
      );

  await adminDb.runTransaction(
    async (
      transaction,
    ) => {
      const snapshot =
        await transaction.get(
          reference,
        );

      if (
        !snapshot.exists
      ) {
        throw new Error(
          "VOTING_NOT_FOUND",
        );
      }

      const data =
        snapshot.data() ??
        {};

      const poll =
        mapVotingPoll(
          snapshot.id,
          data,
        );

      if (
        poll.type !==
        "build_xi"
      ) {
        throw new Error(
          "BUILD_XI_ONLY",
        );
      }

      if (
        poll.status !==
        "closed"
      ) {
        throw new Error(
          "BUILD_XI_TIE_BREAK_REQUIRES_CLOSED",
        );
      }

      const candidates =
        Array.isArray(
          data.candidates,
        )
          ? data.candidates as
              BuildXiCandidate[]
          : [];

      const currentDecisions =
        readBuildXiTieBreakDecisions(
          data.buildXiTieBreakDecisions,
        );

      const unresolved =
        buildBuildXiVotingResults({
          candidates,
          submissions,
          tieBreakDecisions:
            currentDecisions,
        }).result.tieBreaks[
          role
        ];

      if (
        !unresolved
      ) {
        throw new Error(
          "BUILD_XI_TIE_NOT_FOUND",
        );
      }

      const normalizedSelection =
        Array.from(
          new Set(
            selectedPlayerIds
              .map(
                (
                  playerId,
                ) =>
                  String(
                    playerId,
                  ).trim(),
              )
              .filter(
                Boolean,
              ),
          ),
        );

      const allowed =
        new Set(
          unresolved.candidateIds,
        );

      if (
        normalizedSelection.length !==
          unresolved.requiredSelections ||
        normalizedSelection.some(
          (
            playerId,
          ) =>
            !allowed.has(
              playerId,
            ),
        )
      ) {
        throw new Error(
          "INVALID_BUILD_XI_TIE_SELECTION",
        );
      }

      const nextDecisions:
        BuildXiTieBreakDecisions = {
          ...currentDecisions,
          [role]:
            normalizedSelection,
        };

      const resolved =
        buildBuildXiVotingResults({
          candidates,
          submissions,
          tieBreakDecisions:
            nextDecisions,
        }).result;

      if (
        resolved.tieBreaks[
          role
        ]?.resolved !==
        true
      ) {
        throw new Error(
          "INVALID_BUILD_XI_TIE_SELECTION",
        );
      }

      transaction.update(
        reference,
        {
          buildXiTieBreakDecisions:
            nextDecisions,
          buildXiTieBreakUpdatedAt:
            FieldValue.serverTimestamp(),
          buildXiTieBreakResolvedBy:
            resolvedBy,
          updatedAt:
            FieldValue.serverTimestamp(),
        },
      );
    },
  );
}

function readBuildXiTieBreakDecisions(
  value:
    unknown,
): BuildXiTieBreakDecisions {
  const data =
    asRecord(
      value,
    );

  const result:
    BuildXiTieBreakDecisions = {};

  for (
    const role of [
      "goalkeeper",
      "defender",
      "midfielder",
      "forward",
    ] as BuildXiRole[]
  ) {
    const values =
      readStringArray(
        data[
          role
        ],
      );

    if (
      values.length >
      0
    ) {
      result[
        role
      ] =
        values;
    }
  }

  return result;
}


async function prepareBuildXiPublicationCandidates(
  pollId:
    string,
): Promise<
  BuildXiCandidate[] |
  null
> {
  const snapshot =
    await adminDb
      .collection(
        POLLS,
      )
      .doc(
        pollId,
      )
      .get();

  if (
    !snapshot.exists
  ) {
    throw new Error(
      "VOTING_NOT_FOUND",
    );
  }

  const data =
    snapshot.data() ??
    {};

  const poll =
    mapVotingPoll(
      snapshot.id,
      data,
    );

  if (
    poll.type !==
      "build_xi" ||
    poll.status !==
      "ready"
  ) {
    return null;
  }

  const candidates =
    Array.isArray(
      data.candidates,
    )
      ? data.candidates as
          BuildXiCandidate[]
      : [];

  assertBuildXiCandidateSnapshot(
    candidates,
    poll.eligibilityRate ||
      ELIGIBILITY_RATE,
  );

  const [
    players,
    teams,
    matches,
    reports,
    finalStageMatches,
    finalStageReports,
    matchweekAwards,
    finalStagePlayers,
    competitions,
  ] =
    await Promise.all([
      loadCollection(
        "players",
      ),
      loadCollection(
        "teams",
      ),
      loadCollection(
        "matches",
      ),
      loadCollection(
        "matchReports",
      ),
      loadCollection(
        "finalStageMatches",
      ),
      loadCollection(
        "finalStageMatchReports",
      ),
      loadCollection(
        "matchweekAwards",
      ),
      loadCollection(
        "finalStagePlayers",
      ),
      loadCollection(
        "competitions",
      ),
    ]);

  const playerById =
    new Map(
      players.map(
        (
          entry,
        ) => [
          entry.id,
          entry.data,
        ],
      ),
    );

  const teamById =
    new Map(
      teams.map(
        (
          entry,
        ) => [
          entry.id,
          entry.data,
        ],
      ),
    );

  const competition =
    competitions.find(
      (
        entry,
      ) =>
        entry.id ===
        poll.competitionId,
    )?.data;

  const competitionLogoUrl =
    typeof competition
      ?.logoUrl ===
      "string" &&
    competition.logoUrl.trim()
      ? competition.logoUrl.trim()
      : undefined;

  const futSnapshots =
    new Map<
      string,
      Pick<
        BuildXiCandidate,
        "futRating" |
        "futCard"
      >
    >();

  for (
    const candidate of
    candidates
  ) {
    const player =
      playerById.get(
        candidate.playerId,
      );

    const team =
      teamById.get(
        candidate.teamId,
      );

    if (
      !player ||
      !team
    ) {
      throw new Error(
        "BUILD_XI_PUBLICATION_SOURCE_MISSING",
      );
    }

    const futSnapshot =
      buildBuildXiFutSnapshot({
        playerId:
          candidate.playerId,
        teamId:
          candidate.teamId,
        role:
          candidate.originalRole,
        baseRating:
          player.baseRating,
        seasonId:
          poll.seasonId,
        competitionId:
          poll.competitionId,
        matches:
          matches.filter(
            (
              currentMatch,
            ) =>
              currentMatch.data
                .seasonId ===
              poll.seasonId,
          ),
        reports,
        finalStageMatches,
        finalStageReports,
        teams,
        players,
        matchweekAwards,
        finalStagePlayers,
      });

    futSnapshots.set(
      candidate.playerId,
      futSnapshot,
    );
  }

  return applyBuildXiPublicationFutSnapshots({
    candidates,
    futSnapshots,
    competitionName:
      poll.competitionName,
    competitionLogoUrl,
  });
}

export async function changeVotingStatus(pollId: string, nextStatus: VotingStatus): Promise<void> {
  const reference =
    adminDb.collection(POLLS).doc(pollId);

  /*
   * Il calcolo FUT può richiedere molte letture. Lo eseguiamo prima
   * della transaction, poi dentro la transaction verifichiamo che lo
   * snapshot candidati/ruoli non sia cambiato prima di pubblicare.
   */
  const buildXiPublicationCandidates =
    nextStatus ===
      "published"
      ? await prepareBuildXiPublicationCandidates(
          pollId,
        )
      : null;

  await adminDb.runTransaction(
    async (transaction) => {
      const snapshot =
        await transaction.get(
          reference,
        );

      if (!snapshot.exists) {
        throw new Error(
          "VOTING_NOT_FOUND",
        );
      }

      const data =
        snapshot.data() ?? {};

      const poll =
        mapVotingPoll(
          snapshot.id,
          data,
        );

      const allowed:
        Partial<
          Record<
            VotingStatus,
            VotingStatus[]
          >
        > = {
          setup:
            ["ready"],
          ready:
            [
              "setup",
              "published",
            ],
          published:
            ["closed"],
          closed:
            ["archived"],
        };

      if (
        !allowed[
          poll.status
        ]?.includes(
          nextStatus,
        )
      ) {
        throw new Error(
          "INVALID_STATUS_TRANSITION",
        );
      }

      let pollForValidation =
        poll;

      let matchBoundPollPatch:
        Record<
          string,
          unknown
        > = {};

      if (
        nextStatus ===
          "published" &&
        poll.type ===
          "score_prediction" &&
        poll.scorePrediction
      ) {
        const matchSnapshot =
          await transaction.get(
            adminDb
              .collection(
                "matches",
              )
              .doc(
                poll.scorePrediction
                  .match.id,
              ),
          );

        if (
          !matchSnapshot.exists
        ) {
          throw new Error(
            "MATCH_NOT_FOUND",
          );
        }

        const currentMatch =
          buildCurrentScorePredictionMatch({
            stored:
              poll.scorePrediction
                .match,
            data:
              matchSnapshot.data() ??
              {},
          });

        assertScorePredictionMatchIdentity({
          stored:
            poll.scorePrediction
              .match,
          current:
            currentMatch,
        });

        if (
          resolveScorePredictionLifecycle({
            persistedStatus:
              "published",
            kickoffAtMs:
              currentMatch.kickoffAtMs,
            nowMs:
              Date.now(),
          }) !==
          "published"
        ) {
          throw new Error(
            "MATCH_ALREADY_STARTED",
          );
        }

        pollForValidation = {
          ...poll,
          scorePrediction: {
            ...poll.scorePrediction,
            match:
              currentMatch,
          },
        };

        matchBoundPollPatch = {
          scorePrediction: {
            ...poll.scorePrediction,
            match:
              currentMatch,
          },
        };
      }

      if (
        nextStatus ===
          "published" &&
        poll.type ===
          "man_of_the_match" &&
        poll.manOfTheMatch
      ) {
        const matchSnapshot =
          await transaction.get(
            adminDb
              .collection(
                "matches",
              )
              .doc(
                poll.manOfTheMatch
                  .match.id,
              ),
          );

        if (
          !matchSnapshot.exists
        ) {
          throw new Error(
            "MATCH_NOT_FOUND",
          );
        }

        const currentMatch =
          buildCurrentManOfTheMatchMatch({
            stored:
              poll.manOfTheMatch
                .match,
            data:
              matchSnapshot.data() ??
              {},
          });

        assertManOfTheMatchMatchIdentity({
          stored:
            poll.manOfTheMatch
              .match,
          current:
            currentMatch,
        });

        pollForValidation = {
          ...poll,
          manOfTheMatch: {
            ...poll.manOfTheMatch,
            match:
              currentMatch,
          },
        };

        matchBoundPollPatch = {
          manOfTheMatch: {
            ...poll.manOfTheMatch,
            match:
              currentMatch,
          },
        };
      }

      if (
        nextStatus ===
        "published"
      ) {
        validatePollReadyForPublish(
          pollForValidation,
        );

        if (
          poll.type ===
          "build_xi"
        ) {
          const candidates =
            Array.isArray(
              data.candidates,
            )
              ? data.candidates as
                  BuildXiCandidate[]
              : [];

          /*
           * Non ci affidiamo a candidateCount/roleCounts salvati nel
           * documento: prima della pubblicazione validiamo lo snapshot
           * reale che verrà poi usato dagli utenti.
           */
          assertBuildXiCandidateSnapshot(
            candidates,
            poll.eligibilityRate ||
              ELIGIBILITY_RATE,
          );

          if (
            !buildXiPublicationCandidates
          ) {
            throw new Error(
              "BUILD_XI_PUBLICATION_SNAPSHOT_MISSING",
            );
          }

          assertBuildXiPublicationSnapshotUnchanged({
            currentCandidates:
              candidates,
            refreshedCandidates:
              buildXiPublicationCandidates,
          });

          matchBoundPollPatch = {
            ...matchBoundPollPatch,
            candidates:
              buildXiPublicationCandidates,
            snapshotCreatedAt:
              FieldValue.serverTimestamp(),
          };
        }
      }

      transaction.update(
        reference,
        {
          status:
            nextStatus,
          ...matchBoundPollPatch,
          ...(
            nextStatus ===
              "published"
              ? {
                  publishedAt:
                    FieldValue.serverTimestamp(),
                }
              : {}
          ),
          ...(
            nextStatus ===
              "closed"
              ? {
                  closedAt:
                    FieldValue.serverTimestamp(),
                }
              : {}
          ),
          updatedAt:
            FieldValue.serverTimestamp(),
        },
      );
    },
  );
}

export async function getPublishedVotingRuntime(pollId: string, uid: string) {
  const snapshot = await adminDb.collection(POLLS).doc(pollId).get();
  if (!snapshot.exists) throw new Error("VOTING_NOT_FOUND");
  const data = snapshot.data() ?? {};
  const rawPoll = mapVotingPoll(snapshot.id, data);

  // Best Of The Month è sempre consultabile come contenitore pubblico,
  // anche dopo un Reset o quando non c'è ancora alcun sondaggio attivo.
  if (
    rawPoll.type !==
      "best_of_the_month" &&
    ![
      "published",
      "closed",
    ].includes(
      rawPoll.status,
    )
  ) {
    throw new Error(
      "VOTING_NOT_PUBLISHED",
    );
  }

  const refreshedPoll =
    await refreshManOfTheMatchMatchSnapshot(
      await refreshScorePredictionMatchSnapshot(
        rawPoll,
      ),
    );

  const pollWithLogos =
    await enrichVotingPollTeamLogos(
      refreshedPoll,
    );

  const poll = {
    ...pollWithLogos,
    status:
      getEffectiveVotingStatus(
        pollWithLogos,
        Date.now(),
      ),
  };

  const candidates = Array.isArray(data.candidates)
    ? data.candidates as BuildXiCandidate[]
    : [];

  if (
    poll.type ===
    "best_of_the_month"
  ) {
    const submissions =
      await Promise.all(
        BEST_OF_MONTH_KEYS.map(
          async (
            awardKey,
          ) => {
            const doc =
              await adminDb
                .collection(
                  SUBMISSIONS,
                )
                .doc(
                  bestOfMonthSubmissionId(
                    pollId,
                    awardKey,
                    uid,
                  ),
                )
                .get();

            return doc.exists
              ? doc.data()
              : null;
          },
        ),
      );

    return {
      poll:
        sanitizePublicVotingPoll(
          poll,
        ),
      candidates,
      submissions,
      bestOfMonthWinners:
        buildBestOfMonthPublicWinners(
          poll,
        ),
    };
  }

  const submission = await adminDb.collection(SUBMISSIONS).doc(`${pollId}_${uid}`).get();

  if (
    poll.type ===
      "build_xi" &&
    poll.status ===
      "closed"
  ) {
    return {
      poll,
      candidates,
      submission:
        submission.exists
          ? submission.data()
          : null,
      results:
        await getVotingAdminResults(
          pollId,
          poll,
          data,
        ),
    };
  }

  if (
    poll.type ===
      "score_prediction" &&
    poll.status ===
      "closed"
  ) {
    const adminResult =
      await buildScorePredictionAdminResult({
        poll,
        submissions:
          (
            await adminDb
              .collection(
                SUBMISSIONS,
              )
              .where(
                "votingId",
                "==",
                pollId,
              )
              .get()
          ).docs.map(
            (
              document,
            ) =>
              document.data(),
          ),
      });

    return {
      poll,
      candidates,
      submission:
        submission.exists
          ? submission.data()
          : null,
      scorePredictionResult:
        buildScorePredictionPublicResult({
          adminResult,
          userId:
            uid,
        }),
    };
  }

  if (
    poll.type ===
      "man_of_the_match" &&
    poll.status ===
      "closed"
  ) {
    const adminResults =
      await getVotingAdminResults(
        pollId,
        poll,
        data,
      );

    const ownSubmission =
      submission.exists
        ? submission.data() ??
          null
        : null;

    return {
      poll,
      candidates,
      submission:
        ownSubmission,
      manOfTheMatchResult:
        buildManOfTheMatchPublicResult({
          adminResults,
          ownSubmission,
        }),
    };
  }

  if (
    poll.type ===
      "ceremony_award" &&
    poll.status ===
      "closed"
  ) {
    const adminResults =
      await getVotingAdminResults(
        pollId,
        poll,
        data,
      );

    const ownSubmission =
      submission.exists
        ? submission.data() ??
          null
        : null;

    return {
      poll,
      candidates,
      submission:
        ownSubmission,
      ceremonyAwardResult:
        buildCeremonyAwardPublicResult({
          poll,
          adminResults,
          ownSubmission,
        }),
    };
  }

  return {
    poll,
    candidates,
    submission:
      submission.exists
        ? submission.data()
        : null,
  };
}

export async function submitBuildXi(pollId: string, uid: string, lineup: BuildXiLineup): Promise<void> {
  const pollReference = adminDb.collection(POLLS).doc(pollId);
  const submissionReference = adminDb.collection(SUBMISSIONS).doc(`${pollId}_${uid}`);
  await adminDb.runTransaction(async (transaction) => {
    const [pollSnapshot, submissionSnapshot] = await Promise.all([
      transaction.get(pollReference),
      transaction.get(submissionReference),
    ]);
    if (!pollSnapshot.exists) throw new Error("VOTING_NOT_FOUND");
    const poll = mapVotingPoll(pollSnapshot.id, pollSnapshot.data() ?? {});
    if (poll.type !== "build_xi") throw new Error("INVALID_SUBMISSION_TYPE");
    assertPollOpenForSubmission(poll);
    if (submissionSnapshot.exists) throw new Error("ALREADY_SUBMITTED");
    const candidates =
      Array.isArray(
        pollSnapshot.data()?.candidates,
      )
        ? pollSnapshot.data()?.candidates as
            BuildXiCandidate[]
        : [];

    /*
     * La submission viene accettata solo contro uno snapshot BUILD XI
     * ancora strutturalmente valido ed eleggibile. La validazione è
     * server-side e avviene dentro la stessa transaction che crea il voto.
     */
    assertBuildXiCandidateSnapshot(
      candidates,
      poll.eligibilityRate ||
        ELIGIBILITY_RATE,
    );

    assertBuildXiLineup(
      lineup,
      candidates,
    );

    transaction.create(submissionReference, {
      votingId: pollId,
      gameId: poll.gameId,
      competitionId: poll.competitionId,
      userId: uid,
      type: "build_xi",
      lineup,
      locked: true,
      submittedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function submitBestOfMonthVote(
  pollId: string,
  uid: string,
  awardKey: BestOfMonthAwardKey,
  optionId: string,
): Promise<void> {
  if (!BEST_OF_MONTH_KEYS.includes(awardKey)) throw new Error("INVALID_AWARD");
  const pollReference = adminDb.collection(POLLS).doc(pollId);
  const submissionReference = adminDb.collection(SUBMISSIONS).doc(bestOfMonthSubmissionId(pollId, awardKey, uid));
  await adminDb.runTransaction(async (transaction) => {
    const [pollSnapshot, submissionSnapshot] = await Promise.all([
      transaction.get(pollReference),
      transaction.get(submissionReference),
    ]);
    if (!pollSnapshot.exists) throw new Error("VOTING_NOT_FOUND");
    const poll = mapVotingPoll(pollSnapshot.id, pollSnapshot.data() ?? {});
    if (
      poll.type !==
        "best_of_the_month" ||
      !poll.bestOfMonth
    ) {
      throw new Error(
        "INVALID_SUBMISSION_TYPE",
      );
    }

    assertPollOpenForSubmission(
      poll,
    );

    if (
      submissionSnapshot.exists
    ) {
      throw new Error(
        "ALREADY_SUBMITTED",
      );
    }

    const award =
      poll.bestOfMonth
        .awards[
          awardKey
        ];

    assertBestOfMonthAwardReady(
      award,
    );

    if (
      !award.candidates.some(
        (
          candidate,
        ) =>
          candidate.id ===
          optionId,
      )
    ) {
      throw new Error(
        "INVALID_OPTION",
      );
    }

    transaction.create(submissionReference, {
      votingId: pollId,
      gameId: poll.gameId,
      userId: uid,
      type: "best_of_the_month",
      awardKey,
      optionId,
      locked: true,
      submittedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function submitScorePrediction(
  pollId: string,
  uid: string,
  input: { homeScore: number; awayScore: number; topScorerPlayerId: string | null },
): Promise<void> {
  const pollReference = adminDb.collection(POLLS).doc(pollId);
  const submissionReference = adminDb.collection(SUBMISSIONS).doc(`${pollId}_${uid}`);
  await adminDb.runTransaction(async (transaction) => {
    const [pollSnapshot, submissionSnapshot] = await Promise.all([
      transaction.get(pollReference),
      transaction.get(submissionReference),
    ]);
    if (!pollSnapshot.exists) throw new Error("VOTING_NOT_FOUND");
    const poll = mapVotingPoll(pollSnapshot.id, pollSnapshot.data() ?? {});
    if (
      poll.type !==
        "score_prediction" ||
      !poll.scorePrediction
    ) {
      throw new Error(
        "INVALID_SUBMISSION_TYPE",
      );
    }

    if (
      submissionSnapshot.exists
    ) {
      throw new Error(
        "ALREADY_SUBMITTED",
      );
    }

    const matchSnapshot =
      await transaction.get(
        adminDb
          .collection(
            "matches",
          )
          .doc(
            poll.scorePrediction
              .match.id,
          ),
      );

    if (
      !matchSnapshot.exists
    ) {
      throw new Error(
        "MATCH_NOT_FOUND",
      );
    }

    const currentMatch =
      buildCurrentScorePredictionMatch({
        stored:
          poll.scorePrediction
            .match,
        data:
          matchSnapshot.data() ??
          {},
      });

    assertScorePredictionMatchIdentity({
      stored:
        poll.scorePrediction
          .match,
      current:
        currentMatch,
    });

    if (
      resolveScorePredictionLifecycle({
        persistedStatus:
          poll.status,
        kickoffAtMs:
          currentMatch.kickoffAtMs,
        nowMs:
          Date.now(),
      }) !==
      "published"
    ) {
      throw new Error(
        "VOTING_NOT_OPEN",
      );
    }

    const homeScore =
      normalizeScorePredictionScore(
        input.homeScore,
      );

    const awayScore =
      normalizeScorePredictionScore(
        input.awayScore,
      );

    const totalGoals =
      homeScore +
      awayScore;

    const topScorerPlayerId =
      resolveScorePredictionScorerId({
        requestedId:
          input.topScorerPlayerId,
        totalGoals,
        scorerOptions:
          poll.scorePrediction
            .scorerOptions,
      });

    transaction.create(submissionReference, {
      votingId: pollId,
      gameId: poll.gameId,
      userId: uid,
      type: "score_prediction",
      homeScore,
      awayScore,
      topScorerPlayerId,
      locked: true,
      submittedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function submitSingleChoiceVote(
  pollId: string,
  uid: string,
  optionId: string,
): Promise<void> {
  const pollReference = adminDb.collection(POLLS).doc(pollId);
  const submissionReference = adminDb.collection(SUBMISSIONS).doc(`${pollId}_${uid}`);
  await adminDb.runTransaction(async (transaction) => {
    const [pollSnapshot, submissionSnapshot] = await Promise.all([
      transaction.get(pollReference),
      transaction.get(submissionReference),
    ]);
    if (!pollSnapshot.exists) throw new Error("VOTING_NOT_FOUND");
    const poll = mapVotingPoll(pollSnapshot.id, pollSnapshot.data() ?? {});
    if (!(["man_of_the_match", "ceremony_award"] as VotingType[]).includes(poll.type)) {
      throw new Error("INVALID_SUBMISSION_TYPE");
    }
    if (
      submissionSnapshot.exists
    ) {
      throw new Error(
        "ALREADY_SUBMITTED",
      );
    }

    if (
      poll.type ===
        "man_of_the_match"
    ) {
      if (
        !poll.manOfTheMatch
      ) {
        throw new Error(
          "VOTING_NOT_READY",
        );
      }

      const matchSnapshot =
        await transaction.get(
          adminDb
            .collection(
              "matches",
            )
            .doc(
              poll.manOfTheMatch
                .match.id,
            ),
        );

      if (
        !matchSnapshot.exists
      ) {
        throw new Error(
          "MATCH_NOT_FOUND",
        );
      }

      const currentMatch =
        buildCurrentManOfTheMatchMatch({
          stored:
            poll.manOfTheMatch
              .match,
          data:
            matchSnapshot.data() ??
            {},
        });

      assertManOfTheMatchMatchIdentity({
        stored:
          poll.manOfTheMatch
            .match,
        current:
          currentMatch,
      });

      validateManOfTheMatchReady({
        candidates:
          poll.manOfTheMatch
            .candidates,
        homeTeamId:
          currentMatch.homeTeamId,
        awayTeamId:
          currentMatch.awayTeamId,
      });
    }

    if (
      poll.type ===
        "ceremony_award"
    ) {
      if (
        !poll.ceremonyAward
      ) {
        throw new Error(
          "VOTING_NOT_READY",
        );
      }

      validateCeremonyAwardReady(
        poll.ceremonyAward,
      );
    }

    assertPollOpenForSubmission(
      poll,
    );

    const candidates =
      poll.type ===
        "man_of_the_match"
        ? poll.manOfTheMatch
            ?.candidates ??
          []
        : poll.ceremonyAward
            ?.candidates ??
          [];

    const normalizedOptionId =
      String(
        optionId ??
        "",
      ).trim();

    if (
      !normalizedOptionId ||
      !candidates.some(
        (
          candidate,
        ) =>
          candidate.id ===
          normalizedOptionId,
      )
    ) {
      throw new Error(
        "INVALID_OPTION",
      );
    }

    transaction.create(submissionReference, {
      votingId: pollId,
      gameId: poll.gameId,
      userId: uid,
      type: poll.type,
      optionId:
        normalizedOptionId,
      locked: true,
      submittedAt: FieldValue.serverTimestamp(),
    });
  });
}

export function validateBuildXiLineup(
  lineup:
    BuildXiLineup,
  candidates:
    BuildXiCandidate[],
) {
  assertBuildXiLineup(
    lineup,
    candidates,
  );
}

export function getEffectiveVotingStatus(
  poll: GamesVotingPoll,
  nowMs: number = Date.now(),
): VotingStatus {
  if (poll.status !== "published") return poll.status;
  if (
    poll.type ===
      "best_of_the_month" &&
    poll.bestOfMonth
  ) {
    return resolveBestOfMonthEffectiveStatus({
      persistedStatus:
        poll.status,
      opensAtMs:
        poll.bestOfMonth.opensAtMs,
      closesAtMs:
        poll.bestOfMonth.closesAtMs,
      nowMs,
    });
  }
  if (
    poll.type ===
      "score_prediction" &&
    poll.scorePrediction
  ) {
    return resolveScorePredictionLifecycle({
      persistedStatus:
        poll.status,
      kickoffAtMs:
        poll.scorePrediction
          .match.kickoffAtMs,
      nowMs,
    });
  }

  return "published";
}

function assertPollOpenForSubmission(poll: GamesVotingPoll) {
  if (poll.status !== "published") throw new Error("VOTING_NOT_OPEN");
  if (getEffectiveVotingStatus(poll, Date.now()) !== "published") throw new Error("VOTING_NOT_OPEN");
}


function votingPercentage(
  votes: number,
  totalVoters: number,
): number {
  if (totalVoters <= 0) return 0;

  return Math.round(
    (votes / totalVoters) * 1000,
  ) / 10;
}

async function getVotingAdminResults(
  pollId: string,
  poll: GamesVotingPoll,
  data: Record<string, unknown>,
): Promise<VotingAdminResults> {
  const snapshot = await adminDb.collection(SUBMISSIONS).where("votingId", "==", pollId).get();
  const submissions = snapshot.docs.map((document) => document.data());
  const result: VotingAdminResults = { submissionCount: submissions.length };

  if (
    poll.type ===
    "build_xi"
  ) {
    const candidates =
      Array.isArray(
        data.candidates,
      )
        ? data.candidates as
            BuildXiCandidate[]
        : [];

    const buildXiResults =
      buildBuildXiVotingResults({
        candidates,
        submissions,
        tieBreakDecisions:
          readBuildXiTieBreakDecisions(
            data.buildXiTieBreakDecisions,
          ),
      });

    result.submissionCount =
      buildXiResults
        .submissionCount;

    result.buildXi =
      buildXiResults
        .result;

    return result;
  }

  if (poll.type === "best_of_the_month" && poll.bestOfMonth) {
    result.awards = {};
    for (const key of BEST_OF_MONTH_KEYS) {
      const votes = new Map<string, number>();
      const awardSubmissions = submissions.filter(
        (submission) =>
          submission.type === "best_of_the_month" &&
          submission.awardKey === key,
      );

      for (const submission of awardSubmissions) {
        if (submission.type === "best_of_the_month" && submission.awardKey === key) {
          const optionId = String(submission.optionId ?? "");
          if (optionId) votes.set(optionId, (votes.get(optionId) ?? 0) + 1);
        }
      }
      result.awards[key] = poll.bestOfMonth.awards[key].candidates
        .map((candidate) => {
          const candidateVotes = votes.get(candidate.id) ?? 0;

          return {
            ...candidate,
            votes: candidateVotes,
            percentage: votingPercentage(
              candidateVotes,
              awardSubmissions.length,
            ),
          };
        })
        .sort((a, b) => b.votes - a.votes || a.label.localeCompare(b.label, "it"));
    }
    return result;
  }

  if (poll.type === "score_prediction" && poll.scorePrediction) {
    result.scorePrediction = await buildScorePredictionAdminResult({
      poll,
      submissions,
    });
    return result;
  }

  if (
    poll.type ===
      "man_of_the_match" &&
    poll.manOfTheMatch
  ) {
    const motmResult =
      buildManOfTheMatchVotingResult({
        candidates:
          poll.manOfTheMatch
            .candidates,
        submissions,
      });

    result.submissionCount =
      motmResult.validSubmissionCount;
    result.choices =
      motmResult.ranking;
    result.manOfTheMatch = {
      winnerCandidateIds:
        motmResult.winnerCandidateIds,
      isTie:
        motmResult.isTie,
      winners:
        motmResult.winners,
    };

    return result;
  }

  if (
    poll.type ===
      "ceremony_award" &&
    poll.ceremonyAward
  ) {
    const ceremonyResult =
      buildCeremonyAwardVotingResult({
        candidates:
          poll.ceremonyAward
            .candidates,
        submissions,
      });

    result.submissionCount =
      ceremonyResult
        .validSubmissionCount;

    result.choices =
      ceremonyResult.ranking;

    result.ceremonyAward = {
      winnerCandidateIds:
        ceremonyResult
          .winnerCandidateIds,
      isTie:
        ceremonyResult
          .isTie,
      winners:
        ceremonyResult
          .winners,
    };

    return result;
  }

  return result;
}


function validatePollReadyForPublish(poll: GamesVotingPoll) {
  if (poll.type === "build_xi") {
    if (poll.candidateCount < 11) throw new Error("VOTING_NOT_READY");
    return;
  }
  if (
    poll.type ===
    "best_of_the_month"
  ) {
    if (
      !poll.bestOfMonth ||
      !isBestOfMonthConfigReady(
        poll.bestOfMonth.awards,
      )
    ) {
      throw new Error(
        "VOTING_NOT_READY",
      );
    }

    return;
  }
  if (
    poll.type ===
    "score_prediction"
  ) {
    if (
      !poll.scorePrediction ||
      !poll.scorePrediction
        .posterImageUrl
        ?.trim() ||
      poll.scorePrediction
        .scorerOptions.length ===
        0
    ) {
      throw new Error(
        "VOTING_NOT_READY",
      );
    }

    validateScorePredictionScorerOptions(
      poll.scorePrediction
        .scorerOptions,
    );

    if (
      poll.scorePrediction
        .match.kickoffAtMs <=
      Date.now()
    ) {
      throw new Error(
        "MATCH_ALREADY_STARTED",
      );
    }

    return;
  }
  if (
    poll.type ===
    "man_of_the_match"
  ) {
    if (
      !poll.manOfTheMatch
    ) {
      throw new Error(
        "VOTING_NOT_READY",
      );
    }

    validateManOfTheMatchReady({
      candidates:
        poll.manOfTheMatch
          .candidates,
      homeTeamId:
        poll.manOfTheMatch
          .match.homeTeamId,
      awayTeamId:
        poll.manOfTheMatch
          .match.awayTeamId,
    });

    return;
  }
  if (
    poll.type ===
    "ceremony_award"
  ) {
    if (
      !poll.ceremonyAward
    ) {
      throw new Error(
        "VOTING_NOT_READY",
      );
    }

    validateCeremonyAwardReady(
      poll.ceremonyAward,
    );
  }
}

function assertEditableType(poll: GamesVotingPoll, type: VotingType) {
  if (poll.type !== type) throw new Error("INVALID_VOTING_TYPE");
  if (!["setup", "ready"].includes(poll.status)) throw new Error("VOTING_NOT_EDITABLE");
}

async function resolveCompetitionIdentity(competitionId: string): Promise<CompetitionIdentity> {
  const competitionSnapshot = await adminDb.collection("competitions").doc(competitionId).get();
  if (!competitionSnapshot.exists || competitionSnapshot.data()?.status !== "active") {
    throw new Error("ACTIVE_COMPETITION_REQUIRED");
  }
  const seasonsSnapshot = await adminDb.collection("seasons").get();
  const season = seasonsSnapshot.docs.find((document) => {
    const value = document.data();
    return value.competitionId === competitionId &&
      (value.status === "active" || value.isCurrent === true);
  });
  if (!season) throw new Error("ACTIVE_SEASON_REQUIRED");
  return {
    competitionId,
    competitionName: String(competitionSnapshot.data()?.name ?? competitionId),
    seasonId: season.id,
    seasonName: String(season.data().name ?? season.id),
  };
}

function emptyCompetitionIdentity(): CompetitionIdentity {
  return {
    competitionId: "",
    competitionName: "Ludi Experience",
    seasonId: "",
    seasonName: "",
  };
}

function competitionIdentityFromMatch(match: VotingMatchOption): CompetitionIdentity {
  return {
    competitionId: match.competitionId,
    competitionName: match.competitionName,
    seasonId: match.seasonId,
    seasonName: "",
  };
}

async function refreshManOfTheMatchMatchSnapshot(
  poll:
    GamesVotingPoll,
): Promise<
  GamesVotingPoll
> {
  if (
    poll.type !==
      "man_of_the_match" ||
    !poll.manOfTheMatch
  ) {
    return poll;
  }

  const snapshot =
    await adminDb
      .collection(
        "matches",
      )
      .doc(
        poll.manOfTheMatch
          .match.id,
      )
      .get();

  if (
    !snapshot.exists
  ) {
    return {
      ...poll,
      status:
        poll.status ===
          "published"
          ? "closed"
          : poll.status,
    };
  }

  try {
    const currentMatch =
      buildCurrentManOfTheMatchMatch({
        stored:
          poll.manOfTheMatch
            .match,
        data:
          snapshot.data() ??
          {},
      });

    assertManOfTheMatchMatchIdentity({
      stored:
        poll.manOfTheMatch
          .match,
      current:
        currentMatch,
    });

    return {
      ...poll,
      manOfTheMatch: {
        ...poll.manOfTheMatch,
        match:
          currentMatch,
      },
    };
  } catch {
    /*
     * Se la partita viene sostituita o resa incoerente dopo la
     * pubblicazione, il MOTM non deve continuare ad accettare voti.
     */
    return {
      ...poll,
      status:
        poll.status ===
          "published"
          ? "closed"
          : poll.status,
    };
  }
}

function buildCurrentManOfTheMatchMatch({
  stored,
  data,
}: {
  stored:
    VotingMatchOption;
  data:
    Record<
      string,
      unknown
    >;
}): VotingMatchOption {
  const date =
    String(
      data.date ??
      "",
    ).trim();

  const time =
    String(
      data.time ??
      "",
    ).trim();

  const kickoffAtMs =
    parseRomeKickoffMs(
      date,
      time,
    );

  if (
    kickoffAtMs ===
    null
  ) {
    throw new Error(
      "INVALID_MATCH_KICKOFF",
    );
  }

  const seasonId =
    String(
      data.seasonId ??
      stored.seasonId,
    ).trim();

  const competitionId =
    String(
      data.competitionId ??
      stored.competitionId,
    ).trim();

  const homeTeamId =
    String(
      data.homeTeamId ??
      "",
    ).trim();

  const awayTeamId =
    String(
      data.awayTeamId ??
      "",
    ).trim();

  if (
    !seasonId ||
    !competitionId ||
    !homeTeamId ||
    !awayTeamId
  ) {
    throw new Error(
      "INVALID_MATCH",
    );
  }

  return {
    ...stored,
    seasonId,
    competitionId,
    homeTeamId,
    awayTeamId,
    date,
    time,
    kickoffAtMs,
    label:
      `${stored.competitionName} · ${stored.homeTeamName} - ${stored.awayTeamName} · ${formatItalianDate(date)} ${time}`,
    isUpcoming:
      kickoffAtMs >
      Date.now(),
  };
}

async function refreshScorePredictionMatchSnapshot(
  poll:
    GamesVotingPoll,
): Promise<
  GamesVotingPoll
> {
  if (
    poll.type !==
      "score_prediction" ||
    !poll.scorePrediction
  ) {
    return poll;
  }

  const snapshot =
    await adminDb
      .collection(
        "matches",
      )
      .doc(
        poll.scorePrediction
          .match.id,
      )
      .get();

  if (
    !snapshot.exists
  ) {
    return {
      ...poll,
      status:
        "closed",
    };
  }

  try {
    const currentMatch =
      buildCurrentScorePredictionMatch({
        stored:
          poll.scorePrediction
            .match,
        data:
          snapshot.data() ??
          {},
      });

    assertScorePredictionMatchIdentity({
      stored:
        poll.scorePrediction
          .match,
      current:
        currentMatch,
    });

    return {
      ...poll,
      scorePrediction: {
        ...poll.scorePrediction,
        match:
          currentMatch,
      },
    };
  } catch {
    return {
      ...poll,
      status:
        "closed",
    };
  }
}

function buildCurrentScorePredictionMatch({
  stored,
  data,
}: {
  stored:
    VotingMatchOption;
  data:
    Record<
      string,
      unknown
    >;
}): VotingMatchOption {
  const date =
    String(
      data.date ??
      "",
    ).trim();

  const time =
    String(
      data.time ??
      "",
    ).trim();

  const kickoffAtMs =
    parseRomeKickoffMs(
      date,
      time,
    );

  if (
    kickoffAtMs ===
    null
  ) {
    throw new Error(
      "INVALID_MATCH_KICKOFF",
    );
  }

  const homeTeamId =
    String(
      data.homeTeamId ??
      "",
    ).trim();

  const awayTeamId =
    String(
      data.awayTeamId ??
      "",
    ).trim();

  const seasonId =
    String(
      data.seasonId ??
      stored.seasonId,
    ).trim();

  const competitionId =
    String(
      data.competitionId ??
      stored.competitionId,
    ).trim();

  if (
    !homeTeamId ||
    !awayTeamId ||
    !seasonId ||
    !competitionId
  ) {
    throw new Error(
      "INVALID_MATCH",
    );
  }

  return {
    ...stored,
    seasonId,
    competitionId,
    date,
    time,
    kickoffAtMs,
    homeTeamId,
    awayTeamId,
    label:
      `${stored.competitionName} · ${stored.homeTeamName} - ${stored.awayTeamName} · ${formatItalianDate(date)} ${time}`,
    isUpcoming:
      kickoffAtMs >
      Date.now(),
  };
}

async function requireVotingMatch(matchId: string, mustBeUpcoming: boolean): Promise<VotingMatchOption> {
  const match = (await listVotingMatchOptions()).find((candidate) => candidate.id === matchId);
  if (!match) throw new Error("MATCH_NOT_FOUND");
  if (mustBeUpcoming && !match.isUpcoming) throw new Error("MATCH_ALREADY_STARTED");
  return match;
}

async function enrichVotingPollTeamLogos(poll: GamesVotingPoll): Promise<GamesVotingPoll> {
  const match = poll.type === "score_prediction"
    ? poll.scorePrediction?.match
    : poll.type === "man_of_the_match"
      ? poll.manOfTheMatch?.match
      : undefined;

  if (!match?.homeTeamId || !match.awayTeamId) return poll;

  const [homeTeamSnapshot, awayTeamSnapshot] = await Promise.all([
    adminDb.collection("teams").doc(match.homeTeamId).get(),
    adminDb.collection("teams").doc(match.awayTeamId).get(),
  ]);

  const homeTeamLogoUrl = String(homeTeamSnapshot.data()?.logoUrl ?? match.homeTeamLogoUrl ?? "").trim();
  const awayTeamLogoUrl = String(awayTeamSnapshot.data()?.logoUrl ?? match.awayTeamLogoUrl ?? "").trim();
  const enrichedMatch: VotingMatchOption = {
    ...match,
    ...(homeTeamLogoUrl ? { homeTeamLogoUrl } : {}),
    ...(awayTeamLogoUrl ? { awayTeamLogoUrl } : {}),
  };

  if (poll.type === "score_prediction" && poll.scorePrediction) {
    return {
      ...poll,
      scorePrediction: {
        ...poll.scorePrediction,
        match: enrichedMatch,
      },
    };
  }

  if (poll.type === "man_of_the_match" && poll.manOfTheMatch) {
    return {
      ...poll,
      manOfTheMatch: {
        ...poll.manOfTheMatch,
        match: enrichedMatch,
      },
    };
  }

  return poll;
}

function normalizeCandidates(input: VotingCandidate[], minimum: number): VotingCandidate[] {
  const seen = new Set<string>();
  const result = input.flatMap((candidate, index) => {
    const label = String(candidate.label ?? "").trim();
    if (!label) return [];
    const baseId = String(candidate.id ?? candidate.playerId ?? `candidate-${index + 1}`).trim();
    const id = baseId || `candidate-${index + 1}`;
    if (seen.has(id)) throw new Error("DUPLICATE_CANDIDATE");
    seen.add(id);
    return [{
      id,
      label,
      ...(candidate.description?.trim() ? { description: candidate.description.trim() } : {}),
      ...(candidate.imageUrl?.trim() ? { imageUrl: candidate.imageUrl.trim() } : {}),
      ...(candidate.playerId?.trim() ? { playerId: candidate.playerId.trim() } : {}),
      ...(candidate.teamId?.trim() ? { teamId: candidate.teamId.trim() } : {}),
      ...(candidate.teamName?.trim() ? { teamName: candidate.teamName.trim() } : {}),
    } satisfies VotingCandidate];
  });
  if (result.length < minimum) throw new Error("CANDIDATES_REQUIRED");
  return result;
}

function bestOfMonthSubmissionId(pollId: string, awardKey: BestOfMonthAwardKey, uid: string) {
  return `${pollId}_${awardKey}_${uid}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "Europe/Rome" })
    .format(new Date(Date.UTC(year, month - 1, 15)))
    .replace(/^./, (value) => value.toUpperCase());
}

function formatItalianDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date;
}

function parseRomeKickoffMs(date: string, time: string): number | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!dateMatch || !timeMatch) return null;
  const expected = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  };
  if (expected.month < 1 || expected.month > 12 || expected.day < 1 || expected.day > 31 || expected.hour > 23 || expected.minute > 59) return null;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const offset = (timestamp: number) => {
    const parts = formatter.formatToParts(new Date(timestamp));
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value ?? 0);
    return Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second")) - timestamp;
  };
  const wall = Date.UTC(expected.year, expected.month - 1, expected.day, expected.hour, expected.minute, 0);
  let utc = wall - offset(wall);
  utc = wall - offset(utc);
  return utc;
}

async function loadCollection(name: string): Promise<PlainDoc[]> {
  const snapshot = await adminDb.collection(name).get();
  return snapshot.docs.map((document) => ({ id: document.id, data: document.data() }));
}

