import "server-only";

import { createHash } from "node:crypto";
import { FieldValue, type DocumentData, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/src/lib/firebaseAdmin";
import { isPredictionTicketClosedAt } from "@/src/services/games/prediction/PredictionTime";
import {
  calculatePredictionScore,
  calculatePredictionMaxScore,
  resolveGoalBand,
  resolveOneXTwo,
  type PredictionSelection,
  type PredictionResultStatus,
  type PredictionTicket,
  type PredictionLeaderboardEntry,
} from "@/src/types/GamesPrediction";
import { isPerfectPredictionTicket } from "@/src/services/games/prediction/PredictionPerfectTicket";
import { buildPerfectTicketNotification, perfectTicketNotificationId } from "@/src/services/games/prediction/PredictionWinnerNotification";

const CONFIGS = "gamesPredictionConfigs";
const SUBMISSIONS = "gamesPredictionSubmissions";
const ROUNDS = "gamesPredictionRounds";
const ADMIN_NOTIFICATIONS = "adminNotifications";
const TARGET_MATCH_COUNT = 10;
const LEAGUE_ONE_COMPETITION_ID = "league-one";
const LEAGUE_ONE_COMPETITION_NAME = "League One";

type RawPredictionMatch = {
  id: string;
  seasonId: string;
  matchweek: number;
  date: string;
  time: string;
  homeTeamId: string;
  awayTeamId: string;
  published: boolean;
};


type PredictionResolvedResult = {
  matchId: string;
  status: PredictionResultStatus;
  homeScore?: number;
  awayScore?: number;
};

type PerfectTicketSyncFilter = {
  gameId?: string;
  seasonId?: string;
  matchweek?: number;
};

type PerfectTicketCandidate = {
  gameId: string;
  seasonId: string;
  matchweek: number;
  userId: string;
};

export async function syncPerfectPredictionWinnerNotifications(
  filter: PerfectTicketSyncFilter = {},
): Promise<number> {
  const submissionsReference =
    filter.gameId
      ? adminDb
          .collection(SUBMISSIONS)
          .where("gameId", "==", filter.gameId)
      : adminDb.collection(SUBMISSIONS);

  const [submissionsSnapshot, reportsSnapshot] =
    await Promise.all([
      submissionsReference.get(),
      adminDb.collection("matchReports").get(),
    ]);

  const resultByMatchId =
    new Map<string, PredictionResolvedResult>();

  for (const reportDocument of reportsSnapshot.docs) {
    const wrapper =
      asRecord(
        reportDocument.data(),
      );

    if (
      wrapper.status !==
      "published"
    ) {
      continue;
    }

    const reportData =
      predictionReportData(
        wrapper,
      );

    const status =
      predictionResultStatus(
        reportData.status,
      );

    if (!status) {
      continue;
    }

    const matchId =
      String(
        wrapper.matchId ??
          reportData.matchId ??
          reportDocument.id,
      ).trim();

    if (!matchId) {
      continue;
    }

    if (
      status ===
      "postponed"
    ) {
      resultByMatchId.set(
        matchId,
        {
          matchId,
          status,
        },
      );

      continue;
    }

    const homeScore =
      finiteNumber(
        reportData.homeScore,
      );

    const awayScore =
      finiteNumber(
        reportData.awayScore,
      );

    if (
      homeScore === null ||
      awayScore === null
    ) {
      continue;
    }

    resultByMatchId.set(
      matchId,
      {
        matchId,
        status,
        homeScore,
        awayScore,
      },
    );
  }

  const perfectCandidates:
    PerfectTicketCandidate[] = [];

  for (const document of submissionsSnapshot.docs) {
    const submission =
      document.data();

    const gameId =
      String(
        submission.gameId ?? "",
      ).trim();

    const seasonId =
      String(
        submission.seasonId ?? "",
      ).trim();

    const matchweek =
      Number(
        submission.matchweek ?? 0,
      );

    const userId =
      String(
        submission.userId ?? "",
      ).trim();

    if (
      !gameId ||
      !seasonId ||
      !userId ||
      !Number.isFinite(matchweek) ||
      matchweek <= 0
    ) {
      continue;
    }

    if (
      filter.gameId &&
      gameId !==
        filter.gameId
    ) {
      continue;
    }

    if (
      filter.seasonId &&
      seasonId !==
        filter.seasonId
    ) {
      continue;
    }

    if (
      typeof filter.matchweek ===
        "number" &&
      matchweek !==
        filter.matchweek
    ) {
      continue;
    }

    const selections =
      Array.isArray(
        submission.selections,
      )
        ? submission.selections as
            PredictionSelection[]
        : [];

    if (
      selections.length !==
      TARGET_MATCH_COUNT
    ) {
      continue;
    }

    const selectedMatchIds =
      selections.map(
        (
          selection,
        ) =>
          String(
            selection.matchId ?? "",
          ).trim(),
      );

    if (
      selectedMatchIds.some(
        (
          matchId,
        ) =>
          !matchId,
      ) ||
      new Set(
        selectedMatchIds,
      ).size !==
        TARGET_MATCH_COUNT
    ) {
      continue;
    }

    const storedMatchIds =
      normalizeStringArray(
        submission.matchIds,
      );

    if (
      storedMatchIds.length >
        0 &&
      (
        storedMatchIds.length !==
          TARGET_MATCH_COUNT ||
        new Set(
          storedMatchIds,
        ).size !==
          TARGET_MATCH_COUNT ||
        storedMatchIds.some(
          (
            matchId,
          ) =>
            !selectedMatchIds.includes(
              matchId,
            ),
        )
      )
    ) {
      continue;
    }

    const results:
      PredictionResolvedResult[] = [];

    let complete =
      true;

    for (const matchId of selectedMatchIds) {
      const result =
        resultByMatchId.get(
          matchId,
        );

      if (!result) {
        complete =
          false;

        break;
      }

      /*
       * Una partita rinviata è comunque un esito definitivo
       * ai fini della schedina: vale 0 punti sia ottenuti sia
       * disponibili e quindi non deve impedire la verifica del
       * massimo punteggio raggiungibile.
       */
      if (
        result.status ===
        "postponed"
      ) {
        results.push(
          result,
        );

        continue;
      }

      /*
       * Per partite giocate o vinte a tavolino servono i punteggi
       * finali. calculatePredictionMaxScore assegna 50 punti a una
       * gara normale e 30 a una gara a tavolino.
       */
      if (
        (
          result.status ===
            "played" ||
          result.status ===
            "walkover"
        ) &&
        result.homeScore !==
          undefined &&
        result.awayScore !==
          undefined
      ) {
        results.push(
          result,
        );

        continue;
      }

      complete =
        false;

      break;
    }

    if (!complete) {
      continue;
    }

    /*
     * La "schedina vincente" non richiede 500 punti fissi.
     * Vince chi raggiunge il massimo effettivamente disponibile
     * per quella schedina dopo aver considerato rinvii e tavolini.
     *
     * La regola è centralizzata in un helper puro e coperta da test.
     */
    if (
      !isPerfectPredictionTicket(
        selections,
        results,
      )
    ) {
      continue;
    }

    perfectCandidates.push({
      gameId,
      seasonId,
      matchweek,
      userId,
    });
  }

  if (
    perfectCandidates.length ===
    0
  ) {
    return 0;
  }

  const uniqueUserIds =
    [
      ...new Set(
        perfectCandidates.map(
          (
            candidate,
          ) =>
            candidate.userId,
        ),
      ),
    ];

  const userSnapshots =
    await adminDb.getAll(
      ...uniqueUserIds.map(
        (
          userId,
        ) =>
          adminDb
            .collection(
              "users",
            )
            .doc(
              userId,
            ),
      ),
    );

  const displayNameByUserId =
    new Map<
      string,
      string
    >();

  for (const snapshot of userSnapshots) {
    const displayName =
      snapshot.exists
        ? String(
            snapshot
              .data()
              ?.displayName ??
              "",
          ).trim()
        : "";

    displayNameByUserId.set(
      snapshot.id,
      displayName ||
        "Giocatore",
    );
  }

  let createdCount =
    0;

  for (const candidate of perfectCandidates) {
    const displayName =
      displayNameByUserId.get(
        candidate.userId,
      ) ??
      "Giocatore";

    const notificationId =
      perfectTicketNotificationId(
        candidate,
      );

    const reference =
      adminDb
        .collection(
          ADMIN_NOTIFICATIONS,
        )
        .doc(
          notificationId,
        );

    const created =
      await adminDb.runTransaction(
        async (
          transaction,
        ) => {
          const existing =
            await transaction.get(
              reference,
            );

          if (
            existing.exists
          ) {
            return false;
          }

          const notification =
            buildPerfectTicketNotification({
              candidate,
              displayName,
            });

          transaction.create(
            reference,
            {
              ...notification,
              createdAt:
                FieldValue.serverTimestamp(),
              updatedAt:
                FieldValue.serverTimestamp(),
            },
          );

          return true;
        },
      );

    if (created) {
      createdCount +=
        1;
    }
  }

  return createdCount;
}



export async function getPredictionConfig(gameId: string) {
  const snapshot = await adminDb.collection(CONFIGS).doc(gameId).get();
  return snapshot.exists ? snapshot.data() ?? null : null;
}

export async function savePredictionConfig(input: { gameId: string; competitionId: string; adminUid: string }) {
  const competition = await adminDb.collection("competitions").doc(input.competitionId).get();
  if (!competition.exists || competition.data()?.status !== "active") throw new Error("ACTIVE_COMPETITION_REQUIRED");
  await adminDb.collection(CONFIGS).doc(input.gameId).set({
    gameId: input.gameId,
    competitionId: input.competitionId,
    competitionName: String(competition.data()?.name ?? input.competitionId),
    outcomePoints: 30,
    goalBandPoints: 20,
    goalThreshold: 7.5,
    targetMatchCount: TARGET_MATCH_COUNT,
    secondaryCompetitionId: LEAGUE_ONE_COMPETITION_ID,
    updatedBy: input.adminUid,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export type PredictionAdminMatch = {
  id: string;
  competitionName: string;
  homeTeamName: string;
  awayTeamName: string;
  date: string;
  time: string;
};

export type PredictionAdminPreview = {
  seasonId: string;
  matchweek: number;
  matches: PredictionAdminMatch[];
  closesAt: string;
  isClosed: boolean;
  alreadyPublished: boolean;
};

async function loadPredictionAdminContext(competitionId: string) {
  const [seasonsSnapshot, matchesSnapshot, teamsSnapshot] = await Promise.all([
    adminDb.collection("seasons").get(),
    adminDb.collection("matches").get(),
    adminDb.collection("teams").get(),
  ]);
  const season = seasonsSnapshot.docs.find((document) => {
    const value = document.data();
    return value.competitionId === competitionId &&
      (value.status === "active" || value.isCurrent === true);
  });
  if (!season) throw new Error("ACTIVE_SEASON_REQUIRED");
  const leagueSeason = seasonsSnapshot.docs.find((document) => {
    const value = document.data();
    return value.competitionId === LEAGUE_ONE_COMPETITION_ID &&
      (value.status === "active" || value.isCurrent === true);
  });
  const allMatches = matchesSnapshot.docs.map(normalizeRawMatch).filter((match) => match.published);
  const teamNames = new Map(teamsSnapshot.docs.map((document) => [
    document.id,
    String(document.data().aliasName ?? document.data().name ?? document.id),
  ]));
  return { season, leagueSeason, allMatches, teamNames };
}

export async function getPredictionAdminMatchweeks(competitionId: string) {
  const context = await loadPredictionAdminContext(competitionId);
  const matchweeks = [...new Set(context.allMatches
    .filter((match) => match.seasonId === context.season.id && match.matchweek > 0)
    .map((match) => match.matchweek))].sort((a, b) => a - b);
  return matchweeks;
}

async function buildPredictionAdminPreview(
  gameId: string,
  competitionId: string,
  matchweek: number,
): Promise<PredictionAdminPreview & { matchIds: string[]; championshipIds: string[]; leagueIds: string[]; leagueSeasonId: string | null }> {
  if (!Number.isInteger(matchweek) || matchweek <= 0) throw new Error("INVALID_MATCHWEEK");
  const context = await loadPredictionAdminContext(competitionId);
  const championship = context.allMatches.filter(
    (match) => match.seasonId === context.season.id && match.matchweek === matchweek,
  ).sort(compareMatchKickoff);
  if (!championship.length) throw new Error("NO_MATCHWEEK_AVAILABLE");
  if (championship.length > TARGET_MATCH_COUNT) throw new Error("TOO_MANY_CHAMPIONSHIP_MATCHES");
  const remaining = TARGET_MATCH_COUNT - championship.length;
  // Le giornate numeriche delle competizioni possono essere sfalsate.
  // Selezioniamo solo gare League One della stessa settimana di calendario.
  const firstDate = new Date(`${championship[0].date}T12:00:00Z`);
  if (Number.isNaN(firstDate.getTime())) throw new Error("INVALID_MATCH_DATE");
  const weekday = (firstDate.getUTCDay() + 6) % 7;
  firstDate.setUTCDate(firstDate.getUTCDate() - weekday);
  const weekStart = firstDate.toISOString().slice(0, 10);
  firstDate.setUTCDate(firstDate.getUTCDate() + 7);
  const weekEnd = firstDate.toISOString().slice(0, 10);
  const league = remaining === 0 ? [] : stableRandomOrder(
    context.allMatches.filter((match) =>
      match.seasonId === context.leagueSeason?.id &&
      match.date >= weekStart && match.date < weekEnd,
    ), `${gameId}_${context.season.id}_mw${matchweek}:league`
  ).slice(0, remaining);
  if (league.length !== remaining) throw new Error("NOT_ENOUGH_PREDICTION_MATCHES");
  const selected = [...championship, ...league];
  const closesAt = selected.map(matchDateTimeKey).sort()[0];
  const roundRef = adminDb.collection(ROUNDS).doc(`${gameId}_${context.season.id}_mw${matchweek}`);
  const round = await roundRef.get();
  const alreadyPublished = round.exists && round.data()?.status === "published";
  return {
    seasonId: context.season.id, matchweek,
    matches: selected.map((match) => ({
      id: match.id,
      competitionName: championship.includes(match) ? "Championship" : LEAGUE_ONE_COMPETITION_NAME,
      homeTeamName: context.teamNames.get(match.homeTeamId) ?? "Casa",
      awayTeamName: context.teamNames.get(match.awayTeamId) ?? "Ospite",
      date: match.date, time: match.time,
    })),
    closesAt,
    isClosed: isPredictionTicketClosedAt(closesAt),
    alreadyPublished,
    matchIds: selected.map((match) => match.id),
    championshipIds: championship.map((match) => match.id),
    leagueIds: league.map((match) => match.id),
    leagueSeasonId: context.leagueSeason?.id ?? null,
  };
}

export async function previewPredictionRound(gameId: string, competitionId: string, matchweek: number): Promise<PredictionAdminPreview> {
  const preview = await buildPredictionAdminPreview(gameId, competitionId, matchweek);
  return {
    seasonId: preview.seasonId,
    matchweek: preview.matchweek,
    matches: preview.matches,
    closesAt: preview.closesAt,
    isClosed: preview.isClosed,
    alreadyPublished: preview.alreadyPublished,
  };
}

export async function publishPredictionRound(input: {
  gameId: string;
  competitionId: string;
  matchweek: number;
  adminUid: string;
}) {
  const config = await getPredictionConfig(input.gameId);
  if (!config || config.competitionId !== input.competitionId) throw new Error("PREDICTION_NOT_CONFIGURED");
  const preview = await buildPredictionAdminPreview(input.gameId, input.competitionId, input.matchweek);
  if (preview.isClosed) throw new Error("TICKET_LOCKED");
  const roundRef = adminDb.collection(ROUNDS)
    .doc(`${input.gameId}_${preview.seasonId}_mw${input.matchweek}`);
  const configRef = adminDb.collection(CONFIGS).doc(input.gameId);
  await adminDb.runTransaction(async (transaction) => {
    const [existingRound, currentConfig] = await Promise.all([
      transaction.get(roundRef), transaction.get(configRef),
    ]);
    if (!currentConfig.exists || currentConfig.data()?.competitionId !== input.competitionId) {
      throw new Error("PREDICTION_NOT_CONFIGURED");
    }
    if (isPredictionTicketClosedAt(preview.closesAt)) throw new Error("TICKET_LOCKED");
    if (existingRound.exists) {
      const oldIds = normalizeStringArray(existingRound.data()?.selectedMatchIds);
      if (oldIds.length !== TARGET_MATCH_COUNT ||
        oldIds.some((id, index) => id !== preview.matchIds[index])) {
        throw new Error("PREDICTION_ROUND_ALREADY_EXISTS");
      }
    }
    if (!existingRound.exists || existingRound.data()?.status !== "published") {
      transaction.set(roundRef, {
      gameId: input.gameId,
      competitionId: input.competitionId,
      championshipSeasonId: preview.seasonId,
      matchweek: input.matchweek,
      targetMatchCount: TARGET_MATCH_COUNT,
      championshipMatchIds: preview.championshipIds,
      leagueOneCompetitionId: LEAGUE_ONE_COMPETITION_ID,
      leagueOneSeasonId: preview.leagueSeasonId,
      leagueOneMatchIds: preview.leagueIds,
      selectedMatchIds: preview.matchIds,
      status: "published",
      publishedBy: input.adminUid,
      publishedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    transaction.update(configRef, {
      activeMatchweek: input.matchweek,
      activeSeasonId: preview.seasonId,
      updatedBy: input.adminUid,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { success: true, matchweek: input.matchweek };
}

export async function getPredictionTicket(gameId: string, uid: string): Promise<PredictionTicket> {
  const config = await getPredictionConfig(gameId);
  if (!config) throw new Error("PREDICTION_NOT_CONFIGURED");

  const competitionId = String(config.competitionId ?? "");
  const competitionName = String(config.competitionName ?? competitionId);

  const [seasons, matches, teams, reports] = await Promise.all([
    adminDb.collection("seasons").get(),
    adminDb.collection("matches").get(),
    adminDb.collection("teams").get(),
    adminDb.collection("matchReports").get(),
  ]);

  const season = seasons.docs.find((document) => {
    const value = document.data();
    return value.competitionId === competitionId && (value.status === "active" || value.isCurrent === true);
  });
  if (!season) throw new Error("ACTIVE_SEASON_REQUIRED");

  const championshipMatches = matches.docs
    .map(normalizeRawMatch)
    .filter((match) => match.seasonId === season.id && match.published);

  if (championshipMatches.length === 0) throw new Error("NO_MATCHWEEK_AVAILABLE");

  const matchweek = Number(config.activeMatchweek ?? 0);
  if (config.activeSeasonId !== season.id) throw new Error("PREDICTION_NOT_PUBLISHED");
  if (!Number.isInteger(matchweek) || matchweek <= 0) {
    throw new Error("PREDICTION_NOT_PUBLISHED");
  }

  const championshipMatchweekMatches = championshipMatches
    .filter((match) => match.matchweek === matchweek)
    .toSorted(compareMatchKickoff);

  if (championshipMatchweekMatches.length === 0) throw new Error("NO_MATCHWEEK_AVAILABLE");
  if (championshipMatchweekMatches.length > TARGET_MATCH_COUNT) throw new Error("TOO_MANY_CHAMPIONSHIP_MATCHES");

  const leagueOneSeason = seasons.docs.find((document) => {
    const value = document.data();
    return value.competitionId === LEAGUE_ONE_COMPETITION_ID && (value.status === "active" || value.isCurrent === true);
  });

  const allLeagueOneMatches = leagueOneSeason
    ? matches.docs
        .map(normalizeRawMatch)
        .filter((match) => match.seasonId === leagueOneSeason.id)
    : [];

  const ticketMatches = await resolvePredictionRoundMatches({
    gameId,
    competitionId,
    competitionName,
    championshipSeasonId: season.id,
    matchweek,
    championshipMatches: championshipMatchweekMatches,
    leagueOneSeasonId: leagueOneSeason?.id ?? null,
    allLeagueOneMatches,
  });

  const closesAtKey = ticketMatches
    .map(({ match }) => matchDateTimeKey(match))
    .toSorted()[0];

  if (!closesAtKey) throw new Error("NO_MATCHWEEK_AVAILABLE");

  const teamsById = new Map(teams.docs.map((document) => [document.id, document.data()]));
  const reportsByMatchId = new Map(reports.docs
    .filter((document) => document.data().status === "published")
    .map((document) => [String(document.data().matchId ?? document.id), document.data()]));

  const timeLocked = isPredictionTicketClosedAt(closesAtKey);
  const submissionId = `${gameId}_${season.id}_mw${matchweek}_${uid}`;
  const submission = await adminDb.collection(SUBMISSIONS).doc(submissionId).get();
  const selections = submission.exists && Array.isArray(submission.data()?.selections)
    ? submission.data()?.selections as PredictionSelection[]
    : [];
  const isLocked = timeLocked || submission.exists;

  const results: Array<{
    matchId: string;
    status: PredictionResultStatus;
    homeScore?: number;
    awayScore?: number;
  }> = [];

  const mappedMatches = ticketMatches.map(({ match, sourceCompetitionId, sourceCompetitionName }) => {
    const report = reportsByMatchId.get(match.id);
    const reportData =
      predictionReportData(
        report,
      );
    const homeScore = finiteNumber(reportData.homeScore);
    const awayScore = finiteNumber(reportData.awayScore);
    const reportStatus = predictionResultStatus(reportData.status);

    if (reportStatus === "postponed") {
      results.push({ matchId: match.id, status: "postponed" });
    } else if (reportStatus && homeScore !== null && awayScore !== null) {
      results.push({ matchId: match.id, status: reportStatus, homeScore, awayScore });
    }

    const homeTeam = teamsById.get(match.homeTeamId);
    const awayTeam = teamsById.get(match.awayTeamId);

    return {
      id: match.id,
      competitionId: sourceCompetitionId,
      competitionName: sourceCompetitionName,
      homeTeamName: String(homeTeam?.aliasName ?? homeTeam?.name ?? "Casa"),
      awayTeamName: String(awayTeam?.aliasName ?? awayTeam?.name ?? "Ospite"),
      date: match.date,
      time: match.time,
      ...(reportStatus === "postponed"
        ? { result: { status: "postponed" as const } }
        : reportStatus && homeScore !== null && awayScore !== null
          ? {
              result: {
                status: reportStatus,
                homeScore,
                awayScore,
                oneXTwo: resolveOneXTwo(homeScore, awayScore),
                ...(reportStatus === "walkover" ? {} : { goalBand: resolveGoalBand(homeScore, awayScore) }),
              },
            }
          : {}),
    };
  });

  const isScored = results.length === ticketMatches.length;

  if (
    isScored
  ) {
    await syncPerfectPredictionWinnerNotifications({
      gameId,
      seasonId:
        season.id,
      matchweek,
    }).catch(
      (
        error,
      ) => {
        console.error(
          "Errore sincronizzazione vincitore Ludi Bet Club:",
          error,
        );
      },
    );
  }

  const seasonLeaderboard = await getPredictionSeasonLeaderboard({
    gameId,
    seasonId: season.id,
    reportsByMatchId,
  });

  return {
    gameId,
    competitionId,
    competitionName,
    seasonId: season.id,
    seasonName: String(season.data().name ?? season.id),
    matchweek,
    matchweekId: `mw${matchweek}`,
    closesAtLabel: closesAtKey,
    isLocked,
    matches: mappedMatches,
    selections,
    submittedAt: submission.data()?.submittedAt,
    score: isScored && submission.exists ? calculatePredictionScore(selections, results) : undefined,
    maxScore: isScored ? calculatePredictionMaxScore(results) : TARGET_MATCH_COUNT * 50,
    isScored,
    seasonLeaderboard,
  };
}

async function resolvePredictionRoundMatches({
  gameId,
  competitionId,
  competitionName,
  championshipSeasonId,
  matchweek,
  championshipMatches,
  allLeagueOneMatches,
}: {
  gameId: string;
  competitionId: string;
  competitionName: string;
  championshipSeasonId: string;
  matchweek: number;
  championshipMatches: RawPredictionMatch[];
  leagueOneSeasonId: string | null;
  allLeagueOneMatches: RawPredictionMatch[];
}) {
  const roundId = `${gameId}_${championshipSeasonId}_mw${matchweek}`;
  const roundRef = adminDb.collection(ROUNDS).doc(roundId);
  const allMatchesById = new Map<string, {
    match: RawPredictionMatch;
    sourceCompetitionId: string;
    sourceCompetitionName: string;
  }>();

  for (const match of championshipMatches) {
    allMatchesById.set(match.id, {
      match,
      sourceCompetitionId: competitionId,
      sourceCompetitionName: competitionName,
    });
  }

  for (const match of allLeagueOneMatches) {
    allMatchesById.set(match.id, {
      match,
      sourceCompetitionId: LEAGUE_ONE_COMPETITION_ID,
      sourceCompetitionName: LEAGUE_ONE_COMPETITION_NAME,
    });
  }

  const resolvedMatchIds = await adminDb.runTransaction(async (transaction) => {
    const existing = await transaction.get(roundRef);

    if (existing.exists) {
      if (existing.data()?.status !== "published") throw new Error("PREDICTION_NOT_PUBLISHED");
      const storedIds = normalizeStringArray(existing.data()?.selectedMatchIds);
      if (storedIds.length !== TARGET_MATCH_COUNT) throw new Error("PREDICTION_ROUND_INVALID");
      if (storedIds.some((matchId) => !allMatchesById.has(matchId))) throw new Error("PREDICTION_ROUND_INVALID");
      return storedIds;
    }

    // Nessuna scrittura durante la lettura pubblica.
    throw new Error("PREDICTION_NOT_PUBLISHED");
  });

  return resolvedMatchIds.map((matchId) => {
    const resolved = allMatchesById.get(matchId);
    if (!resolved) throw new Error("PREDICTION_ROUND_INVALID");
    return resolved;
  });
}

function stableRandomOrder(matches: RawPredictionMatch[], seed: string) {
  return [...matches].sort((first, second) => {
    const firstHash = createHash("sha256").update(`${seed}:${first.id}`).digest("hex");
    const secondHash = createHash("sha256").update(`${seed}:${second.id}`).digest("hex");
    return firstHash.localeCompare(secondHash) || first.id.localeCompare(second.id);
  });
}

async function getPredictionSeasonLeaderboard({
  gameId,
  seasonId,
  reportsByMatchId,
}: {
  gameId: string;
  seasonId: string;
  reportsByMatchId: Map<string, DocumentData>;
}): Promise<PredictionLeaderboardEntry[]> {
  const submissionsSnapshot = await adminDb
    .collection(SUBMISSIONS)
    .where("gameId", "==", gameId)
    .get();

  const totalsByUser = new Map<
    string,
    { totalScore: number; submittedTickets: number; correctPredictions: number }
  >();

  for (const document of submissionsSnapshot.docs) {
    const submission = document.data();

    if (String(submission.seasonId ?? "") !== seasonId) continue;

    const userId = String(submission.userId ?? "").trim();
    if (!userId) continue;

    const selections = Array.isArray(submission.selections)
      ? submission.selections as PredictionSelection[]
      : [];

    const results: PredictionResolvedResult[] = [];

    for (const selection of selections) {
      const report =
        reportsByMatchId.get(
          selection.matchId,
        );

      if (!report) {
        continue;
      }

      const reportData =
        predictionReportData(
          report,
        );

      const status =
        predictionResultStatus(
          reportData.status,
        );

      const homeScore =
        finiteNumber(
          reportData.homeScore,
        );

      const awayScore =
        finiteNumber(
          reportData.awayScore,
        );

      if (
        status ===
        "postponed"
      ) {
        results.push({
          matchId:
            selection.matchId,
          status,
        });

        continue;
      }

      if (
        !status ||
        homeScore ===
          null ||
        awayScore ===
          null
      ) {
        continue;
      }

      results.push({
        matchId:
          selection.matchId,
        status,
        homeScore,
        awayScore,
      });
    }

    let correctPredictions = 0;
    const resultByMatchId = new Map(results.map((result) => [result.matchId, result]));

    for (const selection of selections) {
      const result = resultByMatchId.get(selection.matchId);
      if (!result || result.status === "postponed") continue;
      if (result.homeScore === undefined || result.awayScore === undefined) continue;

      if (selection.oneXTwo === resolveOneXTwo(result.homeScore, result.awayScore)) {
        correctPredictions += 1;
      }

      if (
        result.status !== "walkover" &&
        selection.goalBand === resolveGoalBand(result.homeScore, result.awayScore)
      ) {
        correctPredictions += 1;
      }
    }

    const current = totalsByUser.get(userId) ?? {
      totalScore: 0,
      submittedTickets: 0,
      correctPredictions: 0,
    };

    current.totalScore += calculatePredictionScore(selections, results);
    current.submittedTickets += 1;
    current.correctPredictions += correctPredictions;
    totalsByUser.set(userId, current);
  }

  const userIds = [...totalsByUser.keys()];
  if (userIds.length === 0) return [];

  const userSnapshots = await adminDb.getAll(
    ...userIds.map((userId) => adminDb.collection("users").doc(userId)),
  );

  const displayNames = new Map<string, string>();
  for (const userSnapshot of userSnapshots) {
    if (!userSnapshot.exists) continue;
    const displayName = String(userSnapshot.data()?.displayName ?? "").trim();
    if (displayName) displayNames.set(userSnapshot.id, displayName);
  }

  return userIds
    .map((userId) => {
      const totals = totalsByUser.get(userId)!;
      return {
        userId,
        displayName: displayNames.get(userId) ?? "Giocatore",
        ...totals,
      };
    })
    .sort((first, second) =>
      second.totalScore - first.totalScore ||
      second.correctPredictions - first.correctPredictions ||
      second.submittedTickets - first.submittedTickets ||
      first.displayName.localeCompare(second.displayName, "it"),
    )
    .slice(0, 50)
    .map((entry, index) => ({
      position: index + 1,
      userId: entry.userId,
      displayName: entry.displayName,
      totalScore: entry.totalScore,
      submittedTickets: entry.submittedTickets,
    }));
}

export async function savePredictionTicket(gameId: string, uid: string, selections: PredictionSelection[]) {
  const ticket = await getPredictionTicket(gameId, uid);

  if (ticket.selections.length > 0) {
    throw new Error("ALREADY_SUBMITTED");
  }

  /*
   * Primo controllo server-side del cutoff. Non ci affidiamo mai
   * allo stato del client per decidere se la schedina è ancora aperta.
   */
  if (
    ticket.isLocked ||
    isPredictionTicketClosedAt(ticket.closesAtLabel)
  ) {
    throw new Error("TICKET_LOCKED");
  }

  validateSelections(
    ticket.matches.map((match) => match.id),
    selections,
  );

  const reference =
    adminDb
      .collection(SUBMISSIONS)
      .doc(
        `${gameId}_${ticket.seasonId}_mw${ticket.matchweek}_${uid}`,
      );

  await adminDb.runTransaction(
    async (transaction) => {
      const existing =
        await transaction.get(
          reference,
        );

      if (existing.exists) {
        throw new Error("ALREADY_SUBMITTED");
      }

      /*
       * Controllo ripetuto dentro la transaction.
       *
       * getPredictionTicket() e il commit non sono atomici: senza questo
       * secondo controllo una richiesta partita pochi istanti prima del
       * kickoff potrebbe teoricamente essere scritta dopo il cutoff.
       * In caso di retry automatico della transaction il controllo viene
       * rivalutato usando nuovamente l'orario server corrente.
       */
      if (
        isPredictionTicketClosedAt(
          ticket.closesAtLabel,
        )
      ) {
        throw new Error("TICKET_LOCKED");
      }

      transaction.create(
        reference,
        {
          gameId,
          userId: uid,
          competitionId:
            ticket.competitionId,
          seasonId:
            ticket.seasonId,
          matchweek:
            ticket.matchweek,
          matchweekId:
            ticket.matchweekId,
          matchIds:
            ticket.matches.map(
              (match) =>
                match.id,
            ),
          selections,
          submittedAt:
            FieldValue.serverTimestamp(),
          locked:
            true,
          lockedAt:
            ticket.closesAtLabel,
        },
      );
    },
  );
}

function normalizeRawMatch(document: QueryDocumentSnapshot<DocumentData>): RawPredictionMatch {
  const value = document.data();
  return {
    id: document.id,
    seasonId: String(value.seasonId ?? ""),
    matchweek: Number(value.matchweek ?? 0),
    date: String(value.date ?? ""),
    time: String(value.time ?? "00:00"),
    homeTeamId: String(value.homeTeamId ?? ""),
    awayTeamId: String(value.awayTeamId ?? ""),
    published: value.published !== false,
  };
}

function compareMatchKickoff(first: RawPredictionMatch, second: RawPredictionMatch) {
  return matchDateTimeKey(first).localeCompare(matchDateTimeKey(second)) || first.id.localeCompare(second.id);
}

function matchDateTimeKey(match: Pick<RawPredictionMatch, "date" | "time">) {
  return `${match.date} ${match.time || "00:00"}`;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => typeof item === "string" && item.trim() ? [item.trim()] : []);
}

function validateSelections(matchIds: string[], selections: PredictionSelection[]) {
  if (selections.length !== matchIds.length) throw new Error("INCOMPLETE_TICKET");
  const expected = new Set(matchIds);
  const seen = new Set<string>();
  for (const selection of selections) {
    if (
      !expected.has(selection.matchId) ||
      seen.has(selection.matchId) ||
      !["1", "X", "2"].includes(selection.oneXTwo) ||
      !["under", "over"].includes(selection.goalBand)
    ) {
      throw new Error("INVALID_TICKET");
    }
    seen.add(selection.matchId);
  }
}

function predictionReportData(
  report:
    unknown,
): Record<string, unknown> {
  const wrapper =
    asRecord(
      report,
    );

  const nested =
    asRecord(
      wrapper.data,
    );

  return Object.keys(
    nested,
  ).length >
    0
    ? nested
    : wrapper;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function predictionResultStatus(value: unknown): PredictionResultStatus | null {
  if (value === "postponed" || value === "walkover") return value;
  if (value === "played" || value === "finished") return "played";
  return null;
}
