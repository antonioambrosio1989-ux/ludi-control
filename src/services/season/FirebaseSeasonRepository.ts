import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  type DocumentReference,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import type {
  CreateSeasonInput,
  Season,
} from "@/src/types/Season";

const SEASONS_COLLECTION = "seasons";
const SETTINGS_COLLECTION = "settings";
const GENERAL_SETTINGS_ID = "general";

function createSeasonId(
  startYear: number,
  endYear: number,
  competitionId?: string,
) {
  const seasonCode =
    `${startYear}-${String(endYear).slice(-2)}`;

  if (!competitionId) {
    /*
     * Compatibilità con le stagioni legacy.
     */
    return seasonCode;
  }

  return `${competitionId}_${seasonCode}`;
}

function mapSeason(
  documentId: string,
  data: Record<string, unknown>,
): Season {
  const rawStatus = data.status;

  const status: Season["status"] =
    rawStatus === "active" ||
    rawStatus === "completed"
      ? rawStatus
      : "draft";

  return {
    id: documentId,

    competitionId:
  typeof data.competitionId ===
    "string" &&
  data.competitionId.trim()
    ? data.competitionId.trim()
    : undefined,

    name:
      typeof data.name === "string"
        ? data.name
        : documentId,

    startYear:
      typeof data.startYear === "number"
        ? data.startYear
        : 0,

    endYear:
      typeof data.endYear === "number"
        ? data.endYear
        : 0,

    status,

    isCurrent:
      typeof data.isCurrent === "boolean"
        ? data.isCurrent
        : false,

    regularSeasonClosed:
  typeof data.regularSeasonClosed ===
  "boolean"
    ? data.regularSeasonClosed
    : false,

finalStageClosed:
  typeof data.finalStageClosed ===
  "boolean"
    ? data.finalStageClosed
    : false,
  };
}

async function getSeasonReferences(): Promise<
  DocumentReference[]
> {
  const snapshot = await getDocs(
    collection(
      db,
      SEASONS_COLLECTION,
    ),
  );

  return snapshot.docs.map(
    (seasonDocument) =>
      seasonDocument.ref,
  );
}

export const FirebaseSeasonRepository = {
  subscribeAll(
    onChange: (seasons: Season[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      collection(
        db,
        SEASONS_COLLECTION,
      ),

      (snapshot) => {
        const seasons =
          snapshot.docs.map(
            (currentDocument) =>
              mapSeason(
                currentDocument.id,
                currentDocument.data(),
              ),
          );

        seasons.sort(
          (first, second) =>
            second.startYear -
            first.startYear,
        );

        onChange(seasons);
      },

      (error) => {
        console.error(
          "Errore caricamento stagioni:",
          error,
        );

        onError?.(error);
      },
    );
  },

  async getCurrent(): Promise<
  Season | undefined
> {
  const snapshot =
    await getDocs(
      collection(
        db,
        SEASONS_COLLECTION,
      ),
    );

  const currentDocument =
    snapshot.docs.find(
      (currentSnapshot) => {
        const season =
          mapSeason(
            currentSnapshot.id,
            currentSnapshot.data(),
          );

        return (
          season.isCurrent &&
          season.status ===
            "active"
        );
      },
    );

  if (
    !currentDocument
  ) {
    return undefined;
  }

  return mapSeason(
    currentDocument.id,
    currentDocument.data(),
  );
},

  async getCurrentForCompetition(
  competitionId: string,
): Promise<
  Season | undefined
> {
  const normalizedCompetitionId =
    competitionId.trim();

  if (!normalizedCompetitionId) {
    return undefined;
  }

  const snapshot =
    await getDocs(
      collection(
        db,
        SEASONS_COLLECTION,
      ),
    );

  const currentDocument =
    snapshot.docs.find(
      (
        currentSnapshot,
      ) => {
        const season =
          mapSeason(
            currentSnapshot.id,
            currentSnapshot.data(),
          );

        return (
          season.competitionId ===
            normalizedCompetitionId &&
          season.isCurrent &&
          season.status ===
            "active"
        );
      },
    );

  if (!currentDocument) {
    return undefined;
  }

  return mapSeason(
    currentDocument.id,
    currentDocument.data(),
  );
},

async getAllForCompetition(
  competitionId: string,
): Promise<Season[]> {
  const normalizedCompetitionId =
    competitionId.trim();

  if (!normalizedCompetitionId) {
    return [];
  }

  const snapshot =
    await getDocs(
      collection(
        db,
        SEASONS_COLLECTION,
      ),
    );

  return snapshot.docs
    .map(
      (
        currentDocument,
      ) =>
        mapSeason(
          currentDocument.id,
          currentDocument.data(),
        ),
    )
    .filter(
      (
        season,
      ) =>
        season.competitionId ===
        normalizedCompetitionId,
    )
    .sort(
      (
        first,
        second,
      ) =>
        second.startYear -
        first.startYear,
    );
},

  async getById(
    seasonId: string,
  ): Promise<Season | undefined> {
    const snapshot = await getDoc(
      doc(
        db,
        SEASONS_COLLECTION,
        seasonId,
      ),
    );

    if (!snapshot.exists()) {
      return undefined;
    }

    return mapSeason(
      snapshot.id,
      snapshot.data(),
    );
  },

  async create(
    input: CreateSeasonInput,
  ): Promise<Season> {
    if (
  input.endYear < input.startYear ||
  input.endYear > input.startYear + 1
) {
  throw new Error(
    "L’anno finale deve coincidere con quello iniziale oppure essere quello immediatamente successivo.",
  );
}

    const name = input.name.trim();

    if (!name) {
      throw new Error(
        "Inserisci il nome della stagione.",
      );
    }

    const competitionId =
  input.competitionId
    ?.trim() ||
  undefined;

const id =
  createSeasonId(
    input.startYear,
    input.endYear,
    competitionId,
  );

    const reference = doc(
      db,
      SEASONS_COLLECTION,
      id,
    );

    const existing =
      await getDoc(reference);

    if (existing.exists()) {
      throw new Error(
        "Questa stagione esiste già.",
      );
    }

    const season: Season = {
      id,
      competitionId,
      name,
      startYear: input.startYear,
      endYear: input.endYear,
      status: "draft",
      isCurrent: false,
      regularSeasonClosed:
  false,

finalStageClosed:
  false,
    };

    await setDoc(reference, {
      ...season,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    });

    return season;
  },

  async setCurrent(
    seasonId: string,
  ): Promise<void> {
    const seasonReferences =
      await getSeasonReferences();

    const targetReference = doc(
      db,
      SEASONS_COLLECTION,
      seasonId,
    );

    await runTransaction(
      db,
      async (transaction) => {
        /*
         * Tutte le letture vengono eseguite
         * prima delle scritture.
         */
        const seasonSnapshots = [];

        for (const reference of seasonReferences) {
          const snapshot =
            await transaction.get(
              reference,
            );

          seasonSnapshots.push(
            snapshot,
          );
        }

        const targetSnapshot =
          seasonSnapshots.find(
            (snapshot) =>
              snapshot.id ===
              seasonId,
          ) ??
          (await transaction.get(
            targetReference,
          ));

        if (!targetSnapshot.exists()) {
          throw new Error(
            "La stagione selezionata non esiste.",
          );
        }

        const targetSeason =
          mapSeason(
            targetSnapshot.id,
            targetSnapshot.data(),
          );

        if (
          targetSeason.status ===
          "completed"
        ) {
          throw new Error(
            "Una stagione conclusa non può essere attivata direttamente. Devi prima riaprirla.",
          );
        }

        for (const snapshot of seasonSnapshots) {
          if (!snapshot.exists()) {
            continue;
          }

          const currentSeason =
            mapSeason(
              snapshot.id,
              snapshot.data(),
            );

          const isTarget =
            snapshot.id ===
            seasonId;

          transaction.update(
            snapshot.ref,
            {
              isCurrent: isTarget,

              status: isTarget
                ? "active"
                : currentSeason.status ===
                    "active"
                  ? "completed"
                  : currentSeason.status,

              updatedAt:
                serverTimestamp(),
            },
          );
        }

        /*
         * Gestisce anche il caso limite
         * in cui il documento scelto non
         * fosse incluso nello snapshot iniziale.
         */
        if (
          !seasonSnapshots.some(
            (snapshot) =>
              snapshot.id ===
              seasonId,
          )
        ) {
          transaction.update(
            targetReference,
            {
              isCurrent: true,
              status: "active",

              updatedAt:
                serverTimestamp(),
            },
          );
        }

        transaction.set(
          doc(
            db,
            SETTINGS_COLLECTION,
            GENERAL_SETTINGS_ID,
          ),
          {
            currentSeasonId:
              seasonId,

            updatedAt:
              serverTimestamp(),
          },
          {
            merge: true,
          },
        );
      },
    );
  },

  /*
 * ============================================================
 * STAGIONE CORRENTE PER COMPETIZIONE
 * ============================================================
 */

async setCurrentForCompetition(
  competitionId: string,
  seasonId: string,
): Promise<void> {
  const normalizedCompetitionId =
    competitionId.trim();

  if (!normalizedCompetitionId) {
    throw new Error(
      "La competizione selezionata non è valida.",
    );
  }

  const seasonReferences =
    await getSeasonReferences();

  const targetReference =
    doc(
      db,
      SEASONS_COLLECTION,
      seasonId,
    );

  await runTransaction(
    db,
    async (transaction) => {
      /*
       * ======================================================
       * LETTURE
       * ======================================================
       *
       * Firestore richiede che tutte le letture vengano
       * effettuate prima delle scritture.
       * ======================================================
       */

      const seasonSnapshots = [];

      for (
        const reference of
          seasonReferences
      ) {
        const snapshot =
          await transaction.get(
            reference,
          );

        seasonSnapshots.push(
          snapshot,
        );
      }

      /*
       * ======================================================
       * STAGIONE DA ATTIVARE
       * ======================================================
       */

      const targetSnapshot =
        seasonSnapshots.find(
          (snapshot) =>
            snapshot.id ===
            seasonId,
        ) ??
        (await transaction.get(
          targetReference,
        ));

      if (
        !targetSnapshot.exists()
      ) {
        throw new Error(
          "La stagione selezionata non esiste.",
        );
      }

      const targetSeason =
        mapSeason(
          targetSnapshot.id,
          targetSnapshot.data(),
        );

      /*
       * La stagione deve appartenere esattamente
       * alla competizione selezionata.
       */
      if (
        targetSeason.competitionId !==
        normalizedCompetitionId
      ) {
        throw new Error(
          "La stagione selezionata non appartiene a questa competizione.",
        );
      }

      if (
        targetSeason.status ===
        "completed"
      ) {
        throw new Error(
          "Una stagione conclusa non può essere attivata direttamente. Devi prima riaprirla.",
        );
      }

      /*
       * ======================================================
       * AGGIORNAMENTO
       * ======================================================
       *
       * IMPORTANTISSIMO:
       *
       * vengono modificate SOLTANTO le stagioni
       * appartenenti alla stessa competizione.
       *
       * Le stagioni delle altre competizioni
       * rimangono completamente intatte.
       * ======================================================
       */

      for (
        const snapshot of
          seasonSnapshots
      ) {
        if (
          !snapshot.exists()
        ) {
          continue;
        }

        const currentSeason =
          mapSeason(
            snapshot.id,
            snapshot.data(),
          );

        if (
          currentSeason.competitionId !==
          normalizedCompetitionId
        ) {
          continue;
        }

        const isTarget =
          snapshot.id ===
          seasonId;

        transaction.update(
          snapshot.ref,
          {
            isCurrent:
              isTarget,

            status:
              isTarget
                ? "active"
                : currentSeason.status ===
                    "active"
                  ? "completed"
                  : currentSeason.status,

            updatedAt:
              serverTimestamp(),
          },
        );
      }

      /*
       * Caso limite:
       * il documento target potrebbe non essere
       * stato presente nello snapshot iniziale.
       */
      if (
        !seasonSnapshots.some(
          (snapshot) =>
            snapshot.id ===
            seasonId,
        )
      ) {
        transaction.update(
          targetReference,
          {
            isCurrent:
              true,

            status:
              "active",

            updatedAt:
              serverTimestamp(),
          },
        );
      }
    },
  );
},

  async closeRegularSeason(
  seasonId: string,
): Promise<void> {
  const seasonReference =
    doc(
      db,
      SEASONS_COLLECTION,
      seasonId,
    );

  await runTransaction(
    db,
    async (
      transaction,
    ) => {
      const snapshot =
        await transaction.get(
          seasonReference,
        );

      if (
        !snapshot.exists()
      ) {
        throw new Error(
          "La stagione selezionata non esiste.",
        );
      }

      const season =
        mapSeason(
          snapshot.id,
          snapshot.data(),
        );

      if (
        season.status !==
        "active"
      ) {
        throw new Error(
          "Puoi chiudere la Regular Season soltanto durante una stagione attiva.",
        );
      }

      if (
        season.regularSeasonClosed
      ) {
        throw new Error(
          "La Regular Season è già stata chiusa.",
        );
      }

      transaction.update(
        seasonReference,
        {
          regularSeasonClosed:
            true,

          regularSeasonClosedAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
      );
    },
  );
},

async closeFinalStage(
  seasonId: string,
): Promise<void> {
  const seasonReference =
    doc(
      db,
      SEASONS_COLLECTION,
      seasonId,
    );

  await runTransaction(
    db,
    async (
      transaction,
    ) => {
      const snapshot =
        await transaction.get(
          seasonReference,
        );

      if (
        !snapshot.exists()
      ) {
        throw new Error(
          "La stagione selezionata non esiste.",
        );
      }

      const season =
        mapSeason(
          snapshot.id,
          snapshot.data(),
        );

      if (
        season.status !==
        "active"
      ) {
        throw new Error(
          "Puoi chiudere le fasi finali soltanto durante una stagione attiva.",
        );
      }

      if (
        !season.regularSeasonClosed
      ) {
        throw new Error(
          "Devi prima chiudere la Regular Season.",
        );
      }

      if (
        season.finalStageClosed
      ) {
        throw new Error(
          "Le fasi finali sono già state chiuse.",
        );
      }

      transaction.update(
        seasonReference,
        {
          finalStageClosed:
            true,

          finalStageClosedAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
      );
    },
  );
},

  async completeSeason(
    seasonId: string,
  ): Promise<void> {
    const seasonReference = doc(
      db,
      SEASONS_COLLECTION,
      seasonId,
    );

    await runTransaction(
      db,
      async (transaction) => {
        const snapshot =
          await transaction.get(
            seasonReference,
          );

        if (!snapshot.exists()) {
          throw new Error(
            "La stagione selezionata non esiste.",
          );
        }

        const season = mapSeason(
          snapshot.id,
          snapshot.data(),
        );

        if (
          season.status ===
          "completed"
        ) {
          throw new Error(
            "La stagione è già conclusa.",
          );
        }

        if (
          season.status !==
          "active"
        ) {
          throw new Error(
            "Puoi concludere soltanto una stagione attiva.",
          );
        }

        transaction.update(
          seasonReference,
          {
            status: "completed",
            isCurrent: false,

            completedAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          },
        );

        if (season.isCurrent) {
          transaction.set(
            doc(
              db,
              SETTINGS_COLLECTION,
              GENERAL_SETTINGS_ID,
            ),
            {
              currentSeasonId: null,

              updatedAt:
                serverTimestamp(),
            },
            {
              merge: true,
            },
          );
        }
      },
    );
  },

  async reopenSeason(
    seasonId: string,
  ): Promise<void> {
    const seasonReference = doc(
      db,
      SEASONS_COLLECTION,
      seasonId,
    );

    await runTransaction(
      db,
      async (transaction) => {
        const snapshot =
          await transaction.get(
            seasonReference,
          );

        if (!snapshot.exists()) {
          throw new Error(
            "La stagione selezionata non esiste.",
          );
        }

        const season = mapSeason(
          snapshot.id,
          snapshot.data(),
        );

        if (
          season.status !==
          "completed"
        ) {
          throw new Error(
            "Puoi riaprire soltanto una stagione conclusa.",
          );
        }

        transaction.update(
          seasonReference,
          {
            status: "draft",
            isCurrent: false,

            reopenedAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          },
        );
      },
    );
  },


  /*
   * ============================================================
   * CREA STAGIONE STORICA GIÀ CONCLUSA
   * ============================================================
   */

  async createCompleted(
    input: CreateSeasonInput,
  ): Promise<Season> {
    if (
  input.endYear < input.startYear ||
  input.endYear > input.startYear + 1
) {
  throw new Error(
    "L’anno finale deve coincidere con quello iniziale oppure essere quello immediatamente successivo.",
  );
}

    const name =
      input.name.trim();

    if (!name) {
      throw new Error(
        "Inserisci il nome della stagione.",
      );
    }

    const competitionId =
      input.competitionId
        ?.trim() ||
      undefined;

    const id =
      createSeasonId(
        input.startYear,
        input.endYear,
        competitionId,
      );

    /*
     * Impedisce di ricreare una stagione legacy salvata con un
     * vecchio document ID diverso da quello canonico attuale.
     */
    const seasonsSnapshot =
      await getDocs(
        collection(
          db,
          SEASONS_COLLECTION,
        ),
      );

    const duplicateSeason =
      seasonsSnapshot.docs.some(
        (seasonDocument) => {
          const season =
            mapSeason(
              seasonDocument.id,
              seasonDocument.data(),
            );

          return (
            season.startYear ===
              input.startYear &&
            season.endYear ===
              input.endYear &&
            normalizeCompetitionId(
              season.competitionId,
            ) ===
              normalizeCompetitionId(
                competitionId,
              )
          );
        },
      );

    if (duplicateSeason) {
      throw new Error(
        "Questa stagione esiste già.",
      );
    }

    const reference = doc(
      db,
      SEASONS_COLLECTION,
      id,
    );

    const existing =
      await getDoc(reference);

    if (existing.exists()) {
      throw new Error(
        "Questa stagione esiste già.",
      );
    }

    const season: Season = {
      id,
      competitionId,
      name,
      startYear:
        input.startYear,
      endYear:
        input.endYear,
      status:
        "completed",
      isCurrent:
        false,
      regularSeasonClosed:
        true,
      finalStageClosed:
        true,
    };

    await setDoc(
      reference,
      {
        ...season,

        completedAt:
          serverTimestamp(),

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      },
    );

    return season;
  },

  /*
   * ============================================================
   * MODIFICA METADATI STAGIONE
   * ============================================================
   *
   * L'id Firestore NON viene modificato quando cambiano gli anni.
   * Molti dati storici sono collegati tramite seasonId e cambiare
   * l'id romperebbe tali riferimenti.
   * ============================================================
   */

  async updateMetadata({
    seasonId,
    name,
    startYear,
    endYear,
  }: {
    seasonId: string;
    name: string;
    startYear: number;
    endYear: number;
  }): Promise<void> {
    const normalizedSeasonId =
      seasonId.trim();

    const normalizedName =
      name.trim();

    if (!normalizedSeasonId) {
      throw new Error(
        "Stagione non valida.",
      );
    }

    if (!normalizedName) {
      throw new Error(
        "Inserisci il nome della stagione.",
      );
    }

    if (
  !Number.isInteger(
    startYear,
  ) ||
  !Number.isInteger(
    endYear,
  ) ||
  endYear < startYear ||
  endYear > startYear + 1
) {
  throw new Error(
    "L’anno finale deve coincidere con quello iniziale oppure essere quello immediatamente successivo.",
  );
}

    const seasonReference =
      doc(
        db,
        SEASONS_COLLECTION,
        normalizedSeasonId,
      );

    const seasonReferences =
      await getSeasonReferences();

    await runTransaction(
      db,
      async (
        transaction,
      ) => {
        /*
         * Firestore richiede tutte le letture prima delle write.
         * Leggiamo quindi l'insieme delle stagioni per impedire
         * di assegnare gli stessi anni a due stagioni della stessa
         * competizione.
         */
        const snapshots = [];

        for (
          const reference of
            seasonReferences
        ) {
          snapshots.push(
            await transaction.get(
              reference,
            ),
          );
        }

        const snapshot =
          snapshots.find(
            (
              currentSnapshot,
            ) =>
              currentSnapshot.id ===
              normalizedSeasonId,
          ) ??
          (await transaction.get(
            seasonReference,
          ));

        if (
          !snapshot.exists()
        ) {
          throw new Error(
            "La stagione selezionata non esiste.",
          );
        }

        const targetSeason =
          mapSeason(
            snapshot.id,
            snapshot.data(),
          );

        const duplicateYears =
          snapshots.some(
            (
              currentSnapshot,
            ) => {
              if (
                !currentSnapshot.exists() ||
                currentSnapshot.id ===
                  normalizedSeasonId
              ) {
                return false;
              }

              const currentSeason =
                mapSeason(
                  currentSnapshot.id,
                  currentSnapshot.data(),
                );

              return (
                currentSeason.competitionId ===
                  targetSeason.competitionId &&
                currentSeason.startYear ===
                  startYear &&
                currentSeason.endYear ===
                  endYear
              );
            },
          );

        if (
          duplicateYears
        ) {
          throw new Error(
            "Esiste già una stagione con questi anni per la competizione selezionata.",
          );
        }

        transaction.update(
          seasonReference,
          {
            name:
              normalizedName,

            startYear,
            endYear,

            updatedAt:
              serverTimestamp(),
          },
        );
      },
    );
  },

  /*
   * ============================================================
   * ELIMINA STAGIONE CONCLUSA
   * ============================================================
   *
   * I dati collegati alla stagione devono essere rimossi dal
   * servizio di archivio PRIMA di chiamare questo metodo.
   * ============================================================
   */

  async removeCompleted(
    seasonId: string,
  ): Promise<void> {
    const normalizedSeasonId =
      seasonId.trim();

    if (!normalizedSeasonId) {
      throw new Error(
        "Stagione non valida.",
      );
    }

    const seasonReference =
      doc(
        db,
        SEASONS_COLLECTION,
        normalizedSeasonId,
      );

    await runTransaction(
      db,
      async (
        transaction,
      ) => {
        const snapshot =
          await transaction.get(
            seasonReference,
          );

        if (
          !snapshot.exists()
        ) {
          throw new Error(
            "La stagione selezionata non esiste.",
          );
        }

        const season =
          mapSeason(
            snapshot.id,
            snapshot.data(),
          );

        if (
          season.status !==
          "completed"
        ) {
          throw new Error(
            "Puoi eliminare soltanto una stagione conclusa.",
          );
        }

        if (
          season.isCurrent
        ) {
          throw new Error(
            "La stagione corrente non può essere eliminata.",
          );
        }

        transaction.delete(
          seasonReference,
        );
      },
    );
  },
};

function normalizeCompetitionId(
  competitionId:
    string | undefined,
): string {
  return competitionId
    ?.trim()
    .toLocaleLowerCase(
      "it",
    ) ?? "";
}
