

import {
  DEFAULT_WEEKLY_QUIZ_GENERATION_CONFIG,
  type WeeklyQuizGeneratedWeek,
  type WeeklyQuizKnowledgeBase,
  type WeeklyQuizWeekWithQuestions,
} from "@/src/types/GamesWeeklyQuiz";

import type { WeeklyQuizKnowledgeSource } from "./WeeklyQuizKnowledgeSource";

import {
  WeeklyQuizEngine,
  createWeekId,
} from "@/src/services/games/quiz/WeeklyQuizEngine";

import {
  isCurrentWeeklyQuiz,
} from "@/src/services/games/quiz/WeeklyQuizValidation";

import type {
  FirebaseWeeklyQuizRepository,
} from "@/src/services/games/FirebaseWeeklyQuizRepository";

import {
  resolveWeekWindow,
} from "@/src/services/games/quiz/WeeklyQuizWeekWindow";

export type GenerateWeeklyQuizResult = {
  generated:
    WeeklyQuizGeneratedWeek;

  alreadyExisted:
    boolean;
};

export type WeeklyQuizGenerationDependencies = {
  getDocument(collection: string, id: string): Promise<{
    exists(): boolean;
    data(): Record<string, unknown>;
  }>;
  knowledgeSource: WeeklyQuizKnowledgeSource;
  repository: Pick<typeof FirebaseWeeklyQuizRepository,
    "getWeekWithQuestions" | "publishWeek" | "deleteWeekForRegeneration" |
    "getRecentFingerprints" | "saveGeneratedWeek">;
};

export function createWeeklyQuizGenerationService(dependencies: WeeklyQuizGenerationDependencies) {
  type GenerateWeeklyQuizInput = {
    gamesSeasonId:
      string;

    gameId:
      string;

    targetDate?:
      Date;

    publishImmediately?:
      boolean;
  };

  type PreviewWeeklyQuizInput = {
    gamesSeasonId: string;
    gameId: string;
    targetDate?: Date;
  };

  const KNOWLEDGE_CACHE_TTL_MS = 30_000;

  let knowledgeCache:
    | {
        expiresAt: number;
        value: WeeklyQuizKnowledgeBase;
      }
    | null = null;

  let knowledgePromise:
    | Promise<WeeklyQuizKnowledgeBase>
    | null = null;

  /*
   * ============================================================
   * WEEKLY QUIZ GENERATION SERVICE
   * ============================================================
   *
   * Orchestratore reale:
   *
   * Games Season
   *      ↓
   * finestra settimanale
   *      ↓
   * FirebaseWeeklyQuizKnowledgeSource
   *      ↓
   * fingerprint ultime 10 settimane
   *      ↓
   * WeeklyQuizEngine
   *      ↓
   * gamesQuizWeeks/{weekId}/questions
   *
   * È idempotente per weekId soltanto quando la settimana già salvata usa la
   * versione e il mix correnti. Le settimane obsolete vengono sostituite.
   * ============================================================
   */

  class WeeklyQuizGenerationService {
    static async generateWeek({
      gamesSeasonId,
      gameId,
      targetDate =
        new Date(),
      publishImmediately =
        false,
    }: GenerateWeeklyQuizInput):
      Promise<GenerateWeeklyQuizResult> {
      const normalizedGamesSeasonId =
        gamesSeasonId.trim();

      const normalizedGameId =
        gameId.trim();

      if (
        !normalizedGamesSeasonId ||
        !normalizedGameId
      ) {
        throw new Error(
          "gamesSeasonId e gameId sono obbligatori.",
        );
      }

      const [
        gamesSeasonSnapshot,
        gameSnapshot,
      ] =
        await Promise.all([
          dependencies.getDocument("gamesSeasons", normalizedGamesSeasonId),

          dependencies.getDocument("gamesGames", normalizedGameId),
        ]);

      if (
        !gamesSeasonSnapshot.exists()
      ) {
        throw new Error(
          "Games Season non trovata.",
        );
      }

      if (
        !gameSnapshot.exists()
      ) {
        throw new Error(
          "Quiz non trovato.",
        );
      }

      const gamesSeason =
        gamesSeasonSnapshot.data();

      const game =
        gameSnapshot.data();

      const startsAt =
        toDate(
          gamesSeason.startsAt,
        );

      const endsAt =
        toDate(
          gamesSeason.endsAt,
        );

      if (
        !startsAt ||
        !endsAt
      ) {
        throw new Error(
          "La Games Season non dispone di date valide.",
        );
      }

      /*
       * Il Weekly Quiz può iniziare più tardi della Games Season.
       * La Week 1 parte quindi dalla data di attivazione del gioco.
       */
      const gameActivatesAt =
        toDate(
          game.activatesAt,
        );

      const quizScheduleStartsAt =
        gameActivatesAt &&
        gameActivatesAt.getTime() >
          startsAt.getTime()
          ? gameActivatesAt
          : startsAt;

      const window =
        resolveWeekWindow({
          gamesSeasonStartsAt:
            quizScheduleStartsAt,

          gamesSeasonEndsAt:
            endsAt,

          targetDate,
        });

      const weekId =
        createWeekId({
          gamesSeasonId:
            normalizedGamesSeasonId,

          gameId:
            normalizedGameId,

          weekNumber:
            window.weekNumber,
        });

      const existing =
        await dependencies.repository.getWeekWithQuestions(
          weekId,
        );

      let shouldPublish =
        publishImmediately;

      if (
        existing &&
        isCurrentWeeklyQuiz(
          existing,
        )
      ) {
        /*
         * Un retry del rollover può trovare una Week valida già salvata
         * ma ancora in bozza (per esempio se il primo tentativo si è
         * interrotto dopo il salvataggio e prima della pubblicazione).
         *
         * Se il chiamante richiede publishImmediately, completiamo
         * idempotentemente la pubblicazione senza rigenerare le domande.
         */
        if (
          publishImmediately &&
          existing.status !==
            "published"
        ) {
          await dependencies.repository.publishWeek(
            existing.id,
          );

          existing.status =
            "published";
        }

        return {
          generated:
            storedWeekToGenerated(
              existing,
            ),

          alreadyExisted:
            true,
        };
      }

      if (
        existing
      ) {
        shouldPublish =
          shouldPublish ||
          existing.status ===
            "published";

        await dependencies.repository.deleteWeekForRegeneration(
          weekId,
        );
      }

      const [
        knowledgeBase,
        recentFingerprints,
      ] =
        await Promise.all([
          loadKnowledgeBaseCached(),

          dependencies.repository.getRecentFingerprints({
            gameId:
              normalizedGameId,

            recentWeeks:
              DEFAULT_WEEKLY_QUIZ_GENERATION_CONFIG
                .recentFingerprintWeeks,
          }),
        ]);

      /*
       * Lascia al browser un frame per aggiornare lo stato "Generazione..."
       * prima della fase sincrona del motore.
       */
      await yieldToBrowser();

      const generated =
        WeeklyQuizEngine.generate({
          gamesSeasonId:
            normalizedGamesSeasonId,

          gameId:
            normalizedGameId,

          weekNumber:
            window.weekNumber,

          startsAt:
            window.startsAt,

          endsAt:
            window.endsAt,

          knowledgeBase,

          recentFingerprints,
        });

      await dependencies.repository.saveGeneratedWeek(
        generated,
      );

      if (
        shouldPublish
      ) {
        await dependencies.repository.publishWeek(
          generated.week.id,
        );

        generated.week.status =
          "published";
      }

      return {
        generated,

        alreadyExisted:
          false,
      };
    }

    /*
     * Preview read-only usata dalla Demo del Quiz.
     * Legge le sorgenti reali e genera le domande in memoria,
     * senza creare/eliminare/pubblicare documenti Firebase.
     */
    static async previewWeek({
      gamesSeasonId,
      gameId,
      targetDate = new Date(),
    }: PreviewWeeklyQuizInput): Promise<WeeklyQuizGeneratedWeek> {
      const normalizedGamesSeasonId = gamesSeasonId.trim();
      const normalizedGameId = gameId.trim();

      if (!normalizedGamesSeasonId || !normalizedGameId) {
        throw new Error(
          "gamesSeasonId e gameId sono obbligatori.",
        );
      }

      const [
        gamesSeasonSnapshot,
        gameSnapshot,
      ] =
        await Promise.all([
          dependencies.getDocument("gamesSeasons", normalizedGamesSeasonId),

          dependencies.getDocument("gamesGames", normalizedGameId),
        ]);

      if (!gamesSeasonSnapshot.exists()) {
        throw new Error(
          "Games Season non trovata.",
        );
      }

      if (!gameSnapshot.exists()) {
        throw new Error(
          "Quiz non trovato.",
        );
      }

      const gamesSeason = gamesSeasonSnapshot.data();
      const game = gameSnapshot.data();
      const startsAt = toDate(gamesSeason.startsAt);
      const endsAt = toDate(gamesSeason.endsAt);

      if (!startsAt || !endsAt) {
        throw new Error(
          "La Games Season non dispone di date valide.",
        );
      }

      const gameActivatesAt =
        toDate(
          game.activatesAt,
        );

      const quizScheduleStartsAt =
        gameActivatesAt &&
        gameActivatesAt.getTime() >
          startsAt.getTime()
          ? gameActivatesAt
          : startsAt;

      const window = resolveWeekWindow({
        gamesSeasonStartsAt: quizScheduleStartsAt,
        gamesSeasonEndsAt: endsAt,
        targetDate,
      });

      /*
       * Prima scelta: se la Weekly Challenge corrente è già stata
       * generata con la versione attuale, la Demo usa direttamente
       * quelle 7 domande. È il percorso più veloce e garantisce che
       * la Demo mostri esattamente lo stesso Quiz che vedranno gli utenti.
       */
      const weekId = createWeekId({
        gamesSeasonId: normalizedGamesSeasonId,
        gameId: normalizedGameId,
        weekNumber: window.weekNumber,
      });

      const existing =
        await dependencies.repository.getWeekWithQuestions(
          weekId,
        );

      if (
        existing &&
        isCurrentWeeklyQuiz(
          existing,
        )
      ) {
        return storedWeekToGenerated(
          existing,
        );
      }

      const [knowledgeBase, recentFingerprints] =
        await Promise.all([
          loadKnowledgeBaseCached(),
          dependencies.repository.getRecentFingerprints({
            gameId: normalizedGameId,
            recentWeeks:
              DEFAULT_WEEKLY_QUIZ_GENERATION_CONFIG
                .recentFingerprintWeeks,
          }),
        ]);

      await yieldToBrowser();

      return WeeklyQuizEngine.generate({
        gamesSeasonId: normalizedGamesSeasonId,
        gameId: normalizedGameId,
        weekNumber: window.weekNumber,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        knowledgeBase,
        recentFingerprints,
      });
    }
  }

  function storedWeekToGenerated(
    existing:
      WeeklyQuizWeekWithQuestions,
  ): WeeklyQuizGeneratedWeek {
    return {
      week: {
        id:
          existing.id,

        gamesSeasonId:
          existing.gamesSeasonId,

        gameId:
          existing.gameId,

        weekNumber:
          existing.weekNumber,

        startsAt:
          existing.startsAt,

        endsAt:
          existing.endsAt,

        status:
          existing.status,

        questionCount:
          existing.questionCount,

        maxScore:
          existing.maxScore,

        generationVersion:
          existing.generationVersion,
      },

      questions:
        existing.questions,

      rejectedCandidateCount:
        0,

      availableCandidateCount:
        existing.questions.length,
    };
  }

  async function loadKnowledgeBaseCached() {
    const now = Date.now();

    if (knowledgeCache && knowledgeCache.expiresAt > now) {
      return knowledgeCache.value;
    }

    if (knowledgePromise) {
      return knowledgePromise;
    }

    const knowledgeSource =
      dependencies.knowledgeSource;

    knowledgePromise = knowledgeSource.buildKnowledgeBase();

    try {
      const value = await knowledgePromise;

      knowledgeCache = {
        value,
        expiresAt: Date.now() + KNOWLEDGE_CACHE_TTL_MS,
      };

      return value;
    } finally {
      knowledgePromise = null;
    }
  }

  async function yieldToBrowser(): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });
  }

  function toDate(
    value:
      unknown,
  ): Date | null {
    if (
      value instanceof
      Date
    ) {
      return value;
    }

    if (
      value &&
      typeof value ===
        "object" &&
      "toDate" in
        value &&
      typeof (
        value as {
          toDate?:
            unknown;
        }
      ).toDate ===
        "function"
    ) {
      return (
        value as {
          toDate:
            () => Date;
        }
      ).toDate();
    }

    if (
      value &&
      typeof value ===
        "object" &&
      "toMillis" in
        value &&
      typeof (
        value as {
          toMillis?:
            unknown;
        }
      ).toMillis ===
        "function"
    ) {
      return new Date(
        (
          value as {
            toMillis:
              () => number;
          }
        ).toMillis(),
      );
    }

    if (
      typeof value ===
        "string" ||
      typeof value ===
        "number"
    ) {
      const result =
        new Date(
          value,
        );

      return Number.isNaN(
        result.getTime(),
      )
        ? null
        : result;
    }

    return null;
  }

  return WeeklyQuizGenerationService;
}
