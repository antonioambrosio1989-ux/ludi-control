import {
  NextResponse,
} from "next/server";

import {
  enforceUserApiRateLimit,
} from "@/src/lib/apiRateLimit";

import {
  authenticateQuizUser,
  finalizeCompletedInProgressAttempt,
  getQuizErrorResponse,
  getSeasonLeaderboard,
  getActiveQuizSeasonLeaderboard,
  loadWeeklyQuizContext,
  QuizHttpError,
} from "@/src/server/games/quiz/GamesQuizServer";

/*
 * ============================================================
 * QUIZ PUBLIC STATE
 * ============================================================
 *
 * GET /api/games/quiz/[gameId]?gamesSeasonId=...
 *
 * Restituisce lo stato necessario alla schermata pubblica:
 * - Weekly Challenge corrente;
 * - accesso/partecipazione;
 * - eventuale tentativo già utilizzato;
 * - eventuale tentativo in corso da riprendere;
 * - classifica generale del Weekly Quiz.
 * ============================================================
 */

export async function GET(
  request:
    Request,
  context:
    {
      params:
        Promise<{
          gameId:
            string;
        }>;
    },
) {
  try {
    const user =
      await authenticateQuizUser(
        request,
      );

    const rateLimitResponse =
      await enforceUserApiRateLimit({
        userId:
          user.uid,

        profile:
          "gamesQuizLifecycle",
      });

    if (
      rateLimitResponse
    ) {
      return rateLimitResponse;
    }

    const {
      gameId,
    } =
      await context.params;

    const requestUrl =
      new URL(
        request.url,
      );

    const gamesSeasonId =
      requestUrl.searchParams
        .get(
          "gamesSeasonId",
        )
        ?.trim() ??
      "";

    if (
      !gamesSeasonId
    ) {
      throw new QuizHttpError(
        400,
        "Games Season non valida.",
      );
    }

    if (requestUrl.searchParams.get("section") === "leaderboard") {
      return NextResponse.json({ seasonLeaderboard: await getActiveQuizSeasonLeaderboard({ gamesSeasonId, gameId }) });
    }
    const includeLeaderboard = requestUrl.searchParams.get("includeLeaderboard") !== "false";

    /*
     * ========================================================
     * WEEKLY QUIZ CONTEXT
     * ========================================================
     */

    const quizContext =
      await loadWeeklyQuizContext({
        gameId,

        gamesSeasonId,

        user,
      });

    /*
     * Se tutte le 7 risposte erano già state salvate ma il
     * browser si è chiuso prima di /finish, completiamo il Quiz.
     * Un tentativo parziale invece resta in_progress e può
     * essere ripreso.
     */
    const myWeeklyResult = await finalizeCompletedInProgressAttempt({
      weekId: quizContext.weekId,
      gameId: quizContext.gameId,
      user,
    });
    const seasonLeaderboard = includeLeaderboard ? await getSeasonLeaderboard({
      gamesSeasonId: quizContext.gamesSeasonId,
      gameId: quizContext.gameId,
    }) : [];

    /*
     * Una sola possibilità per Weekly Challenge:
     * - nessun tentativo -> INIZIA IL GIOCO
     * - in_progress      -> RIPRENDI IL GIOCO
     * - completed        -> nessun nuovo tentativo
     */
    const canStart =
      quizContext.canParticipate &&
      (
        myWeeklyResult ===
          null ||
        myWeeklyResult.status ===
          "in_progress"
      );

    return NextResponse.json({
      game: {
        id:
          quizContext.gameId,

        name:
          quizContext.gameName,

        priceCents:
          quizContext.gamePriceCents,

        status:
          quizContext.gameStatus,
      },

      week: {
        id:
          quizContext.weekId,

        weekNumber:
          quizContext.weekNumber,

        startsAtMs:
          quizContext.weekStartsAtMs,

        endsAtMs:
          quizContext.weekEndsAtMs,

        questionCount:
          quizContext.weekQuestionCount,

        maxScore:
          quizContext.weekMaxScore,
      },

      participation: {
        /*
         * `canStart` è il campo usato dalla versione corrente
         * della schermata Quiz.
         */
        canStart,

        /*
         * Manteniamo anche `canParticipate` per compatibilità
         * con eventuali componenti/client precedenti.
         */
        canParticipate:
          quizContext.canParticipate,

        reason:
          quizContext.participationReason,

        previewMode:
          false,

        hasAttempt:
          myWeeklyResult !==
          null,

        attemptStatus:
          myWeeklyResult?.status ??
          null,
      },

      myWeeklyResult,

      weeklyLeaderboard:
        [],

      seasonLeaderboard,
    });
  } catch (
    error
  ) {
    const result =
      getQuizErrorResponse(
        error,
      );

    return NextResponse.json(
      {
        error:
          result.message,
      },
      {
        status:
          result.status,
      },
    );
  }
}
