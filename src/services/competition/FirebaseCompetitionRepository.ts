import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";

import {
  db,
} from "@/src/lib/firebase";

import type {
  Competition,
  CompetitionFeatures,
  CompetitionStatus,
  CreateCompetitionInput,
  UpdateCompetitionInput,
} from "@/src/types/Competition";

/*
 * ============================================================
 * CONFIGURAZIONE
 * ============================================================
 */

const COLLECTION_NAME =
  "competitions";

const DEFAULT_FEATURES:
  CompetitionFeatures = {
  ludiTv: false,
  ludiWeek: false,
  canvaStudio: false,
};

/*
 * ============================================================
 * NORMALIZZAZIONE
 * ============================================================
 */

function normalizeCompetitionId(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    );
}

function getOptionalString(
  value: unknown,
): string | undefined {
  return typeof value === "string" &&
    value.trim()
    ? value.trim()
    : undefined;
}

function getCompetitionStatus(
  value: unknown,
): CompetitionStatus {
  return value === "inactive"
    ? "inactive"
    : "active";
}

function getCompetitionFeatures(
  value: unknown,
): CompetitionFeatures {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return {
      ...DEFAULT_FEATURES,
    };
  }

  const features =
    value as Record<
      string,
      unknown
    >;

  return {
    ludiTv:
      features.ludiTv === true,

    ludiWeek:
      features.ludiWeek === true,

    canvaStudio:
      features.canvaStudio ===
      true,
  };
}

/*
 * ============================================================
 * MAPPING FIRESTORE
 * ============================================================
 */

function mapDocumentToCompetition(
  documentId: string,
  data: Record<string, unknown>,
): Competition {
  return {
    id:
      documentId,

    name:
      typeof data.name === "string" &&
      data.name.trim()
        ? data.name.trim()
        : documentId,

    shortName:
      typeof data.shortName ===
        "string" &&
      data.shortName.trim()
        ? data.shortName.trim()
        : documentId,

    status:
      getCompetitionStatus(
        data.status,
      ),

    primaryColor:
      getOptionalString(
        data.primaryColor,
      ),

    secondaryColor:
      getOptionalString(
        data.secondaryColor,
      ),

    textColor:
  getOptionalString(
    data.textColor,
  ),

    logoUrl:
      getOptionalString(
        data.logoUrl,
      ),

    features:
      getCompetitionFeatures(
        data.features,
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

export const FirebaseCompetitionRepository = {
  /*
   * ==========================================================
   * LETTURA
   * ==========================================================
   */

  async getAll():
    Promise<Competition[]> {
    const snapshot =
      await getDocs(
        collection(
          db,
          COLLECTION_NAME,
        ),
      );

    return snapshot.docs
      .map(
        (
          currentDocument,
        ) =>
          mapDocumentToCompetition(
            currentDocument.id,
            currentDocument.data(),
          ),
      )
      .sort(
        (
          firstCompetition,
          secondCompetition,
        ) =>
          firstCompetition.name.localeCompare(
            secondCompetition.name,
            "it",
          ),
      );
  },

  async getById(
    competitionId: string,
  ): Promise<
    Competition | undefined
  > {
    const normalizedId =
      normalizeCompetitionId(
        competitionId,
      );

    if (!normalizedId) {
      return undefined;
    }

    const snapshot =
      await getDoc(
        doc(
          db,
          COLLECTION_NAME,
          normalizedId,
        ),
      );

    if (!snapshot.exists()) {
      return undefined;
    }

    return mapDocumentToCompetition(
      snapshot.id,
      snapshot.data(),
    );
  },

  /*
   * ==========================================================
   * SOTTOSCRIZIONE
   * ==========================================================
   */

  subscribeAll(
    onChange: (
      competitions:
        Competition[],
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
        const competitions =
          snapshot.docs
            .map(
              (
                currentDocument,
              ) =>
                mapDocumentToCompetition(
                  currentDocument.id,
                  currentDocument.data(),
                ),
            )
            .sort(
              (
                firstCompetition,
                secondCompetition,
              ) =>
                firstCompetition.name.localeCompare(
                  secondCompetition.name,
                  "it",
                ),
            );

        onChange(
          competitions,
        );
      },

      (error) => {
        console.error(
          "Errore caricamento competizioni:",
          error,
        );

        onError?.(
          error,
        );
      },
    );
  },

  /*
   * ==========================================================
   * CREAZIONE
   * ==========================================================
   */

  async create(
    input:
      CreateCompetitionInput,
  ): Promise<Competition> {
    const id =
      normalizeCompetitionId(
        input.id,
      );

    if (!id) {
      throw new Error(
        "Inserisci un identificativo valido per la competizione.",
      );
    }

    const name =
      input.name.trim();

    if (!name) {
      throw new Error(
        "Inserisci il nome della competizione.",
      );
    }

    const shortName =
      input.shortName.trim();

    if (!shortName) {
      throw new Error(
        "Inserisci il nome breve della competizione.",
      );
    }

    const reference =
      doc(
        db,
        COLLECTION_NAME,
        id,
      );

    const existing =
      await getDoc(
        reference,
      );

    if (existing.exists()) {
      throw new Error(
        "Questa competizione esiste già.",
      );
    }

    const features:
      CompetitionFeatures = {
      ...DEFAULT_FEATURES,
      ...input.features,
    };

    const competition:
      Competition = {
      id,

      name,

      shortName,

      status:
        "active",

      primaryColor:
        input.primaryColor
          ?.trim() ||
        undefined,

      secondaryColor:
        input.secondaryColor
          ?.trim() ||
        undefined,

      textColor:
  input.textColor
    ?.trim() ||
  undefined,

      logoUrl:
        input.logoUrl
          ?.trim() ||
        undefined,

      features,
    };

    await setDoc(
      reference,
      {
        ...competition,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      },
    );

    return competition;
  },

  /*
   * ==========================================================
   * AGGIORNAMENTO
   * ==========================================================
   */

  async update(
    input:
      UpdateCompetitionInput,
  ): Promise<void> {
    const competitionId =
      normalizeCompetitionId(
        input.competitionId,
      );

    if (!competitionId) {
      throw new Error(
        "Competizione non valida.",
      );
    }

    const name =
      input.name.trim();

    const shortName =
      input.shortName.trim();

    if (!name) {
      throw new Error(
        "Inserisci il nome della competizione.",
      );
    }

    if (!shortName) {
      throw new Error(
        "Inserisci il nome breve della competizione.",
      );
    }

    await updateDoc(
      doc(
        db,
        COLLECTION_NAME,
        competitionId,
      ),

      {
        name,

        shortName,

        status:
          input.status,

        primaryColor:
          input.primaryColor
            ?.trim() ||
          null,

        secondaryColor:
          input.secondaryColor
            ?.trim() ||
          null,

        textColor:
  input.textColor
    ?.trim() ||
  null,

        logoUrl:
          input.logoUrl
            ?.trim() ||
          null,

        features:
          input.features,

        updatedAt:
          serverTimestamp(),
      },
    );
  },
};