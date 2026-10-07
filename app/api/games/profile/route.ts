import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireGamesApiAccess,
} from "@/src/lib/requireGamesApiAccess";

import {
  adminDb,
} from "@/src/lib/firebaseAdmin";

import {
  getGamesProfileSummary,
} from "@/src/server/games/profile/GamesProfileServer";

export const runtime =
  "nodejs";

export async function GET(
  request:
    NextRequest,
) {
  const access =
    await requireGamesApiAccess(
      request,
      {
        rateLimitProfile:
          "gamesQuizRead",
      },
    );

  if (!access.ok) {
    return access.response;
  }

  const gamesSeasonId =
    request.nextUrl.searchParams
      .get("gamesSeasonId")
      ?.trim() ?? "";

  if (!gamesSeasonId) {
    return NextResponse.json(
      {
        error:
          "Games Season non valida.",
      },
      {
        status:
          400,
      },
    );
  }

  try {
    const profileSnapshot =
      await adminDb
        .collection("users")
        .doc(access.decodedToken.uid)
        .get();

    const displayName =
      normalizeDisplayName(
        profileSnapshot.data()?.displayName,
        access.decodedToken.name,
        access.decodedToken.email,
      );

    const profile =
      await getGamesProfileSummary({
        gamesSeasonId,
        userId:
          access.decodedToken.uid,
        displayName,
      });

    return NextResponse.json(
      {
        profile,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    const code =
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR";

    return NextResponse.json(
      {
        error:
          code === "GAMES_SEASON_NOT_FOUND"
            ? "Games Season non trovata."
            : "Impossibile caricare il profilo Games.",
      },
      {
        status:
          code === "GAMES_SEASON_NOT_FOUND"
            ? 404
            : 500,
      },
    );
  }
}

function normalizeDisplayName(
  profileDisplayName:
    unknown,
  authDisplayName:
    unknown,
  email:
    unknown,
) {
  if (
    typeof profileDisplayName === "string" &&
    profileDisplayName.trim()
  ) {
    return profileDisplayName.trim();
  }

  if (
    typeof authDisplayName === "string" &&
    authDisplayName.trim()
  ) {
    return authDisplayName.trim();
  }

  if (
    typeof email === "string" &&
    email.trim()
  ) {
    return email.split("@")[0];
  }

  return "Giocatore";
}
