import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { initializeApp, deleteApp, getApps, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const projectId = "demo-ludi-roster-release";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host) ||
    (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== projectId) ||
    (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_PROJECT !== projectId)) {
  throw new Error("TEST BLOCCATO: richiesto Firestore Emulator locale e progetto demo-ludi-roster-release.");
}

vi.mock("server-only", () => ({}));
vi.mock("@/src/lib/requireAdminApi", () => ({ requireAdminApi: async () => ({ uid: "demo_admin" }) }));
vi.mock("@/src/lib/firebaseAdmin", async () => {
  const { initializeApp, getApps } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = getApps().find((a) => a.name === "ludi-roster-emulator-test") ??
    initializeApp({ projectId: "demo-ludi-roster-release" }, "ludi-roster-emulator-test");
  return { adminDb: getFirestore(app) };
});

import { POST } from "../app/api/admin/roster-membership/route";

let db: Firestore;
let app: App;
let seasonId = "";
let playerId = "";
let membershipId = "";
const sourceTeam = "demo_home";
const destinationTeam = "demo_other";
const competitionId = "premier-league";
const today = () => new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const tomorrow = () => {
  const [year, month, day] = today().split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
};
const registryId = (season: string, player: string) =>
  `sp_${Buffer.from(JSON.stringify([season, player]), "utf8").toString("base64url")}`;
const createRequest = (action: "release" | "restore", extra: Record<string, unknown> = {}) =>
  new NextRequest("http://localhost/api/admin/roster-membership", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, seasonPlayerId: membershipId, ...extra }),
  });
const call = async (action: "release" | "restore", extra: Record<string, unknown> = {}) => {
  const response = await POST(createRequest(action, extra));
  return { status: response.status, data: await response.json() as { ok?: boolean; error?: string } };
};
const roster = async () => (await db.collection("seasonPlayers").doc(membershipId).get()).data()!;
const transferDocs = async () => (await db.collection("seasonTransfers").where("seasonPlayerId", "==", membershipId).get()).docs;

beforeAll(() => {
  app = getApps().find((entry) => entry.name === "ludi-roster-emulator-test") ??
    initializeApp({ projectId }, "ludi-roster-emulator-test");
  db = getFirestore(app);
});
afterAll(async () => { await deleteApp(app); });
beforeEach(async () => {
  seasonId = `demo_${randomUUID().replaceAll("-", "")}`;
  playerId = `player_${randomUUID().replaceAll("-", "")}`;
  membershipId = `roster_${randomUUID().replaceAll("-", "")}`;
  const report = { status: "published", seasonId, data: {
    homePresentPlayerIds: [playerId], goals: [{ scorerPlayerId: playerId, teamId: sourceTeam }],
    performances: { [playerId]: { playerId, vote: 7, assists: 1 } },
  } };
  await Promise.all([
    db.collection("seasons").doc(seasonId).set({ status: "active", competitionId, regularSeasonClosed: false }),
    db.collection("seasons").doc(seasonId).collection("teamEntries").doc(sourceTeam).set({ status: "active" }),
    db.collection("seasons").doc(seasonId).collection("teamEntries").doc(destinationTeam).set({ status: "active" }),
    db.collection("seasonPlayers").doc(membershipId).set({
      seasonId, playerId, teamId: sourceTeam, status: "active", role: "Attaccante",
      shirtNumber: 9, joinedAt: "2026-09-01",
    }),
    db.collection("seasonPlayerKeys").doc(registryId(seasonId, playerId)).set({ seasonId, playerId, seasonPlayerId: membershipId }),
    db.collection("players").doc(playerId).set({ firstName: "Test", lastName: "Svincolo", photoUrl: "/demo.jpg" }),
    db.collection("matchReports").doc(`${seasonId}_match_01`).set(report),
  ]);
});

describe("Svincolati fuori mercato – API reale su Firestore Emulator", () => {
  it("svincola senza cambiare giocatore, registro o tabellino", async () => {
    const playerBefore = (await db.collection("players").doc(playerId).get()).data();
    const reportBefore = (await db.collection("matchReports").doc(`${seasonId}_match_01`).get()).data();
    const keyBefore = (await db.collection("seasonPlayerKeys").doc(registryId(seasonId, playerId)).get()).data();
    expect(await call("release")).toMatchObject({ status: 200, data: { ok: true } });
    expect(await roster()).toMatchObject({ seasonId, playerId, teamId: sourceTeam, status: "inactive", leftAt: tomorrow() });
    expect((await roster()).inactivePeriods).toEqual([{ from: tomorrow() }]);
    expect((await db.collection("players").doc(playerId).get()).data()).toEqual(playerBefore);
    expect((await db.collection("matchReports").doc(`${seasonId}_match_01`).get()).data()).toEqual(reportBefore);
    expect((await db.collection("seasonPlayerKeys").doc(registryId(seasonId, playerId)).get()).data()).toEqual(keyBefore);
  });

  it("blocca il doppio svincolo senza scrivere di nuovo", async () => {
    expect((await call("release")).status).toBe(200);
    const before = await roster();
    expect((await call("release")).status).toBe(409);
    expect(await roster()).toEqual(before);
  });

  it("riammette alla stessa squadra senza creare trasferimento", async () => {
    expect((await call("release")).status).toBe(200);
    expect(await call("restore", { teamId: sourceTeam, role: "Attaccante", shirtNumber: 11 }))
      .toMatchObject({ status: 200, data: { ok: true } });
    expect(await roster()).toMatchObject({ status: "active", teamId: sourceTeam, playerId, shirtNumber: 11 });
    expect((await roster()).inactivePeriods).toEqual([{ from: tomorrow(), to: tomorrow() }]);
    expect(await transferDocs()).toHaveLength(0);
  });

  it("tessera uno svincolato nella squadra diversa e crea cronologia, senza alterare tabellino e registro", async () => {
    const reportBefore = (await db.collection("matchReports").doc(`${seasonId}_match_01`).get()).data();
    const keyBefore = (await db.collection("seasonPlayerKeys").doc(registryId(seasonId, playerId)).get()).data();
    expect((await call("release")).status).toBe(200);
    expect(await call("restore", { teamId: destinationTeam, role: "Difensore", shirtNumber: 22 }))
      .toMatchObject({ status: 200, data: { ok: true } });
    const current = await roster();
    expect(current).toMatchObject({ seasonId, playerId, teamId: destinationTeam, initialTeamId: sourceTeam,
      status: "active", role: "Difensore", shirtNumber: 22 });
    expect(current.transferHistory).toHaveLength(1);
    expect(current.transferHistory[0]).toMatchObject({ seasonId, playerId, competitionId,
      fromTeamId: sourceTeam, toTeamId: destinationTeam, effectiveDate: tomorrow() });
    const transfers = await transferDocs();
    expect(transfers).toHaveLength(1);
    expect(transfers[0].data()).toMatchObject({ seasonId, playerId, seasonPlayerId: membershipId,
      fromTeamId: sourceTeam, toTeamId: destinationTeam, effectiveDate: tomorrow() });
    expect((await db.collection("seasonPlayerKeys").doc(registryId(seasonId, playerId)).get()).data()).toEqual(keyBefore);
    expect((await db.collection("matchReports").doc(`${seasonId}_match_01`).get()).data()).toEqual(reportBefore);
  });

  it("blocca lo svincolo se c'è una partita aperta oggi", async () => {
    await db.collection("matches").doc(`${seasonId}_today`).set({
      seasonId, homeTeamId: sourceTeam, awayTeamId: destinationTeam, date: today(), status: "scheduled",
    });
    expect((await call("release")).status).toBe(409);
    expect((await roster()).status).toBe("active");
  });

  it("blocca il trasferimento se c'è una partita aperta oggi della squadra di destinazione", async () => {
    expect((await call("release")).status).toBe(200);
    await db.collection("matches").doc(`${seasonId}_today`).set({
      seasonId, homeTeamId: destinationTeam, awayTeamId: "another_team", date: today(), status: "scheduled",
    });
    expect((await call("restore", { teamId: destinationTeam, role: "Attaccante" })).status).toBe(409);
    expect((await roster()).status).toBe("inactive");
    expect(await transferDocs()).toHaveLength(0);
  });

  it("blocca il reinserimento se il numero maglia è già occupato", async () => {
    expect((await call("release")).status).toBe(200);
    await db.collection("seasonPlayers").doc(`other_${randomUUID().replaceAll("-", "")}`).set({
      seasonId, playerId: "different_player", teamId: destinationTeam, status: "active", shirtNumber: 22,
    });
    expect((await call("restore", { teamId: destinationTeam, role: "Difensore", shirtNumber: 22 })).status).toBe(409);
    expect((await roster()).status).toBe("inactive");
  });

  it("blocca lo svincolo a stagione completata", async () => {
    await db.collection("seasons").doc(seasonId).update({ status: "completed" });
    expect((await call("release")).status).toBe(409);
    expect((await roster()).status).toBe("active");
  });

  it("blocca il trasferimento se il registro univoco è assente", async () => {
    expect((await call("release")).status).toBe(200);
    await db.collection("seasonPlayerKeys").doc(registryId(seasonId, playerId)).delete();
    expect((await call("restore", { teamId: destinationTeam, role: "Difensore" })).status).toBe(409);
    expect((await roster()).status).toBe("inactive");
    expect(await transferDocs()).toHaveLength(0);
  });
});
