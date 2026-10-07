import {
  NextResponse,
} from "next/server";

import {
  enforceUserApiRateLimit,
} from "@/src/lib/apiRateLimit";

import {
  authenticateQuizUser,
  finalizeWeeklyAttempt,
  getQuizErrorResponse,
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
        attemptId?:
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

    const attemptId =
      body.attemptId?.trim() ??
      "";

    if (
      !attemptId
    ) {
      throw new QuizHttpError(
        400,
        "Tentativo Quiz non valido.",
      );
    }

    const result =
      await finalizeWeeklyAttempt({
        attemptId,

        gameId,

        user,

        requestedStatus:
          "abandoned",
      });

    return NextResponse.json(
      {
        status:
          result.response.status,

        score:
          result.response.score,

        maxScore:
          result.response.maxScore,
      },
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
