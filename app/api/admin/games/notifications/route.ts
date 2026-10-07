import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  adminDb,
} from "@/src/lib/firebaseAdmin";

import {
  requireAdminApi,
} from "@/src/lib/requireAdminApi";

import {
  syncPerfectPredictionWinnerNotifications,
} from "@/src/server/games/prediction/GamesPredictionServer";

export const runtime =
  "nodejs";

const ADMIN_NOTIFICATIONS =
  "adminNotifications";

const PERFECT_TICKET_NOTIFICATION_TYPE =
  "ludi_bet_perfect_ticket";

export async function GET(
  request:
    NextRequest,
) {
  try {
    await requireAdminApi(
      request,
    );

    await syncPerfectPredictionWinnerNotifications();

    const snapshot =
      await adminDb
        .collection(
          ADMIN_NOTIFICATIONS,
        )
        .orderBy(
          "createdAt",
          "desc",
        )
        .limit(
          50,
        )
        .get();

    const notifications =
      snapshot.docs
        .flatMap(
          (
            document,
          ) => {
            const data =
              document.data();

            if (
              data.type !==
              PERFECT_TICKET_NOTIFICATION_TYPE
            ) {
              return [];
            }

            const createdAt =
              data.createdAt &&
              typeof data.createdAt.toDate ===
                "function"
                ? data.createdAt
                    .toDate()
                    .toISOString()
                : null;

            return [
              {
                id:
                  document.id,

                type:
                  PERFECT_TICKET_NOTIFICATION_TYPE,

                title:
                  String(
                    data.title ??
                      "Ludi Bet Club",
                  ),

                message:
                  String(
                    data.message ??
                      "",
                  ),

                displayName:
                  String(
                    data.displayName ??
                      "Giocatore",
                  ),

                matchweek:
                  Number(
                    data.matchweek ??
                      0,
                  ),

                createdAt,
              },
            ];
          },
        )
        .slice(
          0,
          10,
        );

    return NextResponse.json(
      {
        notifications,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (
    error
  ) {
    console.error(
      "[Admin Games Notifications]",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Impossibile caricare le notifiche Games.",
      },
      {
        status:
          403,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }
}
