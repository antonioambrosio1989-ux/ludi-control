import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/src/lib/requireAdminApi";
import { getSurvivorConfig, saveSurvivorConfig } from "@/src/server/games/survivor/GamesSurvivorServer";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  try {
    await requireAdminApi(request);
    const { gameId } = await context.params;
    return NextResponse.json({ config: await getSurvivorConfig(gameId) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Operazione non autorizzata." }, { status: 403 }); }
}

export async function POST(request: NextRequest, context: { params: Promise<{ gameId: string }> }) {
  try {
    const admin = await requireAdminApi(request);
    const { gameId } = await context.params;
    const body = await request.json() as { competitionId?: string };
    await saveSurvivorConfig({ gameId, competitionId: String(body.competitionId ?? ""), adminUid: admin.uid });
    return NextResponse.json({ success: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const message = code === "ACTIVE_COMPETITION_REQUIRED" ? "Seleziona una competizione attiva." : code === "ACTIVE_SEASON_REQUIRED" ? "La competizione non ha una stagione attiva." : "Impossibile salvare la configurazione.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
