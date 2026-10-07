import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/src/lib/firebaseAdmin";
import { currentRomeDateTimeKey, isSurvivorRoundClosedAt } from "@/src/services/games/survivor/SurvivorTime";
import { resolveCollectiveSurvivorRound, shouldConsumeSurvivorTeam } from "@/src/services/games/survivor/SurvivorRoundRules";
import {
  isSurvivorRoundMatchTerminal,
  isSurvivorSelectionNeutralWithoutReport,
  resolveSurvivorWinnerUserId,
} from "@/src/services/games/survivor/SurvivorProgressRules";
import {
  resolveSurvivorOutcome,
  type SurvivorChoice,
  type SurvivorPlayerStatus,
  type SurvivorRuntime,
} from "@/src/types/GamesSurvivor";

const CONFIGS = "gamesSurvivorConfigs";
const ENTRIES = "gamesSurvivorEntries";

type SourceMatch = { id: string } & Record<string, unknown>;
type EntryData = { userId?: string; choices?: Record<string, SurvivorChoice> };
type Evaluation = { status: SurvivorPlayerStatus; usedTeamIds: string[]; eliminatedAt?: number };

type RoundOutcome =
  | "qualified"
  | "postponed"
  | "eliminated_result"
  | "eliminated_other"
  | "pending";

type EditionResolution = {
  revivedMatchweeks: Set<number>;
  winnerUserId?: string;
};

export async function getSurvivorConfig(gameId: string) {
  const snapshot = await adminDb.collection(CONFIGS).doc(gameId).get();
  return snapshot.exists ? snapshot.data() ?? null : null;
}

export async function saveSurvivorConfig(input: { gameId: string; competitionId: string; adminUid: string }) {
  const competition = await adminDb.collection("competitions").doc(input.competitionId).get();
  if (!competition.exists || competition.data()?.status !== "active") throw new Error("ACTIVE_COMPETITION_REQUIRED");
  const season = await findActiveSeason(input.competitionId);
  if (!season) throw new Error("ACTIVE_SEASON_REQUIRED");
  const [matches, reports] = await Promise.all([
    loadSeasonMatches(season.id),
    adminDb.collection("matchReports").get(),
  ]);
  const reportsByMatchId = buildPublishedReportsByMatchId(reports.docs);
  const currentMatchweek = resolveRealMatchweek(matches, reportsByMatchId);
  if (currentMatchweek === null) throw new Error("NO_MATCHWEEK_AVAILABLE");
  const existing = await getSurvivorConfig(input.gameId);
  const existingStartMatchweek = finitePositiveInteger(existing?.startMatchweek);
  const startMatchweek =
    existing?.seasonId === season.id &&
    existingStartMatchweek !== null &&
    existingStartMatchweek <= currentMatchweek
      ? existingStartMatchweek
      : currentMatchweek;
  await adminDb.collection(CONFIGS).doc(input.gameId).set({
    gameId: input.gameId,
    competitionId: input.competitionId,
    competitionName: String(competition.data()?.name ?? input.competitionId),
    seasonId: season.id,
    startMatchweek: existing?.seasonId === season.id && existing.startMatchweek ? existing.startMatchweek : startMatchweek,
    status: "active",
    updatedBy: input.adminUid,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function getSurvivorRuntime(gameId: string, uid: string): Promise<SurvivorRuntime> {
  const config = await getSurvivorConfig(gameId);
  if (!config) throw new Error("SURVIVOR_NOT_CONFIGURED");
  const competitionId = String(config.competitionId ?? "");
  const season = await findActiveSeason(competitionId);
  if (!season) throw new Error("ACTIVE_SEASON_REQUIRED");
  const [matches, teams, reports, entries] = await Promise.all([
    loadSeasonMatches(season.id),
    adminDb.collection("teams").get(),
    adminDb.collection("matchReports").get(),
    adminDb.collection(ENTRIES).get(),
  ]);
  if (!matches.length) throw new Error("NO_MATCHWEEK_AVAILABLE");
  const reportsByMatchId = buildPublishedReportsByMatchId(reports.docs);
  const currentMatchweek = resolveRealMatchweek(matches, reportsByMatchId);
  if (currentMatchweek === null) throw new Error("NO_MATCHWEEK_AVAILABLE");
  const configuredStartMatchweek = finitePositiveInteger(config.startMatchweek);
  const startMatchweek =
    configuredStartMatchweek !== null &&
    configuredStartMatchweek <= currentMatchweek
      ? configuredStartMatchweek
      : currentMatchweek;
  const teamsById = new Map(teams.docs.map((document) => [document.id, document.data()]));
  const editionEntries = entries.docs
    .map((document) => ({ id: document.id, ...document.data() as EntryData }))
    .filter((entry) => entry.id.startsWith(`${gameId}_${season.id}_`));
  const ownEntry = editionEntries.find((entry) => entry.userId === uid);
  const now = currentRomeDateTimeKey();
  const editionResolution = resolveEditionResolution(
    editionEntries,
    matches,
    reportsByMatchId,
    startMatchweek,
    currentMatchweek,
    now,
  );
  const revivedMatchweeks = editionResolution.revivedMatchweeks;
  let ownEvaluation = ownEntry
    ? evaluateEntry(
        ownEntry,
        matches,
        reportsByMatchId,
        startMatchweek,
        currentMatchweek,
        now,
        revivedMatchweeks,
      )
    : evaluateEntry(
        { choices: {} },
        matches,
        reportsByMatchId,
        startMatchweek,
        currentMatchweek,
        now,
        revivedMatchweeks,
      );
  if (editionResolution.winnerUserId === uid) {
    ownEvaluation = { ...ownEvaluation, status: "winner" };
  }
  const currentMatches = matches
    .filter((match) => Number(match.matchweek ?? 0) === currentMatchweek)
    .toSorted(compareMatches);
  const closesAtLabel = kickoffKey(currentMatches[0]);
  const isLocked = isSurvivorRoundClosedAt(closesAtLabel);
  const choices = ownEntry?.choices ?? {};
  const choice = choices[`mw${currentMatchweek}`] ?? null;
  return {
    gameId,
    competitionId,
    competitionName: String(config.competitionName ?? competitionId),
    seasonId: season.id,
    seasonName: String(season.data.name ?? season.id),
    matchweek: currentMatchweek,
    closesAtLabel,
    isLocked,
    canEdit: !isLocked && ["active", "qualified"].includes(ownEvaluation.status),
    status: ownEvaluation.status,
    matches: currentMatches.map((match) => ({
      id: match.id,
      homeTeamId: String(match.homeTeamId ?? ""),
      homeTeamName: teamName(teamsById.get(String(match.homeTeamId ?? "")), "Casa"),
      homeTeamLogoUrl: teamLogoUrl(teamsById.get(String(match.homeTeamId ?? ""))),
      awayTeamId: String(match.awayTeamId ?? ""),
      awayTeamName: teamName(teamsById.get(String(match.awayTeamId ?? "")), "Ospite"),
      awayTeamLogoUrl: teamLogoUrl(teamsById.get(String(match.awayTeamId ?? ""))),
      date: String(match.date ?? ""),
      time: String(match.time ?? ""),
    })),
    choice,
    usedTeamIds: ownEvaluation.usedTeamIds,
  };
}

export async function saveSurvivorChoice(gameId: string, uid: string, teamId: string) {
  const runtime = await getSurvivorRuntime(gameId, uid);

  if (
    !runtime.canEdit ||
    isSurvivorRoundClosedAt(
      runtime.closesAtLabel,
    )
  ) {
    throw new Error(
      runtime.isLocked ||
      isSurvivorRoundClosedAt(
        runtime.closesAtLabel,
      )
        ? "ROUND_LOCKED"
        : "PLAYER_NOT_ACTIVE",
    );
  }

  if (runtime.usedTeamIds.includes(teamId)) {
    throw new Error("TEAM_ALREADY_USED");
  }

  const match =
    runtime.matches.find(
      (item) =>
        item.homeTeamId === teamId ||
        item.awayTeamId === teamId,
    );

  if (!match) {
    throw new Error("TEAM_NOT_IN_MATCHWEEK");
  }

  const teamName =
    match.homeTeamId === teamId
      ? match.homeTeamName
      : match.awayTeamName;

  const reference =
    adminDb
      .collection(ENTRIES)
      .doc(
        `${gameId}_${runtime.seasonId}_${uid}`,
      );

  await adminDb.runTransaction(
    async (transaction) => {
      const snapshot =
        await transaction.get(
          reference,
        );

      /*
       * getSurvivorRuntime() e il commit Firestore non sono atomici.
       * Ripetiamo quindi il cutoff dentro la transaction: una richiesta
       * iniziata pochi istanti prima del kickoff non può essere salvata
       * dopo l'inizio della prima gara.
       */
      if (
        isSurvivorRoundClosedAt(
          runtime.closesAtLabel,
        )
      ) {
        throw new Error(
          "ROUND_LOCKED",
        );
      }

      const existing =
        snapshot.exists
          ? snapshot.data() as EntryData
          : {};

      const choices = {
        ...(existing.choices ?? {}),
      };

      choices[
        `mw${runtime.matchweek}`
      ] = {
        matchweek:
          runtime.matchweek,
        matchId:
          match.id,
        teamId,
        teamName,
      };

      transaction.set(
        reference,
        {
          gameId,
          userId:
            uid,
          competitionId:
            runtime.competitionId,
          seasonId:
            runtime.seasonId,
          choices,
          updatedAt:
            FieldValue.serverTimestamp(),
          ...(
            !snapshot.exists
              ? {
                  createdAt:
                    FieldValue.serverTimestamp(),
                }
              : {}
          ),
        },
        {
          merge:
            true,
        },
      );
    },
  );
}

function evaluateEntry(
  entry: EntryData,
  matches: SourceMatch[],
  reports: Map<string, Record<string, unknown>>,
  startMatchweek: number,
  currentMatchweek: number,
  now: string,
  revivedMatchweeks: ReadonlySet<number>,
): Evaluation {
  const usedTeamIds: string[] = [];
  const choices = entry.choices ?? {};
  for (let matchweek = startMatchweek; matchweek <= currentMatchweek; matchweek += 1) {
    const roundMatches = matches.filter((match) => Number(match.matchweek ?? 0) === matchweek).toSorted(compareMatches);
    if (!roundMatches.length) continue;
    const locked = now >= kickoffKey(roundMatches[0]);
    const choice = choices[`mw${matchweek}`];
    if (!choice) {
      if (locked) return { status: "eliminated", usedTeamIds, eliminatedAt: matchweek };
      return { status: "active", usedTeamIds };
    }
    const selectedMatch = roundMatches.find((match) => match.id === choice.matchId);
    if (!selectedMatch) return { status: "eliminated", usedTeamIds, eliminatedAt: matchweek };

    /*
     * Una partita annullata dal calendario senza tabellino pubblicato
     * è neutrale per il Survivor: il giocatore supera il turno e la
     * squadra NON viene consumata, esattamente come per un report
     * published con status "cancelled".
     */
    if (
      isSurvivorSelectionNeutralWithoutReport(
        selectedMatch.status,
      )
    ) {
      continue;
    }

    const report = reports.get(selectedMatch.id);
    if (!report) return { status: locked ? "waiting_result" : "active", usedTeamIds };
    const outcome = resolveSurvivorOutcome({
      selectedTeamId: choice.teamId,
      homeTeamId: String(selectedMatch.homeTeamId ?? ""),
      awayTeamId: String(selectedMatch.awayTeamId ?? ""),
      status: String(report.status ?? ""),
      homeScore: finiteNumber(report.homeScore) ?? undefined,
      awayScore: finiteNumber(report.awayScore) ?? undefined,
    });
    if (outcome === "pending") {
      return {
        status:
          "waiting_result",
        usedTeamIds,
      };
    }

    const consumesTeam =
      shouldConsumeSurvivorTeam(
        outcome,
      );

    if (
      outcome ===
      "eliminated"
    ) {
      const nextUsedTeamIds =
        consumesTeam
          ? [
              ...usedTeamIds,
              choice.teamId,
            ]
          : usedTeamIds;

      if (
        revivedMatchweeks.has(
          matchweek,
        )
      ) {
        if (consumesTeam) {
          usedTeamIds.push(
            choice.teamId,
          );
        }

        continue;
      }

      return {
        status:
          "eliminated",
        usedTeamIds:
          nextUsedTeamIds,
        eliminatedAt:
          matchweek,
      };
    }

    if (
      consumesTeam
    ) {
      usedTeamIds.push(
        choice.teamId,
      );
    }
  }
  return { status: "qualified", usedTeamIds };
}

function resolveEditionResolution(
  entries: Array<{ id: string } & EntryData>,
  matches: SourceMatch[],
  reports: Map<string, Record<string, unknown>>,
  startMatchweek: number,
  currentMatchweek: number,
  now: string,
): EditionResolution {
  const revivedMatchweeks = new Set<number>();
  let activeEntries = [...entries];

  for (let matchweek = startMatchweek; matchweek <= currentMatchweek; matchweek += 1) {
    const winnerBeforeRound =
      resolveSurvivorWinnerUserId({
        totalEntries:
          entries.length,
        activeUserIds:
          activeEntries.map(
            (entry) =>
              String(
                entry.userId ??
                  "",
              ),
          ),
      });

    if (winnerBeforeRound) {
      return {
        revivedMatchweeks,
        winnerUserId:
          winnerBeforeRound,
      };
    }

    if (activeEntries.length <= 1) break;

    const outcomes = activeEntries.map((entry) =>
      evaluateRoundOutcome(entry, matches, reports, matchweek, now),
    );

    const roundResolution =
      resolveCollectiveSurvivorRound(
        outcomes,
      );

    // Finché anche un solo superstite ha un esito ancora aperto,
    // non assegniamo il vincitore e non decidiamo un eventuale ripescaggio.
    if (
      roundResolution.pending
    ) {
      break;
    }

    if (
      roundResolution.reviveAll
    ) {
      // Tutti i giocatori ancora in corsa hanno perso/pareggiato
      // nello stesso turno: vengono ripescati tutti, ma la squadra
      // scelta resta consumata.
      revivedMatchweeks.add(
        matchweek,
      );

      continue;
    }

    activeEntries =
      activeEntries.filter(
        (
          _,
          index,
        ) =>
          roundResolution
            .survivingIndexes
            .includes(
              index,
            ),
      );

    const winnerAfterRound =
      resolveSurvivorWinnerUserId({
        totalEntries:
          entries.length,
        activeUserIds:
          activeEntries.map(
            (entry) =>
              String(
                entry.userId ??
                  "",
              ),
          ),
      });

    if (winnerAfterRound) {
      return {
        revivedMatchweeks,
        winnerUserId:
          winnerAfterRound,
      };
    }
  }

  return { revivedMatchweeks };
}

function evaluateRoundOutcome(
  entry: EntryData,
  matches: SourceMatch[],
  reports: Map<string, Record<string, unknown>>,
  matchweek: number,
  now: string,
): RoundOutcome {
  const roundMatches = matches
    .filter((match) => Number(match.matchweek ?? 0) === matchweek)
    .toSorted(compareMatches);

  if (!roundMatches.length) return "pending";

  const locked = now >= kickoffKey(roundMatches[0]);
  const choice = entry.choices?.[`mw${matchweek}`];

  if (!choice) {
    return locked ? "eliminated_other" : "pending";
  }

  const selectedMatch = roundMatches.find((match) => match.id === choice.matchId);
  if (!selectedMatch) return "eliminated_other";

  if (
    isSurvivorSelectionNeutralWithoutReport(
      selectedMatch.status,
    )
  ) {
    return "postponed";
  }

  const report = reports.get(selectedMatch.id);
  if (!report) return "pending";

  const outcome = resolveSurvivorOutcome({
    selectedTeamId: choice.teamId,
    homeTeamId: String(selectedMatch.homeTeamId ?? ""),
    awayTeamId: String(selectedMatch.awayTeamId ?? ""),
    status: String(report.status ?? ""),
    homeScore: finiteNumber(report.homeScore) ?? undefined,
    awayScore: finiteNumber(report.awayScore) ?? undefined,
  });

  if (outcome === "qualified") return "qualified";
  if (outcome === "postponed") return "postponed";
  if (outcome === "eliminated") return "eliminated_result";
  return "pending";
}

async function findActiveSeason(competitionId: string) {
  const seasons = await adminDb.collection("seasons").get();
  const document = seasons.docs.find((item) => {
    const value = item.data();
    return value.competitionId === competitionId && (value.status === "active" || value.isCurrent === true);
  });
  return document ? { id: document.id, data: document.data() } : null;
}

async function loadSeasonMatches(seasonId: string): Promise<SourceMatch[]> {
  const snapshot = await adminDb.collection("matches").get();
  return snapshot.docs
    .filter((document) => document.data().seasonId === seasonId && document.data().published !== false)
    .map((document) => ({ id: document.id, ...(document.data() as Record<string, unknown>) }));
}


function buildPublishedReportsByMatchId(
  documents: Array<{ id: string; data: () => Record<string, unknown> }>,
): Map<string, Record<string, unknown>> {
  return new Map(
    documents
      .filter((document) => document.data().status === "published")
      .map((document) => {
        const data = document.data();
        return [
          String(data.matchId ?? document.id),
          asRecord(data.data),
        ] as const;
      }),
  );
}

function resolveRealMatchweek(
  matches: SourceMatch[],
  reportsByMatchId: Map<string, Record<string, unknown>>,
): number | null {
  const matchweeks = Array.from(
    new Set(
      matches
        .map((match) => finitePositiveInteger(match.matchweek))
        .filter((value): value is number => value !== null),
    ),
  ).sort((first, second) => first - second);

  if (matchweeks.length === 0) {
    return null;
  }

  for (const matchweek of matchweeks) {
    const roundMatches = matches.filter(
      (match) => finitePositiveInteger(match.matchweek) === matchweek,
    );

    const isComplete =
      roundMatches.length > 0 &&
      roundMatches.every((match) => {
        const report = reportsByMatchId.get(match.id);
        const reportStatus = String(report?.status ?? "").toLowerCase();
        const matchStatus = String(match.status ?? "").toLowerCase();

        return isSurvivorRoundMatchTerminal({
          reportStatus,
          matchStatus,
        });
      });

    if (!isComplete) {
      return matchweek;
    }
  }

  return matchweeks[matchweeks.length - 1] ?? null;
}

function finitePositiveInteger(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function compareMatches(a: SourceMatch, b: SourceMatch) { return kickoffKey(a).localeCompare(kickoffKey(b)); }
function kickoffKey(match: SourceMatch) { return `${String(match.date ?? "")} ${String(match.time ?? "00:00")}`; }
function teamName(value: Record<string, unknown> | undefined, fallback: string) { return String(value?.aliasName ?? value?.name ?? fallback); }
function teamLogoUrl(value: Record<string, unknown> | undefined): string | undefined {
  const logoUrl = typeof value?.logoUrl === "string" ? value.logoUrl.trim() : "";
  return logoUrl || undefined;
}
function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function finiteNumber(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
