import {
  doc,
  getDoc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import type {
  GamesSubscription,
} from "@/src/types/GamesSubscription";

const COLLECTION_NAME =
  "gamesSubscriptions";

/*
 * ============================================================
 * DOCUMENT ID
 * ============================================================
 */

function createDocumentId({
  userId,
  gamesSeasonId,
}: {
  userId: string;
  gamesSeasonId: string;
}): string {
  return `${userId}-${gamesSeasonId}`;
}

/*
 * ============================================================
 * DOCUMENT REFERENCE
 * ============================================================
 */

function getSubscriptionRef({
  userId,
  gamesSeasonId,
}: {
  userId: string;
  gamesSeasonId: string;
}) {
  return doc(
    db,
    COLLECTION_NAME,
    createDocumentId({
      userId,
      gamesSeasonId,
    }),
  );
}

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function getOptionalString(
  value: unknown,
): string | undefined {
  if (
    typeof value !== "string"
  ) {
    return undefined;
  }

  const normalized =
    value.trim();

  return normalized ||
    undefined;
}

/*
 * ============================================================
 * MAPPING
 * ============================================================
 */

function mapSubscription(
  documentId: string,
  data:
    Record<
      string,
      unknown
    >,
): GamesSubscription {
  const status =
    data.status === "active" ||
    data.status === "expired" ||
    data.status === "cancelled"
      ? data.status
      : "pending";

  return {
    id:
      documentId,

    userId:
      String(
        data.userId ??
          "",
      ),

    accessMethod:
  data.accessMethod ===
  "president_code"
    ? "president_code"
    : "payment",
    
    gamesSeasonId:
      String(
        data.gamesSeasonId ??
          "",
      ),

    status,

    purchasedAt:
      data.purchasedAt,

    expiresAt:
      data.expiresAt,

    paymentProvider:
  data.paymentProvider ===
  "stripe"
    ? "stripe"
    : undefined,

    paymentReference:
      getOptionalString(
        data.paymentReference,
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/*
 * ============================================================
 * REPOSITORY
 * ============================================================
 */

export const FirebaseGamesSubscriptionRepository =
  {
    /*
     * ========================================================
     * GET SUBSCRIPTION
     * ========================================================
     */

    async getByUserAndGamesSeason({
      userId,
      gamesSeasonId,
    }: {
      userId: string;
      gamesSeasonId: string;
    }): Promise<
      GamesSubscription | null
    > {
      const snapshot =
        await getDoc(
          getSubscriptionRef({
            userId,
            gamesSeasonId,
          }),
        );

      if (
        !snapshot.exists()
      ) {
        return null;
      }

      return mapSubscription(
        snapshot.id,
        snapshot.data(),
      );
    },

    /*
     * ========================================================
     * SUBSCRIBE
     * ========================================================
     */

    subscribeByUserAndGamesSeason({
      userId,
      gamesSeasonId,
      onChange,
      onError,
    }: {
      userId: string;
      gamesSeasonId: string;

      onChange: (
        subscription:
          GamesSubscription | null,
      ) => void;

      onError?: (
        error: Error,
      ) => void;
    }): Unsubscribe {
      return onSnapshot(
        getSubscriptionRef({
          userId,
          gamesSeasonId,
        }),

        (
          snapshot,
        ) => {
          if (
            !snapshot.exists()
          ) {
            onChange(
              null,
            );

            return;
          }

          onChange(
            mapSubscription(
              snapshot.id,
              snapshot.data(),
            ),
          );
        },

        (
          error,
        ) => {
          console.error(
            "Errore listener Games Pass:",
            error,
          );

          onError?.(
            error,
          );
        },
      );
    },
  };