import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import type {
  BestOfTheMonthItem,
  BestOfTheMonthStatus,
} from "@/src/types/BestOfTheMonthItem";

const COLLECTION_NAME =
  "bestOfTheMonth";

/*
 * ============================================================
 * INPUT
 * ============================================================
 */

export type CreateBestOfTheMonthItemInput = {
  seasonId:
    string;

  competitionId:
    string;

  month:
    string;

  title?:
    string;

  imageUrl:
    string;

  imageKey?:
    string;

  order:
    number;

  status:
    BestOfTheMonthStatus;
};

export type UpdateBestOfTheMonthItemInput = {
  itemId:
    string;

  month:
    string;

  title?:
    string;

  imageUrl:
    string;

  imageKey?:
    string;

  order:
    number;

  status:
    BestOfTheMonthStatus;
};

/*
 * ============================================================
 * NORMALIZZAZIONE
 * ============================================================
 */

function mapDocument(
  documentId:
    string,

  data:
    Record<
      string,
      unknown
    >,
): BestOfTheMonthItem {
  return {
    id:
      documentId,

    seasonId:
      typeof data.seasonId ===
      "string"
        ? data.seasonId
        : "",

    competitionId:
      typeof data.competitionId === "string" ? data.competitionId : "championship",

    month:
      typeof data.month ===
      "string"
        ? data.month
        : "",

    title:
      typeof data.title ===
      "string"
        ? data.title
        : undefined,

    imageUrl:
      typeof data.imageUrl ===
      "string"
        ? data.imageUrl
        : "",

    imageKey:
      typeof data.imageKey ===
      "string"
        ? data.imageKey
        : undefined,

    order:
      typeof data.order ===
      "number" &&
      Number.isFinite(
        data.order,
      )
        ? data.order
        : 1,

    status:
      data.status ===
      "published"
        ? "published"
        : "draft",

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,

    publishedAt:
      data.publishedAt,
  };
}

/*
 * ============================================================
 * ORDINAMENTO
 * ============================================================
 */

function sortItems(
  items:
    BestOfTheMonthItem[],
) {
  return [
    ...items,
  ].sort(
    (
      first,
      second,
    ) => {
      const monthComparison =
        second.month.localeCompare(
          first.month,
          "it",
        );

      if (
        monthComparison !==
        0
      ) {
        return monthComparison;
      }

      if (
        first.order !==
        second.order
      ) {
        return (
          first.order -
          second.order
        );
      }

      return first.id.localeCompare(
        second.id,
        "it",
      );
    },
  );
}

/*
 * ============================================================
 * VALIDAZIONE
 * ============================================================
 */

function assertValidItemData({
  seasonId,
  competitionId,
  month,
  imageUrl,
  order,
}: {
  seasonId:
    string;

  competitionId:
    string;

  month:
    string;

  imageUrl:
    string;

  order:
    number;
}) {
  if (
    !seasonId.trim()
  ) {
    throw new Error(
      "Stagione non disponibile.",
    );
  }

  if (
    !competitionId.trim()
  ) {
    throw new Error(
      "Competizione non disponibile.",
    );
  }

  if (
    !/^\d{4}-\d{2}$/.test(
      month,
    )
  ) {
    throw new Error(
      "Seleziona un mese valido.",
    );
  }

  if (
    !imageUrl.trim()
  ) {
    throw new Error(
      "Carica un'immagine.",
    );
  }

  if (
    !Number.isInteger(
      order,
    ) ||
    order <
      1
  ) {
    throw new Error(
      "L'ordine deve essere un numero intero maggiore o uguale a 1.",
    );
  }
}

/*
 * ============================================================
 * REPOSITORY
 * ============================================================
 */

export const FirebaseBestOfTheMonthRepository =
  {
    /*
     * ========================================================
     * PUBBLICO
     * ========================================================
     *
     * La query Firestore legge esclusivamente documenti
     * pubblicati, coerentemente con le Security Rules.
     * Stagione e competizione vengono poi filtrate lato client.
     * ========================================================
     */

    subscribePublishedBySeason({
      seasonId,
      competitionId,
      onChange,
      onError,
    }: {
      seasonId:
        string;

      competitionId:
        string;

      onChange:
        (
          items:
            BestOfTheMonthItem[],
        ) => void;

      onError?:
        (
          error:
            Error,
        ) => void;
    }): Unsubscribe {
      const publishedQuery =
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
        );

      return onSnapshot(
        publishedQuery,

        (
          snapshot,
        ) => {
          const items =
            snapshot.docs
              .map(
                (
                  currentDocument,
                ) =>
                  mapDocument(
                    currentDocument.id,
                    currentDocument.data(),
                  ),
              )
              .filter(
                (
                  item,
                ) =>
                  item.seasonId ===
                    seasonId &&
                  item.competitionId ===
                    competitionId,
              );

          onChange(
            sortItems(
              items,
            ),
          );
        },

        (
          currentError,
        ) => {
          console.error(
            "Errore caricamento Best Of The Month:",
            currentError,
          );

          onError?.(
            currentError,
          );
        },
      );
    },

    /*
     * ========================================================
     * ADMIN
     * ========================================================
     */

    subscribeAdminBySeason({
      seasonId,
      onChange,
      onError,
    }: {
      seasonId:
        string;

      onChange:
        (
          items:
            BestOfTheMonthItem[],
        ) => void;

      onError?:
        (
          error:
            Error,
        ) => void;
    }): Unsubscribe {
      return onSnapshot(
        collection(
          db,
          COLLECTION_NAME,
        ),

        (
          snapshot,
        ) => {
          const items =
            snapshot.docs
              .map(
                (
                  currentDocument,
                ) =>
                  mapDocument(
                    currentDocument.id,
                    currentDocument.data(),
                  ),
              )
              .filter(
                (
                  item,
                ) =>
                  item.seasonId ===
                    seasonId,
              );

          onChange(
            sortItems(
              items,
            ),
          );
        },

        (
          currentError,
        ) => {
          console.error(
            "Errore caricamento Admin Best Of The Month:",
            currentError,
          );

          onError?.(
            currentError,
          );
        },
      );
    },

    /*
     * ========================================================
     * CREATE
     * ========================================================
     */

    async create(
      input:
        CreateBestOfTheMonthItemInput,
    ): Promise<
      string
    > {
      assertValidItemData({
        seasonId:
          input.seasonId,

        competitionId:
          input.competitionId,

        month:
          input.month,

        imageUrl:
          input.imageUrl,

        order:
          input.order,
      });

      const reference =
        await addDoc(
          collection(
            db,
            COLLECTION_NAME,
          ),

          {
            seasonId:
              input.seasonId,

            competitionId:
              input.competitionId,

            month:
              input.month,

            title:
              input.title
                ?.trim() ||
              "",

            imageUrl:
              input.imageUrl.trim(),

            imageKey:
              input.imageKey
                ?.trim() ||
              "",

            order:
              input.order,

            status:
              input.status,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),

            publishedAt:
              input.status ===
              "published"
                ? serverTimestamp()
                : null,
          },
        );

      return reference.id;
    },

    /*
     * ========================================================
     * UPDATE
     * ========================================================
     */

    async update(
      input:
        UpdateBestOfTheMonthItemInput,
    ): Promise<
      void
    > {
      if (
        !input.itemId.trim()
      ) {
        throw new Error(
          "Elemento Best Of The Month non valido.",
        );
      }

      assertValidItemData({
        seasonId:
          "existing",

        competitionId:
          "championship",

        month:
          input.month,

        imageUrl:
          input.imageUrl,

        order:
          input.order,
      });

      await updateDoc(
        doc(
          db,
          COLLECTION_NAME,
          input.itemId,
        ),

        {
          month:
            input.month,

          title:
            input.title
              ?.trim() ||
            "",

          imageUrl:
            input.imageUrl.trim(),

          imageKey:
            input.imageKey
              ?.trim() ||
            "",

          order:
            input.order,

          status:
            input.status,

          updatedAt:
            serverTimestamp(),

          publishedAt:
            input.status ===
            "published"
              ? serverTimestamp()
              : null,
        },
      );
    },

    /*
     * ========================================================
     * DELETE
     * ========================================================
     */

    async remove(
      itemId:
        string,
    ): Promise<
      void
    > {
      const normalizedItemId =
        itemId.trim();

      if (
        !normalizedItemId
      ) {
        return;
      }

      await deleteDoc(
        doc(
          db,
          COLLECTION_NAME,
          normalizedItemId,
        ),
      );
    },
  };
