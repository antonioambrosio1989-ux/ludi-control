import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

const projectId = "demo-ludi-os-rules";
let env: RulesTestEnvironment;
const rosterPath = "seasonPlayers/market-check-player";

function getEmulator() {
  const value = process.env.FIRESTORE_EMULATOR_HOST;
  if (!value) {
    throw new Error("FIRESTORE_EMULATOR_HOST assente: avviare via firebase emulators:exec.");
  }
  const [host, portString] = value.split(":");
  const port = Number(portString);
  if (!host || !Number.isInteger(port)) throw new Error("Indirizzo emulator non valido.");
  return { host, port };
}

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc("admins/admin-market-test").set({ active: true });
    await db.doc(rosterPath).set({
      seasonId: "season-market-test",
      playerId: "player-market-test",
      teamId: "team-a",
      initialTeamId: "team-a",
      transferHistory: [],
      status: "active",
      shirtNumber: 9,
    });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      ...getEmulator(),
      rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8"),
    },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

afterAll(async () => {
  await env?.cleanup();
});

function adminDb() {
  return env.authenticatedContext("admin-market-test").firestore();
}

function ordinaryDb() {
  return env.authenticatedContext("regular-market-test").firestore();
}

describe("Mercato - Firestore Security Rules Fase 5C", () => {
  it("admin: modifica ordinaria della rosa consentita", async () => {
    await assertSucceeds(adminDb().doc(rosterPath).update({ shirtNumber: 11 }));
  });

  it("utente ordinario: modifica della rosa negata", async () => {
    await assertFails(ordinaryDb().doc(rosterPath).update({ shirtNumber: 11 }));
  });

  it("admin: cambio diretto teamId negato", async () => {
    await assertFails(adminDb().doc(rosterPath).update({ teamId: "team-b" }));
  });

  it("admin: modifica diretta initialTeamId negata", async () => {
    await assertFails(adminDb().doc(rosterPath).update({ initialTeamId: "team-b" }));
  });

  it("admin: modifica diretta transferHistory negata", async () => {
    await assertFails(adminDb().doc(rosterPath).update({ transferHistory: [{ toTeamId: "team-b" }] }));
  });

  it("admin: cancellazione iscrizione negata", async () => {
    await assertFails(adminDb().doc(rosterPath).delete());
  });

  it("admin: creazione diretta nuova iscrizione negata", async () => {
    await assertFails(adminDb().doc("seasonPlayers/market-check-new").set({
      seasonId: "season-market-test", playerId: "player-market-2", teamId: "team-b", status: "active",
    }));
  });

  it("admin: eliminazione e ricreazione per cambio squadra negata", async () => {
    const db = adminDb();
    const batch = db.batch();
    batch.delete(db.doc(rosterPath));
    batch.set(db.doc(rosterPath), {
      seasonId: "season-market-test", playerId: "player-market-test",
      teamId: "team-b", status: "active",
    });
    await assertFails(batch.commit());
  });

  it("admin: modifica diretta playerId negata", async () => {
    await assertFails(adminDb().doc(rosterPath).update({ playerId: "player-different" }));
  });

  it("admin: modifica diretta seasonId negata", async () => {
    await assertFails(adminDb().doc(rosterPath).update({ seasonId: "another-season" }));
  });

  it("admin: stato transferred imposto dal client negato", async () => {
    await assertFails(adminDb().doc(rosterPath).update({ status: "transferred" }));
  });

  it("admin: passaggio active a inactive consentito", async () => {
    await assertSucceeds(adminDb().doc(rosterPath).update({ status: "inactive" }));
  });

  it("admin: scrittura diretta seasonTransfers negata", async () => {
    await assertFails(adminDb().doc("seasonTransfers/market-check-transfer").set({ seasonId: "season-market-test" }));
  });

  it("admin: scrittura diretta seasonPlayerKeys negata", async () => {
    await assertFails(adminDb().doc("seasonPlayerKeys/market-check-key").set({ seasonId: "season-market-test" }));
  });
});
