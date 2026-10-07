import { normalizeInteger, normalizeQuestion, normalizeWeek } from "@/src/lib/firestore/mappers/QuizWeekDocumentMapper";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";

import {
  db,
} from "@/src/lib/firebase";

import type {
  WeeklyQuizGeneratedWeek,
  WeeklyQuizWeek,
  WeeklyQuizWeekWithQuestions,
} from "@/src/types/GamesWeeklyQuiz";

const WEEKS_COLLECTION =
  "gamesQuizWeeks";

const QUESTIONS_COLLECTION =
  "questions";

export class FirebaseWeeklyQuizRepository {
  static async saveGeneratedWeek(
    generated:
      WeeklyQuizGeneratedWeek,
  ): Promise<void> {
    const weekRef =
      doc(
        db,
        WEEKS_COLLECTION,
        generated.week.id,
      );

    const batch =
      writeBatch(
        db,
      );

    batch.set(
      weekRef,
      {
        ...generated.week,

        generatedAt:
          serverTimestamp(),

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      },
      {
        merge:
          false,
      },
    );

    for (
      const question of
      generated.questions
    ) {
      batch.set(
        doc(
          weekRef,
          QUESTIONS_COLLECTION,
          question.id,
        ),
        {
          ...question,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
      );
    }

    await batch.commit();
  }

  static async publishWeek(
    weekId:
      string,
  ): Promise<void> {
    await updateDoc(
      doc(
        db,
        WEEKS_COLLECTION,
        weekId,
      ),
      {
        status:
          "published",

        publishedAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      },
    );
  }

  static async closeWeek(
    weekId:
      string,
  ): Promise<void> {
    await updateDoc(
      doc(
        db,
        WEEKS_COLLECTION,
        weekId,
      ),
      {
        status:
          "closed",

        closedAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      },
    );
  }

  static subscribeByGame(
    gameId:
      string,

    onChange:
      (
        weeks:
          WeeklyQuizWeek[],
      ) => void,

    onError?:
      (
        error:
          Error,
      ) => void,
  ): Unsubscribe {
    const reference =
      query(
        collection(
          db,
          WEEKS_COLLECTION,
        ),
        where(
          "gameId",
          "==",
          gameId,
        ),
      );

    return onSnapshot(
      reference,

      (
        snapshot,
      ) => {
        onChange(
          snapshot.docs
            .map(
              (
                currentDocument,
              ) =>
                normalizeWeek(
                  currentDocument.id,
                  currentDocument.data(),
                ),
            )
            .sort(
              (
                first,
                second,
              ) =>
                second.weekNumber -
                first.weekNumber,
            ),
        );
      },

      (
        error,
      ) => {
        console.error(
          "Errore Weekly Quiz:",
          error,
        );

        onError?.(
          error,
        );
      },
    );
  }

  static async getRecentFingerprints({
    gameId,
    recentWeeks,
  }: {
    gameId:
      string;

    recentWeeks:
      number;
  }): Promise<string[]> {
    const weeksSnapshot =
      await getDocs(
        query(
          collection(
            db,
            WEEKS_COLLECTION,
          ),
          where(
            "gameId",
            "==",
            gameId,
          ),
        ),
      );

    const weekDocuments =
      weeksSnapshot.docs
        .slice()
        .sort(
          (
            first,
            second,
          ) =>
            normalizeInteger(
              second.data()
                .weekNumber,
            ) -
            normalizeInteger(
              first.data()
                .weekNumber,
            ),
        )
        .slice(
          0,
          recentWeeks,
        );

    const fingerprints:
      string[] = [];

    for (
      const weekDocument of
      weekDocuments
    ) {
      const questionsSnapshot =
        await getDocs(
          collection(
            weekDocument.ref,
            QUESTIONS_COLLECTION,
          ),
        );

      for (
        const question of
        questionsSnapshot.docs
      ) {
        const fingerprint =
          question.data()
            .fingerprint;

        if (
          typeof fingerprint ===
          "string" &&
          fingerprint.trim()
        ) {
          fingerprints.push(
            fingerprint,
          );
        }
      }
    }

    return Array.from(
      new Set(
        fingerprints,
      ),
    );
  }

  static async deleteWeekForRegeneration(
    weekId:
      string,
  ): Promise<void> {
    const weekRef =
      doc(
        db,
        WEEKS_COLLECTION,
        weekId,
      );

    const questionsSnapshot =
      await getDocs(
        collection(
          weekRef,
          QUESTIONS_COLLECTION,
        ),
      );

    const batch =
      writeBatch(
        db,
      );

    for (
      const questionDocument of
      questionsSnapshot.docs
    ) {
      batch.delete(
        questionDocument.ref,
      );
    }

    batch.delete(
      weekRef,
    );

    await batch.commit();
  }

  static async getWeekWithQuestions(
    weekId:
      string,
  ): Promise<
    WeeklyQuizWeekWithQuestions | null
  > {
    const weekRef =
      doc(
        db,
        WEEKS_COLLECTION,
        weekId,
      );

    const weekDocument =
      await getDoc(
        weekRef,
      );

    if (
      !weekDocument.exists()
    ) {
      return null;
    }

    const questionsSnapshot =
      await getDocs(
        collection(
          weekRef,
          QUESTIONS_COLLECTION,
        ),
      );

    const questions =
      questionsSnapshot.docs
        .map(
          (
            currentDocument,
          ) =>
            normalizeQuestion(
              currentDocument.id,
              currentDocument.data(),
            ),
        )
        .sort(
          (
            first,
            second,
          ) =>
            first.order -
            second.order,
        );

    return {
      ...normalizeWeek(
        weekDocument.id,
        weekDocument.data(),
      ),

      questions,
    };
  }

}








