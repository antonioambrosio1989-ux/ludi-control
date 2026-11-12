const { loadEnvConfig } = require("@next/env");
const { initializeApp, cert, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

async function main() {
  loadEnvConfig(process.cwd());

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ?.replace(/\\n/g, "\n");

  if (projectId !== "ludi-os") {
    throw new Error("Progetto diverso da ludi-os: audit bloccato.");
  }

  if (process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error("Variabili emulator presenti: audit bloccato.");
  }

  if (!clientEmail || !privateKey) {
    throw new Error("Credenziali Firebase Admin mancanti.");
  }

  const app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey })
  }, "market-registry-readonly-audit");

  try {
    const db = getFirestore(app, "default");

    console.log("=== AUDIT FIRESTORE SOLA LETTURA ===");
    console.log("Progetto:", projectId);

    const [players, keys] = await Promise.all([
      db.collection("seasonPlayers").get(),
      db.collection("seasonPlayerKeys").get()
    ]);

    const canonicalId = (seasonId, playerId) =>
      "sp_" + Buffer.from(
        JSON.stringify([seasonId, playerId]), "utf8"
      ).toString("base64url");

    const validId = v => typeof v === "string" &&
      /^[a-zA-Z0-9_-]{1,180}$/.test(v);

    const rosterByIdentity = new Map();
    const rosterById = new Map();
    const keyById = new Map();

    let invalidRosters = 0;
    let duplicates = 0;
    let missingKeys = 0;
    let orphanKeys = 0;
    let inconsistentKeys = 0;
    let invalidKeys = 0;

    for (const doc of keys.docs) {
      keyById.set(doc.id, doc.data());
    }

    for (const doc of players.docs) {
      const data = doc.data();
      const { seasonId, playerId } = data;

      rosterById.set(doc.id, data);

      if (!validId(seasonId) || !validId(playerId)) {
        invalidRosters++;
        continue;
      }

      const id = canonicalId(seasonId, playerId);
      const existing = rosterByIdentity.get(id) || [];
      existing.push(doc.id);
      rosterByIdentity.set(id, existing);

      const key = keyById.get(id);

      if (!key) {
        missingKeys++;
      } else if (
        key.seasonId !== seasonId ||
        key.playerId !== playerId ||
        key.seasonPlayerId !== doc.id
      ) {
        inconsistentKeys++;
      }
    }

    for (const ids of rosterByIdentity.values()) {
      if (ids.length > 1) duplicates += ids.length - 1;
    }

    for (const doc of keys.docs) {
      const key = doc.data();

      if (!validId(key.seasonId) ||
          !validId(key.playerId) ||
          !validId(key.seasonPlayerId) ||
          doc.id !== canonicalId(key.seasonId, key.playerId)) {
        invalidKeys++;
        continue;
      }

      const roster = rosterById.get(key.seasonPlayerId);

      if (!roster) {
        orphanKeys++;
      } else if (
        roster.seasonId !== key.seasonId ||
        roster.playerId !== key.playerId
      ) {
        inconsistentKeys++;
      }
    }

    const report = {
      projectId,
      totalSeasonPlayers: players.size,
      totalSeasonPlayerKeys: keys.size,
      invalidRosters,
      duplicateRegistrations: duplicates,
      missingKeys,
      orphanKeys,
      invalidKeys,
      inconsistentKeys
    };

    console.log("=== RIEPILOGO AUDIT ===");
    console.log(JSON.stringify(report, null, 2));

    const anomalies = invalidRosters + duplicates +
      missingKeys + orphanKeys + invalidKeys + inconsistentKeys;

    if (anomalies > 0) {
      console.log("ESITO: INCONGRUENZE RILEVATE");
      process.exitCode = 2;
    } else {
      console.log("ESITO: REGISTRO COERENTE");
    }
  } finally {
    await deleteApp(app);
  }
}

main().catch(err => {
  console.error("AUDIT FALLITO:", err.message);
  process.exitCode = 1;
});
