import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { initializeApp, deleteApp, getApp, getApps, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const projectId = "demo-ludi-roster-release";
if (!process.env.FIRESTORE_EMULATOR_HOST || !/^demo-/.test(process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? projectId)) {
  throw new Error("TEST BLOCCATO: richiesto Firestore Emulator con progetto demo-.");
}
// Nessuna autenticazione reale: mock esclusivamente per testare la logica POST.
vi.mock("server-only", () => ({}));
vi.mock("@/src/lib/requireAdminApi", () => ({ requireAdminApi: async () => ({ uid: "demo_admin" }) }));
vi.mock("@/src/lib/firebaseAdmin", async () => {
  const { initializeApp, getApps } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = getApps().find((item) => item.name === "ludi-roster-emulator-test") ??
    initializeApp({ projectId: "demo-ludi-roster-release" }, "ludi-roster-emulator-test");
  return { adminDb: getFirestore(app) };
});

import { POST } from "../app/api/admin/roster-membership/route";

let db: Firestore;
let app: App;
let seasonId = "";
let playerId = "";
let membershipId = "";
const teamId = "demo_home";
const otherTeamId = "demo_other";
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const reportData = { matchId: "demo_match_01", status: "published", data: { matchId: "demo_match_01", status: "finished", homeScore: 3, awayScore: 1, homePresentPlayerIds: ["demo_player"], goals: [{ scorerPlayerId: "demo_player", teamId }], performances: { demo_player: { playerId: "demo_player", vote: 7, assists: 1 } } } };
const request = (action: "release" | "restore", extra: Record<string, unknown> = {}) =>
  new NextRequest("http://localhost/api/admin/roster-membership", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, seasonPlayerId: membershipId, ...extra }),
  });
const call = async (action: "release" | "restore", extra: Record<string, unknown> = {}) => {
  const response = await POST(request(action, extra));
  return { status: response.status, data: await response.json() as { ok?: boolean; error?: string } };
};

beforeAll(() => {
  app = getApps().find((entry) => entry.name === "ludi-roster-emulator-test") ?? getApp("ludi-roster-emulator-test");
  db = getFirestore(app);
});
afterAll(async () => { await deleteApp(app); });
beforeEach(async () => {
  seasonId = `demo_${randomUUID().replaceAll("-", "")}`;
  playerId = `player_${randomUUID().replaceAll("-", "")}`;
  membershipId = `roster_${randomUUID().replaceAll("-", "")}`;
  await Promise.all([
    db.collection("seasons").doc(seasonId).set({ status: "active" }),
    db.collection("seasons").doc(seasonId).collection("teamEntries").doc(teamId).set({ status: "active" }),
    db.collection("seasons").doc(seasonId).collection("teamEntries").doc(otherTeamId).set({ status: "active" }),
    db.collection("seasonPlayers").doc(membershipId).set({ seasonId, playerId, teamId, status: "active", role: "Attaccante", shirtNumber: 9, joinedAt: "2026-09-01" }),
    db.collection("players").doc(playerId).set({ firstName: "Test", lastName: "Svincolo", photoUrl: "/demo.jpg" }),
    db.collection("matchReports").doc(`${seasonId}_match_01`).set(reportData),
  ]);
});

describe("Svincolo rosa: API reale su Firestore Emulator", () => {
  it("svincola mantenendo profilo e tabellino intatti", async () => {
    const beforePlayer = (await db.collection("players").doc(playerId).get()).data();
    const beforeReport = (await db.collection("matchReports").doc(`${seasonId}_match_01`).get()).data();
    const result = await call("release");
    expect(result).toMatchObject({ status: 200, data: { ok: true } });
    const roster = (await db.collection("seasonPlayers").doc(membershipId).get()).data();
    expect(roster).toMatchObject({ seasonId, playerId, teamId, status: "inactive", role: "Attaccante", shirtNumber: 9 });
    expect(roster?.inactivePeriods).toHaveLength(1);
    expect(roster?.inactivePeriods[0].from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await db.collection("players").doc(playerId).get()).data()).toEqual(beforePlayer);
    expect((await db.collection("matchReports").doc(`${seasonId}_match_01`).get()).data()).toEqual(beforeReport);
  });
  it("non svincola due volte", async () => {
    expect((await call("release")).status).toBe(200);
    const before = (await db.collection("seasonPlayers").doc(membershipId).get()).data();
    expect((await call("release")).status).toBe(409);
    expect((await db.collection("seasonPlayers").doc(membershipId).get()).data()).toEqual(before);
  });
  it("permette il rientro nella stessa squadra conservando l'ID e i periodi", async () => {
    expect((await call("release")).status).toBe(200);
    const response = await call("restore", { teamId, role: "Attaccante", shirtNumber: 11 });
    expect(response.status).toBe(200);
    const roster = (await db.collection("seasonPlayers").doc(membershipId).get()).data();
    expect(roster).toMatchObject({ status: "active", playerId, teamId, shirtNumber: 11 });
    expect(roster?.inactivePeriods).toHaveLength(1);
    expect(roster?.inactivePeriods[0].to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("blocca rientro in squadra diversa e mantiene l'iscrizione inattiva", async () => {
    expect((await call("release")).status).toBe(200);
    const result = await call("restore", { teamId: otherTeamId, role: "Attaccante" });
    expect(result.status).toBe(409);
    expect((await db.collection("seasonPlayers").doc(membershipId).get()).get("status")).toBe("inactive");
  });
  it("blocca lo svincolo se una partita della squadra è aperta oggi", async () => {
    await db.collection("matches").doc(`${seasonId}_today`).set({ seasonId, homeTeamId: teamId, awayTeamId: otherTeamId, date: today(), status: "scheduled" });
    expect((await call("release")).status).toBe(409);
    expect((await db.collection("seasonPlayers").doc(membershipId).get()).get("status")).toBe("active");
  });
  it("blocca lo svincolo se la stagione è terminata", async () => {
    await db.collection("seasons").doc(seasonId).update({ status: "completed" });
    expect((await call("release")).status).toBe(409);
    expect((await db.collection("seasonPlayers").doc(membershipId).get()).get("status")).toBe("active");
  });
});
