import "server-only";
import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/src/lib/firebaseAdmin";
import { requireAdminApi } from "@/src/lib/requireAdminApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idPattern = /^[a-zA-Z0-9_-]{1,180}$/;
const roles = new Set(["Portiere", "Difensore", "Attaccante"]);
type InactivePeriod = { from: string; to?: string };

function romeDay() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function respond(data: object, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminApi(request);
  } catch {
    return respond({ error: "Accesso amministratore richiesto." }, 403);
  }

  try {
    if (Number(request.headers.get("content-length") ?? 0) > 4096)
      return respond({ error: "Richiesta troppo grande." }, 413);
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      return respond({ error: "Richiesta non valida." }, 400);
    const input = raw as Record<string, unknown>;
    const action = input.action;
    const seasonPlayerId = input.seasonPlayerId;
    if ((action !== "release" && action !== "restore") ||
      typeof seasonPlayerId !== "string" || !idPattern.test(seasonPlayerId))
      return respond({ error: "Operazione o iscrizione non valida." }, 400);

    const requestedTeamId = input.teamId;
    if (action === "restore" &&
      (typeof requestedTeamId !== "string" || !idPattern.test(requestedTeamId) ||
       typeof input.role !== "string" || !roles.has(input.role)))
      return respond({ error: "Dati per il reinserimento non validi." }, 400);
    const shirtNumber = input.shirtNumber;
    if (action === "restore" && shirtNumber !== undefined && shirtNumber !== null &&
      (!Number.isInteger(shirtNumber) || Number(shirtNumber) < 1 || Number(shirtNumber) > 99))
      return respond({ error: "Numero maglia non valido." }, 400);

    const today = romeDay();
    const [year, month, day] = today.split("-").map(Number);
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
    const ref = adminDb.collection("seasonPlayers").doc(seasonPlayerId);
    await adminDb.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw new Error("ISCRIZIONE_NOT_FOUND");
      const record = snapshot.data() ?? {};
      const seasonId = record.seasonId;
      const teamId = record.teamId;
      const playerId = record.playerId;
      if (![seasonId, teamId, playerId].every((value) =>
        typeof value === "string" && idPattern.test(value)))
        throw new Error("ISCRIZIONE_INVALID");
      const seasonRef = adminDb.collection("seasons").doc(seasonId);
      const teamRef = seasonRef.collection("teamEntries").doc(teamId);
      const [season, team, duplicates] = await Promise.all([
        tx.get(seasonRef),
        tx.get(teamRef),
        tx.get(adminDb.collection("seasonPlayers")
          .where("seasonId", "==", seasonId)
          .where("playerId", "==", playerId).limit(10)),
      ]);
      if (!season.exists || !["draft", "active"].includes(season.get("status")))
        throw new Error("STAGIONE_CLOSED");
      if (duplicates.docs.some((doc) => doc.id !== seasonPlayerId && doc.get("status") === "active"))
        throw new Error("DUPLICATE_ACTIVE");
      if (action === "release") {
        if (record.status !== "active") throw new Error("NOT_ACTIVE");
        // Con una data di uscita solo YYYY-MM-DD conserviamo tutte le gare
        // già concluse oggi. Non permettiamo la rimozione finché ci sono gare
        // della squadra non terminate oggi, per evitare attribuzioni politiche.
        const todayMatches = await tx.get(adminDb.collection("matches")
          .where("seasonId", "==", seasonId).where("date", "==", today).limit(100));
        if (todayMatches.docs.some((doc) =>
          [String(doc.get("homeTeamId")), String(doc.get("awayTeamId"))].includes(teamId) &&
          !["played", "finished", "walkover", "cancelled"].includes(String(doc.get("status")))))
          throw new Error("TODAY_FIXTURES_PENDING");
        const periods: InactivePeriod[] = Array.isArray(record.inactivePeriods)
          ? record.inactivePeriods : [];
        if (periods.some((item) => !item.to)) throw new Error("INTERVALS_INCONSISTENT");
        tx.update(ref, {
          status: "inactive",
          leftAt: nextDay,
          inactivePeriods: [...periods, { from: nextDay }],
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      if (record.status !== "inactive") throw new Error("NOT_INACTIVE");
      // Non bypassare il mercato/trasferimenti: il rientro è nella stessa squadra.
      if (requestedTeamId !== teamId) throw new Error("OTHER_TEAM_NOT_ALLOWED");
      if (!team.exists || ["withdrawn", "completed"].includes(team.get("status")))
        throw new Error("TEAM_NOT_AVAILABLE");
      if (season.get("regularSeasonClosed") === true)
        throw new Error("STAGIONE_CLOSED");
      if (shirtNumber !== undefined && shirtNumber !== null) {
        const others = await tx.get(adminDb.collection("seasonPlayers")
          .where("seasonId", "==", seasonId)
          .where("teamId", "==", teamId)
          .where("shirtNumber", "==", shirtNumber)
          .where("status", "==", "active").limit(10));
        if (others.docs.some((doc) => doc.id !== seasonPlayerId))
          throw new Error("SHIRT_TAKEN");
      }
      const periods: InactivePeriod[] = Array.isArray(record.inactivePeriods)
        ? [...record.inactivePeriods] : [];
      if (periods.length > 0 && !periods[periods.length - 1].to) {
        periods[periods.length - 1] = { ...periods[periods.length - 1],
          to: today < periods[periods.length - 1].from ? periods[periods.length - 1].from : today };
      } else if (typeof record.leftAt === "string" && record.leftAt <= today) {
        periods.push({ from: record.leftAt, to: today });
      }
      tx.update(ref, {
        status: "active",
        role: input.role,
        shirtNumber: shirtNumber ?? null,
        leftAt: FieldValue.delete(),
        inactivePeriods: periods,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return respond({ ok: true, action });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const messages: Record<string, string> = {
      ISCRIZIONE_NOT_FOUND: "Iscrizione non trovata.",
      ISCRIZIONE_INVALID: "Iscrizione non coerente.",
      STAGIONE_CLOSED: "Stagione non modificabile.",
      DUPLICATE_ACTIVE: "Esiste già un'iscrizione attiva del giocatore.",
      NOT_ACTIVE: "Il giocatore non risulta attivo nella rosa.",
      NOT_INACTIVE: "Il giocatore non risulta svincolato.",
      INTERVALS_INCONSISTENT: "Storico dei periodi da verificare: operazione bloccata.",
      OTHER_TEAM_NOT_ALLOWED: "Il reinserimento in una squadra diversa deve avvenire tramite Mercato Ludi.",
      TEAM_NOT_AVAILABLE: "La squadra non è più disponibile.",
      SHIRT_TAKEN: "Numero maglia già utilizzato.",
      TODAY_FIXTURES_PENDING: "Per questa squadra ci sono partite di oggi ancora aperte. Completa i tabellini o effettua lo svincolo domani.",
    };
    console.error("Roster membership operation refused", error);
    return respond({ error: messages[code] ?? "Operazione non disponibile. Nessun dato modificato." }, 409);
  }
}
