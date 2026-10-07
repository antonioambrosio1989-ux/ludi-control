import {
  NextResponse,
} from "next/server";

import {
  enforceUserApiRateLimit,
} from "@/src/lib/apiRateLimit";

import {
  authenticateQuizUser,
  getQuizErrorResponse,
  QuizHttpError,
  saveWeeklyAnswer,
} from "@/src/server/games/quiz/GamesQuizServer";

import type {
  QuizAnswerRequest,
} from "@/src/types/GamesQuizRuntime";

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
          "gamesQuizAnswer",
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
      Partial<
        QuizAnswerRequest
      >;

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

    const questionId =
      body.questionId?.trim() ??
      "";

    if (
      !attemptId ||
      !questionId ||
      typeof body.selectedAnswerPosition !==
        "number"
    ) {
      throw new QuizHttpError(
        400,
        "Risposta Quiz non valida.",
      );
    }

    const response =
      await saveWeeklyAnswer({
        attemptId,

        gameId,

        user,

        questionId,

        selectedAnswerPosition:
          body.selectedAnswerPosition,
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
