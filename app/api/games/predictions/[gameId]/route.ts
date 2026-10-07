import { NextRequest, NextResponse } from "next/server";
import { requireGamesApiAccess } from "@/src/lib/requireGamesApiAccess";
import { getPredictionTicket, savePredictionTicket } from "@/src/server/games/prediction/GamesPredictionServer";
import type { PredictionSelection } from "@/src/types/GamesPrediction";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  const access = await requireGamesApiAccess(request, { rateLimitProfile: "gamesQuizRead" });
  if (!access.ok) return access.response;
  try {
    const { gameId } = await context.params;
    return NextResponse.json({ ticket: await getPredictionTicket(gameId, access.decodedToken.uid) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return predictionError(error); }
}

export async function POST(request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  const access = await requireGamesApiAccess(request, { rateLimitProfile: "gamesFantasyMutation" });
  if (!access.ok) return access.response;
  try {
    const { gameId } = await context.params;
    const body = await request.json() as { selections?: PredictionSelection[] };
    await savePredictionTicket(gameId, access.decodedToken.uid, Array.isArray(body.selections) ? body.selections : []);
    return NextResponse.json({ success: true });
  } catch (error) { return predictionError(error); }
}

function predictionError(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const messages: Record<string, string> = {
    PREDICTION_NOT_CONFIGURED: "Il gioco non è ancora configurato.",
    ACTIVE_SEASON_REQUIRED: "Non esiste una stagione attiva per questa competizione.",
    NO_MATCHWEEK_AVAILABLE: "Nessuna Matchweek disponibile.",
    TICKET_LOCKED: "La schedina è chiusa perché la prima partita è già iniziata.",
    ALREADY_SUBMITTED: "Hai già inviato questa schedina e non puoi modificarla.",
    INCOMPLETE_TICKET: "Completa entrambi i pronostici per tutte le partite.",
    INVALID_TICKET: "La schedina contiene una selezione non valida.",
    LEAGUE_ONE_SEASON_REQUIRED: "Non esiste una stagione League One attiva da cui completare la schedina.",
    NOT_ENOUGH_PREDICTION_MATCHES: "Non ci sono abbastanza partite disponibili tra Championship e League One per comporre una schedina da 10 gare.",
    TOO_MANY_CHAMPIONSHIP_MATCHES: "La Matchweek Championship contiene più di 10 partite e non può essere usata per questa schedina.",
    PREDICTION_ROUND_INVALID: "La schedina settimanale salvata non è più coerente con il calendario. Controlla il calendario in Admin.",
  };
  return NextResponse.json({ error: messages[code] ?? "Impossibile completare l’operazione." }, { status: code === "ALREADY_SUBMITTED" ? 409 : 400 });
}
