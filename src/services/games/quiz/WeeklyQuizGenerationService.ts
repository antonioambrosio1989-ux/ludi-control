import { doc, getDoc } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { FirebaseWeeklyQuizKnowledgeSource } from "./FirebaseWeeklyQuizKnowledgeSource";
import { FirebaseWeeklyQuizRepository } from "../FirebaseWeeklyQuizRepository";
import { createWeeklyQuizGenerationService } from "./WeeklyQuizGenerationCore";
export type { GenerateWeeklyQuizResult } from "./WeeklyQuizGenerationCore";

export const WeeklyQuizGenerationService = createWeeklyQuizGenerationService({
  getDocument: async (collection, id) => {
    const snapshot = await getDoc(doc(db, collection, id));
    return { exists: () => snapshot.exists(), data: () => snapshot.data() ?? {} };
  },
  knowledgeSource: new FirebaseWeeklyQuizKnowledgeSource(),
  repository: FirebaseWeeklyQuizRepository,
});
