import { getPublicPlayerSummary } from "@/src/server/public/PublicSeasonSummaryServer";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ seasonId: string; playerId: string }> },
) {
  const { seasonId, playerId } = await params;
  if (!/^[\w-]{1,128}$/.test(seasonId) || !/^[\w-]{1,128}$/.test(playerId))
    return Response.json(
      { error: "Identificativo non valido." },
      { status: 400 },
    );
  try {
    return Response.json(await getPublicPlayerSummary(seasonId, playerId), {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=5" },
    });
  } catch {
    return Response.json(
      { error: "Statistiche temporaneamente non disponibili." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
