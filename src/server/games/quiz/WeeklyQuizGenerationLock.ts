import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { adminDb } from "@/src/lib/firebaseAdmin";
import type { Transaction } from "firebase-admin/firestore";

export class WeeklyQuizGenerationBusyError extends Error {
  constructor() { super("Generazione Weekly Quiz già in corso. Riprova tra poco."); }
}

export async function withWeeklyQuizGenerationLock<T>(
  gamesSeasonId: string,
  gameId: string,
  operation: (assertOwnership: (transaction: Transaction) => Promise<void>) => Promise<T>,
): Promise<T> {
  const key = createHash("sha256").update(JSON.stringify([gamesSeasonId.trim(), gameId.trim()])).digest("hex");
  const reference = adminDb.collection("gamesQuizGenerationLocks").doc(key);
  const owner = randomUUID();
  await adminDb.runTransaction(async (transaction) => {
    const current = await transaction.get(reference);
    if (Number(current.data()?.expiresAtMs) > Date.now()) throw new WeeklyQuizGenerationBusyError();
    transaction.set(reference, { owner, expiresAtMs: Date.now() + 5 * 60_000 });
  });
  const assertOwnership = async (transaction: Transaction) => {
    const lock = await transaction.get(reference);
    if (lock.data()?.owner !== owner || Number(lock.data()?.expiresAtMs) <= Date.now()) {
      throw new WeeklyQuizGenerationBusyError();
    }
  };
  try {
    return await operation(assertOwnership);
  } finally {
    // A worker whose lease expired must never release its successor's lock.
    await adminDb.runTransaction(async (transaction) => {
      const current = await transaction.get(reference);
      if (current.data()?.owner === owner) transaction.delete(reference);
    }).catch((error) => console.error("Impossibile rilasciare il lock Weekly Quiz:", error));
  }
}
