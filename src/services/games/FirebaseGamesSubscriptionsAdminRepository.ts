import {
  collection,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import {
  db,
} from "@/src/lib/firebase";

import type {
  GamesSubscription,
} from "@/src/types/GamesSubscription";

const COLLECTION_NAME =
  "gamesSubscriptions";

export class FirebaseGamesSubscriptionsAdminRepository {
  static subscribeByGamesSeason(
    gamesSeasonId:
      string,

    onChange:
      (
        subscriptions:
          GamesSubscription[],
      ) => void,

    onError?:
      (
        error:
          Error,
      ) => void,
  ): Unsubscribe {
    const reference =
      query(
        collection(
          db,
          COLLECTION_NAME,
        ),

        where(
          "gamesSeasonId",
          "==",
          gamesSeasonId,
        ),
      );

    return onSnapshot(
      reference,

      (
        snapshot,
      ) => {
        onChange(
          snapshot.docs.map(
            (
              document,
            ) =>
              normalizeSubscription(
                document.id,
                document.data(),
              ),
          ),
        );
      },

      (
        error,
      ) => {
        console.error(
          "Errore caricamento iscritti Games:",
          error,
        );

        onError?.(
          error,
        );
      },
    );
  }
}

function normalizeSubscription(
  id:
    string,

  value:
    Record<
      string,
      unknown
    >,
): GamesSubscription {
  const status =
    value.status ===
      "active" ||
    value.status ===
      "expired" ||
    value.status ===
      "cancelled"
      ? value.status
      : "pending";

  return {
    id,

    userId:
      String(
        value.userId ??
          "",
      ),

    gamesSeasonId:
      String(
        value.gamesSeasonId ??
          "",
      ),

    status,

    accessMethod:
      value.accessMethod ===
      "president_code"
        ? "president_code"
        : "payment",

    purchasedAt:
      value.purchasedAt,

    expiresAt:
      value.expiresAt,

    paymentProvider:
      "stripe",

    paymentReference:
      typeof value.paymentReference ===
        "string"
        ? value.paymentReference
        : undefined,

    createdAt:
      value.createdAt,

    updatedAt:
      value.updatedAt,
  };
}