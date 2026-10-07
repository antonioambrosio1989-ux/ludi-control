import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/src/lib/requireAdminApi";
import { getPredictionConfig, savePredictionConfig } from "@/src/server/games/prediction/GamesPredictionServer";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  try {
    await requireAdminApi(request);
    const { gameId } = await context.params;
    return NextResponse.json({ config: await getPredictionConfig(gameId) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Operazione non autorizzata." }, { status: 403 }); }
}

export async function POST(request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  try {
    const admin = await requireAdminApi(request);
    const { gameId } = await context.params;
    const body = await request.json() as { competitionId?: string };
    await savePredictionConfig({ gameId, competitionId: String(body.competitionId ?? ""), adminUid: admin.uid });
    return NextResponse.json({ success: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: code === "ACTIVE_COMPETITION_REQUIRED" ? "Seleziona una competizione attiva." : "Impossibile salvare la configurazione." }, { status: 400 });
  }
}
