import { requireGamesApiAccess } from "@/src/lib/requireGamesApiAccess";
import { resolveCurrentGamesSeasonId } from "@/src/server/games/GamesEntitlementServer";
import {
  getFriendGroup,
  listFriendGroups,
  mutateFriendGroup,
} from "@/src/server/games/social/GamesFriendsServer";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
function failure(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  console.error("[Games Friends] Operazione non riuscita", error);
  const message: Record<string, string> = {
    GROUP_NOT_AVAILABLE: "Gruppo non disponibile o accesso non consentito.",
    INVALID_NAME: "Il nome deve contenere da 3 a 40 caratteri.",
    GROUP_LIMIT: "Puoi partecipare al massimo a 5 gruppi per stagione.",
    GROUP_FULL: "Questo gruppo ha raggiunto 50 partecipanti.",
    INVALID_ACTION: "Operazione non valida.",
  };
  return Response.json(
    { error: message[code] ?? "Operazione temporaneamente non disponibile." },
    {
      status: code === "GROUP_NOT_AVAILABLE" ? 404 : message[code] ? 400 : 503,
      headers,
    },
  );
}
export async function GET(request: Request) {
  const access = await requireGamesApiAccess(request, {
    rateLimitProfile: "gamesQuizRead",
  });
  if (!access.ok) return access.response;
  try {
    const season = await resolveCurrentGamesSeasonId();
    if (!season)
      return Response.json(
        { error: "Nessuna stagione Games attiva." },
        { status: 409, headers },
      );
    const id = new URL(request.url).searchParams.get("group");
    if (id && !/^[a-f0-9]{16}$/.test(id))
      return failure(new Error("GROUP_NOT_AVAILABLE"));
    return Response.json(
      id
        ? await getFriendGroup(access.decodedToken.uid, season, id)
        : { groups: await listFriendGroups(access.decodedToken.uid, season) },
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  const access = await requireGamesApiAccess(request, {
    rateLimitProfile: "gamesRedeemCode",
  });
  if (!access.ok) return access.response;
  try {
    const season = await resolveCurrentGamesSeasonId();
    if (!season)
      return Response.json(
        { error: "Nessuna stagione Games attiva." },
        { status: 409, headers },
      );
    const body = await request.json();
    const id = await mutateFriendGroup({
      uid: access.decodedToken.uid,
      season,
      action: String(body.action ?? ""),
      name: body.name,
      id:
        typeof body.id === "string" ? body.id.trim().toLowerCase() : undefined,
    });
    return Response.json({ id }, { headers });
  } catch (error) {
    return failure(error);
  }
}
