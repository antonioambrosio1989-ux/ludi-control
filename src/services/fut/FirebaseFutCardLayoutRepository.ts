import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import {
  getDefaultFutCardLayout,
  sanitizeFutCardElementLayout,
} from "@/src/application/fut/FutCardLayoutDefaults";

import type {
  FutCardElementKey,
  FutCardLayout,
} from "@/src/types/FutCardLayout";

const COLLECTION_NAME =
  "futCardLayouts";

const DOCUMENT_ID =
  "global";

const ELEMENT_KEYS: FutCardElementKey[] = [
  "rating",
  "role",
  "photo",
  "name",
  "nationality",
  "competitionLogo",
  "teamLogo",
];

function mapLayout(
  data: Record<
    string,
    unknown
  >,
): FutCardLayout {
  const fallback =
    getDefaultFutCardLayout();

  const rawElements =
    data.elements &&
    typeof data.elements ===
      "object"
      ? data.elements as
          Record<
            string,
            unknown
          >
      : {};

  const elements =
    ELEMENT_KEYS.reduce<
      FutCardLayout["elements"]
    >(
      (
        result,
        key,
      ) => {
        result[key] =
          sanitizeFutCardElementLayout({
            value:
              rawElements[
                key
              ],

            fallback:
              fallback.elements[
                key
              ],
          });

        return result;
      },

      {
        ...fallback.elements,
      },
    );

  return {
    elements,
    updatedAt:
      data.updatedAt,
  };
}

export const FirebaseFutCardLayoutRepository =
  {
    subscribe(
      onChange:
        (
          layout:
            FutCardLayout,
        ) => void,

      onError?:
        (
          error:
            Error,
        ) => void,
    ): Unsubscribe {
      const reference =
        doc(
          db,
          COLLECTION_NAME,
          DOCUMENT_ID,
        );

      return onSnapshot(
        reference,

        (
          snapshot,
        ) => {
          if (
            !snapshot.exists()
          ) {
            onChange(
              getDefaultFutCardLayout(),
            );

            return;
          }

          onChange(
            mapLayout(
              snapshot.data(),
            ),
          );
        },

        (
          error,
        ) => {
          console.error(
            "Errore caricamento layout FUT:",
            error,
          );

          onChange(
            getDefaultFutCardLayout(),
          );

          onError?.(
            error,
          );
        },
      );
    },

    async save(
      layout:
        FutCardLayout,
    ): Promise<void> {
      await setDoc(
        doc(
          db,
          COLLECTION_NAME,
          DOCUMENT_ID,
        ),

        {
          elements:
            layout.elements,

          updatedAt:
            serverTimestamp(),
        },

        {
          merge:
            true,
        },
      );
    },
  };
