import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";

import {
  db,
} from "@/src/lib/firebase";

import type {
  Regulation,
  RegulationSection,
  SaveRegulationInput,
} from "@/src/types/Regulation";

const COLLECTION_NAME =
  "regulations";

/*
 * ============================================================
 * LEGACY
 * ============================================================
 *
 * Prima dell'isolamento per competizione il regolamento era
 * salvato in regulations/current.
 *
 * Manteniamo soltanto una lettura di compatibilità per la
 * Premier League. Ogni nuovo salvataggio viene invece scritto
 * nel documento della competizione.
 * ============================================================
 */

const LEGACY_DOCUMENT_ID =
  "current";

const LEGACY_COMPETITION_ID =
  "premier-league";

function normalizeCompetitionId(
  competitionId:
    string,
) {
  const normalizedCompetitionId =
    competitionId.trim();

  if (
    !normalizedCompetitionId
  ) {
    throw new Error(
      "Competizione non valida.",
    );
  }

  if (
    normalizedCompetitionId.includes(
      "/",
    )
  ) {
    throw new Error(
      "Identificativo competizione non valido.",
    );
  }

  return normalizedCompetitionId;
}

function mapTimestampToDate(
  value: unknown,
): Date | undefined {
  if (
    value &&
    typeof value ===
      "object" &&
    "toDate" in value &&
    typeof (
      value as Timestamp
    ).toDate ===
      "function"
  ) {
    return (
      value as Timestamp
    ).toDate();
  }

  return undefined;
}

function mapSections(
  value: unknown,
): RegulationSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(
      (
        currentSection,
        index,
      ): RegulationSection | null => {
        if (
          !currentSection ||
          typeof currentSection !==
            "object"
        ) {
          return null;
        }

        const data =
          currentSection as Record<
            string,
            unknown
          >;

        const title =
          typeof data.title ===
          "string"
            ? data.title.trim()
            : "";

        const content =
          typeof data.content ===
          "string"
            ? data.content.trim()
            : "";

        if (
          !title &&
          !content
        ) {
          return null;
        }

        return {
          id:
            typeof data.id ===
              "string" &&
            data.id.trim()
              ? data.id
              : `section-${index + 1}`,

          title:
            title ||
            `Sezione ${index + 1}`,

          content,

          order:
            typeof data.order ===
              "number"
              ? data.order
              : index + 1,
        };
      },
    )
    .filter(
      (
        section,
      ): section is RegulationSection =>
        section !== null,
    )
    .sort(
      (
        firstSection,
        secondSection,
      ) =>
        firstSection.order -
        secondSection.order,
    );
}

function mapDocumentToRegulation(
  documentId:
    string,

  competitionId:
    string,

  data:
    Record<string, unknown>,
): Regulation {
  return {
    id:
      documentId,

    competitionId,

    title:
      typeof data.title ===
      "string"
        ? data.title
        : "Regolamento ufficiale",

    sections:
      mapSections(
        data.sections,
      ),

    status:
      data.status ===
      "published"
        ? "published"
        : "draft",

    createdAt:
      mapTimestampToDate(
        data.createdAt,
      ),

    updatedAt:
      mapTimestampToDate(
        data.updatedAt,
      ),

    publishedAt:
      mapTimestampToDate(
        data.publishedAt,
      ),
  };
}

function normalizeSections(
  sections:
    RegulationSection[],
): RegulationSection[] {
  return sections
    .map(
      (
        section,
        index,
      ): RegulationSection => ({
        id:
          section.id.trim() ||
          `section-${index + 1}`,

        title:
          section.title.trim() ||
          `Sezione ${index + 1}`,

        content:
          section.content.trim(),

        order:
          index + 1,
      }),
    )
    .filter(
      (
        section,
      ) =>
        section.title.length >
          0 ||
        section.content.length >
          0,
    );
}

async function getLegacyPremierLeagueRegulation(): Promise<
  Regulation | undefined
> {
  const snapshot =
    await getDoc(
      doc(
        db,
        COLLECTION_NAME,
        LEGACY_DOCUMENT_ID,
      ),
    );

  if (
    !snapshot.exists()
  ) {
    return undefined;
  }

  return mapDocumentToRegulation(
    snapshot.id,
    LEGACY_COMPETITION_ID,
    snapshot.data(),
  );
}

export const FirebaseRegulationRepository =
  {
    async getByCompetition(
      competitionId:
        string,
    ): Promise<
      Regulation | undefined
    > {
      const normalizedCompetitionId =
        normalizeCompetitionId(
          competitionId,
        );

      const snapshot =
        await getDoc(
          doc(
            db,
            COLLECTION_NAME,
            normalizedCompetitionId,
          ),
        );

      if (
        snapshot.exists()
      ) {
        return mapDocumentToRegulation(
          snapshot.id,
          normalizedCompetitionId,
          snapshot.data(),
        );
      }

      if (
        normalizedCompetitionId ===
        LEGACY_COMPETITION_ID
      ) {
        return getLegacyPremierLeagueRegulation();
      }

      return undefined;
    },

    subscribeByCompetition(
      competitionId:
        string,

      onChange: (
        regulation:
          | Regulation
          | undefined,
      ) => void,

      onError?: (
        error:
          Error,
      ) => void,
    ): Unsubscribe {
      const normalizedCompetitionId =
        normalizeCompetitionId(
          competitionId,
        );

      let isClosed =
        false;

      const unsubscribe =
        onSnapshot(
          doc(
            db,
            COLLECTION_NAME,
            normalizedCompetitionId,
          ),

          (
            snapshot,
          ) => {
            if (
              snapshot.exists()
            ) {
              onChange(
                mapDocumentToRegulation(
                  snapshot.id,
                  normalizedCompetitionId,
                  snapshot.data(),
                ),
              );

              return;
            }

            if (
              normalizedCompetitionId !==
              LEGACY_COMPETITION_ID
            ) {
              onChange(
                undefined,
              );

              return;
            }

            void getLegacyPremierLeagueRegulation()
              .then(
                (
                  legacyRegulation,
                ) => {
                  if (
                    !isClosed
                  ) {
                    onChange(
                      legacyRegulation,
                    );
                  }
                },
              )
              .catch(
                (
                  error:
                    unknown,
                ) => {
                  if (
                    isClosed
                  ) {
                    return;
                  }

                  const normalizedError =
                    error instanceof Error
                      ? error
                      : new Error(
                          "Impossibile caricare il regolamento precedente.",
                        );

                  console.error(
                    "Errore caricamento regolamento legacy:",
                    normalizedError,
                  );

                  onError?.(
                    normalizedError,
                  );
                },
              );
          },

          (
            error,
          ) => {
            console.error(
              "Errore caricamento regolamento:",
              error,
            );

            onError?.(
              error,
            );
          },
        );

      return () => {
        isClosed =
          true;

        unsubscribe();
      };
    },

    async save(
      competitionId:
        string,

      input:
        SaveRegulationInput,
    ): Promise<void> {
      const normalizedCompetitionId =
        normalizeCompetitionId(
          competitionId,
        );

      const normalizedTitle =
        input.title.trim();

      if (
        normalizedTitle.length <
        3
      ) {
        throw new Error(
          "Inserisci un titolo valido per il regolamento.",
        );
      }

      const reference =
        doc(
          db,
          COLLECTION_NAME,
          normalizedCompetitionId,
        );

      const existingDocument =
        await getDoc(
          reference,
        );

      const regulationData: Record<
        string,
        unknown
      > = {
        competitionId:
          normalizedCompetitionId,

        title:
          normalizedTitle,

        sections:
          normalizeSections(
            input.sections,
          ),

        status:
          input.status,

        updatedAt:
          serverTimestamp(),
      };

      if (
        !existingDocument.exists()
      ) {
        regulationData.createdAt =
          serverTimestamp();
      }

      if (
        input.status ===
        "published"
      ) {
        regulationData.publishedAt =
          serverTimestamp();
      }

      await setDoc(
        reference,
        regulationData,
        {
          merge:
            true,
        },
      );
    },

    async publish(
      competitionId:
        string,

      input:
        Omit<
          SaveRegulationInput,
          "status"
        >,
    ): Promise<void> {
      await this.save(
        competitionId,
        {
          ...input,

          status:
            "published",
        },
      );
    },

    async saveDraft(
      competitionId:
        string,

      input:
        Omit<
          SaveRegulationInput,
          "status"
        >,
    ): Promise<void> {
      await this.save(
        competitionId,
        {
          ...input,

          status:
            "draft",
        },
      );
    },
  };
