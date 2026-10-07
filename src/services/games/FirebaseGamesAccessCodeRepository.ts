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
  GamesAccessCode,
} from "@/src/types/GamesAccessCode";

const COLLECTION_NAME =
  "gamesAccessCodes";

export class FirebaseGamesAccessCodeRepository {
  static subscribeByGamesSeason(
    gamesSeasonId:
      string,

    onChange:
      (
        items:
          GamesAccessCode[],
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
              normalizeDocument(
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
          "Errore caricamento pass Presidenti:",
          error,
        );

        onError?.(
          error,
        );
      },
    );
  }
}

function normalizeDocument(
  id:
    string,

  value:
    Record<
      string,
      unknown
    >,
): GamesAccessCode {
  return {
    id,

    gamesSeasonId:
      normalizeString(
        value.gamesSeasonId,
      ),

    type:
      "president",

    label:
      normalizeString(
        value.label,
      ),

    status:
      value.status ===
      "redeemed"
        ? "redeemed"
        : value.status ===
            "disabled"
          ? "disabled"
          : "available",

    codeHash:
      normalizeString(
        value.codeHash,
      ),

    redeemedByUserId:
      normalizeOptionalString(
        value.redeemedByUserId,
      ),

    redeemedAt:
      value.redeemedAt,

    createdAt:
      value.createdAt,

    updatedAt:
      value.updatedAt,
  };
}

function normalizeString(
  value:
    unknown,
): string {
  return String(
    value ??
      "",
  ).trim();
}

function normalizeOptionalString(
  value:
    unknown,
): string | undefined {
  const normalized =
    normalizeString(
      value,
    );

  return (
    normalized ||
    undefined
  );
}