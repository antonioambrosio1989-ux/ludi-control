import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
export type PublicationPhase = "regular" | "final";
export const publicationJobId = (phase: PublicationPhase, id: string) =>
  `${phase}_${id}`;

// Jobs are private. A season lease serializes discipline updates from different games.
export const PublicationJobService = {
  async run<T>(
    phase: PublicationPhase,
    id: string,
    version: number,
    work: () => Promise<T>,
  ): Promise<T> {
    const { db } = await import("@/src/lib/firebase");
    const reference = doc(
      db,
      "matchPublicationJobs",
      publicationJobId(phase, id),
    );
    const token = crypto.randomUUID();
    let seasonId = "";
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      const job = snapshot.data();
      if (!job || job.version !== version)
        throw new Error(
          "È disponibile una versione più recente del tabellino. Ricarica la pagina.",
        );
      seasonId = String(job.seasonId);
      const lock = doc(db, "matchPublicationLocks", seasonId);
      const lease = (await transaction.get(lock)).data();
      if (lease && lease.expiresAtMs > Date.now())
        throw new Error(
          "Un'altra partita è in elaborazione. Puoi riprovare dal pannello Elaborazioni.",
        );
      transaction.set(lock, { token, expiresAtMs: Date.now() + 300_000 });
      transaction.update(reference, {
        status: "running",
        token,
        attempts: (job.attempts ?? 0) + 1,
        updatedAt: serverTimestamp(),
        error: null,
      });
    });
    const finish = async (
      status: "completed" | "failed",
      error: string | null,
    ) => {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(reference);
        const lock = doc(db, "matchPublicationLocks", seasonId);
        const lease = await transaction.get(lock);
        if (
          snapshot.data()?.token === token &&
          snapshot.data()?.version === version
        ) {
          transaction.update(reference, {
            status,
            error,
            updatedAt: serverTimestamp(),
          });
        }
        if (lease.data()?.token === token) transaction.delete(lock);
      });
    };
    // Keep the lease alive during long browser-side processing.
    const heartbeat = window.setInterval(() => {
      void runTransaction(db, async (transaction) => {
        const lock = doc(db, "matchPublicationLocks", seasonId);
        const lease = await transaction.get(lock);
        if (lease.data()?.token === token)
          transaction.update(lock, { expiresAtMs: Date.now() + 300_000 });
      }).catch((error) =>
        console.error("Publication lease renewal failed", error),
      );
    }, 60_000);
    try {
      const result = await work();
      await finish("completed", null);
      return result;
    } catch (error) {
      await finish(
        "failed",
        error instanceof Error ? error.message : "Elaborazione non riuscita.",
      ).catch(console.error);
      throw error;
    } finally {
      window.clearInterval(heartbeat);
    }
  },
  async get(phase: PublicationPhase, id: string) {
    const { db } = await import("@/src/lib/firebase");
    const snapshot = await getDoc(
      doc(db, "matchPublicationJobs", publicationJobId(phase, id)),
    );
    return snapshot.data();
  },
};
