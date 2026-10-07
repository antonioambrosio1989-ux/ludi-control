import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import {
  assertSeasonWritable,
} from "@/src/services/season/SeasonWriteGuard";

import {
  buildYouTubeCoverUrl,
  extractYouTubeVideoId,
} from "@/src/services/video/YouTubeUtils";

import type {
  CreateVideoItemInput,
  VideoItem,
  VideoSection,
  UpdateVideoItemInput,
} from "@/src/types/VideoItem";

/*
 * Manteniamo la collection esistente
 * per non perdere i dati già caricati.
 */
const COLLECTION_NAME =
  "video";

type FirestoreDocument = {
  id: string;

  data: () => Record<
    string,
    unknown
  >;
};

function normalizeOptionalString(
  value: unknown,
): string | undefined {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return undefined;
  }

  return value.trim();
}

function normalizeMatchweek(
  value: unknown,
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return Math.max(
      0,
      Math.trunc(value),
    );
  }

  if (
    typeof value === "string" &&
    value.trim()
  ) {
    const parsed =
      Number(value);

    if (
      Number.isFinite(parsed)
    ) {
      return Math.max(
        0,
        Math.trunc(parsed),
      );
    }
  }

  return 0;
}

function mapDocument(
  document: FirestoreDocument,
): VideoItem {
  const data =
    document.data();

  const section: VideoSection =
  data.section === "ludi-tv"
    ? "ludi-tv"
    : "video"; 

  /*
   * Compatibilità URL:
   *
   * nuovo:
   * youtubeUrl
   *
   * vecchio:
   * videoUrl
   */
  const storedUrl =
    normalizeOptionalString(
      data.youtubeUrl,
    ) ??
    normalizeOptionalString(
      data.videoUrl,
    ) ??
    "";

  const storedVideoId =
    normalizeOptionalString(
      data.youtubeVideoId,
    );

  const extractedVideoId =
    extractYouTubeVideoId(
      storedUrl,
    );

  const youtubeVideoId =
    storedVideoId ??
    extractedVideoId ??
    "";

  const matchweek =
    normalizeMatchweek(
      data.matchweek,
    );

  /*
   * Compatibilità vecchi documenti:
   * se contentType non esiste,
   * erano Goal Parade.
   */
  const contentType =
    normalizeOptionalString(
      data.contentType,
    ) ??
    normalizeOptionalString(
      data.type,
    ) ??
    "Goal Parade";

  const storedTitle =
    normalizeOptionalString(
      data.title,
    );

  const title =
    storedTitle ??
    (
      matchweek > 0 &&
      contentType ===
        "Goal Parade"
        ? `Goal Parade MW ${matchweek}`
        : undefined
    );

  const customCoverUrl =
    normalizeOptionalString(
      data.coverUrl,
    );

  return {
    id:
      document.id,

    seasonId:
      typeof data.seasonId ===
      "string"
        ? data.seasonId
        : "",

    section,

    contentType,

    title,

    youtubeUrl:
      storedUrl,

    youtubeVideoId,

    coverUrl:
      customCoverUrl ??
      (
        youtubeVideoId
          ? buildYouTubeCoverUrl(
              youtubeVideoId,
            )
          : undefined
      ),

    coverKey:
      normalizeOptionalString(
        data.coverKey,
      ),

    status:
      data.status ===
      "published"
        ? "published"
        : "draft",

    /*
     * Solo compatibilità legacy.
     */
    matchweek,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,

    publishedAt:
      data.publishedAt,
  };
}

function getTimestampValue(
  value: unknown,
): number {
  if (
    value &&
    typeof value ===
      "object" &&
    "toMillis" in value &&
    typeof (
      value as {
        toMillis?: unknown;
      }
    ).toMillis ===
      "function"
  ) {
    return (
      value as {
        toMillis: () => number;
      }
    ).toMillis();
  }

  return 0;
}

function sortLatest(
  items: VideoItem[],
): VideoItem[] {
  return items
    .slice()
    .sort(
      (
        first,
        second,
      ) => {
        const secondTime =
          getTimestampValue(
            second.updatedAt,
          ) ||
          getTimestampValue(
            second.createdAt,
          );

        const firstTime =
          getTimestampValue(
            first.updatedAt,
          ) ||
          getTimestampValue(
            first.createdAt,
          );

        if (
          secondTime !==
          firstTime
        ) {
          return (
            secondTime -
            firstTime
          );
        }

        /*
         * I vecchi contenuti possono
         * ancora sfruttare la matchweek
         * come fallback.
         */
        return (
          second.matchweek -
          first.matchweek
        );
      },
    );
}

function validateVideoInput({
  seasonId,
  section,
  contentType,
  youtubeUrl,
  youtubeVideoId,
}: {
  seasonId: string;

  section: VideoSection;

  contentType: string;

  youtubeUrl: string;

  youtubeVideoId: string;
}) {
  if (!seasonId.trim()) {
    throw new Error(
      "Seleziona una stagione.",
    );
  }

  if (
  section !== "video" &&
  section !== "ludi-tv"
) {
  throw new Error(
    "La sezione video non è valida.",
  );
}

  if (
    contentType.trim().length <
    2
  ) {
    throw new Error(
      "Inserisci il tipo di contenuto.",
    );
  }

  const extractedVideoId =
    extractYouTubeVideoId(
      youtubeUrl,
    );

  if (!extractedVideoId) {
    throw new Error(
      "Inserisci un link YouTube valido.",
    );
  }

  if (
    youtubeVideoId &&
    youtubeVideoId !==
      extractedVideoId
  ) {
    throw new Error(
      "L’ID del video non corrisponde al link YouTube inserito.",
    );
  }

  return {
    normalizedContentType:
      contentType.trim(),

    normalizedUrl:
      youtubeUrl.trim(),

    normalizedVideoId:
      extractedVideoId,
  };
}

async function getById(
  itemId: string,
): Promise<
  VideoItem | undefined
> {
  const snapshot =
    await getDoc(
      doc(
        db,
        COLLECTION_NAME,
        itemId,
      ),
    );

  if (
    !snapshot.exists()
  ) {
    return undefined;
  }

  return mapDocument({
    id:
      snapshot.id,

    data: () =>
      snapshot.data(),
  });
}

export const FirebaseVideoRepository =
  {
    subscribePublishedBySeason(
      seasonId: string,

      section:
      VideoSection,

      onChange: (
        items:
          VideoItem[],
      ) => void,

      onError?: (
        error: Error,
      ) => void,
    ): Unsubscribe {
      const videoQuery =
        query(
          collection(
            db,
            COLLECTION_NAME,
          ),

          where(
            "seasonId",
            "==",
            seasonId,
          ),

          where(
            "status",
            "==",
            "published",
          ),
        );

      return onSnapshot(
        videoQuery,

        (snapshot) => {
          const items =
  snapshot.docs
    .map(
      mapDocument,
    )
    .filter(
      (item) =>
        item.status ===
          "published" &&
        item.section ===
          section,
    );

          onChange(
            sortLatest(
              items,
            ),
          );
        },

        (error) => {
          console.error(
            "Errore listener pubblico Video:",
            error,
          );

          onError?.(
            error,
          );
        },
      );
    },

    subscribeAllBySeason(
  seasonId: string,

  section:
    VideoSection,

  onChange: (
    items:
      VideoItem[],
  ) => void,

      onError?: (
        error: Error,
      ) => void,
    ): Unsubscribe {
      const videoQuery =
        query(
          collection(
            db,
            COLLECTION_NAME,
          ),

          where(
            "seasonId",
            "==",
            seasonId,
          ),
        );

      return onSnapshot(
        videoQuery,

        (snapshot) => {
          const items =
  snapshot.docs
    .map(
      mapDocument,
    )
    .filter(
      (item) =>
        item.section ===
        section,
    );

          onChange(
            sortLatest(
              items,
            ),
          );
        },

        (error) => {
          console.error(
            "Errore listener admin Video:",
            error,
          );

          onError?.(
            error,
          );
        },
      );
    },

    async getById(
      itemId: string,
    ): Promise<
      VideoItem |
      undefined
    > {
      return getById(
        itemId,
      );
    },

    async create(
      input:
        CreateVideoItemInput,
    ): Promise<string> {
      await assertSeasonWritable(
        input.seasonId,
      );

      const {
        normalizedContentType,
        normalizedUrl,
        normalizedVideoId,
      } =
        validateVideoInput({
          seasonId:
            input.seasonId,

          section:
             input.section,

          contentType:
            input.contentType,

          youtubeUrl:
            input.youtubeUrl,

          youtubeVideoId:
            input.youtubeVideoId,
        });

      const normalizedCoverUrl =
        input.coverUrl
          ?.trim() ||
        buildYouTubeCoverUrl(
          normalizedVideoId,
        );

      const reference =
        await addDoc(
          collection(
            db,
            COLLECTION_NAME,
          ),

          {
            seasonId:
              input.seasonId,

            section:
              input.section,

            contentType:
              normalizedContentType,

            title:
              input.title
                ?.trim() ||
              null,

            /*
             * Legacy.
             */
            matchweek:
              input.matchweek ??
              0,

            youtubeUrl:
              normalizedUrl,

            youtubeVideoId:
              normalizedVideoId,

            coverUrl:
              normalizedCoverUrl,

            coverKey:
              input.coverKey ??
              null,

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

    async update(
      input:
        UpdateVideoItemInput,
    ): Promise<void> {
      const existingItem =
        await getById(
          input.itemId,
        );

      if (!existingItem) {
        throw new Error(
          "Il video selezionato non esiste.",
        );
      }

      await assertSeasonWritable(
        existingItem.seasonId,
      );

      if (
        input.seasonId !==
        existingItem.seasonId
      ) {
        await assertSeasonWritable(
          input.seasonId,
        );
      }

      const {
        normalizedContentType,
        normalizedUrl,
        normalizedVideoId,
      } =
        validateVideoInput({
          seasonId:
            input.seasonId,

          section:
            input.section,

          contentType:
            input.contentType,

          youtubeUrl:
            input.youtubeUrl,

          youtubeVideoId:
            input.youtubeVideoId,
        });

      const normalizedCoverUrl =
        input.coverUrl
          ?.trim() ||
        buildYouTubeCoverUrl(
          normalizedVideoId,
        );

      const wasPublished =
        existingItem.status ===
        "published";

      await updateDoc(
        doc(
          db,
          COLLECTION_NAME,
          input.itemId,
        ),

        {
          seasonId:
            input.seasonId,

          section:
            input.section,

          contentType:
            normalizedContentType,

          title:
            input.title
              ?.trim() ||
            null,

          /*
           * Manteniamo la vecchia
           * matchweek se il contenuto
           * proveniva dal sistema
           * precedente.
           */
          matchweek:
            input.matchweek ??
            existingItem.matchweek ??
            0,

          youtubeUrl:
            normalizedUrl,

          youtubeVideoId:
            normalizedVideoId,

          coverUrl:
            normalizedCoverUrl,

          coverKey:
            input.coverKey ??
            null,

          status:
            input.status,

          updatedAt:
            serverTimestamp(),

          publishedAt:
            input.status ===
            "published"
              ? wasPublished
                ? existingItem
                    .publishedAt ??
                  serverTimestamp()
                : serverTimestamp()
              : null,
        },
      );
    },

    async remove(
      itemId: string,
    ): Promise<void> {
      const existingItem =
        await getById(
          itemId,
        );

      if (!existingItem) {
        throw new Error(
          "Il video selezionato non esiste.",
        );
      }

      await assertSeasonWritable(
        existingItem.seasonId,
      );

      await deleteDoc(
        doc(
          db,
          COLLECTION_NAME,
          itemId,
        ),
      );
    },
  };