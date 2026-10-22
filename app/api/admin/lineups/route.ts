import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { adminAuth, adminDb } from "@/src/lib/firebaseAdmin";

export const runtime = "nodejs";

type Side = "home" | "away";
const validId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(value);
const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const stringIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));
const errorResponse = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  try {
    const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
    if (!bearer) return errorResponse("Autenticazione richiesta.", 401);
    let uid: string;
    try {
      uid = (await adminAuth.verifyIdToken(bearer, true)).uid;
    } catch {
      return errorResponse("Sessione non valida o scaduta.", 401);
    }
    const admin = await adminDb.collection("admins").doc(uid).get();
    if (!admin.exists || admin.data()?.active !== true) return errorResponse("Permessi amministrativi insufficienti.", 403);

    let body: Record<string, unknown>;
    try { body = asRecord(await request.json()); }
    catch { return errorResponse("Richiesta JSON non valida.", 400); }
    if (body.action === "rename_guest") {
      const { matchId, seasonId, teamId, side, guestId, expectedGuestName, lastName, firstName } = body;
      if (!validId(matchId) || !validId(seasonId) || !validId(teamId) ||
          (side !== "home" && side !== "away") || !validId(guestId) ||
          typeof expectedGuestName !== "string" || typeof lastName !== "string" ||
          typeof firstName !== "string") return errorResponse("Dati giocatore non validi.", 400);
      const validNamePart = (value: string) => value.length <= 100 &&
        /^[\p{L}\p{M}'’ .-]*$/u.test(value);
      const cleanLastName = lastName.trim().replace(/\s+/g, " ");
      const cleanFirstName = firstName.trim().replace(/\s+/g, " ");
      if (!cleanLastName || !validNamePart(cleanLastName) || !validNamePart(cleanFirstName))
        return errorResponse("Cognome o nome non valido.", 400);
      const titleCase = (value: string) => value.toLocaleLowerCase("it")
        .replace(/(^|[\s'’.-])([\p{L}])/gu, (_, boundary: string, letter: string) =>
          boundary + letter.toLocaleUpperCase("it"));
      const formattedLast = titleCase(cleanLastName);
      const formattedFirst = titleCase(cleanFirstName);
      const name = [formattedLast, formattedFirst].filter(Boolean).join(" ");
      const normalizedName = name.toLocaleLowerCase("it").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
      const matchRef = adminDb.collection("matches").doc(matchId);
      const lineupRef = adminDb.collection("matchLineups").doc(matchId);
      const requestRef = adminDb.collection("lineupRequests").doc(`${matchId}__${teamId}`);
      const auditRef = adminDb.collection("lineupAdminEdits").doc();
      await adminDb.runTransaction(async (tx) => {
        const [matchSnap, lineupSnap, requestSnap] = await Promise.all([
          tx.get(matchRef), tx.get(lineupRef), tx.get(requestRef),
        ]);
        if (!matchSnap.exists || !lineupSnap.exists) throw new Error("Partita o formazione non trovata.");
        const match = matchSnap.data() ?? {};
        if (match.seasonId !== seasonId || match[side === "home" ? "homeTeamId" : "awayTeamId"] !== teamId)
          throw new Error("Squadra o stagione non associata alla partita.");
        const oldSide = asRecord(lineupSnap.data()?.[side]);
        if (oldSide.teamId !== teamId) throw new Error("Formazione della squadra non disponibile.");
        const oldGuests = Array.isArray(oldSide.guestPlayers) ? oldSide.guestPlayers.map(asRecord) : [];
        const existing = oldGuests.find((guest) => guest.id === guestId);
        if (!existing || existing.name !== expectedGuestName)
          throw new Error("Il nominativo è stato modificato: aggiorna la pagina prima di salvare.");
        if (oldGuests.some((guest) => guest.id !== guestId &&
            typeof guest.name === "string" && guest.name.toLocaleLowerCase("it").normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim() === normalizedName))
          throw new Error("Un altro giocatore provvisorio ha già questo nominativo.");
        const updatedGuests = oldGuests.map((guest) => guest.id === guestId
          ? { ...guest, name, lastName: formattedLast, firstName: formattedFirst || null, normalizedName }
          : guest);
        const changedAt = FieldValue.serverTimestamp();
        tx.update(lineupRef, { [`${side}.guestPlayers`]: updatedGuests,
          [`${side}.adminEditedAt`]: changedAt, [`${side}.lastModifiedAt`]: changedAt,
          updatedAt: changedAt });
        if (requestSnap.exists) tx.update(requestRef, {
          guestPlayers: updatedGuests, adminEditedAt: changedAt, updatedAt: changedAt,
        });
        tx.set(auditRef, { matchId, seasonId, teamId, side, adminUid: uid,
          action: "rename_guest", guestId, previousGuestName: expectedGuestName,
          nextGuestName: name, source: "ludi-control", createdAt: changedAt });
      });
      return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }

    const { matchId, seasonId, teamId, side, playerIds, expectedPlayerIds,
      goalkeeperId, expectedGoalkeeperId, guestGoalkeeperName } = body;
    if (!validId(matchId) || !validId(seasonId) || !validId(teamId) || (side !== "home" && side !== "away"))
      return errorResponse("Partita, stagione o squadra non valida.", 400);
    if (!Array.isArray(playerIds) || !Array.isArray(expectedPlayerIds) ||
      playerIds.length > 100 || expectedPlayerIds.length > 100 ||
      !playerIds.every(validId) || !expectedPlayerIds.every(validId) ||
      new Set(playerIds).size !== playerIds.length || new Set(expectedPlayerIds).size !== expectedPlayerIds.length)
      return errorResponse("Elenco giocatori non valido.", 400);

    if (goalkeeperId !== null && goalkeeperId !== undefined && goalkeeperId !== "" && !validId(goalkeeperId))
      return errorResponse("Identificativo del portiere non valido.", 400);
    if (expectedGoalkeeperId !== null && expectedGoalkeeperId !== undefined && expectedGoalkeeperId !== "" && !validId(expectedGoalkeeperId))
      return errorResponse("Portiere precedente non valido.", 400);
    if (guestGoalkeeperName !== null && guestGoalkeeperName !== undefined && guestGoalkeeperName !== "" &&
      (typeof guestGoalkeeperName !== "string" || guestGoalkeeperName.trim().length > 100 || guestGoalkeeperName.trim().length < 2 ||
        !/^[\p{L}\p{M}'’ .-]+$/u.test(guestGoalkeeperName.trim())))
      return errorResponse("Nome del portiere provvisorio non valido.", 400);
    if (goalkeeperId && guestGoalkeeperName) return errorResponse("Scegli un solo portiere.", 400);

    const lineupRef = adminDb.collection("matchLineups").doc(matchId);
    const matchRef = adminDb.collection("matches").doc(matchId);
    const requestRef = adminDb.collection("lineupRequests").doc(`${matchId}__${teamId}`);
    const auditRef = adminDb.collection("lineupAdminEdits").doc();
    const validatedSide = side as Side;
    await adminDb.runTransaction(async (tx) => {
      const [matchSnap, lineupSnap, requestSnap] = await Promise.all([
        tx.get(matchRef), tx.get(lineupRef), tx.get(requestRef),
      ]);
      if (!matchSnap.exists) throw new Error("Partita non trovata.");
      const match = matchSnap.data() ?? {};
      if (match.seasonId !== seasonId || match[side === "home" ? "homeTeamId" : "awayTeamId"] !== teamId)
        throw new Error("Squadra o stagione non associata alla partita.");
      const old = asRecord(lineupSnap.data()?.[validatedSide]);
      const oldIds = stringIds(old.playerIds);
      const oldGoalkeeper = typeof old.goalkeeperId === "string" ? old.goalkeeperId : "";
      if (oldGoalkeeper !== (typeof expectedGoalkeeperId === "string" ? expectedGoalkeeperId : ""))
        throw new Error("Il portiere è stato cambiato da un altro utente: aggiorna la pagina.");
      if (!sameSet(oldIds, expectedPlayerIds as string[]))
        throw new Error("La formazione è cambiata: aggiorna la pagina prima di salvare.");
      // Controlla i tesserati in rosa sul server, senza fidarsi delle opzioni del browser.
      const rosterQuery = adminDb.collection("seasonPlayers")
        .where("seasonId", "==", seasonId).where("teamId", "==", teamId);
      const rosterSnap = await tx.get(rosterQuery);
      const active = new Set(rosterSnap.docs.flatMap((doc) => {
        const data = doc.data();
        return data.status === "active" && typeof data.playerId === "string" ? [data.playerId] : [];
      }));
      if (!(playerIds as string[]).every((id) => active.has(id)))
        throw new Error("Uno o più giocatori non appartengono alla rosa attiva.");
      const oldGuests = Array.isArray(old.guestPlayers) ? old.guestPlayers.map(asRecord) : [];
      let guests = oldGuests;
      let selectedGoalkeeper = typeof goalkeeperId === "string" ? goalkeeperId : "";
      if (selectedGoalkeeper && !(playerIds as string[]).includes(selectedGoalkeeper) &&
        !oldGuests.some((g) => g.id === selectedGoalkeeper))
        throw new Error("Il portiere selezionato non è tra i convocati.");
      if (typeof guestGoalkeeperName === "string" && guestGoalkeeperName.trim()) {
        const name = guestGoalkeeperName.replace(/\s+/g, " ").trim();
        const normalized = name.toLocaleLowerCase("it").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const sameName = oldGuests.find((g) => typeof g.name === "string" &&
          g.name.toLocaleLowerCase("it").normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalized);
        const id = typeof sameName?.id === "string" ? sameName.id : `guest_admin_${createHash("sha256")
          .update(`${matchId}:${teamId}:${normalized}`).digest("hex").slice(0, 24)}`;
        if (!sameName) guests = [...oldGuests, { id, name, normalizedName: normalized }];
        selectedGoalkeeper = id;
      }
      if (oldGoalkeeper && !(playerIds as string[]).includes(oldGoalkeeper) &&
        !guests.some((g) => g.id === oldGoalkeeper) && !selectedGoalkeeper)
        throw new Error("Hai rimosso il portiere: indica chi giocherà in porta.");
      const status = (playerIds as string[]).length + guests.length >= 5 ? "published" : "needs_review";
      const changedAt = FieldValue.serverTimestamp();
      tx.set(lineupRef, {
        matchId, seasonId,
        [validatedSide]: { ...old, teamId, status, playerIds, guestPlayers: guests, goalkeeperId: selectedGoalkeeper || null,
          adminEditedAt: changedAt, lastModifiedAt: changedAt },
        updatedAt: changedAt,
      }, { merge: true });
      if (requestSnap.exists) {
        tx.set(requestRef, {
          status, playerIds, guestPlayers: guests, goalkeeperId: selectedGoalkeeper || null,
          pendingPlayerConfirmation: null, pendingLineupEdit: null,
          unresolvedLabels: [], adminEditedAt: changedAt, updatedAt: changedAt,
        }, { merge: true });
      }
      tx.set(auditRef, { matchId, seasonId, teamId, side, adminUid: uid,
        previousPlayerIds: oldIds, nextPlayerIds: playerIds, previousGoalkeeperId: oldGoalkeeper || null, nextGoalkeeperId: selectedGoalkeeper || null, source: "ludi-control", createdAt: changedAt });
    });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin lineup save error:", error);
    return errorResponse(error instanceof Error ? error.message : "Salvataggio non riuscito.", 400);
  }
}
