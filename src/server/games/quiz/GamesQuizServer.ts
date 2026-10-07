import "server-only";

import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
} from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "@/src/lib/firebaseAdmin";

import {
  resolveGameEntitlement,
} from "@/src/server/games/GamesEntitlementServer";

import type {
  QuizFinishResponse,
  QuizMyWeeklyResult,
  QuizQuestionResult,
  QuizRuntimeQuestion,
  QuizSeasonLeaderboardEntry,
  QuizWeeklyLeaderboardEntry,
  WeeklyQuizAttemptStatus,
  WeeklyQuizParticipationReason,
} from "@/src/types/GamesQuizRuntime";

export const quizAdminAuth =
  adminAuth;

export const quizAdminDb =
  adminDb;

export const serverTimestamp =
  FieldValue.serverTimestamp;

export type QuizAuthenticatedUser = {
  uid:
    string;

  displayName:
    string;

  isAdmin:
    boolean;
};

type ServerWeeklyQuestion = {
  id:
    string;

  order:
    number;

  challengeType:
    QuizRuntimeQuestion["challengeType"];

  kind:
    QuizRuntimeQuestion["kind"];

  prompt:
    string;

  answers:
    string[];

  answerImageUrls:
    string[];

  correctAnswerIndex:
    number;

  points:
    number;

  explanation:
    string;
};

export type WeeklyQuizContext = {
  gameId:
    string;

  gamesSeasonId:
    string;

  gameName:
    string;

  gamePriceCents:
    number;

  gameStatus:
    string;

  weekId:
    string;

  weekNumber:
    number;

  weekStartsAtMs:
    number;

  weekEndsAtMs:
    number;

  weekQuestionCount:
    number;

  weekMaxScore:
    number;

  questions:
    ServerWeeklyQuestion[];

  canParticipate:
    boolean;

  participationReason:
    WeeklyQuizParticipationReason;

  previewMode:
    boolean;
};

type AttemptQuestionSnapshot = {
  questionId:
    string;

  order:
    number;

  challengeType:
    QuizRuntimeQuestion["challengeType"];

  kind:
    QuizRuntimeQuestion["kind"];

  prompt:
    string;

  answers:
    string[];

  answerImageUrls:
    string[];

  correctAnswerIndex:
    number;

  points:
    number;

  explanation:
    string;
};

type AttemptAnswer = {
  questionId:
    string;

  selectedAnswerPosition:
    number;

  answeredAtMs:
    number;
};

type FinalizedAttemptResult = {
  response:
    QuizFinishResponse;

  alreadyFinalized:
    boolean;
};

export class QuizHttpError extends Error {
  readonly status:
    number;

  constructor(
    status:
      number,
    message:
      string,
  ) {
    super(
      message,
    );

    this.status =
      status;
  }
}

/*
 * ============================================================
 * AUTH
 * ============================================================
 */

export async function authenticateQuizUser(
  request:
    Request,
): Promise<QuizAuthenticatedUser> {
  const authorization =
    request.headers.get(
      "authorization",
    );

  if (
    !authorization?.startsWith(
      "Bearer ",
    )
  ) {
    throw new QuizHttpError(
      401,
      "Autenticazione richiesta.",
    );
  }

  const token =
    authorization
      .slice(
        "Bearer ".length,
      )
      .trim();

  if (
    !token
  ) {
    throw new QuizHttpError(
      401,
      "Autenticazione richiesta.",
    );
  }

  let decodedToken;

  try {
    decodedToken =
      await quizAdminAuth.verifyIdToken(
        token,
      );
  } catch (
    error
  ) {
    console.error(
      "Token Quiz non valido:",
      error,
    );

    throw new QuizHttpError(
      401,
      "Sessione non valida o scaduta.",
    );
  }

  const adminSnapshot =
    await quizAdminDb
      .collection(
        "admins",
      )
      .doc(
        decodedToken.uid,
      )
      .get();

  const isAdmin =
    adminSnapshot.exists &&
    adminSnapshot.data()?.active ===
      true;

  return {
    uid:
      decodedToken.uid,

    displayName:
      normalizeDisplayName(
        decodedToken.name,
        decodedToken.email,
      ),

    isAdmin,
  };
}

/*
 * ============================================================
 * CONTEXT
 * ============================================================
 */

export async function loadWeeklyQuizContext({
  gameId,
  gamesSeasonId,
  user,
}: {
  gameId:
    string;

  gamesSeasonId:
    string;

  user:
    QuizAuthenticatedUser;
}): Promise<WeeklyQuizContext> {
  const normalizedGameId =
    gameId.trim();

  const normalizedGamesSeasonId =
    gamesSeasonId.trim();

  if (
    !normalizedGameId ||
    !normalizedGamesSeasonId
  ) {
    throw new QuizHttpError(
      400,
      "Configurazione Quiz non valida.",
    );
  }

  const [
    seasonSnapshot,
    gameSnapshot,
    currentWeek,
  ] =
    await Promise.all([
      quizAdminDb
        .collection(
          "gamesSeasons",
        )
        .doc(
          normalizedGamesSeasonId,
        )
        .get(),

      quizAdminDb
        .collection(
          "gamesGames",
        )
        .doc(
          normalizedGameId,
        )
        .get(),
      loadCurrentPublishedWeek({ gameId: normalizedGameId, gamesSeasonId: normalizedGamesSeasonId }),
    ]);

  if (
    !seasonSnapshot.exists
  ) {
    throw new QuizHttpError(
      404,
      "Games Season non trovata.",
    );
  }

  if (
    !gameSnapshot.exists
  ) {
    throw new QuizHttpError(
      404,
      "Quiz non trovato.",
    );
  }

  const season =
    seasonSnapshot.data() ??
    {};

  const game =
    gameSnapshot.data() ??
    {};

  assertGamesSeasonActive(
    season,
  );

  const gameName =
    normalizeString(
      game.name,
    ) ||
    "Quiz";

  const gameSlug =
    normalizeString(
      game.slug,
    );

  const gameType =
    normalizeString(
      game.gameType,
    );

  if (
    gameType !==
      "quiz" &&
    gameSlug !==
      "quiz"
  ) {
    throw new QuizHttpError(
      409,
      "Il gioco selezionato non è un Quiz.",
    );
  }

  const gameStatus =
    resolveEffectiveGameStatus(
      game,
    );

  if (
    gameStatus !==
      "active"
  ) {
    throw new QuizHttpError(
      409,
      "Il Quiz non è ancora attivo.",
    );
  }

  if (
    !currentWeek
  ) {
    throw new QuizHttpError(
      404,
      "Non c'è ancora una Weekly Challenge pubblicata per questa settimana.",
    );
  }

  const priceCents = normalizeNonNegativeInteger(game.priceCents);
  const [questionsSnapshot, access] = await Promise.all([
    quizAdminDb
      .collection(
        "gamesQuizWeeks",
      )
      .doc(
        currentWeek.id,
      )
      .collection(
        "questions",
      )
      .get(),
    resolveParticipationAccess({ user, gameId: normalizedGameId, gamesSeasonId: normalizedGamesSeasonId, priceCents }),
  ]);

  const questions =
    questionsSnapshot.docs
      .map(
        (
          document,
        ) =>
          normalizeWeeklyQuestion(
            document.id,
            document.data(),
          ),
      )
      .filter(
        (
          value,
        ): value is ServerWeeklyQuestion =>
          value !==
          null,
      )
      .sort(
        (
          first,
          second,
        ) =>
          first.order -
          second.order,
      );

  if (
    questions.length !==
    7
  ) {
    throw new QuizHttpError(
      409,
      "La Weekly Challenge pubblicata non contiene 7 domande valide.",
    );
  }

  return {
    gameId:
      normalizedGameId,

    gamesSeasonId:
      normalizedGamesSeasonId,

    gameName,

    gamePriceCents:
      priceCents,

    gameStatus,

    weekId:
      currentWeek.id,

    weekNumber:
      currentWeek.weekNumber,

    weekStartsAtMs:
      currentWeek.startsAtMs,

    weekEndsAtMs:
      currentWeek.endsAtMs,

    weekQuestionCount:
      questions.length,

    weekMaxScore:
      questions.reduce(
        (
          total,
          question,
        ) =>
          total +
          question.points,
        0,
      ),

    questions,

    canParticipate:
      access.canParticipate,

    participationReason:
      access.reason,

    /*
     * La pagina pubblica /games usa sempre il tentativo reale,
     * anche se l'utente è Admin. La Demo Admin resta separata.
     */
    previewMode:
      false,
  };
}

async function loadCurrentPublishedWeek({
  gameId,
  gamesSeasonId,
}: {
  gameId:
    string;

  gamesSeasonId:
    string;
}) {
  const snapshot =
    await quizAdminDb
      .collection(
        "gamesQuizWeeks",
      )
      .where(
        "gameId",
        "==",
        gameId,
      )
      .where("gamesSeasonId", "==", gamesSeasonId)
      .get();

  const now =
    Date.now();

  const candidates =
    snapshot.docs
      .map(
        (
          document,
        ) => {
          const data =
            document.data();

          const startsAtMs =
            timestampToMs(
              data.startsAt,
            );

          const endsAtMs =
            timestampToMs(
              data.endsAt,
            );

          return {
            id:
              document.id,

            gamesSeasonId:
              normalizeString(
                data.gamesSeasonId,
              ),

            status:
              normalizeString(
                data.status,
              ),

            weekNumber:
              normalizePositiveInteger(
                data.weekNumber,
              ),

            startsAtMs,

            endsAtMs,
          };
        },
      )
      .filter(
        (
          week,
        ) =>
          week.gamesSeasonId ===
            gamesSeasonId &&
          week.status ===
            "published" &&
          week.weekNumber >
            0 &&
          week.startsAtMs >
            0 &&
          week.endsAtMs >
            0 &&
          now >=
            week.startsAtMs &&
          now <=
            week.endsAtMs,
      )
      .sort(
        (
          first,
          second,
        ) =>
          second.weekNumber -
          first.weekNumber,
      );

  return (
    candidates[0] ??
    null
  );
}

/*
 * ============================================================
 * ACCESS
 * ============================================================
 */

async function resolveParticipationAccess({
  user,
  gameId,
  gamesSeasonId,
  priceCents,
}: {
  user:
    QuizAuthenticatedUser;

  gameId:
    string;

  gamesSeasonId:
    string;

  priceCents:
    number;
}): Promise<{
  canParticipate:
    boolean;

  reason:
    WeeklyQuizParticipationReason;
}> {
  if (
    priceCents ===
    0
  ) {
    return {
      canParticipate:
        true,

      reason:
        "free",
    };
  }

  const entitlement =
    await resolveGameEntitlement({
      userId:
        user.uid,

      gamesSeasonId,
      gameId,

      isAdmin:
        user.isAdmin,
    });

  if (
    entitlement.hasAccess
  ) {
    if (
      entitlement.reason ===
      "single_game"
    ) {
      /*
       * WeeklyQuizParticipationReason non distingue ancora il
       * pagamento singolo dal pass. Ai fini del Quiz entrambi
       * rappresentano un entitlement a pagamento valido.
       */
      return {
        canParticipate:
          true,

        reason:
          "games_pass",
      };
    }

    if (
      entitlement.reason ===
      "games_pass"
    ) {
      return {
        canParticipate:
          true,

        reason:
          "games_pass",
      };
    }

    if (
      entitlement.reason ===
      "admin"
    ) {
      return {
        canParticipate:
          true,

        reason:
          "admin_preview",
      };
    }

    return {
      canParticipate:
        true,

      reason:
        "free",
    };
  }

  return {
    canParticipate:
      false,

    reason:
      "purchase_required",
  };
}

/*
 * ============================================================
 * START
 * ============================================================
 */

export async function createWeeklyAttempt({
  context,
  user,
}: {
  context:
    WeeklyQuizContext;

  user:
    QuizAuthenticatedUser;
}) {
  if (
    !context.canParticipate
  ) {
    throw new QuizHttpError(
      403,
      "Per partecipare al Quiz è necessario un accesso Games valido.",
    );
  }

  const now =
    Date.now();

  const questionSnapshots:
    AttemptQuestionSnapshot[] =
    context.questions.map(
      (
        question,
      ) => ({
        questionId:
          question.id,

        order:
          question.order,

        challengeType:
          question.challengeType,

        kind:
          question.kind,

        prompt:
          question.prompt,

        answers:
          question.answers,

        answerImageUrls:
          question.answerImageUrls,

        correctAnswerIndex:
          question.correctAnswerIndex,

        points:
          question.points,

        explanation:
          question.explanation,
      }),
    );

  /*
   * La preview server-side viene mantenuta per compatibilità,
   * ma la pagina pubblica non la usa più: anche un Admin gioca
   * con il tentativo reale. La Demo Admin è separata.
   */
  if (
    context.previewMode
  ) {
    const attemptRef =
      quizAdminDb
        .collection(
          "gamesQuizAttempts",
        )
        .doc();

    await attemptRef.set({
      userId:
        user.uid,

      displayName:
        user.displayName,

      gameId:
        context.gameId,

      gamesSeasonId:
        context.gamesSeasonId,

      weekId:
        context.weekId,

      weekNumber:
        context.weekNumber,

      preview:
        true,

      status:
        "in_progress",

      startedAtMs:
        now,

      questionSnapshots,

      answers:
        [],

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    });

    return {
      attemptId:
        attemptRef.id,

      previewMode:
        true,

      resumed:
        false,

      answeredCount:
        0,

      weekId:
        context.weekId,

      weekNumber:
        context.weekNumber,

      questions:
        sanitizeRuntimeQuestions(
          questionSnapshots,
        ),
    };
  }

  const weeklyStatsRef =
    getWeeklyStatsRef({
      weekId:
        context.weekId,

      userId:
        user.uid,
    });

  const newAttemptRef =
    quizAdminDb
      .collection(
        "gamesQuizAttempts",
      )
      .doc();

  let response:
    {
      attemptId:
        string;

      previewMode:
        boolean;

      resumed:
        boolean;

      answeredCount:
        number;

      weekId:
        string;

      weekNumber:
        number;

      questions:
        QuizRuntimeQuestion[];
    } | null =
    null;

  await quizAdminDb.runTransaction(
    async (
      transaction,
    ) => {
      const existingStats =
        await transaction.get(
          weeklyStatsRef,
        );

      /*
       * Se esiste già un tentativo in corso NON ne creiamo uno
       * nuovo: recuperiamo lo stesso documento e ripartiamo dalla
       * prima domanda ancora senza risposta.
       */
      if (
        existingStats.exists
      ) {
        const stats =
          existingStats.data() ??
          {};

        const status =
          normalizeAttemptStatus(
            stats.status,
          );

        const existingAttemptId =
          normalizeString(
            stats.attemptId,
          );

        if (
          status !==
            "in_progress" ||
          !existingAttemptId
        ) {
          throw new QuizHttpError(
            409,
            "Hai già utilizzato il tuo unico tentativo per questa Weekly Challenge.",
          );
        }

        const existingAttemptRef =
          quizAdminDb
            .collection(
              "gamesQuizAttempts",
            )
            .doc(
              existingAttemptId,
            );

        const existingAttemptSnapshot =
          await transaction.get(
            existingAttemptRef,
          );

        if (
          !existingAttemptSnapshot.exists
        ) {
          throw new QuizHttpError(
            409,
            "Il tentativo in corso non è più recuperabile.",
          );
        }

        const attempt =
          existingAttemptSnapshot.data() ??
          {};

        assertAttemptOwnership({
          attempt,
          user,
          gameId:
            context.gameId,
        });

        if (
          normalizeAttemptStatus(
            attempt.status,
          ) !==
            "in_progress"
        ) {
          throw new QuizHttpError(
            409,
            "Hai già utilizzato il tuo unico tentativo per questa Weekly Challenge.",
          );
        }

        const storedQuestions =
          normalizeAttemptQuestions(
            attempt.questionSnapshots,
          );

        const storedAnswers =
          normalizeAttemptAnswers(
            attempt.answers,
          );

        if (
          storedQuestions.length ===
          0
        ) {
          throw new QuizHttpError(
            409,
            "Il tentativo in corso non contiene domande valide.",
          );
        }

        response = {
          attemptId:
            existingAttemptId,

          previewMode:
            false,

          resumed:
            true,

          answeredCount:
            Math.min(
              storedAnswers.length,
              storedQuestions.length,
            ),

          weekId:
            context.weekId,

          weekNumber:
            context.weekNumber,

          questions:
            sanitizeRuntimeQuestions(
              storedQuestions,
            ),
        };

        return;
      }

      transaction.set(
        weeklyStatsRef,
        {
          userId:
            user.uid,

          displayName:
            user.displayName,

          gameId:
            context.gameId,

          gamesSeasonId:
            context.gamesSeasonId,

          weekId:
            context.weekId,

          weekNumber:
            context.weekNumber,

          attemptId:
            newAttemptRef.id,

          status:
            "in_progress",

          score:
            0,

          maxScore:
            context.weekMaxScore,

          percent:
            0,

          correctCount:
            0,

          questionCount:
            context.weekQuestionCount,

          startedAtMs:
            now,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
      );

      transaction.set(
        newAttemptRef,
        {
          userId:
            user.uid,

          displayName:
            user.displayName,

          gameId:
            context.gameId,

          gamesSeasonId:
            context.gamesSeasonId,

          weekId:
            context.weekId,

          weekNumber:
            context.weekNumber,

          preview:
            false,

          status:
            "in_progress",

          startedAtMs:
            now,

          questionSnapshots,

          answers:
            [],

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
      );

      response = {
        attemptId:
          newAttemptRef.id,

        previewMode:
          false,

        resumed:
          false,

        answeredCount:
          0,

        weekId:
          context.weekId,

        weekNumber:
          context.weekNumber,

        questions:
          sanitizeRuntimeQuestions(
            questionSnapshots,
          ),
      };
    },
  );

  if (
    !response
  ) {
    throw new QuizHttpError(
      500,
      "Impossibile preparare il tentativo Quiz.",
    );
  }

  return response;
}

/*
 * ============================================================
 * ANSWER
 * ============================================================
 */

export async function saveWeeklyAnswer({
  attemptId,
  gameId,
  user,
  questionId,
  selectedAnswerPosition,
}: {
  attemptId:
    string;

  gameId:
    string;

  user:
    QuizAuthenticatedUser;

  questionId:
    string;

  selectedAnswerPosition:
    number;
}) {
  const attemptRef =
    quizAdminDb
      .collection(
        "gamesQuizAttempts",
      )
      .doc(
        attemptId,
      );

  let response = {
    accepted:
      false,

    answeredCount:
      0,

    questionCount:
      0,

    isComplete:
      false,

    feedback: {
      questionId:
        "",

      selectedAnswerPosition:
        0,

      correctAnswerPosition:
        0,

      isCorrect:
        false,

      earnedPoints:
        0,

      maxPoints:
        0,

      explanation:
        "",
    },
  };

  await quizAdminDb.runTransaction(
    async (
      transaction,
    ) => {
      const snapshot =
        await transaction.get(
          attemptRef,
        );

      if (
        !snapshot.exists
      ) {
        throw new QuizHttpError(
          404,
          "Tentativo Quiz non trovato.",
        );
      }

      const attempt =
        snapshot.data() ??
        {};

      assertAttemptOwnership({
        attempt,
        user,
        gameId,
      });

      if (
        attempt.status !==
        "in_progress"
      ) {
        throw new QuizHttpError(
          409,
          "Questo tentativo è già stato concluso.",
        );
      }

      const questions =
        normalizeAttemptQuestions(
          attempt.questionSnapshots,
        );

      const answers =
        normalizeAttemptAnswers(
          attempt.answers,
        );

      const nextQuestion =
        questions[
          answers.length
        ];

      if (
        !nextQuestion
      ) {
        throw new QuizHttpError(
          409,
          "Tutte le domande del tentativo hanno già una risposta.",
        );
      }

      if (
        nextQuestion.questionId !==
        questionId
      ) {
        throw new QuizHttpError(
          409,
          "Le domande devono essere completate nell'ordine previsto.",
        );
      }

      if (
        !Number.isInteger(
          selectedAnswerPosition,
        ) ||
        selectedAnswerPosition <
          -1 ||
        selectedAnswerPosition >=
          nextQuestion.answers.length
      ) {
        throw new QuizHttpError(
          400,
          "Risposta selezionata non valida.",
        );
      }

      const nextAnswers:
        AttemptAnswer[] = [
          ...answers,
          {
            questionId,
            selectedAnswerPosition,
            answeredAtMs:
              Date.now(),
          },
        ];

      transaction.update(
        attemptRef,
        {
          answers:
            nextAnswers,

          updatedAt:
            serverTimestamp(),
        },
      );

      const isCorrect =
        selectedAnswerPosition ===
        nextQuestion.correctAnswerIndex;

      response = {
        accepted:
          true,

        answeredCount:
          nextAnswers.length,

        questionCount:
          questions.length,

        isComplete:
          nextAnswers.length ===
          questions.length,

        feedback: {
          questionId,

          selectedAnswerPosition,

          correctAnswerPosition:
            nextQuestion.correctAnswerIndex,

          isCorrect,

          earnedPoints:
            isCorrect
              ? nextQuestion.points
              : 0,

          maxPoints:
            nextQuestion.points,

          explanation:
            nextQuestion.explanation,
        },
      };
    },
  );

  return response;
}

/*
 * ============================================================
 * FINALIZE
 * ============================================================
 */

export async function finalizeWeeklyAttempt({
  attemptId,
  gameId,
  user,
  requestedStatus,
}: {
  attemptId:
    string;

  gameId:
    string;

  user:
    QuizAuthenticatedUser;

  requestedStatus:
    "completed" | "abandoned";
}): Promise<FinalizedAttemptResult> {
  const attemptRef =
    quizAdminDb
      .collection(
        "gamesQuizAttempts",
      )
      .doc(
        attemptId,
      );

  const initialSnapshot =
    await attemptRef.get();

  if (
    !initialSnapshot.exists
  ) {
    throw new QuizHttpError(
      404,
      "Tentativo Quiz non trovato.",
    );
  }

  const initialAttempt =
    initialSnapshot.data() ??
    {};

  assertAttemptOwnership({
    attempt:
      initialAttempt,

    user,

    gameId,
  });

  const preview =
    initialAttempt.preview ===
    true;

  const currentStatus =
    normalizeAttemptStatus(
      initialAttempt.status,
    );

  if (
    currentStatus ===
      "completed" ||
    currentStatus ===
      "abandoned"
  ) {
    return {
      response:
        await buildFinishResponseFromStoredAttempt({
          attempt:
            initialAttempt,

          user,

          previewMode:
            preview,
        }),

      alreadyFinalized:
        true,
    };
  }

  const questions =
    normalizeAttemptQuestions(
      initialAttempt.questionSnapshots,
    );

  const answers =
    normalizeAttemptAnswers(
      initialAttempt.answers,
    );

  if (
    questions.length ===
    0
  ) {
    throw new QuizHttpError(
      409,
      "Il tentativo non contiene domande valide.",
    );
  }

  const allAnswered =
    answers.length ===
    questions.length;

  if (
    requestedStatus ===
      "completed" &&
    !allAnswered
  ) {
    throw new QuizHttpError(
      409,
      "Il Quiz non è ancora completo.",
    );
  }

  /*
   * Se tutte le 7 risposte sono già state registrate,
   * consideriamo il tentativo completato anche se il client
   * viene chiuso nell'istante precedente al finish.
   */
  const finalStatus:
    "completed" | "abandoned" =
    allAnswered
      ? "completed"
      : requestedStatus;

  const calculated =
    calculateAttemptResult({
      questions,
      answers,
    });

  const finalizedAtMs =
    Date.now();

  if (
    preview
  ) {
    await attemptRef.update({
      status:
        finalStatus,

      finalizedAtMs,

      score:
        calculated.score,

      maxScore:
        calculated.maxScore,

      percent:
        calculated.percent,

      correctCount:
        calculated.correctCount,

      questionCount:
        questions.length,

      updatedAt:
        serverTimestamp(),
    });
  } else {
    await persistFinalResult({
      attemptRef,
      attempt:
        initialAttempt,

      user,

      finalStatus,

      finalizedAtMs,

      calculated,
    });
  }

  const finalAttempt = {
    ...initialAttempt,

    status:
      finalStatus,

    finalizedAtMs,

    score:
      calculated.score,

    maxScore:
      calculated.maxScore,

    percent:
      calculated.percent,

    correctCount:
      calculated.correctCount,

    questionCount:
      questions.length,
  };

  return {
    response:
      await buildFinishResponseFromStoredAttempt({
        attempt:
          finalAttempt,

        user,

        previewMode:
          preview,

        precomputedResults:
          calculated.results,
      }),

    alreadyFinalized:
      false,
  };
}

async function persistFinalResult({
  attemptRef,
  attempt,
  user,
  finalStatus,
  finalizedAtMs,
  calculated,
}: {
  attemptRef:
    DocumentReference<DocumentData>;

  attempt:
    DocumentData;

  user:
    QuizAuthenticatedUser;

  finalStatus:
    "completed" | "abandoned";

  finalizedAtMs:
    number;

  calculated:
    ReturnType<
      typeof calculateAttemptResult
    >;
}) {
  const weekId =
    normalizeString(
      attempt.weekId,
    );

  const gamesSeasonId =
    normalizeString(
      attempt.gamesSeasonId,
    );

  const gameId =
    normalizeString(
      attempt.gameId,
    );

  if (
    !weekId ||
    !gamesSeasonId ||
    !gameId
  ) {
    throw new QuizHttpError(
      409,
      "Riferimenti del tentativo incompleti.",
    );
  }

  const weeklyStatsRef =
    getWeeklyStatsRef({
      weekId,
      userId:
        user.uid,
    });

  const weeklyLeaderboardRef =
    quizAdminDb
      .collection(
        "gamesQuizWeeklyLeaderboards",
      )
      .doc(
        weekId,
      )
      .collection(
        "entries",
      )
      .doc(
        user.uid,
      );

  const seasonLeaderboardId =
    createSeasonLeaderboardId({
      gamesSeasonId,
      gameId,
    });

  const seasonLeaderboardRef =
    quizAdminDb
      .collection(
        "gamesQuizSeasonLeaderboards",
      )
      .doc(
        seasonLeaderboardId,
      )
      .collection(
        "entries",
      )
      .doc(
        user.uid,
      );

  await quizAdminDb.runTransaction(
    async (
      transaction,
    ) => {
      const [
        attemptSnapshot,
        weeklyStatsSnapshot,
        seasonEntrySnapshot,
      ] =
        await Promise.all([
          transaction.get(
            attemptRef,
          ),

          transaction.get(
            weeklyStatsRef,
          ),

          transaction.get(
            seasonLeaderboardRef,
          ),
        ]);

      const liveAttempt =
        attemptSnapshot.data() ??
        {};

      if (
        liveAttempt.status !==
        "in_progress"
      ) {
        return;
      }

      const seasonEntry =
        seasonEntrySnapshot.data() ??
        {};

      transaction.update(
        attemptRef,
        {
          status:
            finalStatus,

          finalizedAtMs,

          score:
            calculated.score,

          maxScore:
            calculated.maxScore,

          percent:
            calculated.percent,

          correctCount:
            calculated.correctCount,

          questionCount:
            calculated.questionCount,

          updatedAt:
            serverTimestamp(),
        },
      );

      transaction.set(
        weeklyStatsRef,
        {
          userId:
            user.uid,

          displayName:
            user.displayName,

          gameId,

          gamesSeasonId,

          weekId,

          weekNumber:
            normalizePositiveInteger(
              attempt.weekNumber,
            ),

          attemptId:
            attemptRef.id,

          status:
            finalStatus,

          score:
            calculated.score,

          maxScore:
            calculated.maxScore,

          percent:
            calculated.percent,

          correctCount:
            calculated.correctCount,

          questionCount:
            calculated.questionCount,

          startedAtMs:
            normalizeNonNegativeInteger(
              attempt.startedAtMs,
            ),

          finalizedAtMs,

          createdAt:
            weeklyStatsSnapshot.exists
              ? weeklyStatsSnapshot.data()?.createdAt ??
                serverTimestamp()
              : serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
        {
          merge:
            true,
        },
      );

      transaction.set(
        weeklyLeaderboardRef,
        {
          userId:
            user.uid,

          displayName:
            user.displayName,

          gameId,

          gamesSeasonId,

          weekId,

          status:
            finalStatus,

          score:
            calculated.score,

          maxScore:
            calculated.maxScore,

          percent:
            calculated.percent,

          correctCount:
            calculated.correctCount,

          finalizedAtMs,

          updatedAt:
            serverTimestamp(),
        },
        {
          merge:
            true,
        },
      );

      const previousScore =
        normalizeNonNegativeInteger(
          seasonEntry.totalScore,
        );

      const previousMaxScore =
        normalizeNonNegativeInteger(
          seasonEntry.totalMaxScore,
        );

      const previousCorrect =
        normalizeNonNegativeInteger(
          seasonEntry.totalCorrect,
        );

      const previousWeeks =
        normalizeNonNegativeInteger(
          seasonEntry.completedWeeks,
        );

      const totalScore =
        previousScore +
        calculated.score;

      const totalMaxScore =
        previousMaxScore +
        calculated.maxScore;

      transaction.set(
        seasonLeaderboardRef,
        {
          userId:
            user.uid,

          displayName:
            user.displayName,

          gameId,

          gamesSeasonId,

          totalScore,

          totalMaxScore,

          totalPercent:
            totalMaxScore >
            0
              ? roundPercent(
                  totalScore,
                  totalMaxScore,
                )
              : 0,

          totalCorrect:
            previousCorrect +
            calculated.correctCount,

          completedWeeks:
            previousWeeks +
            1,

          lastWeekId:
            weekId,

          lastFinalizedAtMs:
            finalizedAtMs,

          createdAt:
            seasonEntrySnapshot.exists
              ? seasonEntry.createdAt ??
                serverTimestamp()
              : serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
        {
          merge:
            true,
        },
      );
    },
  );
}

/*
 * ============================================================
 * RECOVERY / ABANDONMENT
 * ============================================================
 */

export async function finalizeCompletedInProgressAttempt({
  weekId,
  gameId,
  user,
}: {
  weekId:
    string;

  gameId:
    string;

  user:
    QuizAuthenticatedUser;
}) {
  const weeklyStatsSnapshot =
    await getWeeklyStatsRef({
      weekId,
      userId:
        user.uid,
    }).get();

  if (
    !weeklyStatsSnapshot.exists
  ) {
    return null;
  }

  const stats = weeklyStatsSnapshot.data() ?? {};
  const currentResult = mapMyWeeklyResult(stats);

  if (
    normalizeAttemptStatus(
      stats.status,
    ) !==
      "in_progress"
  ) {
    return currentResult;
  }

  const attemptId =
    normalizeString(
      stats.attemptId,
    );

  if (
    !attemptId
  ) {
    return currentResult;
  }

  const attemptSnapshot =
    await quizAdminDb
      .collection(
        "gamesQuizAttempts",
      )
      .doc(
        attemptId,
      )
      .get();

  if (
    !attemptSnapshot.exists
  ) {
    return currentResult;
  }

  const attempt =
    attemptSnapshot.data() ??
    {};

  if (
    normalizeAttemptStatus(
      attempt.status,
    ) !==
      "in_progress"
  ) {
    return currentResult;
  }

  const questions =
    normalizeAttemptQuestions(
      attempt.questionSnapshots,
    );

  const answers =
    normalizeAttemptAnswers(
      attempt.answers,
    );

  /*
   * Se il browser è stato chiuso subito dopo la settima risposta
   * ma prima della chiamata /finish, completiamo automaticamente
   * il tentativo e aggiorniamo la classifica generale.
   *
   * Se mancano ancora domande, invece, il tentativo resta
   * in_progress ed è riprendibile.
   */
  if (
    questions.length ===
      0 ||
    answers.length !==
      questions.length
  ) {
    return currentResult;
  }

  await finalizeWeeklyAttempt({
    attemptId,
    gameId,
    user,
    requestedStatus:
      "completed",
  });
  return getMyWeeklyResult({ weekId, userId: user.uid });
}

/*
 * ============================================================
 * USER STATE
 * ============================================================
 */

export async function getMyWeeklyResult({
  weekId,
  userId,
}: {
  weekId:
    string;

  userId:
    string;
}): Promise<QuizMyWeeklyResult | null> {
  const snapshot =
    await getWeeklyStatsRef({
      weekId,
      userId,
    }).get();

  if (
    !snapshot.exists
  ) {
    return null;
  }

  const value =
    snapshot.data() ??
    {};

  return mapMyWeeklyResult(value);
}

/*
 * ============================================================
 * LEADERBOARDS
 * ============================================================
 */

function mapMyWeeklyResult(value: DocumentData): QuizMyWeeklyResult {
  return {
    status:
      normalizeAttemptStatus(
        value.status,
      ) ??
      "in_progress",

    score:
      normalizeNonNegativeInteger(
        value.score,
      ),

    maxScore:
      normalizeNonNegativeInteger(
        value.maxScore,
      ),

    percent:
      normalizePercent(
        value.percent,
      ),

    correctCount:
      normalizeNonNegativeInteger(
        value.correctCount,
      ),

    questionCount:
      normalizeNonNegativeInteger(
        value.questionCount,
      ),
  };
}

export async function getWeeklyLeaderboard({
  weekId,
}: {
  weekId:
    string;
}): Promise<
  QuizWeeklyLeaderboardEntry[]
> {
  const snapshot =
    await quizAdminDb
      .collection(
        "gamesQuizWeeklyLeaderboards",
      )
      .doc(
        weekId,
      )
      .collection(
        "entries",
      )
      .get();

  return snapshot.docs
    .map(
      (
        document,
      ) => {
        const value =
          document.data();

        const status:
          QuizWeeklyLeaderboardEntry["status"] =
          value.status ===
          "abandoned"
            ? "abandoned"
            : "completed";

        return {
          userId:
            normalizeString(
              value.userId,
            ) ||
            document.id,

          displayName:
            normalizeString(
              value.displayName,
            ) ||
            "Utente",

          score:
            normalizeNonNegativeInteger(
              value.score,
            ),

          maxScore:
            normalizeNonNegativeInteger(
              value.maxScore,
            ),

          percent:
            normalizePercent(
              value.percent,
            ),

          correctCount:
            normalizeNonNegativeInteger(
              value.correctCount,
            ),

          status,

          finalizedAtMs:
            normalizeNonNegativeInteger(
              value.finalizedAtMs,
            ),
        };
      },
    )
    .sort(
      (
        first,
        second,
      ) =>
        second.score -
          first.score ||
        second.correctCount -
          first.correctCount ||
        first.finalizedAtMs -
          second.finalizedAtMs ||
        first.displayName.localeCompare(
          second.displayName,
        ),
    )
    .slice(
      0,
      50,
    )
    .map(
      (
        entry,
        index,
      ) => ({
        position:
          index +
          1,

        userId:
          entry.userId,

        displayName:
          entry.displayName,

        score:
          entry.score,

        maxScore:
          entry.maxScore,

        percent:
          entry.percent,

        correctCount:
          entry.correctCount,

        status:
          entry.status,
      }),
    );
}

/** Lightweight leaderboard read: checks the active catalog without loading quiz questions or attempts. */
export async function getActiveQuizSeasonLeaderboard({ gamesSeasonId, gameId }: {
  gamesSeasonId: string;
  gameId: string;
}) {
  const [seasonSnapshot, gameSnapshot] = await Promise.all([
    quizAdminDb.collection("gamesSeasons").doc(gamesSeasonId).get(),
    quizAdminDb.collection("gamesGames").doc(gameId).get(),
  ]);
  if (!seasonSnapshot.exists || !gameSnapshot.exists) throw new QuizHttpError(404, "Quiz non disponibile.");
  assertGamesSeasonActive(seasonSnapshot.data() ?? {});
  const game = gameSnapshot.data() ?? {};
  if (resolveEffectiveGameStatus(game) !== "active" ||
      (normalizeString(game.gameType) !== "quiz" && normalizeString(game.slug) !== "quiz")) {
    throw new QuizHttpError(409, "Il Quiz non è ancora attivo.");
  }
  return getSeasonLeaderboard({ gamesSeasonId, gameId });
}

export async function getSeasonLeaderboard({
  gamesSeasonId,
  gameId,
}: {
  gamesSeasonId:
    string;

  gameId:
    string;
}): Promise<
  QuizSeasonLeaderboardEntry[]
> {
  const leaderboardId =
    createSeasonLeaderboardId({
      gamesSeasonId,
      gameId,
    });

  const snapshot =
    await quizAdminDb
      .collection(
        "gamesQuizSeasonLeaderboards",
      )
      .doc(
        leaderboardId,
      )
      .collection(
        "entries",
      )
      .get();

  return snapshot.docs
    .map(
      (
        document,
      ) => {
        const value =
          document.data();

        return {
          userId:
            normalizeString(
              value.userId,
            ) ||
            document.id,

          displayName:
            normalizeString(
              value.displayName,
            ) ||
            "Utente",

          totalScore:
            normalizeNonNegativeInteger(
              value.totalScore,
            ),

          totalMaxScore:
            normalizeNonNegativeInteger(
              value.totalMaxScore,
            ),

          totalPercent:
            normalizePercent(
              value.totalPercent,
            ),

          totalCorrect:
            normalizeNonNegativeInteger(
              value.totalCorrect,
            ),

          completedWeeks:
            normalizeNonNegativeInteger(
              value.completedWeeks,
            ),

          lastFinalizedAtMs:
            normalizeNonNegativeInteger(
              value.lastFinalizedAtMs,
            ),
        };
      },
    )
    .sort(
      (
        first,
        second,
      ) =>
        second.totalScore -
          first.totalScore ||
        second.totalCorrect -
          first.totalCorrect ||
        second.completedWeeks -
          first.completedWeeks ||
        first.lastFinalizedAtMs -
          second.lastFinalizedAtMs ||
        first.displayName.localeCompare(
          second.displayName,
        ),
    )
    .slice(
      0,
      50,
    )
    .map(
      (
        entry,
        index,
      ) => ({
        position:
          index +
          1,

        userId:
          entry.userId,

        displayName:
          entry.displayName,

        totalScore:
          entry.totalScore,

        totalMaxScore:
          entry.totalMaxScore,

        totalPercent:
          entry.totalPercent,

        totalCorrect:
          entry.totalCorrect,

        completedWeeks:
          entry.completedWeeks,
      }),
    );
}

/*
 * ============================================================
 * RESULT BUILDERS
 * ============================================================
 */

async function buildFinishResponseFromStoredAttempt({
  attempt,
  previewMode,
  precomputedResults,
}: {
  attempt:
    DocumentData;

  user:
    QuizAuthenticatedUser;

  previewMode:
    boolean;

  precomputedResults?:
    QuizQuestionResult[];
}): Promise<QuizFinishResponse> {
  const questions =
    normalizeAttemptQuestions(
      attempt.questionSnapshots,
    );

  const answers =
    normalizeAttemptAnswers(
      attempt.answers,
    );

  const calculated =
    precomputedResults
      ? {
          results:
            precomputedResults,

          ...calculateSummaryFromResults(
            precomputedResults,
          ),
        }
      : calculateAttemptResult({
          questions,
          answers,
        });

  const gameId =
    normalizeString(
      attempt.gameId,
    );

  const gamesSeasonId =
    normalizeString(
      attempt.gamesSeasonId,
    );

  const seasonLeaderboard =
    previewMode
      ? []
      : await getSeasonLeaderboard({
          gamesSeasonId,
          gameId,
        });

  /*
   * La UI del Weekly Quiz usa soltanto la classifica generale.
   * Manteniamo l'array settimanale vuoto nel payload per
   * compatibilità con il tipo/vecchi client.
   */
  const weeklyLeaderboard:
    QuizWeeklyLeaderboardEntry[] =
    [];

  const status =
    attempt.status ===
      "abandoned"
      ? "abandoned"
      : "completed";

  return {
    status,

    score:
      calculated.score,

    maxScore:
      calculated.maxScore,

    percent:
      calculated.percent,

    correctCount:
      calculated.correctCount,

    questionCount:
      calculated.questionCount,

    previewMode,

    results:
      calculated.results,

    weeklyLeaderboard,

    seasonLeaderboard,
  };
}

function calculateAttemptResult({
  questions,
  answers,
}: {
  questions:
    AttemptQuestionSnapshot[];

  answers:
    AttemptAnswer[];
}) {
  const answerMap =
    new Map(
      answers.map(
        (
          answer,
        ) => [
          answer.questionId,
          answer.selectedAnswerPosition,
        ],
      ),
    );

  const results:
    QuizQuestionResult[] =
    questions.map(
      (
        question,
      ) => {
        const rawSelected =
          answerMap.get(
            question.questionId,
          );

        const selectedAnswerPosition =
          typeof rawSelected ===
              "number" &&
            Number.isInteger(
              rawSelected,
            ) &&
            rawSelected >=
              0 &&
            rawSelected <
              question.answers.length
            ? rawSelected
            : null;

        const isCorrect =
          selectedAnswerPosition ===
          question.correctAnswerIndex;

        return {
          questionId:
            question.questionId,

          order:
            question.order,

          challengeType:
            question.challengeType,

          prompt:
            question.prompt,

          answers:
            question.answers,

          selectedAnswerPosition,

          correctAnswerPosition:
            question.correctAnswerIndex,

          isCorrect,

          earnedPoints:
            isCorrect
              ? question.points
              : 0,

          maxPoints:
            question.points,

          explanation:
            question.explanation,
        };
      },
    );

  return {
    results,

    ...calculateSummaryFromResults(
      results,
    ),
  };
}

function calculateSummaryFromResults(
  results:
    QuizQuestionResult[],
) {
  const score =
    results.reduce(
      (
        total,
        result,
      ) =>
        total +
        result.earnedPoints,
      0,
    );

  const maxScore =
    results.reduce(
      (
        total,
        result,
      ) =>
        total +
        result.maxPoints,
      0,
    );

  const correctCount =
    results.filter(
      (
        result,
      ) =>
        result.isCorrect,
    ).length;

  return {
    score,

    maxScore,

    percent:
      roundPercent(
        score,
        maxScore,
      ),

    correctCount,

    questionCount:
      results.length,
  };
}

/*
 * ============================================================
 * NORMALIZATION
 * ============================================================
 */

function normalizeWeeklyQuestion(
  id:
    string,
  value:
    DocumentData,
): ServerWeeklyQuestion | null {
  const answers =
    Array.isArray(
      value.answers,
    )
      ? value.answers
          .map(
            (
              answer,
            ) =>
              String(
                answer,
              ).trim(),
          )
          .filter(
            Boolean,
          )
      : [];

  const correctAnswerIndex =
    normalizeNonNegativeInteger(
      value.correctAnswerIndex,
    );

  const answerImageUrls =
    Array.isArray(value.answerImageUrls)
      ? value.answerImageUrls.map((imageUrl) => normalizeString(imageUrl))
      : [];

  if (
    !normalizeString(
      value.prompt,
    ) ||
    answers.length <
      2 ||
    correctAnswerIndex >=
      answers.length
  ) {
    return null;
  }

  return {
    id,

    order:
      normalizePositiveInteger(
        value.order,
      ) ||
      1,

    challengeType:
      normalizeChallengeType(
        value.challengeType,
      ),

    kind:
      value.kind ===
      "higher_or_lower"
        ? "higher_or_lower"
        : "multiple_choice",

    prompt:
      normalizeString(
        value.prompt,
      ),

    answers,

    answerImageUrls:
      answerImageUrls.length === answers.length
        ? answerImageUrls
        : [],

    correctAnswerIndex,

    points:
      normalizePositiveInteger(
        value.points,
      ) ||
      100,

    explanation:
      normalizeString(
        value.explanation,
      ),
  };
}

function normalizeAttemptQuestions(
  value:
    unknown,
): AttemptQuestionSnapshot[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value
    .map(
      (
        item,
      ) => {
        if (
          !item ||
          typeof item !==
            "object"
        ) {
          return null;
        }

        const data =
          item as
            Record<
              string,
              unknown
            >;

        const answers =
          Array.isArray(
            data.answers,
          )
            ? data.answers.map(
                (
                  answer,
                ) =>
                  String(
                    answer,
                  ),
              )
            : [];

        const correctAnswerIndex =
          normalizeNonNegativeInteger(
            data.correctAnswerIndex,
          );

        const answerImageUrls =
          Array.isArray(data.answerImageUrls)
            ? data.answerImageUrls.map((imageUrl) => normalizeString(imageUrl))
            : [];

        const questionId =
          normalizeString(
            data.questionId,
          );

        const prompt =
          normalizeString(
            data.prompt,
          );

        if (
          !questionId ||
          !prompt ||
          answers.length <
            2 ||
          correctAnswerIndex >=
            answers.length
        ) {
          return null;
        }

        return {
          questionId,

          order:
            normalizePositiveInteger(
              data.order,
            ) ||
            1,

          challengeType:
            normalizeChallengeType(
              data.challengeType,
            ),

          kind:
            data.kind ===
            "higher_or_lower"
              ? "higher_or_lower"
              : "multiple_choice",

          prompt,

          answers,

          answerImageUrls:
            answerImageUrls.length === answers.length
              ? answerImageUrls
              : [],

          correctAnswerIndex,

          points:
            normalizePositiveInteger(
              data.points,
            ) ||
            100,

          explanation:
            normalizeString(
              data.explanation,
            ),
        } satisfies AttemptQuestionSnapshot;
      },
    )
    .filter(
      (
        item,
      ): item is AttemptQuestionSnapshot =>
        item !==
        null,
    )
    .sort(
      (
        first,
        second,
      ) =>
        first.order -
        second.order,
    );
}

function normalizeAttemptAnswers(
  value:
    unknown,
): AttemptAnswer[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value.flatMap(
    (
      item,
    ) => {
      if (
        !item ||
        typeof item !==
          "object"
      ) {
        return [];
      }

      const data =
        item as
          Record<
            string,
            unknown
          >;

      const questionId =
        normalizeString(
          data.questionId,
        );

      const selectedAnswerPosition =
        normalizeAnswerPosition(
          data.selectedAnswerPosition,
        );

      if (
        !questionId
      ) {
        return [];
      }

      return [
        {
          questionId,

          selectedAnswerPosition,

          answeredAtMs:
            normalizeNonNegativeInteger(
              data.answeredAtMs,
            ),
        },
      ];
    },
  );
}

function sanitizeRuntimeQuestions(
  questions:
    AttemptQuestionSnapshot[],
): QuizRuntimeQuestion[] {
  return questions.map(
    (
      question,
    ) => ({
      id:
        question.questionId,

      order:
        question.order,

      challengeType:
        question.challengeType,

      kind:
        question.kind,

      prompt:
        question.prompt,

      answers:
        question.answers,

      answerImageUrls:
        question.answerImageUrls,

      points:
        question.points,
    }),
  );
}

function assertAttemptOwnership({
  attempt,
  user,
  gameId,
}: {
  attempt:
    DocumentData;

  user:
    QuizAuthenticatedUser;

  gameId:
    string;
}) {
  if (
    normalizeString(
      attempt.userId,
    ) !==
    user.uid
  ) {
    throw new QuizHttpError(
      403,
      "Tentativo non autorizzato.",
    );
  }

  if (
    normalizeString(
      attempt.gameId,
    ) !==
    gameId
  ) {
    throw new QuizHttpError(
      409,
      "Tentativo associato a un altro gioco.",
    );
  }
}

function getWeeklyStatsRef({
  weekId,
  userId,
}: {
  weekId:
    string;

  userId:
    string;
}) {
  return quizAdminDb
    .collection(
      "gamesQuizWeeklyStats",
    )
    .doc(
      createSafeId(
        `${weekId}__${userId}`,
      ),
    );
}

function createSeasonLeaderboardId({
  gamesSeasonId,
  gameId,
}: {
  gamesSeasonId:
    string;

  gameId:
    string;
}) {
  return createSafeId(
    `${gamesSeasonId}__${gameId}`,
  );
}

function createSafeId(
  value:
    string,
) {
  return value.replace(
    /\//g,
    "_",
  );
}

function normalizeDisplayName(
  name:
    unknown,
  email:
    unknown,
) {
  const normalizedName =
    normalizeString(
      name,
    );

  if (
    normalizedName
  ) {
    return normalizedName;
  }

  const normalizedEmail =
    normalizeString(
      email,
    );

  return normalizedEmail
    ? normalizedEmail.split(
        "@",
      )[0]
    : "Utente";
}

function normalizeString(
  value:
    unknown,
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function normalizeAnswerPosition(
  value:
    unknown,
) {
  if (
    typeof value !==
      "number" ||
    !Number.isFinite(
      value,
    )
  ) {
    return -1;
  }

  const normalized =
    Math.trunc(
      value,
    );

  return normalized >=
    -1
    ? normalized
    : -1;
}

function normalizeNonNegativeInteger(
  value:
    unknown,
) {
  return typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
    ? Math.max(
        0,
        Math.trunc(
          value,
        ),
      )
    : 0;
}

function normalizePositiveInteger(
  value:
    unknown,
) {
  const normalized =
    normalizeNonNegativeInteger(
      value,
    );

  return normalized >
    0
    ? normalized
    : 0;
}

function normalizePercent(
  value:
    unknown,
) {
  return typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
    ? Math.max(
        0,
        Math.min(
          100,
          value,
        ),
      )
    : 0;
}

function normalizeChallengeType(
  value:
    unknown,
): QuizRuntimeQuestion["challengeType"] {
  switch (
    value
  ) {
    case "history_challenge":
    case "higher_or_lower":
    case "whos_the_player":
      return value;

    default:
      return "stats_challenge";
  }
}

function normalizeAttemptStatus(
  value:
    unknown,
): WeeklyQuizAttemptStatus | null {
  switch (
    value
  ) {
    case "in_progress":
    case "completed":
    case "abandoned":
      return value;

    default:
      return null;
  }
}

function timestampToMs(
  value:
    unknown,
) {
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
    return (
      value as {
        toMillis:
          () => number;
      }
    ).toMillis();
  }

  if (
    value instanceof
    Date
  ) {
    return value.getTime();
  }

  if (
    typeof value ===
      "number"
  ) {
    return value;
  }

  if (
    typeof value ===
      "string"
  ) {
    const parsed =
      new Date(
        value,
      ).getTime();

    return Number.isNaN(
      parsed,
    )
      ? 0
      : parsed;
  }

  return 0;
}

function resolveEffectiveGameStatus(
  game:
    DocumentData,
) {
  const status =
    normalizeString(
      game.status,
    );

  if (
    status ===
    "active"
  ) {
    return "active";
  }

  if (
    status ===
    "waiting"
  ) {
    const activatesAtMs =
      timestampToMs(
        game.activatesAt,
      );

    if (
      activatesAtMs >
        0 &&
      activatesAtMs <=
        Date.now()
    ) {
      return "active";
    }
  }

  return status ||
    "waiting";
}

function assertGamesSeasonActive(
  season:
    DocumentData,
) {
  const startsAtMs =
    timestampToMs(
      season.startsAt,
    );

  const endsAtMs =
    timestampToMs(
      season.endsAt,
    );

  const now =
    Date.now();

  if (
    startsAtMs <=
      0 ||
    endsAtMs <=
      0 ||
    now <
      startsAtMs ||
    now >
      endsAtMs
  ) {
    throw new QuizHttpError(
      409,
      "La Games Season non è attiva.",
    );
  }
}

function roundPercent(
  score:
    number,
  maxScore:
    number,
) {
  if (
    maxScore <=
    0
  ) {
    return 0;
  }

  return Math.round(
    (
      score /
      maxScore
    ) *
      10000,
  ) /
    100;
}

export function getQuizErrorResponse(
  error:
    unknown,
) {
  if (
    error instanceof
    QuizHttpError
  ) {
    return {
      status:
        error.status,

      message:
        error.message,
    };
  }

  console.error(
    "Errore Quiz:",
    error,
  );

  return {
    status:
      500,

    message:
      "Si è verificato un errore durante la gestione del Quiz.",
  };
}
