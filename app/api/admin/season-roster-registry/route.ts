import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/src/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const validId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,180}$/.test(value);
const roles = new Set(["Portiere", "Difensore", "Attaccante"]);
// FASE 6: abilitazione esplicita e separata della scrittura server.
// La Preview resta sempre in sola lettura; l'ambiente demo mantiene i test esistenti.
const inDemo = process.env.FIREBASE_ADMIN_PROJECT_ID === "demo-ludi-market-confirm" &&
  Boolean(process.env.FIRESTORE_EMULATOR_HOST) && Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
const inProduction =
  process.env.VERCEL_ENV === "production" &&
  process.env.LUDI_ROSTER_WRITES_ENABLED === "true" &&
  typeof process.env.LUDI_ROSTER_ALLOWED_PROJECT_ID === "string" &&
  process.env.LUDI_ROSTER_ALLOWED_PROJECT_ID.length > 0 &&
  process.env.LUDI_ROSTER_ALLOWED_PROJECT_ID !== "demo-ludi-market-confirm" &&
  process.env.FIREBASE_ADMIN_PROJECT_ID === process.env.LUDI_ROSTER_ALLOWED_PROJECT_ID &&
  !process.env.FIRESTORE_EMULATOR_HOST &&
  !process.env.FIREBASE_AUTH_EMULATOR_HOST;
const registryWritesAllowed = inDemo || inProduction;

type Input = { seasonId: string; playerId: string; teamId: string; role: string; shirtNumber?: number | null };
function parseInput(value: unknown): Input {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Iscrizione non valida.");
  const v = value as Record<string, unknown>;
  if (!validId(v.seasonId) || !validId(v.playerId) || !validId(v.teamId) || typeof v.role !== "string" || !roles.has(v.role))
    throw new Error("Campi iscrizione non validi.");
  if (v.shirtNumber !== undefined && v.shirtNumber !== null && (!Number.isInteger(v.shirtNumber) || (v.shirtNumber as number) < 0 || (v.shirtNumber as number) > 99))
    throw new Error("Numero maglia non valido.");
  return { seasonId: v.seasonId, playerId: v.playerId, teamId: v.teamId, role: v.role, shirtNumber: v.shirtNumber as number | null | undefined };
}
function registryId(seasonId: string, playerId: string) {
  return "sp_" + Buffer.from(JSON.stringify([seasonId, playerId]), "utf8").toString("base64url");
}
async function checkAdmin(request: NextRequest): Promise<boolean> {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return false;
  try {
    const user = await adminAuth.verifyIdToken(token, true);
    const admin = await adminDb.doc(`admins/${user.uid}`).get();
    return admin.exists && admin.get("active") === true;
  } catch { return false; }
}

async function createOne(input: Input): Promise<string> {
  const rosterRef = adminDb.collection("seasonPlayers").doc();
  const keyRef = adminDb.collection("seasonPlayerKeys").doc(registryId(input.seasonId, input.playerId));
  const seasonRef = adminDb.doc(`seasons/${input.seasonId}`);
  const teamRef = seasonRef.collection("teamEntries").doc(input.teamId);
  await adminDb.runTransaction(async tx => {
    const [season, team, key, existing, shirt] = await Promise.all([
      tx.get(seasonRef), tx.get(teamRef), tx.get(keyRef),
      tx.get(adminDb.collection("seasonPlayers").where("seasonId", "==", input.seasonId).where("playerId", "==", input.playerId).limit(1)),
      input.shirtNumber == null ? Promise.resolve(null) :
        tx.get(adminDb.collection("seasonPlayers").where("seasonId", "==", input.seasonId).where("teamId", "==", input.teamId).where("shirtNumber", "==", input.shirtNumber).where("status", "==", "active").limit(1)),
    ]);
    if (!season.exists || !["draft", "active"].includes(season.get("status")) || season.get("regularSeasonClosed") === true)
      throw new Error("Stagione non modificabile.");
    if (!team.exists || team.get("status") === "withdrawn" || team.get("status") === "completed")
      throw new Error("Squadra non iscritta o ritirata.");
    if (key.exists || !existing.empty) throw new Error("Giocatore già iscritto nella stagione.");
    if (shirt && !shirt.empty) throw new Error("Numero maglia già utilizzato.");
    tx.create(rosterRef, {
      seasonId: input.seasonId, playerId: input.playerId, teamId: input.teamId,
      role: input.role, shirtNumber: input.shirtNumber ?? null, status: "active",
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    tx.create(keyRef, { seasonId: input.seasonId, playerId: input.playerId, seasonPlayerId: rosterRef.id });
  });
  return rosterRef.id;
}

// FASE 5E: una transazione, nessuna scrittura parziale.
// Limite conservativo: due documenti per giocatore, piu eventuali trasformazioni di timestamp.
const MAX_ATOMIC_IMPORT = 200;
async function createManyAtomic(inputs: Input[]): Promise<number> {
  if (inputs.length < 1 || inputs.length > MAX_ATOMIC_IMPORT)
    throw new Error(`Import atomico limitato a 1-${MAX_ATOMIC_IMPORT} iscrizioni.`);
  const seasonId = inputs[0].seasonId;
  if (inputs.some(x => x.seasonId !== seasonId))
    throw new Error("Tutte le iscrizioni devono appartenere alla stessa stagione.");

  const players = new Set<string>();
  const shirtNumbers = new Set<string>();
  for (const input of inputs) {
    if (players.has(input.playerId)) throw new Error("Iscrizioni duplicate nel file.");
    players.add(input.playerId);
    if (input.shirtNumber != null) {
      const shirtKey = JSON.stringify([input.teamId, input.shirtNumber]);
      if (shirtNumbers.has(shirtKey)) throw new Error("Numero maglia duplicato nel file.");
      shirtNumbers.add(shirtKey);
    }
  }

  const seasonRef = adminDb.doc(`seasons/${seasonId}`);
  const teamRefs = new Map([...new Set(inputs.map(x => x.teamId))].map(teamId =>
    [teamId, seasonRef.collection("teamEntries").doc(teamId)] as const));
  const rosterRefs = inputs.map(() => adminDb.collection("seasonPlayers").doc());
  const keyRefs = inputs.map(x => adminDb.collection("seasonPlayerKeys").doc(registryId(x.seasonId, x.playerId)));

  await adminDb.runTransaction(async tx => {
    // Tutte le letture precedono ogni scrittura, anche in caso di retry.
    const season = await tx.get(seasonRef);
    if (!season.exists || !["draft", "active"].includes(season.get("status")) || season.get("regularSeasonClosed") === true)
      throw new Error("Stagione non modificabile.");
    const teams = await Promise.all([...teamRefs.entries()].map(async ([teamId, ref]) =>
      [teamId, await tx.get(ref)] as const));
    for (const [teamId, snap] of teams) {
      if (!snap.exists || snap.get("status") === "withdrawn" || snap.get("status") === "completed" ||
          (snap.get("teamId") != null && snap.get("teamId") !== teamId))
        throw new Error("Squadra non iscritta o ritirata.");
    }
    const keys = await Promise.all(keyRefs.map(ref => tx.get(ref)));
    if (keys.some(snap => snap.exists)) throw new Error("Giocatore già iscritto nella stagione.");

    const existingPlayers = await Promise.all(inputs.map(x =>
      tx.get(adminDb.collection("seasonPlayers").where("seasonId", "==", seasonId)
        .where("playerId", "==", x.playerId).limit(1))));
    if (existingPlayers.some(snap => !snap.empty)) throw new Error("Giocatore già iscritto nella stagione.");

    const existingShirts = await Promise.all(inputs.map(x => x.shirtNumber == null
      ? Promise.resolve(null)
      : tx.get(adminDb.collection("seasonPlayers").where("seasonId", "==", seasonId)
        .where("teamId", "==", x.teamId).where("shirtNumber", "==", x.shirtNumber)
        .where("status", "==", "active").limit(1))));
    if (existingShirts.some(snap => snap && !snap.empty)) throw new Error("Numero maglia già utilizzato.");

    inputs.forEach((input, i) => {
      tx.create(rosterRefs[i], {
        seasonId: input.seasonId, playerId: input.playerId, teamId: input.teamId,
        role: input.role, shirtNumber: input.shirtNumber ?? null, status: "active",
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      tx.create(keyRefs[i], { seasonId: input.seasonId, playerId: input.playerId, seasonPlayerId: rosterRefs[i].id });
    });
  });
  return inputs.length;
}

async function removeOne(seasonPlayerId: string): Promise<void> {
  const rosterRef = adminDb.doc(`seasonPlayers/${seasonPlayerId}`);
  await adminDb.runTransaction(async tx => {
    const roster = await tx.get(rosterRef);
    if (!roster.exists) throw new Error("Iscrizione non trovata.");
    const seasonId = roster.get("seasonId");
    const playerId = roster.get("playerId");
    if (!validId(seasonId) || !validId(playerId)) throw new Error("Identità iscrizione non valida.");
    const seasonRef = adminDb.doc(`seasons/${seasonId}`);
    const keyRef = adminDb.doc(`seasonPlayerKeys/${registryId(seasonId, playerId)}`);
    const [season, key, transfers] = await Promise.all([
      tx.get(seasonRef), tx.get(keyRef),
      tx.get(adminDb.collection("seasonTransfers").where("seasonPlayerId", "==", seasonPlayerId).limit(1)),
    ]);
    // Senza un controllo completo di tabellini/statistiche, solo le bozze sono eliminabili.
    if (!season.exists || season.get("status") !== "draft") throw new Error("Rimozione consentita solo in stagione bozza.");
    if (season.get("regularSeasonClosed") === true || !transfers.empty || (Array.isArray(roster.get("transferHistory")) && roster.get("transferHistory").length > 0))
      throw new Error("Storico presente: eliminazione bloccata.");
    if (!key.exists || key.get("seasonPlayerId") !== seasonPlayerId || key.get("seasonId") !== seasonId || key.get("playerId") !== playerId)
      throw new Error("Registro non coerente.");
    tx.delete(rosterRef);
    tx.delete(keyRef);
  });
}

export async function POST(request: NextRequest) {
  // Fail closed: niente scritture da Preview; produzione solo con opt-in esplicito.
  if (!registryWritesAllowed) return reply({ error: "Registro server non abilitato per questo ambiente." }, 403);
  if (!(await checkAdmin(request))) return reply({ error: "Amministratore non autorizzato." }, 403);
  let body: Record<string, unknown>;
  try {
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error();
    body = raw as Record<string, unknown>;
  } catch { return reply({ error: "Richiesta JSON non valida." }, 400); }
  try {
    if (body.action === "create") {
      const seasonPlayerId = await createOne(parseInput(body.input));
      return reply({ ok: true, seasonPlayerId });
    }
    if (body.action === "createMany") {
      if (!Array.isArray(body.inputs) || body.inputs.length < 1 || body.inputs.length > MAX_ATOMIC_IMPORT)
        return reply({ error: `Import atomico limitato a 1-${MAX_ATOMIC_IMPORT} iscrizioni.` }, 400);
      const inputs = body.inputs.map(parseInput);
      const completed = await createManyAtomic(inputs);
      return reply({ ok: true, completed });
    }
    if (body.action === "remove") {
      if (!validId(body.seasonPlayerId)) return reply({ error: "Iscrizione non valida." }, 400);
      await removeOne(body.seasonPlayerId);
      return reply({ ok: true });
    }
    return reply({ error: "Operazione non riconosciuta." }, 400);
  } catch (err) {
    console.error("Roster registry operation refused:", err);
    return reply({ error: err instanceof Error ? err.message : "Operazione negata." }, 409);
  }
}
