import "server-only";

import type {
  DocumentData,
  DocumentReference,
  Query,
} from "firebase-admin/firestore";

import { adminDb } from "@/src/lib/firebaseAdmin";

export type GamesAdminResetResult = {
  gameId: string;
  kind: "quiz" | "prediction" | "voting" | "survivor" | "fantasy";
  deletedDocuments: number;
};

type CatalogGameData = {
  gameType?: unknown;
  slug?: unknown;
  name?: unknown;
};

const QUIZ_COLLECTIONS_TO_CLEAR = [
  "gamesQuizQuestions",
  "gamesQuizWeeks",
  "gamesQuizAttempts",
  "gamesQuizWeeklyStats",
  "gamesQuizWeeklyLeaderboards",
  "gamesQuizSeasonLeaderboards",
] as const;

const FANTASY_LINKED_COLLECTIONS = [
  "fantasyPlayerPools",
  "fantasyPlayers",
  "fantasyMatchweeks",
  "fantasyTeams",
  "fantasyFormations",
  "fantasyPlayerScores",
  "fantasyTeamScores",
  "fantasyStandings",
  "fantasyTeamUniquenessLocks",
] as const;

export async function resetGamesGame(
  gameId: string,
): Promise<GamesAdminResetResult> {
  const normalizedGameId = gameId.trim();
  if (!normalizedGameId) throw new Error("GAME_ID_REQUIRED");

  const gameSnapshot = await adminDb
    .collection("gamesGames")
    .doc(normalizedGameId)
    .get();

  if (!gameSnapshot.exists) throw new Error("GAME_NOT_FOUND");

  const game = (gameSnapshot.data() ?? {}) as CatalogGameData;
  const gameType = String(game.gameType ?? "").trim().toLowerCase();
  const searchable = `${String(game.slug ?? "")} ${String(game.name ?? "")}`
    .trim()
    .toLocaleLowerCase("it");

  if (gameType === "quiz") {
    return {
      gameId: normalizedGameId,
      kind: "quiz",
      deletedDocuments: await resetQuiz(normalizedGameId),
    };
  }

  if (gameType === "pronostici") {
    return {
      gameId: normalizedGameId,
      kind: "prediction",
      deletedDocuments: await resetPrediction(normalizedGameId),
    };
  }

  if (gameType === "votazioni") {
    return {
      gameId: normalizedGameId,
      kind: "voting",
      deletedDocuments: await resetVoting(normalizedGameId),
    };
  }

  if (gameType === "fantacalcio") {
    return {
      gameId: normalizedGameId,
      kind: "fantasy",
      deletedDocuments: await resetFantasy(normalizedGameId),
    };
  }

  if (searchable.includes("survivor")) {
    return {
      gameId: normalizedGameId,
      kind: "survivor",
      deletedDocuments: await resetSurvivor(normalizedGameId),
    };
  }

  throw new Error("RESET_NOT_SUPPORTED");
}

async function resetQuiz(gameId: string): Promise<number> {
  let deleted = 0;

  deleted += await deleteDocumentIfExists(
    adminDb.collection("gamesQuizConfigs").doc(gameId),
  );

  /*
   * Il catalogo Games è fisso e contiene un solo Weekly Quiz.
   * Queste collection appartengono esclusivamente a quel gioco;
   * cancellarle integralmente equivale allo stato appena creato,
   * compresi banca domande, settimane, tentativi e classifiche.
   */
  for (const collectionName of QUIZ_COLLECTIONS_TO_CLEAR) {
    deleted += await deleteWholeCollection(collectionName);
  }

  return deleted;
}

async function resetPrediction(gameId: string): Promise<number> {
  let deleted = 0;

  deleted += await deleteDocumentIfExists(
    adminDb.collection("gamesPredictionConfigs").doc(gameId),
  );
  deleted += await deleteWhere("gamesPredictionSubmissions", "gameId", gameId);
  deleted += await deleteWhere("gamesPredictionRounds", "gameId", gameId);

  deleted += await deleteMatchingDocuments(
    "adminNotifications",
    (id, data) =>
      String(data.gameId ?? "") === gameId &&
      (
        String(data.type ?? "") === "ludi_bet_perfect_ticket" ||
        id.includes(gameId)
      ),
  );

  return deleted;
}

async function resetVoting(gameId: string): Promise<number> {
  let deleted = 0;

  const pollsSnapshot = await adminDb
    .collection("gamesVotingPolls")
    .where("gameId", "==", gameId)
    .get();

  const pollIds = new Set(pollsSnapshot.docs.map((document) => document.id));

  for (const document of pollsSnapshot.docs) {
    await adminDb.recursiveDelete(document.ref);
    deleted += 1;
  }

  deleted += await deleteMatchingDocuments(
    "gamesBuildXiSubmissions",
    (id, data) =>
      String(data.gameId ?? "") === gameId ||
      pollIds.has(String(data.votingId ?? "")) ||
      Array.from(pollIds).some((pollId) => id.startsWith(`${pollId}_`)),
  );

  return deleted;
}

async function resetSurvivor(gameId: string): Promise<number> {
  let deleted = 0;

  deleted += await deleteDocumentIfExists(
    adminDb.collection("gamesSurvivorConfigs").doc(gameId),
  );
  deleted += await deleteWhere("gamesSurvivorEntries", "gameId", gameId);

  return deleted;
}

async function resetFantasy(gameId: string): Promise<number> {
  let deleted = 0;

  const seasonsSnapshot = await adminDb
    .collection("fantasySeasons")
    .where("gameId", "==", gameId)
    .get();

  if (seasonsSnapshot.empty) return 0;

  const fantasySeasonIds = new Set(
    seasonsSnapshot.docs.map((document) => document.id),
  );

  /*
   * Team e matchweek servono anche per intercettare eventuali documenti
   * legacy che non possiedono fantasySeasonId ma conservano uno dei due ID.
   */
  const [teamsSnapshot, matchweeksSnapshot] = await Promise.all([
    adminDb.collection("fantasyTeams").get(),
    adminDb.collection("fantasyMatchweeks").get(),
  ]);

  const fantasyTeamIds = new Set(
    teamsSnapshot.docs
      .filter((document) => fantasySeasonIds.has(String(document.data().fantasySeasonId ?? "")))
      .map((document) => document.id),
  );

  const fantasyMatchweekIds = new Set(
    matchweeksSnapshot.docs
      .filter((document) => fantasySeasonIds.has(String(document.data().fantasySeasonId ?? "")))
      .map((document) => document.id),
  );

  for (const collectionName of FANTASY_LINKED_COLLECTIONS) {
    deleted += await deleteMatchingDocuments(
      collectionName,
      (id, data) => {
        const seasonId = String(data.fantasySeasonId ?? "");
        const teamId = String(data.fantasyTeamId ?? "");
        const matchweekId = String(data.fantasyMatchweekId ?? "");

        return (
          fantasySeasonIds.has(seasonId) ||
          fantasyTeamIds.has(teamId) ||
          fantasyMatchweekIds.has(matchweekId) ||
          Array.from(fantasySeasonIds).some((value) => id.startsWith(`${value}_`))
        );
      },
    );
  }

  for (const document of seasonsSnapshot.docs) {
    await adminDb.recursiveDelete(document.ref);
    deleted += 1;
  }

  return deleted;
}

async function deleteWhere(
  collectionName: string,
  field: string,
  value: string,
): Promise<number> {
  return deleteQuery(
    adminDb.collection(collectionName).where(field, "==", value),
  );
}

async function deleteQuery(
  query: Query<DocumentData>,
): Promise<number> {
  const snapshot = await query.get();

  for (const document of snapshot.docs) {
    await adminDb.recursiveDelete(document.ref);
  }

  return snapshot.size;
}

async function deleteWholeCollection(collectionName: string): Promise<number> {
  const reference = adminDb.collection(collectionName);
  const snapshot = await reference.get();
  if (snapshot.empty) return 0;
  await adminDb.recursiveDelete(reference);
  return snapshot.size;
}

async function deleteDocumentIfExists(
  reference: DocumentReference<DocumentData>,
): Promise<number> {
  const snapshot = await reference.get();
  if (!snapshot.exists) return 0;
  await adminDb.recursiveDelete(reference);
  return 1;
}

async function deleteMatchingDocuments(
  collectionName: string,
  predicate: (id: string, data: DocumentData) => boolean,
): Promise<number> {
  const snapshot = await adminDb.collection(collectionName).get();
  const matches = snapshot.docs.filter((document) =>
    predicate(document.id, document.data()),
  );

  for (const document of matches) {
    await adminDb.recursiveDelete(document.ref);
  }

  return matches.length;
}
