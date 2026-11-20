import "server-only";
import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/src/lib/firebaseAdmin";
import { requireAdminApi } from "@/src/lib/requireAdminApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idPattern = /^[a-zA-Z0-9_-]{1,180}$/;
const roles = new Set(["Portiere", "Difensore", "Attaccante"]);
const completedStatuses = new Set(["played", "finished", "walkover", "cancelled"]);
const civilDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime()) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const registryId = (seasonId: string, playerId: string) =>
  `sp_${Buffer.from(JSON.stringify([seasonId, playerId]), "utf8").toString("base64url")}`;
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
      const registryRef = adminDb.collection("seasonPlayerKeys").doc(registryId(seasonId, playerId));
      const [season, team, duplicates, registry] = await Promise.all([
        tx.get(seasonRef),
        tx.get(teamRef),
        tx.get(adminDb.collection("seasonPlayers")
          .where("seasonId", "==", seasonId)
          .where("playerId", "==", playerId).limit(10)),
        tx.get(registryRef),
      ]);
      if (!registry.exists || registry.get("seasonId") !== seasonId ||
          registry.get("playerId") !== playerId || registry.get("seasonPlayerId") !== seasonPlayerId)
        throw new Error("REGISTRY_INVALID");
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
          !completedStatuses.has(String(doc.get("status")))))
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
      const changingTeam = requestedTeamId !== teamId;
      const destinationRef = changingTeam
        ? seasonRef.collection("teamEntries").doc(requestedTeamId as string)
        : teamRef;
      const destination = changingTeam ? await tx.get(destinationRef) : team;
      if (!destination.exists || ["withdrawn", "completed"].includes(destination.get("status")))
        throw new Error("TEAM_NOT_AVAILABLE");
      if (changingTeam && (!team.exists || ["withdrawn", "completed"].includes(team.get("status"))))
        throw new Error("SOURCE_TEAM_NOT_AVAILABLE");
      if (season.get("regularSeasonClosed") === true)
        throw new Error("STAGIONE_CLOSED");
      if (shirtNumber !== undefined && shirtNumber !== null) {
        const others = await tx.get(adminDb.collection("seasonPlayers")
          .where("seasonId", "==", seasonId)
          .where("teamId", "==", requestedTeamId)
          .where("shirtNumber", "==", shirtNumber)
          .where("status", "==", "active").limit(10));
        if (others.docs.some((doc) => doc.id !== seasonPlayerId))
          throw new Error("SHIRT_TAKEN");
      }
      // Trasferimento di uno svincolato: nessuna finestra di mercato, ma
      // conserva la catena cronologica e non attribuisce a una squadra nuova
      // le partite gia disputate oggi. Data effettiva = domani.
      let transferUpdate: Record<string, unknown> = {};
      const transferRef = changingTeam ? adminDb.collection("seasonTransfers").doc() : null;
      let transferRecord: Record<string, unknown> | null = null;
      if (changingTeam) {
        // Un altro incontro ancora aperto oggi in una delle due squadre
        // renderebbe ambiguo l'allineamento della rosa col calendario.
        const todayMatches = await tx.get(adminDb.collection("matches")
          .where("seasonId", "==", seasonId).where("date", "==", today).limit(100));
        if (todayMatches.docs.some((doc) =>
          [String(doc.get("homeTeamId")), String(doc.get("awayTeamId"))]
            .some((id) => id === teamId || id === requestedTeamId) &&
          !completedStatuses.has(String(doc.get("status")))))
          throw new Error("TODAY_FIXTURES_PENDING");

        const history: unknown = record.transferHistory ?? [];
        if (!Array.isArray(history)) throw new Error("TRANSFER_HISTORY_INVALID");
        const initialTeamId = record.initialTeamId ?? teamId;
        if (typeof initialTeamId !== "string" || !idPattern.test(initialTeamId))
          throw new Error("TRANSFER_HISTORY_INVALID");
        let lastTeam = initialTeamId;
        let lastDate = "";
        const used = new Set<string>();
        for (const item of history) {
          if (!item || typeof item !== "object" || Array.isArray(item))
            throw new Error("TRANSFER_HISTORY_INVALID");
          const transfer = item as Record<string, unknown>;
          if (typeof transfer.id !== "string" || !transfer.id || used.has(transfer.id) ||
              transfer.playerId !== playerId || transfer.seasonId !== seasonId ||
              (transfer.competitionId !== undefined && transfer.competitionId !== season.get("competitionId")) ||
              !civilDate(transfer.effectiveDate) || transfer.effectiveDate <= lastDate ||
              transfer.fromTeamId !== lastTeam ||
              typeof transfer.toTeamId !== "string" || !idPattern.test(transfer.toTeamId))
            throw new Error("TRANSFER_HISTORY_INVALID");
          used.add(transfer.id);
          lastDate = transfer.effectiveDate;
          lastTeam = transfer.toTeamId;
        }
        if (lastTeam !== teamId || nextDay <= lastDate)
          throw new Error("TRANSFER_HISTORY_INVALID");
        const competitionId = season.get("competitionId");
        if (typeof competitionId !== "string" || !idPattern.test(competitionId))
          throw new Error("ISCRIZIONE_INVALID");
        if (!transferRef) throw new Error("TRANSFER_HISTORY_INVALID");
        transferRecord = {
          id: transferRef.id, seasonId, playerId, competitionId,
          fromTeamId: teamId, toTeamId: requestedTeamId,
          effectiveDate: nextDay,
        };
        transferUpdate = {
          teamId: requestedTeamId,
          initialTeamId,
          transferHistory: [...history, transferRecord],
        };
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
        ...transferUpdate,
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (transferRecord && transferRef) {
        tx.create(transferRef, {
          ...transferRecord, seasonPlayerId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
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
      REGISTRY_INVALID: "Registro univoco non coerente: operazione bloccata.",
      TRANSFER_HISTORY_INVALID: "Cronologia dei trasferimenti non coerente: operazione bloccata.",
      SOURCE_TEAM_NOT_AVAILABLE: "La squadra precedente non è disponibile.",
      TEAM_NOT_AVAILABLE: "La squadra non è più disponibile.",
      SHIRT_TAKEN: "Numero maglia già utilizzato.",
      TODAY_FIXTURES_PENDING: "Ci sono partite di oggi ancora aperte per una delle squadre. Completa prima gli incontri.",
    };
    console.error("Roster membership operation refused", error);
    return respond({ error: messages[code] ?? "Operazione non disponibile. Nessun dato modificato." }, 409);
  }
}
