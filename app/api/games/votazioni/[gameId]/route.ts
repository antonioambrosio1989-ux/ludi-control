import { NextRequest, NextResponse } from "next/server";

import { requireGamesApiAccess } from "@/src/lib/requireGamesApiAccess";
import { listPublicVotingPolls } from "@/src/server/games/voting/BuildXiServer";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await context.params;
  const access = await requireGamesApiAccess(request, { gameId, rateLimitProfile: "gamesQuizRead" });
  if (!access.ok) return access.response;

  return NextResponse.json(
    { polls: await listPublicVotingPolls(gameId) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
