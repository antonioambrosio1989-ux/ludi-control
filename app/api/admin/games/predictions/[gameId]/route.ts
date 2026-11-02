import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/src/lib/requireAdminApi";
import {
  getPredictionConfig,
  savePredictionConfig,
  getPredictionAdminMatchweeks,
  previewPredictionRound,
  publishPredictionRound,
} from "@/src/server/games/prediction/GamesPredictionServer";

export const runtime = "nodejs";
type Context = { params: Promise<{ gameId: string }> };
function failure(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const labels: Record<string, string> = {
    ACTIVE_COMPETITION_REQUIRED: "Seleziona una competizione attiva.",
    ACTIVE_SEASON_REQUIRED: "Non esiste una stagione attiva per la competizione.",
    INVALID_MATCHWEEK: "Seleziona una giornata valida.",
    NO_MATCHWEEK_AVAILABLE: "Nessuna partita pubblicata per questa giornata.",
    TOO_MANY_CHAMPIONSHIP_MATCHES: "Questa giornata contiene più di 10 partite.",
    NOT_ENOUGH_PREDICTION_MATCHES: "Non ci sono abbastanza incontri pubblicati della stessa giornata in League One per raggiungere 10 partite.",
    PREDICTION_NOT_CONFIGURED: "Salva prima la competizione sorgente.",
    PREDICTION_ROUND_ALREADY_EXISTS: "Esiste già una schedina diversa per questa giornata: non può essere sovrascritta.",
    TICKET_LOCKED: "La prima partita è già iniziata: pubblicazione bloccata.",
  };
  return NextResponse.json({ error: labels[code] ?? "Operazione non riuscita." }, { status: 400 });
}
export async function GET(request: NextRequest, context: Context) {
  try {
    await requireAdminApi(request);
    const { gameId } = await context.params;
    const config = await getPredictionConfig(gameId);
    const url = new URL(request.url);
    const competitionId = url.searchParams.get("competitionId") || String(config?.competitionId ?? "");
    const rawWeek = url.searchParams.get("matchweek");
    const matchweeks = competitionId ? await getPredictionAdminMatchweeks(competitionId) : [];
    const preview = competitionId && rawWeek
      ? await previewPredictionRound(gameId, competitionId, Number(rawWeek))
      : null;
    return NextResponse.json({ config, matchweeks, preview }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const admin = await requireAdminApi(request);
    const { gameId } = await context.params;
    const body = await request.json() as {
      competitionId?: string;
      matchweek?: number;
      action?: "publish" | "configure";
    };
    const competitionId = String(body.competitionId ?? "");
    if (body.action === "publish") {
      const result = await publishPredictionRound({
        gameId, competitionId, matchweek: Number(body.matchweek ?? 0), adminUid: admin.uid,
      });
      return NextResponse.json(result);
    }
    await savePredictionConfig({ gameId, competitionId, adminUid: admin.uid });
    return NextResponse.json({ success: true });
  } catch (error) {
    return failure(error);
  }
}
