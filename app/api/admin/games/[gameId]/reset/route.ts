import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/src/lib/requireAdminApi";
import { resetGamesGame } from "@/src/server/games/admin/GamesAdminResetServer";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> },
) {
  try {
    await requireAdminApi(request);
    const { gameId } = await context.params;
    const result = await resetGamesGame(gameId);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const unauthorized = code === "UNAUTHORIZED" || code === "FORBIDDEN";

    const messages: Record<string, string> = {
      GAME_ID_REQUIRED: "Gioco non valido.",
      GAME_NOT_FOUND: "Gioco non trovato.",
      RESET_NOT_SUPPORTED: "Il reset non è disponibile per questo gioco.",
    };

    return NextResponse.json(
      {
        error:
          messages[code] ??
          (unauthorized
            ? "Operazione non autorizzata."
            : "Impossibile azzerare il gioco."),
      },
      { status: unauthorized ? 403 : code === "GAME_NOT_FOUND" ? 404 : 400 },
    );
  }
}
