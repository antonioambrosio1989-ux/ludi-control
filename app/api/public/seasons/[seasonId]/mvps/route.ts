import { getPublicMvpSummary } from "@/src/server/public/PublicSeasonSummaryServer";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ seasonId: string }> },
) {
  const { seasonId } = await params;
  if (!/^[\w-]{1,128}$/.test(seasonId))
    return Response.json({ error: "Stagione non valida." }, { status: 400 });
  try {
    return Response.json(await getPublicMvpSummary(seasonId), {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=5" },
    });
  } catch {
    return Response.json(
      { error: "MVP non disponibili." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
