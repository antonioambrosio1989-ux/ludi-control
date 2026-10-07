import {
  NextResponse,
} from "next/server";

import {
  requireGamesApiAccess,
} from "@/src/lib/requireGamesApiAccess";

import {
  getUserGamesAccessSummary,
} from "@/src/server/games/GamesEntitlementServer";

export const runtime =
  "nodejs";

export async function GET(
  request:
    Request,
) {
  const access =
    await requireGamesApiAccess(
      request,
      {
        rateLimitProfile:
          "gamesQuizRead",
      },
    );

  if (
    !access.ok
  ) {
    return access.response;
  }

  const url =
    new URL(
      request.url,
    );

  const gamesSeasonId =
    url.searchParams
      .get(
        "gamesSeasonId",
      )
      ?.trim() ??
    "";

  if (
    !gamesSeasonId
  ) {
    return NextResponse.json(
      {
        error:
          "Stagione Games non valida.",
      },
      {
        status:
          400,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const summary =
    await getUserGamesAccessSummary({
      userId:
        access.decodedToken.uid,

      gamesSeasonId,
    });

  return NextResponse.json(
    summary,
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}
