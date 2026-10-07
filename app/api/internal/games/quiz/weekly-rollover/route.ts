import { WeeklyQuizGenerationBusyError } from "@/src/server/games/quiz/WeeklyQuizGenerationLock";
import {
  timingSafeEqual,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "@/src/lib/firebaseAdmin";

import {
  WeeklyQuizAdminGenerationService,
} from "@/src/server/games/quiz/WeeklyQuizAdminGenerationService";

import {
  resolveWeekWindow,
} from "@/src/services/games/quiz/WeeklyQuizWeekWindow";

import {
  finalizeWeeklyAttempt,
} from "@/src/server/games/quiz/GamesQuizServer";

export const runtime =
  "nodejs";

const AUTOMATION_HEADER =
  "x-ludi-quiz-automation";


type QuizGameForRollover = {
  id:
    string;
  gameType?:
    unknown;
  slug?:
    unknown;
  status?:
    unknown;
  activatesAt?:
    unknown;
  catalogVersion?:
    unknown;
};

/*
 * ============================================================
 * WEEKLY QUIZ ROLLOVER
 * ============================================================
 *
 * Chiamato esclusivamente dal Firebase Scheduler ogni giovedì
 * alle 02:00 Europe/Rome.
 *
 * 1. chiude la Weekly Challenge precedente;
 * 2. finalizza come "abandoned" eventuali tentativi rimasti
 *    in_progress (le risposte mancanti valgono 0);
 *    anche le Week già chiuse vengono riesaminate: un retry dopo
 *    un'interruzione tra chiusura e finalizzazione resta idempotente;
 * 3. genera la nuova Weekly Challenge;
 * 4. la pubblica subito in modo idempotente.
 *
 * La Week può essere pubblicata già alle 02:00 perché il runtime
 * pubblico considera utilizzabile una challenge soltanto dalla sua
 * startsAt: giovedì 10:00 -> giovedì successivo 02:00 Europe/Rome.
 *
 * In questo modo l'Admin conserva la finestra 02:00-10:00 per
 * controllare o rigenerare le domande, ma il go-live non richiede
 * nessun intervento manuale.
 * ============================================================
 */
export async function POST(
  request:
    Request,
) {
  if (
    !hasValidAutomationSecret(
      request,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Unauthorized.",
      },
      {
        status:
          401,
      },
    );
  }

  let body:
    {
      scheduledAt?:
        string;
    } =
    {};

  try {
    body =
      await request.json();
  } catch {
    /* Body opzionale: in un retry manuale usiamo l'ora corrente. */
  }

  const targetDate =
    parseTargetDate(
      body.scheduledAt,
    );

  try {
    const season =
      await getActiveGamesSeason(
        targetDate,
      );

    if (
      !season
    ) {
      return NextResponse.json({
        ok:
          true,
        skipped:
          true,
        reason:
          "Nessuna Games Season attiva nella data del rollover.",
      });
    }

    const quizGame =
      await getQuizGameForRollover(
        targetDate,
      );

    if (
      !quizGame
    ) {
      return NextResponse.json({
        ok:
          true,
        skipped:
          true,
        reason:
          "Nessun Weekly Quiz attivo nel catalogo Games.",
      });
    }

    const closed =
      await closeExpiredQuizWeeks({
        gamesSeasonId:
          season.id,
        gameId:
          quizGame.id,
        targetDate,
      });

    const finalizedAttempts =
      await finalizeExpiredAttempts(
        closed,
      );

      const generated =
        await WeeklyQuizAdminGenerationService.generateWeek({
          gamesSeasonId:
            season.id,
          gameId:
            quizGame.id,
          targetDate,
          publishImmediately:
            true,
        });

      return NextResponse.json({
        ok:
          true,
        gamesSeasonId:
          season.id,
        gameId:
          quizGame.id,
        weekId:
          generated.generated.week.id,
        weekNumber:
          generated.generated.week.weekNumber,
        status:
          generated.generated.week.status,
        alreadyExisted:
          generated.alreadyExisted,
        startsAt:
          toIsoString(
            generated.generated.week.startsAt,
          ),
        endsAt:
          toIsoString(
            generated.generated.week.endsAt,
          ),
        closedWeekIds:
          closed.map(
            (
              week,
            ) =>
              week.id,
          ),
        finalizedAttempts,
      });
  } catch (
    error
  ) {
    console.error(
      "Errore rollover automatico Weekly Quiz:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Rollover Weekly Quiz non riuscito.",
      },
      {
        status:
          error instanceof WeeklyQuizGenerationBusyError ? 409 : 500,
      },
    );
  }
}

async function getActiveGamesSeason(
  targetDate:
    Date,
) {
  const snapshot =
    await adminDb
      .collection(
        "gamesSeasons",
      )
      .where(
        "status",
        "==",
        "active",
      )
      .get();

  for (
    const document of
    snapshot.docs
  ) {
    const data =
      document.data();

    const startsAt =
      timestampToDate(
        data.startsAt,
      );

    const endsAt =
      timestampToDate(
        data.endsAt,
      );

    if (
      !startsAt ||
      !endsAt
    ) {
      continue;
    }

    try {
      /*
       * Usiamo lo stesso resolver del Quiz: in questo modo il
       * controllo della Games Season e il fuso Europe/Rome non
       * possono divergere tra Scheduler, Admin e generatore.
       */
      resolveWeekWindow({
        gamesSeasonStartsAt:
          startsAt,
        gamesSeasonEndsAt:
          endsAt,
        targetDate,
      });

      return {
        id:
          document.id,
      };
    } catch {
      /* Questa Games Season non copre il rollover richiesto. */
    }
  }

  return null;
}

async function getQuizGameForRollover(
  targetDate:
    Date,
) {
  const snapshot =
    await adminDb
      .collection(
        "gamesGames",
      )
      .get();

  const candidates =
    snapshot.docs
      .map(
        (
          document,
        ): QuizGameForRollover => {
          const data =
            document.data();

          return {
            id:
              document.id,
            gameType:
              data.gameType,
            slug:
              data.slug,
            status:
              data.status,
            activatesAt:
              data.activatesAt,
            catalogVersion:
              data.catalogVersion,
          };
        },
      )
      .filter(
        (
          value,
        ) => {
          const isQuiz =
            value.gameType ===
              "quiz" ||
            String(
              value.slug ??
                "",
            ) ===
              "quiz";

          if (
            !isQuiz ||
            value.status ===
              "suppressed"
          ) {
            return false;
          }

          if (
            value.status ===
              "active"
          ) {
            return true;
          }

          if (
            value.status !==
              "waiting"
          ) {
            return false;
          }

          const activatesAt =
            timestampToDate(
              value.activatesAt,
            );

          if (!activatesAt) {
            return false;
          }

          /*
           * Il rollover gira alle 02:00 e la Week apre alle 10:00.
           * Un Quiz ancora "waiting" ma programmato entro quella
           * finestra deve essere generato ugualmente in bozza.
           */
          const reviewWindowEndsAt =
            targetDate.getTime() +
            8 *
              60 *
              60 *
              1000;

          return (
            activatesAt.getTime() <=
            reviewWindowEndsAt
          );
        },
      )
      .sort(
        (
          first,
          second,
        ) =>
          normalizeNumber(
            second.catalogVersion,
          ) -
          normalizeNumber(
            first.catalogVersion,
          ),
      );

  return (
    candidates[0] ??
    null
  );
}

type ClosedWeek = {
  id:
    string;
  gameId:
    string;
};

async function closeExpiredQuizWeeks({
  gamesSeasonId,
  gameId,
  targetDate,
}: {
  gamesSeasonId:
    string;
  gameId:
    string;
  targetDate:
    Date;
}): Promise<ClosedWeek[]> {
  const snapshot =
    await adminDb
      .collection(
        "gamesQuizWeeks",
      )
      .get();

  const expired =
    snapshot.docs.filter(
      (
        document,
      ) => {
        const data =
          document.data();

        const endsAt =
          timestampToDate(
            data.endsAt,
          );

        return (
          data.gamesSeasonId ===
            gamesSeasonId &&
          data.gameId ===
            gameId &&
          (
            data.status ===
              "published" ||
            data.status ===
              "closed"
          ) &&
          Boolean(
            endsAt &&
              endsAt.getTime() <=
                targetDate.getTime(),
          )
        );
      },
    );

  if (
    expired.length ===
    0
  ) {
    return [];
  }

  const toClose =
    expired.filter(
      (
        document,
      ) =>
        document.data().status ===
        "published",
    );

  if (
    toClose.length >
    0
  ) {
    const batch =
      adminDb.batch();

    for (
      const document of
      toClose
    ) {
      batch.update(
        document.ref,
        {
          status:
            "closed",
          closedAt:
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp(),
        },
      );
    }

    await batch.commit();
  }

  return expired.map(
    (
      document,
    ) => ({
      id:
        document.id,
      gameId,
    }),
  );
}

async function finalizeExpiredAttempts(
  weeks:
    ClosedWeek[],
) {
  let finalized =
    0;

  for (
    const week of
    weeks
  ) {
    const snapshot =
      await adminDb
        .collection(
          "gamesQuizAttempts",
        )
        .where(
          "weekId",
          "==",
          week.id,
        )
        .get();

    for (
      const document of
      snapshot.docs
    ) {
      const attempt =
        document.data();

      if (
        attempt.status !==
        "in_progress"
      ) {
        continue;
      }

      const userId =
        normalizeString(
          attempt.userId,
        );

      if (
        !userId
      ) {
        continue;
      }

      try {
        await finalizeWeeklyAttempt({
          attemptId:
            document.id,
          gameId:
            week.gameId,
          user: {
            uid:
              userId,
            displayName:
              normalizeString(
                attempt.displayName,
              ) ||
              "Utente",
            isAdmin:
              false,
          },
          requestedStatus:
            "abandoned",
        });

        finalized +=
          1;
      } catch (
        error
      ) {
        console.error(
          `Impossibile finalizzare il tentativo ${document.id} durante il rollover:`,
          error,
        );
      }
    }
  }

  return finalized;
}

function hasValidAutomationSecret(
  request:
    Request,
) {
  const expected =
    process.env.QUIZ_AUTOMATION_SECRET ??
    "";

  const supplied =
    request.headers.get(
      AUTOMATION_HEADER,
    ) ??
    "";

  if (
    !expected ||
    !supplied
  ) {
    return false;
  }

  const expectedBuffer =
    Buffer.from(
      expected,
      "utf8",
    );

  const suppliedBuffer =
    Buffer.from(
      supplied,
      "utf8",
    );

  return (
    expectedBuffer.length ===
      suppliedBuffer.length &&
    timingSafeEqual(
      expectedBuffer,
      suppliedBuffer,
    )
  );
}

function parseTargetDate(
  value:
    unknown,
) {
  if (
    typeof value ===
    "string"
  ) {
    const parsed =
      new Date(
        value,
      );

    if (
      !Number.isNaN(
        parsed.getTime(),
      )
    ) {
      return parsed;
    }
  }

  return new Date();
}

function timestampToDate(
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

  return null;
}

function toIsoString(
  value:
    unknown,
) {
  return timestampToDate(
    value,
  )?.toISOString() ??
    null;
}

function normalizeString(
  value:
    unknown,
) {
  return String(
    value ??
      "",
  ).trim();
}

function normalizeNumber(
  value:
    unknown,
) {
  const parsed =
    Number(
      value,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}
