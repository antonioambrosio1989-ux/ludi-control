import { NextRequest, NextResponse } from "next/server";
import { requireGamesApiAccess } from "@/src/lib/requireGamesApiAccess";
import { getSurvivorRuntime, saveSurvivorChoice } from "@/src/server/games/survivor/GamesSurvivorServer";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  const access = await requireGamesApiAccess(request, { rateLimitProfile: "gamesQuizRead" });
  if (!access.ok) return access.response;
  try {
    const { gameId } = await context.params;
    return NextResponse.json({ runtime: await getSurvivorRuntime(gameId, access.decodedToken.uid) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return survivorError(error); }
}

export async function POST(request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  const access = await requireGamesApiAccess(request, { rateLimitProfile: "gamesFantasyMutation" });
  if (!access.ok) return access.response;
  try {
    const { gameId } = await context.params;
    const body = await request.json() as { teamId?: string };
    await saveSurvivorChoice(gameId, access.decodedToken.uid, String(body.teamId ?? ""));
    return NextResponse.json({ success: true });
  } catch (error) { return survivorError(error); }
}

function survivorError(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const messages: Record<string, string> = {
    SURVIVOR_NOT_CONFIGURED: "Il Survivor non è ancora configurato.",
    ACTIVE_SEASON_REQUIRED: "Non esiste una stagione attiva per questa competizione.",
    NO_MATCHWEEK_AVAILABLE: "Nessuna Matchweek pubblicata.",
    ROUND_LOCKED: "Il turno è chiuso perché la prima partita è già iniziata.",
    PLAYER_NOT_ACTIVE: "Non puoi modificare la scelta perché non sei più attivo nel Survivor.",
    TEAM_ALREADY_USED: "Hai già utilizzato questa squadra in un turno precedente.",
    TEAM_NOT_IN_MATCHWEEK: "La squadra scelta non partecipa a questa Matchweek.",
  };
  return NextResponse.json({ error: messages[code] ?? "Impossibile completare l’operazione." }, { status: 400 });
}
