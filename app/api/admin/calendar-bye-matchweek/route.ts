import { NextRequest, NextResponse } from "next/server";
import { getHistoricalByeCounts } from "@/src/services/calendar/LudiHistoricalByes";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/src/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BYE = "__ludi_bye__";
const idOk = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const matchTimes = new Set(["20:30", "21:30", "22:30"]);
const answer = (data: object, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

type Fixture = { homeTeamId: string; awayTeamId: string; date: string; time: string };

async function requireAdmin(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return false;
  try {
    const identity = await adminAuth.verifyIdToken(token, true);
    const admin = await adminDb.collection("admins").doc(identity.uid).get();
    return admin.exists && admin.data()?.active === true;
  } catch { return false; }
}

function pair(a: string, b: string) { return [a, b].sort().join("|"); }

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) return answer({ error: "Accesso amministratore richiesto." }, 403);
  let body: unknown;
  try { body = await request.json(); } catch { return answer({ error: "JSON non valido." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return answer({ error: "Richiesta non valida." }, 400);
  const input = body as Record<string, unknown>;
  if (!idOk(input.seasonId) || !Number.isSafeInteger(input.matchweek) ||
      (input.matchweek as number) < 1 || (input.matchweek as number) > 100 ||
      !Array.isArray(input.draft) || input.draft.length < 2 || input.draft.length > 100) {
    return answer({ error: "Stagione, giornata o calendario non validi." }, 400);
  }
  const seasonId = input.seasonId;
  const matchweek = input.matchweek as number;
  const fixtures = input.draft as Fixture[];
  if (fixtures.some((fixture) => !fixture || typeof fixture !== "object" ||
      !idOk(fixture.homeTeamId) || !idOk(fixture.awayTeamId) ||
      typeof fixture.date !== "string" || typeof fixture.time !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fixture.date))) {
    return answer({ error: "Partite non valide." }, 400);
  }
  const fake = fixtures.filter((fixture) => fixture.awayTeamId === BYE);
  if (fake.length !== 1 || fixtures.some((fixture) => fixture.homeTeamId === BYE)) {
    return answer({ error: "È consentito un solo RIPOSO per giornata, sempre come ospite." }, 400);
  }
  const realFixtures = fixtures.filter((fixture) => fixture.awayTeamId !== BYE);
  const bye = fake[0];
  const participants = fixtures.flatMap((fixture) => fixture.awayTeamId === BYE
    ? [fixture.homeTeamId] : [fixture.homeTeamId, fixture.awayTeamId]);
  if (new Set(participants).size !== participants.length ||
      realFixtures.some((fixture) => fixture.homeTeamId === fixture.awayTeamId || !matchTimes.has(fixture.time))) {
    return answer({ error: "Squadra duplicata oppure orario non valido." }, 400);
  }
  const slots = realFixtures.map((fixture) => `${fixture.date}|${fixture.time}`);
  if (new Set(slots).size !== slots.length) return answer({ error: "Slot duplicato." }, 400);
  const seasonRef = adminDb.collection("seasons").doc(seasonId);
  const seasonMatchesQuery = adminDb.collection("matches").where("seasonId", "==", seasonId);
  try {
    await adminDb.runTransaction(async (transaction) => {
      const [season, teamEntries, withdrawals, previous] = await Promise.all([
        transaction.get(seasonRef),
        transaction.get(seasonRef.collection("teamEntries")),
        transaction.get(seasonRef.collection("withdrawalRegistrations")),
        transaction.get(seasonMatchesQuery),
      ]);
      if (!season.exists || !["draft", "active"].includes(String(season.data()?.status))) {
        throw new Error("Stagione non modificabile.");
      }
      const withdrawn = new Set(withdrawals.docs
        .filter((doc) => doc.data().state === "active" && doc.data().effectsApplied === true)
        .map((doc) => doc.data().teamId || doc.id));
      const active = new Set(teamEntries.docs
        .filter((doc) => (doc.data().status ?? "active") === "active" && !withdrawn.has(doc.data().teamId || doc.id))
        .map((doc) => String(doc.data().teamId || doc.id)));
      if (active.size % 2 !== 1 || active.size < 3 ||
          realFixtures.length !== Math.floor(active.size / 2) ||
          participants.length !== active.size ||
          participants.some((team) => !active.has(team))) {
        throw new Error("Il calendario non contiene tutte le squadre attive e un unico RIPOSO.");
      }
      if (previous.docs.some((doc) => Number(doc.data().matchweek) === matchweek)) {
        throw new Error(`La Matchweek ${matchweek} contiene già gare: nessuna modifica applicata.`);
      }
      const historical = previous.docs.filter((doc) => doc.data().status !== "cancelled")
        .map((doc) => doc.data());
      const previousPairs = new Set(historical.map((match) => pair(String(match.homeTeamId), String(match.awayTeamId))));
      const previousSlots = new Set(historical.map((match) => `${match.date}|${match.time}`));
      const currentPairs = realFixtures.map((fixture) => pair(fixture.homeTeamId, fixture.awayTeamId));
      if (new Set(currentPairs).size !== currentPairs.length ||
          currentPairs.some((key) => previousPairs.has(key)) ||
          slots.some((slot) => previousSlots.has(slot))) {
        throw new Error("Esistono gare, incroci o slot già utilizzati nel calendario.");
      }
      // La rotazione comprende anche le gare gia concluse contro Bristol
      // o altre squadre ritirate ufficialmente; non modifichiamo lo storico.
      const byeCounts = getHistoricalByeCounts({
        matches: previous.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Array<{
          id: string; matchweek: number; status: string;
          homeTeamId: string; awayTeamId: string;
        }>,
        activeTeamIds: [...active],
        withdrawnTeamIds: [
          ...withdrawn,
          ...teamEntries.docs.filter((doc) => doc.data().status === "withdrawn")
            .map((doc) => String(doc.data().teamId || doc.id)),
        ],
        beforeMatchweek: matchweek,
      });
      if ((byeCounts.get(bye.homeTeamId) ?? 0) !== Math.min(...byeCounts.values())) {
        throw new Error("Questa squadra ha già riposato più delle altre squadre attive.");
      }
      const now = FieldValue.serverTimestamp();
      for (const fixture of fixtures) {
        const isBye = fixture.awayTeamId === BYE;
        const ref = adminDb.collection("matches").doc();
        transaction.create(ref, {
          seasonId, matchType: "regularSeason", matchweek, matchweekId: `mw${matchweek}`,
          date: fixture.date, time: isBye ? "00:00" : fixture.time,
          venue: isBye ? "RIPOSO" : "Centro Sportivo Ludi",
          homeTeamId: fixture.homeTeamId, awayTeamId: fixture.awayTeamId,
          status: isBye ? "cancelled" : "scheduled",
          published: false,
          ...(isBye ? { isBye: true } : {}),
          createdAt: now, updatedAt: now,
        });
      }
    });
    return answer({ ok: true, matches: realFixtures.length, byeTeamId: bye.homeTeamId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Salvataggio non riuscito.";
    return answer({ error: message }, 409);
  }
}
