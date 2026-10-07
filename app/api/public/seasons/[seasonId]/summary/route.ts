import { getPublicSeasonSummary } from "@/src/server/public/PublicSeasonSummaryServer";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ seasonId: string }> },
) {
  const { seasonId } = await params;
  if (!/^[\w-]{1,128}$/.test(seasonId))
    return Response.json({ error: "Stagione non valida." }, { status: 400 });
  try {
    return Response.json(await getPublicSeasonSummary(seasonId), {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=5" },
    });
  } catch (error) {
    const status =
      error instanceof Error && error.message === "SEASON_NOT_FOUND"
        ? 404
        : 503;
    return Response.json(
      { error: "Riepilogo temporaneamente non disponibile." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
