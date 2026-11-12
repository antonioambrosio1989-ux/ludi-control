/**
 * Gate dei trasferimenti: riconosce il demo emulator e, separatamente,
 * una produzione abilitata in modo esplicito sul progetto Firebase atteso.
 * Nessuna impostazione di Vercel abilita automaticamente le Cloud Functions.
 */
export function marketWritesAllowed(env: Record<string, string | undefined>): boolean {
  const projectId = env.GCLOUD_PROJECT;
  const firestoreEmulator = Boolean(env.FIRESTORE_EMULATOR_HOST);
  const authEmulator = Boolean(env.FIREBASE_AUTH_EMULATOR_HOST);

  // Compatibilita con i test end-to-end gia superati.
  if (projectId === "demo-ludi-market-confirm" && firestoreEmulator && authEmulator) return true;

  // Gli emulatori non devono mai autorizzare una scrittura su altri progetti.
  if (firestoreEmulator || authEmulator) return false;

  const allowedProjectId = env.LUDI_MARKET_ALLOWED_PROJECT_ID;
  return env.LUDI_MARKET_WRITES_ENABLED === "true" &&
    typeof projectId === "string" && projectId.length > 0 &&
    typeof allowedProjectId === "string" && allowedProjectId.length > 0 &&
    allowedProjectId !== "demo-ludi-market-confirm" &&
    projectId === allowedProjectId;
}
