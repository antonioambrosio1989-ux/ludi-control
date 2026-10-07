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

import {
  FirebaseFinalStageMatchRepository,
} from "@/src/services/final-stage/FirebaseFinalStageMatchRepository";

import {
  assertSeasonWritable,
} from "@/src/services/season/SeasonWriteGuard";

import type {
  MatchWizardData,
} from "@/src/types/MatchWizardData";

/*
 * ============================================================
 * STATUS
 * ============================================================
 */

export type CloudFinalStageMatchReportStatus =
  | "draft"
  | "published";

/*
 * ============================================================
 * CLOUD MATCH REPORT
 * ============================================================
 */

export type CloudFinalStageMatchReport = {
  matchId: string;

  /*
   * Opzionale solamente durante la migrazione dei report legacy.
   */
  seasonId?: string;

  status:
    CloudFinalStageMatchReportStatus;

  version: number;

  data:
    MatchWizardData;

  updatedAt?: unknown;
  publishedAt?: unknown;
};

/*
 * ============================================================
 * COLLECTION
 * ============================================================
 */

const COLLECTION_NAME =
  "finalStageMatchReports";

/*
 * ============================================================
 * DOCUMENT REF
 * ============================================================
 */

function getReportRef(
  matchId:
    string,
) {
  return doc(
    db,
    COLLECTION_NAME,
    String(
      matchId,
    ),
  );
}

/*
 * ============================================================
 * WRITE GUARD
 * ============================================================
 */

async function getWritableFinalStageSeasonId(
  matchId:
    string,
): Promise<string> {
  const normalizedMatchId =
    String(
      matchId,
    ).trim();

  if (
    !normalizedMatchId
  ) {
    throw new Error(
      "La partita non è stata specificata.",
    );
  }

  const match =
    await FirebaseFinalStageMatchRepository.getById(
      normalizedMatchId,
    );

  if (
    !match
  ) {
    throw new Error(
      "La partita delle fasi finali selezionata non esiste.",
    );
  }

  const seasonId =
    String(
      match.seasonId ??
        "",
    ).trim();

  if (
    !seasonId
  ) {
    throw new Error(
      "La partita delle fasi finali non appartiene a una stagione valida.",
    );
  }

  await assertSeasonWritable(
    seasonId,
  );

  return seasonId;
}

type PublishedFinalStageReportSubscriber = {
  onChange:
    (
      reports:
        CloudFinalStageMatchReport[],
    ) => void;

  onError?:
    (
      error:
        Error,
    ) => void;
};

type PublishedFinalStageSeasonSubscription = {
  subscribers:
    Set<
      PublishedFinalStageReportSubscriber
    >;

  cache?:
    CloudFinalStageMatchReport[];

  unsubscribe?:
    Unsubscribe;
};

const publishedFinalStageReportSubscriptionsBySeason =
  new Map<
    string,
    PublishedFinalStageSeasonSubscription
  >();

function subscribeSharedPublishedFinalStageReportsBySeason(
  seasonId:
    string,

  subscriber:
    PublishedFinalStageReportSubscriber,
): Unsubscribe {
  const normalizedSeasonId =
    seasonId.trim();

  if (!normalizedSeasonId) {
    subscriber.onChange(
      [],
    );

    return () =>
      undefined;
  }

  let current =
    publishedFinalStageReportSubscriptionsBySeason.get(
      normalizedSeasonId,
    );

  if (!current) {
    current = {
      subscribers:
        new Set<
          PublishedFinalStageReportSubscriber
        >(),
    };

    publishedFinalStageReportSubscriptionsBySeason.set(
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

        (
          snapshot,
        ) => {
          const active =
            publishedFinalStageReportSubscriptionsBySeason.get(
              normalizedSeasonId,
            );

          if (!active) {
            return;
          }

          active.cache =
            snapshot.docs.map(
              (
                currentDocument,
              ) =>
                currentDocument.data() as
                  CloudFinalStageMatchReport,
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

        (
          error,
        ) => {
          console.error(
            `Errore listener Final Stage Match Report pubblicati stagione ${normalizedSeasonId}:`,
            error,
          );

          const active =
            publishedFinalStageReportSubscriptionsBySeason.get(
              normalizedSeasonId,
            );

          for (
            const currentSubscriber of
              active?.subscribers ??
              []
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
      publishedFinalStageReportSubscriptionsBySeason.get(
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

      publishedFinalStageReportSubscriptionsBySeason.delete(
        normalizedSeasonId,
      );
    }
  };
}

/*
 * ============================================================
 * REPOSITORY
 * ============================================================
 */

export const FirebaseFinalStageMatchReportRepository =
  {
    /*
     * ========================================================
     * SUBSCRIBE ALL
     * ========================================================
     */

    subscribeAll(
      onChange:
        (
          reports:
            CloudFinalStageMatchReport[],
        ) => void,

      onError?:
        (
          error:
            Error,
        ) => void,
    ): Unsubscribe {
      return onSnapshot(
        collection(
          db,
          COLLECTION_NAME,
        ),

        (
          snapshot,
        ) => {
          const reports =
            snapshot.docs.map(
              (
                currentDocument,
              ) =>
                currentDocument.data() as
                  CloudFinalStageMatchReport,
            );

          onChange(
            reports,
          );
        },

        (
          error,
        ) => {
          console.error(
            "Errore listener Final Stage Match Report:",
            error,
          );

          onError?.(
            error,
          );
        },
      );
    },

    /*
     * ========================================================
     * SUBSCRIBE PUBLISHED
     * ========================================================
     *
     * Listener utilizzabile anche dai visitatori non autenticati.
     * La query esplicita sullo status permette alle regole
     * Firestore di garantire che nessuna bozza venga esposta.
     * ========================================================
     */

    subscribePublished(
      onChange:
        (
          reports:
            CloudFinalStageMatchReport[],
        ) => void,

      onError?:
        (
          error:
            Error,
        ) => void,
    ): Unsubscribe {
      return onSnapshot(
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

        (
          snapshot,
        ) => {
          onChange(
            snapshot.docs.map(
              (
                currentDocument,
              ) =>
                currentDocument.data() as
                  CloudFinalStageMatchReport,
            ),
          );
        },

        (
          error,
        ) => {
          console.error(
            "Errore listener Final Stage Match Report pubblicati:",
            error,
          );

          onError?.(
            error,
          );
        },
      );
    },

    subscribePublishedBySeason(
      seasonId:
        string,

      onChange:
        (
          reports:
            CloudFinalStageMatchReport[],
        ) => void,

      onError?:
        (
          error:
            Error,
        ) => void,
    ): Unsubscribe {
      return subscribeSharedPublishedFinalStageReportsBySeason(
        seasonId,
        {
          onChange,
          onError,
        },
      );
    },

    /*
     * ========================================================
     * GET ALL
     * ========================================================
     */

    async getAll(): Promise<
      CloudFinalStageMatchReport[]
    > {
      const snapshot =
        await getDocs(
          collection(
            db,
            COLLECTION_NAME,
          ),
        );

      return snapshot.docs.map(
        (
          currentDocument,
        ) =>
          currentDocument.data() as
            CloudFinalStageMatchReport,
      );
    },

    /*
     * ========================================================
     * GET PUBLISHED
     * ========================================================
     */

    async getPublished(): Promise<
      CloudFinalStageMatchReport[]
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
        (
          currentDocument,
        ) =>
          currentDocument.data() as
            CloudFinalStageMatchReport,
      );
    },

    /*
     * ========================================================
     * GET BY MATCH ID
     * ========================================================
     */

    async getPublishedBySeason(
      seasonId:
        string,
    ): Promise<
      CloudFinalStageMatchReport[]
    > {
      const normalizedSeasonId =
        seasonId.trim();

      if (
        !normalizedSeasonId
      ) {
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
        (
          currentDocument,
        ) =>
          currentDocument.data() as
            CloudFinalStageMatchReport,
      );
    },

    async getPublishedByMatchId(matchId: string): Promise<CloudFinalStageMatchReport | undefined> {
      if (!matchId.trim()) return undefined;
      const snapshot = await getDocs(query(collection(db, COLLECTION_NAME),
        where("matchId", "==", matchId.trim()), where("status", "==", "published")));
      return snapshot.docs[0]?.data() as CloudFinalStageMatchReport | undefined;
    },

    async getByMatchId(
      matchId:
        string,
    ): Promise<
      CloudFinalStageMatchReport |
      undefined
    > {
      const normalizedMatchId =
        String(
          matchId,
        ).trim();

      if (
        !normalizedMatchId
      ) {
        return undefined;
      }

      const snapshot =
        await getDoc(
          getReportRef(
            normalizedMatchId,
          ),
        );

      if (
        !snapshot.exists()
      ) {
        return undefined;
      }

      return snapshot.data() as
        CloudFinalStageMatchReport;
    },

    /*
     * ========================================================
     * SAVE DRAFT
     * ========================================================
     */

    async saveDraft(data: MatchWizardData): Promise<void> {
    const seasonId = await getWritableFinalStageSeasonId(data.matchId);
    const reference = getReportRef(data.matchId);
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      const existing = snapshot.exists() ? snapshot.data() as CloudFinalStageMatchReport : undefined;
      // A published report changes only through explicit publication.
      if (existing?.status === "published") return;
      transaction.set(reference, {
        matchId: data.matchId, seasonId, status: "draft",
        version: existing?.version ?? 1, data,
        updatedAt: serverTimestamp(), publishedAt: existing?.publishedAt ?? null,
      }, { merge: true });
    });
  },

    /*
     * ========================================================
     * PUBLISH
     * ========================================================
     */

    async publish(
      data:
        MatchWizardData,
    ): Promise<void> {
      const seasonId =
        await getWritableFinalStageSeasonId(
          data.matchId,
        );

      const reference =
        getReportRef(
          data.matchId,
        );

      const existingSnapshot =
        await getDoc(
          reference,
        );

      const existing =
        existingSnapshot.exists()
          ? (
              existingSnapshot.data() as
                CloudFinalStageMatchReport
            )
          : undefined;

      const nextVersion =
        existing?.status ===
        "published"
          ? existing.version +
            1
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
          merge:
            true,
        },
      );
    },

    /*
     * ========================================================
     * MERGE PLAYER REFERENCES
     * ========================================================
     */

    async mergePlayerReferences({
      sourcePlayerId,
      targetPlayerId,
    }: {
      sourcePlayerId:
        string;

      targetPlayerId:
        string;
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

      const pendingUpdates:
        {
          reference:
            ReturnType<
              typeof doc
            >;

          data:
            MatchWizardData;
        }[] = [];

      for (
        const currentDocument of
          snapshot.docs
      ) {
        const report =
          currentDocument.data() as
            CloudFinalStageMatchReport;

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
       * Utilizziamo blocchi da 400
       * per mantenere margine.
       */

      for (
        let index =
          0;

        index <
        pendingUpdates.length;

        index +=
          400
      ) {
        const chunk =
          pendingUpdates.slice(
            index,
            index +
              400,
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

/*
 * ============================================================
 * REPLACE PLAYER ID
 * ============================================================
 */

function replacePlayerIdInMatchWizardData(
  data:
    MatchWizardData,

  sourcePlayerId:
    string,

  targetPlayerId:
    string,
): {
  data:
    MatchWizardData;

  changed:
    boolean;
} {
  let changed =
    false;

  /*
   * ==========================================================
   * REPLACE VALUE
   * ==========================================================
   */

  function replaceValue(
    value:
      unknown,
  ): unknown {
    /*
     * ========================================================
     * ARRAY
     * ========================================================
     */

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

    /*
     * ========================================================
     * OBJECT
     * ========================================================
     */

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
         * Sostituiamo soltanto i campi
         * che rappresentano esplicitamente
         * un riferimento a un giocatore.
         */

        if (
          isPlayerIdField(
            key,
          ) &&
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
    ) as
      MatchWizardData;

  return {
    data:
      nextData,

    changed,
  };
}

/*
 * ============================================================
 * CAMPI PLAYER ID
 * ============================================================
 */

function isPlayerIdField(
  key:
    string,
): boolean {
  return [
    "playerId",

    "scorerPlayerId",

    "assistPlayerId",

    "mvpPlayerId",
  ].includes(
    key,
  );
}
