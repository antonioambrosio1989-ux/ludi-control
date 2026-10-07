import "server-only";
import { adminDb } from "@/src/lib/firebaseAdmin";
import { WeeklyQuizKnowledgeBuilder } from "@/src/services/games/quiz/WeeklyQuizKnowledgeBuilder";
import { mapPlayerWithPrivateData } from "@/src/lib/firestore/mappers/PlayerDocumentMapper";
import { mapDocumentToTeam } from "@/src/lib/firestore/mappers/TeamDocumentMapper";
import { mapMatch } from "@/src/lib/firestore/mappers/MatchDocumentMapper";
import { mapSeasonPlayer } from "@/src/lib/firestore/mappers/SeasonPlayerDocumentMapper";
import { mapDocument } from "@/src/lib/firestore/mappers/HallOfChampionsDocumentMapper";
import type { CloudMatchReport } from "@/src/services/match/FirebaseMatchReportRepository";

export const weeklyQuizAdminKnowledgeSource = new WeeklyQuizKnowledgeBuilder({
  getDocuments: (name) => adminDb.collection(name).get(),
  players: {
    async getAllWithPrivate() {
      const [players, privateProfiles] = await Promise.all([
        adminDb.collection("players").orderBy("lastName").get(),
        adminDb.collection("playerPrivateProfiles").get(),
      ]);
      const privateById = new Map(privateProfiles.docs.map((doc) => [doc.id, doc.data()]));
      return players.docs.map((doc) => mapPlayerWithPrivateData(doc, privateById.get(doc.id)));
    },
  },
  teams: {
    async getAll() {
      const snapshot = await adminDb.collection("teams").get();
      return snapshot.docs.map((doc) => mapDocumentToTeam(doc.id, doc.data())).sort((a, b) => a.name.localeCompare(b.name, "it"));
    },
  },
  champions: {
    async getAll() {
      const snapshot = await adminDb.collection("hallOfChampions").get();
      return snapshot.docs.map(mapDocument);
    },
  },
  matches: {
    async getBySeason(seasonId) {
      const snapshot = await adminDb.collection("matches").where("seasonId", "==", seasonId)
        .orderBy("matchweek", "asc").orderBy("date", "asc").orderBy("time", "asc").get();
      return snapshot.docs.map((doc) => mapMatch(doc.id, doc.data()));
    },
  },
  seasonPlayers: {
    async getBySeasonId(seasonId) {
      const snapshot = await adminDb.collection("seasonPlayers").where("seasonId", "==", seasonId).orderBy("createdAt", "asc").get();
      return snapshot.docs.map((doc) => mapSeasonPlayer(doc.id, doc.data()));
    },
  },
  reports: {
    async getPublishedBySeason(seasonId) {
      const snapshot = await adminDb.collection("matchReports")
        .where("seasonId", "==", seasonId).where("status", "==", "published").get();
      return snapshot.docs.map((doc) => doc.data() as CloudMatchReport);
    },
  },
});
