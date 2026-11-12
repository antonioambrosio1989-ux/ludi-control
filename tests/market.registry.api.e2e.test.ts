import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { initializeApp, deleteApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const PROJECT = "demo-ludi-market-confirm";
const PREFIX = `market5d-${process.pid}-${Date.now()}`;
let db: Firestore;
let route: typeof import("@/app/api/admin/season-roster-registry/route");
let adminToken = "";
let userToken = "";
let adminUid = "";
let authHost = "";
const seasonDraft = `${PREFIX}-draft`;
const seasonActive = `${PREFIX}-active`;
const teamA = `${PREFIX}-a`;
const teamB = `${PREFIX}-b`;
const createdPlayers = new Set<string>();
const createdKeys = new Set<string>();
const createdTransfers = new Set<string>();

// Importa il modulo API soltanto DOPO aver validato il progetto demo e le variabili emulator.
vi.mock("@/src/lib/firebaseAdmin", () => {
  const app = getApps().find(x => x.name === "market-registry-5d") ??
    initializeApp({ projectId: PROJECT }, "market-registry-5d");
  return { adminAuth: getAuth(app), adminDb: getFirestore(app, "default") };
});

function registryId(seasonId: string, playerId: string): string {
  return `sp_${Buffer.from(JSON.stringify([seasonId, playerId]), "utf8").toString("base64url")}`;
}
function input(playerId: string, seasonId = seasonDraft, teamId = teamA, shirtNumber: number | null = null) {
  return { seasonId, playerId, teamId, role: "Difensore", shirtNumber };
}
function track(playerId: string, seasonId = seasonDraft) {
  createdPlayers.add(playerId);
  createdKeys.add(registryId(seasonId, playerId));
}
async function call(action: string, payload: object, token = adminToken) {
  const request = new NextRequest("http://localhost:3000/api/admin/season-roster-registry", {
    method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, ...payload }),
  });
  const response = await route.POST(request);
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}
async function createAuthUser(label: string) {
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: `${label}-${PREFIX}@example.invalid`, password: "DemoPassword5D!2026", returnSecureToken: true }),
  });
  const body = await response.json() as { idToken?: string; localId?: string; error?: unknown };
  if (!response.ok || !body.idToken || !body.localId) throw new Error(`Auth Emulator signup failed: ${JSON.stringify(body)}`);
  return { token: body.idToken, uid: body.localId };
}

beforeAll(async () => {
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  const auth = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!firestoreHost || !auth) throw new Error("Servono entrambi gli emulatori (Firestore e Auth).");
  if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT)
    throw new Error("Progetto Firebase non demo: esecuzione bloccata.");
  if (process.env.FIREBASE_CONFIG) {
    try { const c = JSON.parse(process.env.FIREBASE_CONFIG) as { projectId?: string };
      if (c.projectId && c.projectId !== PROJECT) throw new Error("Configurazione Firebase non demo.");
    } catch (e) { throw e; }
  }
  process.env.FIREBASE_ADMIN_PROJECT_ID = PROJECT;
  process.env.GCLOUD_PROJECT = PROJECT;
  authHost = auth;
  const app = getApps().find(x => x.name === "market-registry-5d") ??
    initializeApp({ projectId: PROJECT }, "market-registry-5d");
  db = getFirestore(app, "default");
  route = await import("@/app/api/admin/season-roster-registry/route");

  const admin = await createAuthUser("admin");
  const normal = await createAuthUser("normal");
  adminToken = admin.token; adminUid = admin.uid; userToken = normal.token;
  await Promise.all([
    db.doc(`admins/${adminUid}`).set({ active: true }),
    db.doc(`seasons/${seasonDraft}`).set({ status: "draft", competitionId: "generic-a-r", regularSeasonClosed: false }),
    db.doc(`seasons/${seasonActive}`).set({ status: "active", competitionId: "generic-a-r", regularSeasonClosed: false }),
    db.doc(`seasons/${seasonDraft}/teamEntries/${teamA}`).set({ status: "active", teamId: teamA }),
    db.doc(`seasons/${seasonDraft}/teamEntries/${teamB}`).set({ status: "active", teamId: teamB }),
    db.doc(`seasons/${seasonActive}/teamEntries/${teamA}`).set({ status: "active", teamId: teamA }),
  ]);
}, 30000);

afterAll(async () => {
  if (!db) return;
  // Elimina solo i documenti di questo test: nessun wipe dell'emulatore.
  const docs = [
    ...[...createdPlayers].map(id => db.doc(`seasonPlayers/${id}`)),
    ...[...createdKeys].map(id => db.doc(`seasonPlayerKeys/${id}`)),
    ...[...createdTransfers].map(id => db.doc(`seasonTransfers/${id}`)),
    db.doc(`admins/${adminUid}`),
    db.doc(`seasons/${seasonDraft}/teamEntries/${teamA}`), db.doc(`seasons/${seasonDraft}/teamEntries/${teamB}`),
    db.doc(`seasons/${seasonActive}/teamEntries/${teamA}`),
    db.doc(`seasons/${seasonDraft}`), db.doc(`seasons/${seasonActive}`),
  ];
  for (const ref of docs) { try { await ref.delete(); } catch { /* cleanup best effort */ } }
  const app = getApps().find(x => x.name === "market-registry-5d");
  if (app) await deleteApp(app);
}, 30000);

describe("Fase 5D - API registro rose, solo emulator demo", () => {
  it("nega chiamata anonima", async () => {
    const r = await call("create", { input: input(`${PREFIX}-anon`) }, "");
    expect(r.status).toBe(403);
  });

  it("nega utente autenticato non amministratore", async () => {
    const r = await call("create", { input: input(`${PREFIX}-unauth`) }, userToken);
    expect(r.status).toBe(403);
  });

  it("crea atomicamente iscrizione e chiave", async () => {
    const playerId = `${PREFIX}-create`;
    const r = await call("create", { input: input(playerId, seasonDraft, teamA, 7) });
    expect(r.status).toBe(200); expect(r.body.ok).toBe(true);
    const id = String(r.body.seasonPlayerId);
    createdPlayers.add(id); createdKeys.add(registryId(seasonDraft, playerId));
    const [roster, key] = await Promise.all([
      db.doc(`seasonPlayers/${id}`).get(), db.doc(`seasonPlayerKeys/${registryId(seasonDraft, playerId)}`).get(),
    ]);
    expect(roster.exists).toBe(true); expect(roster.get("teamId")).toBe(teamA);
    expect(key.get("seasonPlayerId")).toBe(id);
  });

  it("nega seconda iscrizione dello stesso giocatore", async () => {
    const playerId = `${PREFIX}-create`;
    const r = await call("create", { input: input(playerId, seasonDraft, teamB, 9) });
    expect(r.status).toBe(409);
    const q = await db.collection("seasonPlayers").where("seasonId", "==", seasonDraft).where("playerId", "==", playerId).get();
    expect(q.size).toBe(1);
  });

  it("nega squadra non iscritta senza creare dati", async () => {
    const playerId = `${PREFIX}-unknownteam`;
    const r = await call("create", { input: input(playerId, seasonDraft, `${PREFIX}-missing`) });
    expect(r.status).toBe(409);
    expect((await db.doc(`seasonPlayerKeys/${registryId(seasonDraft, playerId)}`).get()).exists).toBe(false);
  });

  it("nega duplicati interni all'import prima di scrivere", async () => {
    const playerId = `${PREFIX}-batch-dupe`;
    const r = await call("createMany", { inputs: [input(playerId), input(playerId)] });
    expect(r.status).toBe(409);
    expect((await db.doc(`seasonPlayerKeys/${registryId(seasonDraft, playerId)}`).get()).exists).toBe(false);
  });

  it("createMany fallito non salva alcuna iscrizione o chiave", async () => {
    const playerId = `${PREFIX}-batch-partial`;
    const r = await call("createMany", { inputs: [input(playerId), input(`${PREFIX}-bad`, seasonDraft, `${PREFIX}-missing`)] });
    expect(r.status).toBe(409);
    const key = await db.doc(`seasonPlayerKeys/${registryId(seasonDraft, playerId)}`).get();
    expect(key.exists).toBe(false);
    const orphan = await db.collection("seasonPlayers").where("seasonId", "==", seasonDraft).where("playerId", "==", playerId).get();
    expect(orphan.empty).toBe(true);
  });

  it("createMany valido salva tutte le iscrizioni e tutte le chiavi", async () => {
    const p1 = `${PREFIX}-multi-ok-1`, p2 = `${PREFIX}-multi-ok-2`;
    const r = await call("createMany", { inputs: [input(p1, seasonDraft, teamA, 31), input(p2, seasonDraft, teamB, 32)] });
    expect(r.status).toBe(200); expect(r.body.completed).toBe(2);
    for (const playerId of [p1, p2]) {
      const key = await db.doc(`seasonPlayerKeys/${registryId(seasonDraft, playerId)}`).get();
      expect(key.exists).toBe(true);
      const id = String(key.get("seasonPlayerId"));
      expect((await db.doc(`seasonPlayers/${id}`).get()).exists).toBe(true);
      createdKeys.add(key.id); createdPlayers.add(id);
    }
  });

  it("createMany con numero maglia duplicato nello stesso lotto non scrive nulla", async () => {
    const p1 = `${PREFIX}-shirt-dupe-1`, p2 = `${PREFIX}-shirt-dupe-2`;
    const r = await call("createMany", { inputs: [input(p1, seasonDraft, teamA, 56), input(p2, seasonDraft, teamA, 56)] });
    expect(r.status).toBe(409);
    for (const playerId of [p1, p2]) {
      expect((await db.doc(`seasonPlayerKeys/${registryId(seasonDraft, playerId)}`).get()).exists).toBe(false);
    }
  });

  it("createMany di 201 giocatori viene respinto integralmente", async () => {
    const p = `${PREFIX}-batch-over-0`;
    const inputs = Array.from({ length: 201 }, (_, i) => input(`${PREFIX}-batch-over-${i}`));
    const r = await call("createMany", { inputs });
    expect(r.status).toBe(400);
    expect((await db.doc(`seasonPlayerKeys/${registryId(seasonDraft, p)}`).get()).exists).toBe(false);
  });

  it("createMany con stagioni differenti non scrive nulla", async () => {
    const p1 = `${PREFIX}-mixed-1`, p2 = `${PREFIX}-mixed-2`;
    const r = await call("createMany", { inputs: [input(p1, seasonDraft, teamA), input(p2, seasonActive, teamA)] });
    expect(r.status).toBe(409);
    for (const [season, playerId] of [[seasonDraft, p1], [seasonActive, p2]])
      expect((await db.doc(`seasonPlayerKeys/${registryId(season, playerId)}`).get()).exists).toBe(false);
  });

  it("rimuove coppia coerente da stagione draft", async () => {
    const playerId = `${PREFIX}-remove`;
    const made = await call("create", { input: input(playerId) });
    expect(made.status).toBe(200);
    const rosterId = String(made.body.seasonPlayerId);
    track(playerId); createdPlayers.add(rosterId);
    const removed = await call("remove", { seasonPlayerId: rosterId });
    expect(removed.status).toBe(200);
    expect((await db.doc(`seasonPlayers/${rosterId}`).get()).exists).toBe(false);
    expect((await db.doc(`seasonPlayerKeys/${registryId(seasonDraft, playerId)}`).get()).exists).toBe(false);
  });

  it("nega rimozione da stagione attiva", async () => {
    const playerId = `${PREFIX}-active`;
    const made = await call("create", { input: input(playerId, seasonActive) });
    expect(made.status).toBe(200);
    const rosterId = String(made.body.seasonPlayerId);
    track(playerId, seasonActive); createdPlayers.add(rosterId);
    const r = await call("remove", { seasonPlayerId: rosterId });
    expect(r.status).toBe(409);
    expect((await db.doc(`seasonPlayers/${rosterId}`).get()).exists).toBe(true);
  });

  it("nega rimozione in presenza di storico trasferimenti", async () => {
    const playerId = `${PREFIX}-history`;
    const made = await call("create", { input: input(playerId) });
    expect(made.status).toBe(200);
    const rosterId = String(made.body.seasonPlayerId);
    track(playerId); createdPlayers.add(rosterId);
    await db.doc(`seasonPlayers/${rosterId}`).update({ transferHistory: [{ fromTeamId: teamA, toTeamId: teamB, effectiveDate: "2026-01-01" }] });
    const r = await call("remove", { seasonPlayerId: rosterId });
    expect(r.status).toBe(409);
    expect((await db.doc(`seasonPlayers/${rosterId}`).get()).exists).toBe(true);
  });
});
