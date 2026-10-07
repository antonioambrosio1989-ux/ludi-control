import "server-only";
import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/src/lib/firebaseAdmin";
import { createWeeklyQuizGenerationService } from "@/src/services/games/quiz/WeeklyQuizGenerationCore";
import { normalizeWeek, normalizeQuestion } from "@/src/lib/firestore/mappers/QuizWeekDocumentMapper";
import { weeklyQuizAdminKnowledgeSource } from "./WeeklyQuizAdminDataSource";
import { withWeeklyQuizGenerationLock } from "./WeeklyQuizGenerationLock";

type Input = {
  gamesSeasonId: string;
  gameId: string;
  targetDate?: Date;
  publishImmediately?: boolean;
  regenerateWeekId?: string;
};

function createAdminRepository(assertOwnership: (transaction: Transaction) => Promise<void>, regenerateWeekId?: string) {
  const replacingWeekIds = new Set(regenerateWeekId ? [regenerateWeekId] : []);
  return {
    async getWeekWithQuestions(id: string) {
      if (regenerateWeekId) {
        if (id !== regenerateWeekId) throw new Error("È possibile rigenerare soltanto la Weekly Challenge corrente.");
        return null;
      }
      const ref = adminDb.collection("gamesQuizWeeks").doc(id);
      const week = await ref.get();
      if (!week.exists) return null;
      const questions = await ref.collection("questions").get();
      return { ...normalizeWeek(id, week.data() ?? {}), questions: questions.docs
        .map((doc) => normalizeQuestion(doc.id, doc.data())).sort((a, b) => a.order - b.order) };
    },
    async getRecentFingerprints({ gameId, recentWeeks }: { gameId: string; recentWeeks: number }) {
      const snapshot = await adminDb.collection("gamesQuizWeeks").where("gameId", "==", gameId).get();
      const weeks = snapshot.docs.filter((doc) => !replacingWeekIds.has(doc.id))
        .sort((a, b) => Number(b.data().weekNumber) - Number(a.data().weekNumber)).slice(0, recentWeeks);
      const questions = await Promise.all(weeks.map((doc) => doc.ref.collection("questions").get()));
      return [...new Set(questions.flatMap((snapshot) => snapshot.docs.flatMap((doc) => {
        const value = doc.data().fingerprint;
        return typeof value === "string" && value.trim() ? [value] : [];
      })))];
    },
    // Keep an obsolete week intact until its replacement is ready to commit.
    async deleteWeekForRegeneration(id: string) { replacingWeekIds.add(id); },
    async saveGeneratedWeek(generated: import("@/src/types/GamesWeeklyQuiz").WeeklyQuizGeneratedWeek) {
      const ref = adminDb.collection("gamesQuizWeeks").doc(generated.week.id);
      await adminDb.runTransaction(async (transaction) => {
        await assertOwnership(transaction);
        const previousQuestions = await transaction.get(ref.collection("questions"));
        for (const doc of previousQuestions.docs) transaction.delete(doc.ref);
        transaction.set(ref, { ...generated.week, generatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        for (const question of generated.questions) transaction.set(ref.collection("questions").doc(question.id), {
          ...question, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        });
      });
    },
    async publishWeek(id: string) {
      await adminDb.runTransaction(async (transaction) => {
        await assertOwnership(transaction);
        transaction.update(adminDb.collection("gamesQuizWeeks").doc(id), {
          status: "published", publishedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        });
      });
    },
  };
}

export const WeeklyQuizAdminGenerationService = {
  async generateWeek(input: Input) {
    return withWeeklyQuizGenerationLock(input.gamesSeasonId, input.gameId, async (assertOwnership) => {
      if (input.regenerateWeekId) {
        const snapshot = await adminDb.collection("gamesQuizWeeks").doc(input.regenerateWeekId).get();
        const data = snapshot.data();
        if (!data || data.gamesSeasonId !== input.gamesSeasonId || data.gameId !== input.gameId) {
          throw new Error("La Weekly Challenge non appartiene al Quiz selezionato.");
        }
      }
      const generator = createWeeklyQuizGenerationService({
        getDocument: async (name, id) => {
          const snapshot = await adminDb.collection(name).doc(id).get();
          return { exists: () => snapshot.exists, data: () => snapshot.data() ?? {} };
        },
        knowledgeSource: weeklyQuizAdminKnowledgeSource,
        repository: createAdminRepository(assertOwnership, input.regenerateWeekId),
      });
      return generator.generateWeek(input);
    });
  },
};
