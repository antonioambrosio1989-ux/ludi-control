import {
  NextResponse,
} from "next/server";

import {
  enforceUserApiRateLimit,
} from "@/src/lib/apiRateLimit";

import {
  authenticateQuizUser,
  createWeeklyAttempt,
  getQuizErrorResponse,
  loadWeeklyQuizContext,
  QuizHttpError,
} from "@/src/server/games/quiz/GamesQuizServer";

export async function POST(
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

    let body:
      {
        gamesSeasonId?:
          string;
      };

    try {
      body =
        await request.json();
    } catch {
      throw new QuizHttpError(
        400,
        "Richiesta non valida.",
      );
    }

    const gamesSeasonId =
      body.gamesSeasonId?.trim() ??
      "";

    const quizContext =
      await loadWeeklyQuizContext({
        gameId,
        gamesSeasonId,
        user,
      });

    const response =
      await createWeeklyAttempt({
        context:
          quizContext,

        user,
      });

    return NextResponse.json(
      response,
    );
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
