import { WeeklyQuizGenerationBusyError, withWeeklyQuizGenerationLock } from "@/src/server/games/quiz/WeeklyQuizGenerationLock";
import {
  FieldValue,
  type Transaction,
} from "firebase-admin/firestore";

import {
  NextResponse,
} from "next/server";

import {
  adminDb,
} from "@/src/lib/firebaseAdmin";

import {
  authenticateQuizUser,
  QuizHttpError,
} from "@/src/server/games/quiz/GamesQuizServer";

import {
  WeeklyQuizAdminGenerationService,
} from "@/src/server/games/quiz/WeeklyQuizAdminGenerationService";

export const runtime =
  "nodejs";

type AdminQuizAction =
  | "generate"
  | "regenerate"
  | "publish";

type RequestBody = {
  action?:
    AdminQuizAction;

  gamesSeasonId?:
    string;

  gameId?:
    string;

  weekId?:
    string;

  publishImmediately?:
    boolean;
};

export async function POST(
  request:
    Request,
) {
  try {
    const user =
      await authenticateQuizUser(
        request,
      );

    if (
      !user.isAdmin
    ) {
      throw new QuizHttpError(
        403,
        "Permessi Admin richiesti.",
      );
    }

    const body =
      await readBody(
        request,
      );

    switch (
      body.action
    ) {
      case "generate":
        return handleGenerate({
          userId:
            user.uid,

          gamesSeasonId:
            requireString(
              body.gamesSeasonId,
              "gamesSeasonId",
            ),

          gameId:
            requireString(
              body.gameId,
              "gameId",
            ),
        });

      case "regenerate":
        return handleRegenerate({
          userId:
            user.uid,

          gamesSeasonId:
            requireString(
              body.gamesSeasonId,
              "gamesSeasonId",
            ),

          gameId:
            requireString(
              body.gameId,
              "gameId",
            ),

          weekId:
            requireString(
              body.weekId,
              "weekId",
            ),

          publishImmediately:
            body.publishImmediately ===
            true,
        });

      case "publish":
        return handlePublish({
          weekId:
            requireString(
              body.weekId,
              "weekId",
            ),
        });

      default:
        throw new QuizHttpError(
          400,
          "Azione Weekly Quiz non valida.",
        );
    }
  } catch (
    error
  ) {
    if (error instanceof WeeklyQuizGenerationBusyError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (
      error instanceof
      QuizHttpError
    ) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status:
            error.status,
        },
      );
    }

    console.error(
      "Errore azione Admin Weekly Quiz:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Operazione Weekly Quiz non riuscita.",
      },
      {
        status:
          500,
      },
    );
  }
}

async function handleGenerate({
  userId,
  gamesSeasonId,
  gameId,
}: {
  userId:
    string;

  gamesSeasonId:
    string;

  gameId:
    string;
}) {
  const result =
    await runGenerationAsAdmin({
      userId,
      gamesSeasonId,
      gameId,
      publishImmediately:
        false,
    });

  return NextResponse.json(
    serializeGenerationResult(
      result,
    ),
  );
}

async function handleRegenerate({
  userId,
  gamesSeasonId,
  gameId,
  weekId,
  publishImmediately,
}: {
  userId:
    string;

  gamesSeasonId:
    string;

  gameId:
    string;

  weekId:
    string;

  publishImmediately:
    boolean;
}) {
  const weekReference =
    adminDb
      .collection(
        "gamesQuizWeeks",
      )
      .doc(
        weekId,
      );

  const snapshot =
    await weekReference.get();

  if (
    !snapshot.exists
  ) {
    throw new QuizHttpError(
      404,
      "Weekly Challenge non trovata.",
    );
  }

  const data =
    snapshot.data() ??
    {};

  if (
    String(
      data.gamesSeasonId ??
      "",
    ) !==
      gamesSeasonId ||
    String(
      data.gameId ??
      "",
    ) !==
      gameId
  ) {
    throw new QuizHttpError(
      409,
      "La Weekly Challenge non appartiene al Quiz selezionato.",
    );
  }

  const result =
    await runGenerationAsAdmin({
      userId,
      gamesSeasonId,
      gameId,
      publishImmediately,
      regenerateWeekId: weekId,
    });

  return NextResponse.json(
    serializeGenerationResult(
      result,
    ),
  );
}

async function handlePublish({ weekId }: { weekId: string }) {
  const snapshot = await adminDb.collection("gamesQuizWeeks").doc(weekId).get();
  if (!snapshot.exists) throw new QuizHttpError(404, "Weekly Challenge non trovata.");
  const data = snapshot.data() ?? {};
  return withWeeklyQuizGenerationLock(
    String(data.gamesSeasonId ?? ""), String(data.gameId ?? ""),
    (assertOwnership) => handlePublishUnlocked({ weekId }, assertOwnership),
  );
}

async function handlePublishUnlocked({
  weekId,
}: {
  weekId:
    string;
}, assertOwnership: (transaction: Transaction) => Promise<void>) {
  const reference =
    adminDb
      .collection(
        "gamesQuizWeeks",
      )
      .doc(
        weekId,
      );

  const snapshot =
    await reference.get();

  if (
    !snapshot.exists
  ) {
    throw new QuizHttpError(
      404,
      "Weekly Challenge non trovata.",
    );
  }

  const questionsSnapshot =
    await reference
      .collection(
        "questions",
      )
      .get();

  if (
    questionsSnapshot.size !==
    7
  ) {
    throw new QuizHttpError(
      409,
      "La Weekly Challenge deve contenere esattamente 7 domande prima della pubblicazione.",
    );
  }

  const status =
    String(
      snapshot.data()?.status ??
      "",
    );

  if (
    status ===
    "published"
  ) {
    return NextResponse.json({
      ok:
        true,
      alreadyPublished:
        true,
      weekId,
    });
  }

  if (
    status !==
    "draft"
  ) {
    throw new QuizHttpError(
      409,
      "Solo una Weekly Challenge in bozza può essere pubblicata.",
    );
  }

  await adminDb.runTransaction(async (transaction) => {
    await assertOwnership(transaction);
    transaction.update(reference, {
    status:
      "published",

    publishedAt:
      FieldValue.serverTimestamp(),

    updatedAt:
      FieldValue.serverTimestamp(),
    });
  });

  return NextResponse.json({
    ok:
      true,
    alreadyPublished:
      false,
    weekId,
  });
}

async function runGenerationAsAdmin({
  gamesSeasonId, gameId, publishImmediately, regenerateWeekId,
}: {
  userId: string;
  gamesSeasonId: string;
  gameId: string;
  publishImmediately: boolean;
  regenerateWeekId?: string;
}) {
  return WeeklyQuizAdminGenerationService.generateWeek({
    gamesSeasonId, gameId, publishImmediately, regenerateWeekId,
  });
}

function serializeGenerationResult(
  result:
    Awaited<
      ReturnType<
        typeof WeeklyQuizAdminGenerationService.generateWeek
      >
    >,
) {
  return {
    ok:
      true,

    weekId:
      result.generated.week.id,

    weekNumber:
      result.generated.week.weekNumber,

    status:
      result.generated.week.status,

    alreadyExisted:
      result.alreadyExisted,
  };
}

async function readBody(
  request:
    Request,
): Promise<RequestBody> {
  try {
    return await request.json() as
      RequestBody;
  } catch {
    throw new QuizHttpError(
      400,
      "Body della richiesta non valido.",
    );
  }
}

function requireString(
  value:
    unknown,

  field:
    string,
) {
  const normalized =
    String(
      value ??
      "",
    ).trim();

  if (
    !normalized
  ) {
    throw new QuizHttpError(
      400,
      `${field} è obbligatorio.`,
    );
  }

  return normalized;
}
