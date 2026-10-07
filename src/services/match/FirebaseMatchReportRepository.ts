import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  runTransaction,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import { FirebaseMatchRepository } from "@/src/services/match/FirebaseMatchRepository";
import { assertSeasonWritable } from "@/src/services/season/SeasonWriteGuard";

import type { MatchWizardData } from "@/src/types/MatchWizardData";

export type CloudMatchReportStatus =
  | "draft"
  | "published";

export type CloudMatchReport = {
  matchId: string;

  /*
   * Presente su tutti i nuovi report.
   * Rimane opzionale nel tipo durante la migrazione dei documenti legacy.
   */
  seasonId?: string;
  status: CloudMatchReportStatus;
  version: number;
  data: MatchWizardData;
  updatedAt?: unknown;
  publishedAt?: unknown;
};

const COLLECTION_NAME = "matchReports";

type PublishedReportSubscriber = {
  onChange: (
    reports: CloudMatchReport[],
  ) => void;
  onError?: (
    error: Error,
  ) => void;
};

const publishedReportSubscribers =
  new Set<PublishedReportSubscriber>();

let publishedReportsCache:
  CloudMatchReport[] | undefined;

let publishedReportsUnsubscribe:
  Unsubscribe | undefined;


type PublishedSeasonReportSubscription = {
  subscribers:
    Set<PublishedReportSubscriber>;
  cache?:
    CloudMatchReport[];
  unsubscribe?:
    Unsubscribe;
};

const publishedReportSubscriptionsBySeason =
  new Map<
    string,
    PublishedSeasonReportSubscription
  >();

function subscribeSharedPublishedReports(
  subscriber:
    PublishedReportSubscriber,
): Unsubscribe {
  publishedReportSubscribers.add(
    subscriber,
  );

  if (
    publishedReportsCache
  ) {
    subscriber.onChange(
      publishedReportsCache,
    );
  }

  if (
    !publishedReportsUnsubscribe
  ) {
    publishedReportsUnsubscribe =
      onSnapshot(
        query(
          collection(
            db,
            COLLECTION_NAME,
          ),
          where(
            "status",
            "==",
            "published",
          ),
        ),
        (snapshot) => {
          publishedReportsCache =
            snapshot.docs.map(
              (
                currentDocument,
              ) =>
                currentDocument.data() as
                  CloudMatchReport,
            );

          for (
            const currentSubscriber of
              publishedReportSubscribers
          ) {
            currentSubscriber.onChange(
              publishedReportsCache,
            );
          }
        },
        (error) => {
          console.error(
            "Errore listener Match Report pubblicati:",
            error,
          );

          for (
            const currentSubscriber of
              publishedReportSubscribers
          ) {
            currentSubscriber.onError?.(
              error,
            );
          }
        },
      );
  }

  return () => {
    publishedReportSubscribers.delete(
      subscriber,
    );

    if (
      publishedReportSubscribers.size ===
        0 &&
      publishedReportsUnsubscribe
    ) {
      publishedReportsUnsubscribe();
      publishedReportsUnsubscribe =
        undefined;
      publishedReportsCache =
        undefined;
    }
  };
}

function subscribeSharedPublishedReportsBySeason(
  seasonId: string,
  subscriber:
    PublishedReportSubscriber,
): Unsubscribe {
  const normalizedSeasonId =
    seasonId.trim();

  if (!normalizedSeasonId) {
    subscriber.onChange([]);
    return () => undefined;
  }

  let current =
    publishedReportSubscriptionsBySeason.get(
      normalizedSeasonId,
    );

  if (!current) {
    current = {
      subscribers:
        new Set<PublishedReportSubscriber>(),
    };

    publishedReportSubscriptionsBySeason.set(
      normalizedSeasonId,
      current,
    );
  }

  current.subscribers.add(
    subscriber,
  );

  if (current.cache) {
    subscriber.onChange(
      current.cache,
    );
  }

  if (!current.unsubscribe) {
    current.unsubscribe =
      onSnapshot(
        query(
          collection(
            db,
            COLLECTION_NAME,
          ),
          where(
            "seasonId",
            "==",
            normalizedSeasonId,
          ),
          where(
            "status",
            "==",
            "published",
          ),
        ),
        (snapshot) => {
          const active =
            publishedReportSubscriptionsBySeason.get(
              normalizedSeasonId,
            );

          if (!active) {
            return;
          }

          active.cache =
            snapshot.docs.map(
              (currentDocument) =>
                currentDocument.data() as
                  CloudMatchReport,
            );

          for (
            const currentSubscriber of
              active.subscribers
          ) {
            currentSubscriber.onChange(
              active.cache,
            );
          }
        },
        (error) => {
          console.error(
            `Errore listener Match Report pubblicati stagione ${normalizedSeasonId}:`,
            error,
          );

          const active =
            publishedReportSubscriptionsBySeason.get(
              normalizedSeasonId,
            );

          for (
            const currentSubscriber of
              active?.subscribers ?? []
          ) {
            currentSubscriber.onError?.(
              error,
            );
          }
        },
      );
  }

  return () => {
    const active =
      publishedReportSubscriptionsBySeason.get(
        normalizedSeasonId,
      );

    if (!active) {
      return;
    }

    active.subscribers.delete(
      subscriber,
    );

    if (
      active.subscribers.size ===
      0
    ) {
      active.unsubscribe?.();
      publishedReportSubscriptionsBySeason.delete(
        normalizedSeasonId,
      );
    }
  };
}

function getReportRef(
  matchId: string,
) {
  return doc(
    db,
    COLLECTION_NAME,
    String(matchId),
  );
}

async function getWritableMatchSeasonId(
  matchId: string,
): Promise<string> {
  const normalizedMatchId =
    String(matchId).trim();

  if (!normalizedMatchId) {
    throw new Error(
      "La partita non è stata specificata.",
    );
  }

  const match =
    await FirebaseMatchRepository.getById(
      normalizedMatchId,
    );

  if (!match) {
    throw new Error(
      "La partita selezionata non esiste.",
    );
  }

  const seasonId =
    String(
      match.seasonId ??
        "",
    ).trim();

  if (!seasonId) {
    throw new Error(
      "La partita non appartiene a una stagione valida.",
    );
  }

  await assertSeasonWritable(
    seasonId,
  );

  return seasonId;
}

export const FirebaseMatchReportRepository = {
  subscribeAll(
    onChange: (
      reports: CloudMatchReport[],
    ) => void,

    onError?: (
      error: Error,
    ) => void,
  ): Unsubscribe {
    return onSnapshot(
      collection(
        db,
        COLLECTION_NAME,
      ),

      (snapshot) => {
        const reports =
          snapshot.docs.map(
            (currentDocument) =>
              currentDocument.data() as CloudMatchReport,
          );

        onChange(reports);
      },

      (error) => {
        console.error(
          "Errore listener Match Report:",
          error,
        );

        onError?.(error);
      },
    );
  },

  subscribePublished(
    onChange: (
      reports:
        CloudMatchReport[],
    ) => void,

    onError?: (
      error:
        Error,
    ) => void,
  ): Unsubscribe {
    return subscribeSharedPublishedReports({
      onChange,
      onError,
    });
  },

  subscribePublishedBySeason(
    seasonId: string,

    onChange: (
      reports:
        CloudMatchReport[],
    ) => void,

    onError?: (
      error:
        Error,
    ) => void,
  ): Unsubscribe {
    return subscribeSharedPublishedReportsBySeason(
      seasonId,
      {
        onChange,
        onError,
      },
    );
  },

  async getAll(): Promise<
    CloudMatchReport[]
  > {
    const snapshot =
      await getDocs(
        collection(
          db,
          COLLECTION_NAME,
        ),
      );

    return snapshot.docs.map(
      (currentDocument) =>
        currentDocument.data() as CloudMatchReport,
    );
  },

  async getPublished(): Promise<
  CloudMatchReport[]
> {
  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          COLLECTION_NAME,
        ),
        where(
          "status",
          "==",
          "published",
        ),
      ),
    );

  return snapshot.docs.map(
    (currentDocument) =>
      currentDocument.data() as CloudMatchReport,
  );
},

  subscribePublishedByMatchId(
    matchId: string,
    onChange: (report: CloudMatchReport | undefined) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(query(
      collection(db, COLLECTION_NAME),
      where("matchId", "==", matchId),
      where("status", "==", "published"),
    ), (snapshot) => {
      onChange(snapshot.docs[0]?.data() as CloudMatchReport | undefined);
    }, onError);
  },

  async getPublishedByMatchId(matchId: string): Promise<CloudMatchReport | undefined> {
    if (!matchId.trim()) return undefined;
    const snapshot = await getDocs(query(collection(db, COLLECTION_NAME),
      where("matchId", "==", matchId.trim()), where("status", "==", "published")));
    return snapshot.docs[0]?.data() as CloudMatchReport | undefined;
  },

  async getPublishedBySeason(
    seasonId: string,
  ): Promise<
    CloudMatchReport[]
  > {
    const normalizedSeasonId =
      seasonId.trim();

    if (!normalizedSeasonId) {
      return [];
    }

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            COLLECTION_NAME,
          ),
          where(
            "seasonId",
            "==",
            normalizedSeasonId,
          ),
          where(
            "status",
            "==",
            "published",
          ),
        ),
      );

    return snapshot.docs.map(
      (currentDocument) =>
        currentDocument.data() as
          CloudMatchReport,
    );
  },

  async getByMatchId(
    matchId: string,
  ): Promise<
    CloudMatchReport | undefined
  > {
    const snapshot =
      await getDoc(
        getReportRef(
          matchId,
        ),
      );

    if (!snapshot.exists()) {
      return undefined;
    }

    return snapshot.data() as CloudMatchReport;
  },

  async saveDraft(data: MatchWizardData): Promise<void> {
    const seasonId = await getWritableMatchSeasonId(data.matchId);
    const reference = getReportRef(data.matchId);
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      const existing = snapshot.exists() ? snapshot.data() as CloudMatchReport : undefined;
      // A published report changes only through explicit publication.
      if (existing?.status === "published") return;
      transaction.set(reference, {
        matchId: data.matchId, seasonId, status: "draft",
        version: existing?.version ?? 1, data,
        updatedAt: serverTimestamp(), publishedAt: existing?.publishedAt ?? null,
      }, { merge: true });
    });
  },

  async publish(
    data: MatchWizardData,
  ): Promise<void> {
    const seasonId =
      await getWritableMatchSeasonId(
        data.matchId,
      );

    const reference =
      getReportRef(
        data.matchId,
      );

    const existingSnapshot =
      await getDoc(reference);

    const existing =
      existingSnapshot.exists()
        ? (existingSnapshot.data() as CloudMatchReport)
        : undefined;

    const nextVersion =
      existing?.status ===
      "published"
        ? existing.version + 1
        : existing?.version ??
          1;

    await setDoc(
      reference,
      {
        matchId:
          data.matchId,

        seasonId,

        status:
          "published",

        version:
          nextVersion,

        data,

        updatedAt:
          serverTimestamp(),

        publishedAt:
          serverTimestamp(),
      },
      {
        merge: true,
      },
    );
  },

  async mergePlayerReferences({
    sourcePlayerId,
    targetPlayerId,
  }: {
    sourcePlayerId: string;
    targetPlayerId: string;
  }): Promise<number> {
    const normalizedSourcePlayerId =
      sourcePlayerId.trim();

    const normalizedTargetPlayerId =
      targetPlayerId.trim();

    if (
      !normalizedSourcePlayerId ||
      !normalizedTargetPlayerId
    ) {
      throw new Error(
        "Gli ID dei giocatori sono obbligatori.",
      );
    }

    if (
      normalizedSourcePlayerId ===
      normalizedTargetPlayerId
    ) {
      return 0;
    }

    const snapshot =
      await getDocs(
        collection(
          db,
          COLLECTION_NAME,
        ),
      );

    let changedReports =
      0;

    const pendingUpdates: {
      reference: ReturnType<typeof doc>;
      data: MatchWizardData;
    }[] = [];

    for (
      const currentDocument of
        snapshot.docs
    ) {
      const report =
        currentDocument.data() as CloudMatchReport;

      if (
        !report.data
      ) {
        continue;
      }

      const {
        data:
          nextData,

        changed,
      } =
        replacePlayerIdInMatchWizardData(
          report.data,

          normalizedSourcePlayerId,

          normalizedTargetPlayerId,
        );

      if (
        !changed
      ) {
        continue;
      }

      pendingUpdates.push({
        reference:
          currentDocument.ref,

        data:
          nextData,
      });

      changedReports +=
        1;
    }

    /*
     * Firestore permette massimo
     * 500 operazioni per batch.
     *
     * Qui lavoriamo a blocchi da 400
     * per stare tranquilli.
     */
    for (
      let index = 0;
      index <
      pendingUpdates.length;
      index += 400
    ) {
      const chunk =
        pendingUpdates.slice(
          index,
          index + 400,
        );

      const batch =
        writeBatch(
          db,
        );

      for (
        const update of
          chunk
      ) {
        batch.update(
          update.reference,
          {
            data:
              update.data,

            updatedAt:
              serverTimestamp(),
          },
        );
      }

      await batch.commit();
    }

    return changedReports;
  },
};
function replacePlayerIdInMatchWizardData(
  data: MatchWizardData,
  sourcePlayerId: string,
  targetPlayerId: string,
): {
  data: MatchWizardData;
  changed: boolean;
} {
  let changed =
    false;

  function replaceValue(
    value: unknown,
  ): unknown {
    if (
      Array.isArray(
        value,
      )
    ) {
      return value.map(
        (
          item,
        ) =>
          replaceValue(
            item,
          ),
      );
    }

    if (
      value &&
      typeof value ===
        "object"
    ) {
      const record =
        value as Record<
          string,
          unknown
        >;

      const nextRecord:
        Record<
          string,
          unknown
        > = {};

      for (
        const [
          key,
          currentValue,
        ] of
          Object.entries(
            record,
          )
      ) {
        /*
         * Sostituiamo solamente
         * campi che rappresentano
         * esplicitamente un playerId.
         *
         * Evitiamo quindi di sostituire
         * stringhe casuali presenti
         * nel report.
         */
        if (
          key ===
            "playerId" &&
          String(
            currentValue ??
              "",
          ) ===
            sourcePlayerId
        ) {
          nextRecord[
            key
          ] =
            targetPlayerId;

          changed =
            true;

          continue;
        }

        nextRecord[
          key
        ] =
          replaceValue(
            currentValue,
          );
      }

      return nextRecord;
    }

    return value;
  }

  const nextData =
    replaceValue(
      data,
    ) as MatchWizardData;

  return {
    data:
      nextData,

    changed,
  };
}
