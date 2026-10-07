import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  where,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import {
  db,
} from "@/src/lib/firebase";

import type {
  CreateSponsorInput,
  Sponsor,
  SponsorSocialPlatform,
  UpdateSponsorInput,
} from "@/src/types/Sponsor";

const COLLECTION_NAME =
  "sponsors";

const SOCIAL_PLATFORMS =
  new Set<SponsorSocialPlatform>([
    "instagram",
    "facebook",
    "tiktok",
  ]);

function mapSponsor(
  snapshot:
    QueryDocumentSnapshot<DocumentData>,
): Sponsor {
  const data =
    snapshot.data();

  const rawPlatform =
    data.socialPlatform;

  return {
    id:
      snapshot.id,

    competitionId:
      typeof data.competitionId ===
      "string"
        ? data.competitionId
        : "",

    name:
      typeof data.name ===
      "string"
        ? data.name
        : "Sponsor",

    imageUrl:
      typeof data.imageUrl ===
      "string"
        ? data.imageUrl
        : "",

    storagePath:
      typeof data.storagePath ===
      "string"
        ? data.storagePath
        : undefined,

    socialPlatform:
      typeof rawPlatform ===
        "string" &&
      SOCIAL_PLATFORMS.has(
        rawPlatform as
          SponsorSocialPlatform,
      )
        ? (
            rawPlatform as
              SponsorSocialPlatform
          )
        : "instagram",

    socialUrl:
      typeof data.socialUrl ===
      "string"
        ? data.socialUrl
        : "",

    sortOrder:
      typeof data.sortOrder ===
        "number" &&
      Number.isFinite(
        data.sortOrder,
      )
        ? data.sortOrder
        : 0,

    active:
      data.active !==
      false,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

function sortSponsors(
  sponsors:
    Sponsor[],
) {
  return [
    ...sponsors,
  ].sort(
    (
      first,
      second,
    ) => {
      const orderDifference =
        first.sortOrder -
        second.sortOrder;

      if (
        orderDifference !==
        0
      ) {
        return orderDifference;
      }

      return first.name.localeCompare(
        second.name,
        "it",
        {
          sensitivity:
            "base",
        },
      );
    },
  );
}

export const FirebaseSponsorRepository = {
  subscribeByCompetition(
    competitionId:
      string,
    onChange:
      (
        sponsors:
          Sponsor[],
      ) => void,
    onError?:
      (
        error:
          Error,
      ) => void,
  ): Unsubscribe {
    const normalizedCompetitionId =
      competitionId.trim();

    if (
      !normalizedCompetitionId
    ) {
      onChange(
        [],
      );

      return () => {};
    }

    const sponsorsQuery =
      query(
        collection(
          db,
          COLLECTION_NAME,
        ),
        where(
          "competitionId",
          "==",
          normalizedCompetitionId,
        ),
      );

    return onSnapshot(
      sponsorsQuery,
      (
        snapshot,
      ) => {
        onChange(
          sortSponsors(
            snapshot.docs.map(
              mapSponsor,
            ),
          ),
        );
      },
      (
        currentError,
      ) => {
        console.error(
          "Errore caricamento sponsor:",
          currentError,
        );

        onError?.(
          currentError,
        );
      },
    );
  },

  async create(
    input:
      CreateSponsorInput,
  ): Promise<string> {
    validateSponsorInput(
      input,
    );

    const document =
      await addDoc(
        collection(
          db,
          COLLECTION_NAME,
        ),
        {
          ...input,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
      );

    return document.id;
  },

  async update(
    sponsorId:
      string,
    input:
      UpdateSponsorInput,
  ): Promise<void> {
    const normalizedId =
      sponsorId.trim();

    if (
      !normalizedId
    ) {
      throw new Error(
        "Sponsor non valido.",
      );
    }

    if (
      input.socialUrl !==
        undefined
    ) {
      assertValidSocialUrl(
        input.socialUrl,
      );
    }

    if (
      input.name !==
        undefined &&
      !input.name.trim()
    ) {
      throw new Error(
        "Inserisci il nome dello sponsor.",
      );
    }

    await updateDoc(
      doc(
        db,
        COLLECTION_NAME,
        normalizedId,
      ),
      {
        ...input,

        updatedAt:
          serverTimestamp(),
      },
    );
  },

  async delete(
    sponsorId:
      string,
  ): Promise<void> {
    const normalizedId =
      sponsorId.trim();

    if (
      !normalizedId
    ) {
      return;
    }

    await deleteDoc(
      doc(
        db,
        COLLECTION_NAME,
        normalizedId,
      ),
    );
  },
};

function validateSponsorInput(
  input:
    CreateSponsorInput,
) {
  if (
    !input.competitionId.trim()
  ) {
    throw new Error(
      "Competizione non valida.",
    );
  }

  if (
    !input.name.trim()
  ) {
    throw new Error(
      "Inserisci il nome dello sponsor.",
    );
  }

  if (
    !input.imageUrl.trim()
  ) {
    throw new Error(
      "Carica l'immagine dello sponsor.",
    );
  }

  if (
    !SOCIAL_PLATFORMS.has(
      input.socialPlatform,
    )
  ) {
    throw new Error(
      "Seleziona un social valido.",
    );
  }

  assertValidSocialUrl(
    input.socialUrl,
  );
}

function assertValidSocialUrl(
  socialUrl:
    string,
) {
  const normalizedUrl =
    socialUrl.trim();

  if (
    !normalizedUrl
  ) {
    throw new Error(
      "Inserisci il link della pagina social.",
    );
  }

  let parsedUrl:
    URL;

  try {
    parsedUrl =
      new URL(
        normalizedUrl,
      );
  } catch {
    throw new Error(
      "Inserisci un link social valido.",
    );
  }

  if (
    parsedUrl.protocol !==
      "https:" &&
    parsedUrl.protocol !==
      "http:"
  ) {
    throw new Error(
      "Il link social deve iniziare con https:// o http://.",
    );
  }
}
