/**
 * Integration tests: Firestore Emulator only; Firebase Auth deliberately mocked.
 * Run using vitest.lineups.config.mts with emulator already started.
 * Test records are individually scoped and removed after each test.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore, type DocumentReference } from "firebase-admin/firestore";
import { NextRequest } from "next/server";

const PROJECT = "demo-ludi-market-confirm";
const UID = `test_lineups_${randomUUID().replaceAll("-", "")}`;

vi.mock("@/src/lib/firebaseAdmin", async () => {
  const { initializeApp, getApps } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const name = "lineups-route-emulator-test";
  const app = getApps().find((item) => item.name === name) ?? initializeApp({ projectId: PROJECT }, name);
  return {
    adminDb: getFirestore(app),
    adminAuth: {
      verifyIdToken: vi.fn(async (token: string) => {
        if (token !== "test-admin-token") throw new Error("Unauthenticated");
        return { uid: UID };
      }),
    },
  };
});

type Handler = (request: NextRequest) => Promise<Response>;
type Guest = { id: string; name: string; firstName?: string; lastName?: string; birthYear?: number; role?: string; shirtNumber?: number };
let app: App;
let db: Firestore;
let lineupPost: Handler;
let registryPost: Handler;
let refs: DocumentReference[] = [];
let testId = "";
let seasonId = "";
let matchId = "";
let teamId = "";
let opponentId = "";
let competitionId = "";
let requestRef: DocumentReference;
let lineupRef: DocumentReference;

const guest = (id: string, name: string, details: Partial<Guest> = {}): Guest => ({ id, name, ...details });
const tracked = (path: string) => {
  const ref = db.doc(path);
  refs.push(ref);
  return ref;
};
const post = async (handler: Handler, body: object, authorized = true) => {
  const request = new NextRequest("http://localhost/api/admin/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorized ? { Authorization: "Bearer test-admin-token" } : {}),
    },
    body: JSON.stringify(body),
  });
  const response = await handler(request);
  return { status: response.status, body: await response.json() as Record<string, unknown> };
};
const common = () => ({ matchId, seasonId, teamId, side: "home" as const });

async function seedLineup(guests: Guest[], extra: Record<string, unknown> = {}) {
  const payload = {
    teamId,
    playerIds: [] as string[],
    guestPlayers: guests,
    approvedGuestIds: [] as string[],
    goalkeeperId: null as string | null,
    status: "needs_review",
    ...extra,
  };
  await lineupRef.set({ matchId, seasonId, home: payload });
  await requestRef.set({ matchId, seasonId, ...payload });
}

async function cleanup() {
  // Collect documents created by the API as well as explicitly seeded documents.
  const [audits, seasonPlayers, players, identities] = await Promise.all([
    db.collection("lineupAdminEdits").where("matchId", "==", matchId).get(),
    db.collection("seasonPlayers").where("seasonId", "==", seasonId).get(),
    db.collection("players").where("competitionId", "==", competitionId).get(),
    db.collection("playerIdentityKeys").where("competitionId", "==", competitionId).get(),
  ]);
  const discovered = [...audits.docs, ...seasonPlayers.docs, ...players.docs, ...identities.docs].map((doc) => doc.ref);
  for (const roster of seasonPlayers.docs) {
    const playerId = roster.get("playerId");
    if (typeof playerId === "string") {
      const key = "sp_" + Buffer.from(JSON.stringify([seasonId, playerId]), "utf8").toString("base64url");
      discovered.push(db.collection("seasonPlayerKeys").doc(key));
    }
  }
  for (const player of players.docs) discovered.push(db.collection("playerPrivateProfiles").doc(player.id));
  const unique = new Map([...refs, ...discovered].map((ref) => [ref.path, ref]));
  for (const ref of unique.values()) await ref.delete();
  refs = [];
}

beforeAll(async () => {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID !== PROJECT ||
      process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099") {
    throw new Error("TEST BLOCCATO: serve il progetto demo e gli emulatori su 8080/9099.");
  }
  // Enforce emulator readiness, not only configured environment variables.
  const probe = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/`);
  if (!probe.ok && probe.status >= 500) throw new Error("Firestore Emulator non raggiungibile.");

  app = initializeApp({ projectId: PROJECT }, `test-${randomUUID()}`);
  db = getFirestore(app);
  const { POST: lineups } = await import("@/app/api/admin/lineups/route");
  const { POST: registry } = await import("@/app/api/admin/season-roster-registry/route");
  lineupPost = lineups;
  registryPost = registry;
  await db.doc(`admins/${UID}`).set({ active: true });
});

afterAll(async () => {
  if (db) await db.doc(`admins/${UID}`).delete();
  if (app) await deleteApp(app);
});

beforeEach(async () => {
  testId = randomUUID().replaceAll("-", "");
  seasonId = `ls_${testId}`;
  matchId = `lm_${testId}`;
  teamId = `lt_${testId}`;
  opponentId = `lo_${testId}`;
  competitionId = `lc_${testId}`;
  await Promise.all([
    tracked(`seasons/${seasonId}`).set({ status: "active", competitionId, regularSeasonClosed: false }),
    tracked(`seasons/${seasonId}/teamEntries/${teamId}`).set({ status: "active", teamId }),
    tracked(`matches/${matchId}`).set({ seasonId, homeTeamId: teamId, awayTeamId: opponentId }),
  ]);
  lineupRef = tracked(`matchLineups/${matchId}`);
  requestRef = tracked(`lineupRequests/${matchId}__${teamId}`);
});

afterEach(async () => {
  if (db && seasonId) await cleanup();
});

describe("Ludi Control â€” API formazioni (emulatore Firestore)", () => {
  it("approva un temporaneo soltanto nella partita", async () => {
    await seedLineup([guest("g1", "Allocca Giovanni")]);
    const response = await post(lineupPost, { action: "approve_guest", ...common(), guestId: "g1", expectedGuestName: "Allocca Giovanni" });
    expect(response.status).toBe(200);
    expect((await lineupRef.get()).get("home.approvedGuestIds")).toEqual(["g1"]);
    expect((await requestRef.get()).get("approvedGuestIds")).toEqual(["g1"]);
    expect((await db.collection("seasonPlayers").where("seasonId", "==", seasonId).get()).empty).toBe(true);
  });

  it("consente di salvare un portiere temporaneo giÃ  approvato", async () => {
    await seedLineup([guest("g1", "Allocca Giovanni")], { approvedGuestIds: ["g1"] });
    const response = await post(lineupPost, {
      ...common(), playerIds: [], expectedPlayerIds: [], goalkeeperId: "g1", expectedGoalkeeperId: null,
      guestGoalkeeperName: null,
    });
    expect(response.status).toBe(200);
    expect((await lineupRef.get()).get("home.goalkeeperId")).toBe("g1");
  });

  it("modifica nome, cognome, anno, ruolo e numero su entrambe le raccolte", async () => {
    await seedLineup([guest("g1", "Aloca Giovani")]);
    const response = await post(lineupPost, {
      action: "rename_guest", ...common(), guestId: "g1", expectedGuestName: "Aloca Giovani",
      lastName: "Allocca", firstName: "Giovanni", birthYear: 1998,
      role: "Portiere", shirtNumber: 1,
    });
    expect(response.status).toBe(200);
    const updated = (await lineupRef.get()).get("home.guestPlayers") as Guest[];
    expect(updated[0]).toMatchObject({ name: "Allocca Giovanni", lastName: "Allocca", firstName: "Giovanni", birthYear: 1998, role: "Portiere", shirtNumber: 1 });
    expect((await requestRef.get()).get("guestPlayers")).toEqual(updated);
  });

  it("elimina soltanto il duplicato giÃ  approvato e mantiene l'altro Allocca", async () => {
    await seedLineup([guest("g1", "Allocca Giovanni"), guest("g2", "Allocca Giovanni")], {
      approvedGuestIds: ["g1", "g2"], goalkeeperId: "g2", goalkeeper: { kind: "guest", guestPlayerId: "g2" },
    });
    const response = await post(lineupPost, { action: "delete_guest", ...common(), guestId: "g2", expectedGuestName: "Allocca Giovanni" });
    expect(response.status).toBe(200);
    const home = (await lineupRef.get()).get("home") as Record<string, unknown>;
    expect(home.guestPlayers).toEqual([guest("g1", "Allocca Giovanni")]);
    expect(home.approvedGuestIds).toEqual(["g1"]);
    expect(home.goalkeeperId).toBeNull();
    expect((await requestRef.get()).get("guestPlayers")).toEqual(home.guestPlayers);
    expect((await requestRef.get()).get("goalkeeperId")).toBeNull();
  });

  it("rifiuta una modifica concorrente basata su nominativo precedente", async () => {
    await seedLineup([guest("g1", "Allocca Giovanni")]);
    const response = await post(lineupPost, { action: "delete_guest", ...common(), guestId: "g1", expectedGuestName: "Altro Nome" });
    expect(response.status).not.toBe(200);
    expect(((await lineupRef.get()).get("home.guestPlayers") as Guest[])).toHaveLength(1);
  });

  it("inserisce in lista un nuovo giocatore in modo atomico", async () => {
    await seedLineup([guest("g1", "Allocca Giovanni", { firstName: "Giovanni", lastName: "Allocca", birthYear: 1998, role: "Portiere", shirtNumber: 1 })], {
      approvedGuestIds: ["g1"], goalkeeperId: "g1", goalkeeper: { kind: "guest", guestPlayerId: "g1" },
    });
    const response = await post(registryPost, { action: "register_lineup_guest", ...common(), guestId: "g1", expectedGuestName: "Allocca Giovanni" });
    expect(response.status).toBe(200);
    const playerId = response.body.playerId as string;
    expect(playerId).toBeTruthy();
    const profile = await db.doc(`players/${playerId}`).get();
    expect(profile.get("firstName")).toBe("Giovanni");
    expect((await db.doc(`playerPrivateProfiles/${playerId}`).get()).get("birthYear")).toBe(1998);
    const roster = await db.collection("seasonPlayers").where("seasonId", "==", seasonId).get();
    expect(roster.size).toBe(1);
    expect(roster.docs[0].data()).toMatchObject({ playerId, teamId, role: "Portiere", shirtNumber: 1, status: "active" });
    const home = (await lineupRef.get()).get("home") as Record<string, unknown>;
    expect(home.guestPlayers).toEqual([]);
    expect(home.approvedGuestIds).toEqual([]);
    expect(home.playerIds).toEqual([playerId]);
    expect(home.goalkeeperId).toBe(playerId);
  });

  it("non registra due volte il medesimo ospite dopo la conversione", async () => {
    await seedLineup([guest("g1", "Allocca Giovanni", { firstName: "Giovanni", lastName: "Allocca", birthYear: 1998, role: "Portiere", shirtNumber: 1 })]);
    const payload = { action: "register_lineup_guest", ...common(), guestId: "g1", expectedGuestName: "Allocca Giovanni" };
    const first = await post(registryPost, payload);
    expect(first.status).toBe(200);
    const second = await post(registryPost, payload);
    expect(second.status).toBe(409);
    expect((await db.collection("seasonPlayers").where("seasonId", "==", seasonId).get()).size).toBe(1);
  });

  it("riusa un profilo esistente con anno di nascita uguale", async () => {
    const existingId = `pe_${testId}`;
    await tracked(`players/${existingId}`).set({ competitionId, firstName: "Giovanni", lastName: "Allocca" });
    await tracked(`playerPrivateProfiles/${existingId}`).set({ birthYear: 1998 });
    await seedLineup([guest("g1", "Allocca Giovanni", { firstName: "Giovanni", lastName: "Allocca", birthYear: 1998, role: "Difensore", shirtNumber: 4 })]);
    const response = await post(registryPost, { action: "register_lineup_guest", ...common(), guestId: "g1", expectedGuestName: "Allocca Giovanni" });
    expect(response.status).toBe(200);
    expect(response.body.playerId).toBe(existingId);
    expect((await db.collection("players").where("competitionId", "==", competitionId).get()).size).toBe(1);
  });

  it("blocca l'omonimo senza anno di nascita verificato", async () => {
    const existingId = `pe_${testId}`;
    await tracked(`players/${existingId}`).set({ competitionId, firstName: "Giovanni", lastName: "Allocca" });
    await seedLineup([guest("g1", "Allocca Giovanni", { firstName: "Giovanni", lastName: "Allocca", birthYear: 1998, role: "Portiere", shirtNumber: 1 })]);
    const response = await post(registryPost, { action: "register_lineup_guest", ...common(), guestId: "g1", expectedGuestName: "Allocca Giovanni" });
    expect(response.status).toBe(409);
    expect((await db.collection("seasonPlayers").where("seasonId", "==", seasonId).get()).empty).toBe(true);
    expect(((await lineupRef.get()).get("home.guestPlayers") as Guest[])).toHaveLength(1);
  });

  it("rifiuta il numero di maglia giÃ  occupato senza cambiare la formazione", async () => {
    const existingId = `pe_${testId}`;
    await tracked(`seasonPlayers/rs_${testId}`).set({ seasonId, playerId: existingId, teamId, role: "Portiere", shirtNumber: 1, status: "active" });
    await seedLineup([guest("g1", "Allocca Giovanni", { firstName: "Giovanni", lastName: "Allocca", birthYear: 1998, role: "Portiere", shirtNumber: 1 })]);
    const response = await post(registryPost, { action: "register_lineup_guest", ...common(), guestId: "g1", expectedGuestName: "Allocca Giovanni" });
    expect(response.status).toBe(409);
    expect((await db.collection("seasonPlayers").where("seasonId", "==", seasonId).get()).size).toBe(1);
    expect(((await lineupRef.get()).get("home.guestPlayers") as Guest[])).toHaveLength(1);
  });
});
