import { createHash } from "node:crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import {
  buildWithdrawalPreparation,
  comparePreparedWithdrawal,
  preparationFingerprint,
  validWithdrawalId,
} from "./WithdrawalPersistenceContract";

export type PrepareWithdrawalRequest = {
  seasonId: string;
  teamId: string;
  expectedMatchweek: number;
  adminUid: string;
};

/** Only prepares an emulator test intent. No withdrawal is activated. */
export async function prepareWithdrawalTestIntent(
  db: Firestore,
  input: PrepareWithdrawalRequest,
): Promise<{ state: "create" | "duplicate"; operationId: string }> {
  const { seasonId, teamId, expectedMatchweek, adminUid } = input;
  if (!validWithdrawalId(seasonId) || !validWithdrawalId(teamId) ||
      !validWithdrawalId(adminUid) || !Number.isSafeInteger(expectedMatchweek)) {
    throw new Error("Richiesta di preparazione non valida.");
  }
  const seasonRef = db.collection("seasons").doc(seasonId);
  const configRef = seasonRef.collection("withdrawalSettings").doc("official");
  const entryRef = seasonRef.collection("teamEntries").doc(teamId);
  const registrationRef = seasonRef.collection("withdrawalRegistrations").doc(teamId);
  const intentRef = seasonRef.collection("withdrawalActivationIntents").doc(teamId);
  return db.runTransaction(async (tx) => {
    const [season, config, entry, registration, intent] = await Promise.all([
      tx.get(seasonRef), tx.get(configRef), tx.get(entryRef),
      tx.get(registrationRef), tx.get(intentRef),
    ]);
    if (!season.exists || season.data()?.status !== "active") throw new Error("Stagione non attiva.");
    if (!entry.exists || entry.data()?.status !== "active") throw new Error("Squadra non attiva.");
    if (!config.exists || !registration.exists) throw new Error("Formula ufficiale o bozza mancante.");
    const candidate = buildWithdrawalPreparation({
      seasonId, teamId, expectedMatchweek,
      config: config.data(), registration: registration.data(),
    });
    const operationId = createHash("sha256")
      .update(preparationFingerprint(candidate)).digest("hex");
    const prepared = { ...candidate, operationId };
    const state = comparePreparedWithdrawal(intent.exists ? intent.data() : undefined, prepared);
    if (state === "create") {
      tx.create(intentRef, { ...prepared, createdAt: FieldValue.serverTimestamp(), createdBy: adminUid });
    }
    return { state, operationId };
  });
}
