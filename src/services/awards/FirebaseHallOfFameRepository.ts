import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import type {
  CreateHallOfFameItemInput,
  HallOfFameItem,
  HallOfFameSection,
  HallOfFameStatus,
  HallOfFameWinnerType,
  UpdateHallOfFameItemInput,
} from "@/src/types/HallOfFameItem";

const COLLECTION_NAME =
  "hallOfFame";

type FirestoreDocument = {
  id: string;

  data: () => Record<
    string,
    unknown
  >;
};

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function normalizeString(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeOptionalString(
  value: unknown,
): string | undefined {
  const normalized =
    normalizeString(
      value,
    );

  return normalized ||
    undefined;
}

function normalizeNumber(
  value: unknown,
  fallback = 0,
): number {
  const normalized =
    Number(
      value,
    );

  return Number.isFinite(
    normalized,
  )
    ? normalized
    : fallback;
}

/*
 * ============================================================
 * CHIAVE LOGICA PREMIO
 * ============================================================
 */

function createHallOfFameAwardKey(
  item:
    Pick<
      HallOfFameItem,
      | "competitionId"
      | "seasonId"
      | "section"
      | "category"
      | "winnerType"
    >,
): string {
  return [
    normalizeAwardKeyPart(
  item.competitionId,
),

   normalizeAwardKeyPart(
      item.seasonId,
    ),

    normalizeAwardKeyPart(
      item.section,
    ),

    normalizeAwardKeyPart(
      item.category,
    ),

    normalizeAwardKeyPart(
      item.winnerType,
    ),
  ].join("|");
}

function normalizeAwardKeyPart(
  value: unknown,
): string {
  return String(
    value ??
      "",
  )
    .trim()
    .toLocaleLowerCase(
      "it",
    )
    .normalize(
      "NFD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /\s+/g,
      " ",
    );
}

/*
 * ============================================================
 * SECTION
 * ============================================================
 */

function normalizeSection(
  value: unknown,
): HallOfFameSection {
  if (
    value ===
      "bestOfSeason" ||
    value ===
      "teamOfSeason" ||
    value ===
      "goalAndSave" ||
    value ===
      "otherAwards"
  ) {
    return value;
  }

  /*
   * Compatibilità con tutti i
   * vecchi documenti Firestore.
   */
  return "otherAwards";
}

/*
 * ============================================================
 * WINNER TYPE
 * ============================================================
 */

function normalizeWinnerType(
  value: unknown,
): HallOfFameWinnerType {
  if (
    value === "team" ||
    value === "custom"
  ) {
    return value;
  }

  return "player";
}

/*
 * ============================================================
 * STATUS
 * ============================================================
 */

function normalizeStatus(
  value: unknown,
): HallOfFameStatus {
  return value ===
    "published"
    ? "published"
    : "draft";
}

/*
 * ============================================================
 * MAPPING FIRESTORE
 * ============================================================
 */

function mapDocument(
  document:
    FirestoreDocument,
): HallOfFameItem {
  const data =
    document.data();

  return {
    id:
      document.id,

    seasonId:
      normalizeString(
        data.seasonId,
      ),

    competitionId:
  normalizeString(
    data.competitionId,
  ), 

    seasonLabel:
      normalizeString(
        data.seasonLabel,
      ) ||
      normalizeString(
        data.seasonName,
      ) ||
      normalizeString(
        data.season,
      ),

    /*
     * Nuovo campo.
     *
     * I vecchi documenti senza section
     * vengono automaticamente classificati
     * come "Altri premi".
     */
    section:
      normalizeSection(
        data.section,
      ),

    category:
      normalizeString(
        data.category,
      ),

    awardDescription:
      normalizeOptionalString(
        data.awardDescription,
      ),

    winnerType:
      normalizeWinnerType(
        data.winnerType,
      ),

    winnerName:
      normalizeString(
        data.winnerName,
      ),

    playerId:
      normalizeOptionalString(
        data.playerId,
      ),

    teamId:
      normalizeOptionalString(
        data.teamId,
      ),

    imageUrl:
      normalizeOptionalString(
        data.imageUrl,
      ),

    imageKey:
      normalizeOptionalString(
        data.imageKey,
      ),

    videoUrl:
      normalizeOptionalString(
        data.videoUrl,
      ),

    videoKey:
      normalizeOptionalString(
        data.videoKey,
      ),

    description:
      normalizeOptionalString(
        data.description,
      ),

    sortOrder:
      normalizeNumber(
        data.sortOrder,
        1,
      ),

    status:
      normalizeStatus(
        data.status,
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/*
 * ============================================================
 * GET BY ID
 * ============================================================
 */

async function getById(
  itemId: string,
): Promise<
  HallOfFameItem | undefined
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

/*
 * ============================================================
 * VALIDAZIONE
 * ============================================================
 */

async function getBySeasonId(
  seasonId: string,
): Promise<HallOfFameItem[]> {
  const normalizedSeasonId =
    seasonId.trim();

  if (!normalizedSeasonId) {
    return [];
  }

  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          COLLECTION_NAME,
        ),

        where(
          "seasonId",
          "==",
          normalizedSeasonId,
        ),
      ),
    );

  return snapshot.docs.map(
    mapDocument,
  );
}

async function getByPlayerId(
  playerId: string,
): Promise<
  HallOfFameItem[]
> {
  const normalizedPlayerId =
    playerId.trim();

  if (
    !normalizedPlayerId
  ) {
    return [];
  }

  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          COLLECTION_NAME,
        ),

        where(
          "playerId",
          "==",
          normalizedPlayerId,
        ),
      ),
    );

  return snapshot.docs.map(
    mapDocument,
  );
}

function getAwardCompletenessScore(
  item:
    HallOfFameItem,
): number {
  let score =
    0;

  if (
    item.imageUrl
  ) {
    score +=
      4;
  }

  if (
    item.imageKey
  ) {
    score +=
      2;
  }

  if (
    item.videoUrl
  ) {
    score +=
      4;
  }

  if (
    item.videoKey
  ) {
    score +=
      2;
  }

  if (
    item.description
  ) {
    score +=
      2;
  }

  if (
    item.teamId
  ) {
    score +=
      1;
  }

  if (
    item.section !==
    "otherAwards"
  ) {
    score +=
      1;
  }

  return score;
}

function validateInput(
  input:
    CreateHallOfFameItemInput,
) {
  if (
    !input.seasonId.trim()
  ) {
    throw new Error(
      "Seleziona una stagione.",
    );
  }

  if (
  !input.competitionId.trim()
) {
  throw new Error(
    "Seleziona una competizione.",
  );
}

  if (
    input.seasonLabel.trim()
      .length < 4
  ) {
    throw new Error(
      "Inserisci una stagione valida.",
    );
  }

  if (
    ![
      "bestOfSeason",
      "teamOfSeason",
      "goalAndSave",
      "otherAwards",
    ].includes(
      input.section,
    )
  ) {
    throw new Error(
      "Sezione Hall of Fame non valida.",
    );
  }

  if (
  ![
    "player",
    "team",
    "custom",
  ].includes(
    input.winnerType,
  )
) {
  throw new Error(
    "Tipo vincitore non valido.",
  );
}

  if (
    input.category.trim()
      .length < 2
  ) {
    throw new Error(
      "Inserisci la categoria del premio.",
    );
  }

  if (
    input.winnerName.trim()
      .length < 2
  ) {
    throw new Error(
      "Inserisci il vincitore.",
    );
  }

  if (
    !Number.isInteger(
      input.sortOrder,
    ) ||
    input.sortOrder < 1
  ) {
    throw new Error(
      "Ordine di visualizzazione non valido.",
    );
  }
}

/*
 * ============================================================
 * REPOSITORY
 * ============================================================
 */

export const FirebaseHallOfFameRepository =
  {

    subscribePublishedByCompetition(
  competitionId: string,
  onChange: (
    items:
      HallOfFameItem[],
  ) => void,

  onError?: (
    error: Error,
  ) => void,
): Unsubscribe {
  const normalizedCompetitionId =
    competitionId.trim();

  if (
    !normalizedCompetitionId
  ) {
    onChange([]);

    return () => {};
  }

  /*
   * Non filtriamo competitionId direttamente nella query.
   *
   * I documenti storici precedenti alla gestione
   * multi-competizione non possiedono quel campo:
   * con where("competitionId", "==", ...) Firestore li
   * escludeva prima ancora che arrivassero al client.
   *
   * Manteniamo invece status == "published", quindi la query
   * resta compatibile con le regole Firestore pubbliche.
   */
  const itemsQuery =
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
    itemsQuery,

    (
      snapshot,
    ) => {
      const items =
        snapshot.docs
          .map(
            mapDocument,
          )
          .filter(
            (
              item,
            ) => {
              if (
                item.status !==
                "published"
              ) {
                return false;
              }

              const itemCompetitionId =
                item.competitionId
                  ?.trim();

              if (
                itemCompetitionId
              ) {
                return (
                  itemCompetitionId ===
                  normalizedCompetitionId
                );
              }

              /*
               * Lo storico antecedente alla separazione delle
               * competizioni appartiene alla Premier League.
               */
              return (
                normalizedCompetitionId ===
                "premier-league"
              );
            },
          )
          .sort(
            (
              first,
              second,
            ) => {
              const bySeason =
                second.seasonLabel.localeCompare(
                  first.seasonLabel,
                  "it",
                  {
                    numeric: true,
                  },
                );

              if (
                bySeason !== 0
              ) {
                return bySeason;
              }

              return (
                first.sortOrder -
                second.sortOrder
              );
            },
          );

      onChange(
        items,
      );
    },

    (
      error,
    ) => {
      console.error(
        "Errore caricamento Hall of Fame pubblica per competizione:",
        error,
      );

      onError?.(
        error,
      );
    },
  );
},
    /*
     * ========================================================
     * SUBSCRIBE ALL
     * ========================================================
     */

    subscribeAll(
      onChange: (
        items:
          HallOfFameItem[],
      ) => void,

      onError?: (
        error: Error,
      ) => void,
    ): Unsubscribe {
      const itemsQuery =
        query(
          collection(
            db,
            COLLECTION_NAME,
          ),

          orderBy(
            "seasonLabel",
            "desc",
          ),
        );

      return onSnapshot(
        itemsQuery,

        (
          snapshot,
        ) => {
          onChange(
            snapshot.docs.map(
              mapDocument,
            ),
          );
        },

        (
          error,
        ) => {
          console.error(
            "Errore caricamento Hall of Fame:",
            error,
          );

          onError?.(
            error,
          );
        },
      );
    },

    /*
     * ========================================================
     * GET BY ID
     * ========================================================
     */

    async getById(
      itemId: string,
    ) {
      return getById(
        itemId,
      );
    },

    async getAll(): Promise<
  HallOfFameItem[]
> {
  const snapshot =
    await getDocs(
      collection(
        db,
        COLLECTION_NAME,
      ),
    );

  return snapshot.docs.map(
    mapDocument,
  );
},

    async getBySeasonId(
  seasonId: string,
) {
  return getBySeasonId(
    seasonId,
  );
},

async getByPlayerId(
  playerId: string,
) {
  return getByPlayerId(
    playerId,
  );
},

    /*
     * ========================================================
     * CREATE
     * ========================================================
     */

    async create(
      input:
        CreateHallOfFameItemInput,
    ): Promise<string> {
      validateInput(
        input,
      );

      const reference =
        await addDoc(
          collection(
            db,
            COLLECTION_NAME,
          ),

          {
            seasonId:
              input.seasonId.trim(),

            competitionId:
  input.competitionId.trim(),  

            seasonLabel:
              input.seasonLabel.trim(),

            /*
             * Nuovo campo.
             */
            section:
              input.section,

            category:
              input.category.trim(),

            awardDescription:
              input.awardDescription
              ?.trim() ||
              null,

            winnerType:
              input.winnerType,

            winnerName:
              input.winnerName.trim(),

            playerId:
              input.winnerType ===
                "player"
                ? input.playerId ??
                null
                : null,

            teamId:
              input.winnerType ===
              "team"
              ? input.teamId ??
              null
              : null,

            imageUrl:
              input.imageUrl ??
              null,

            imageKey:
              input.imageKey ??
              null,

            videoUrl:
              input.videoUrl ??
              null,

            videoKey:
              input.videoKey ??
              null,

            description:
              input.description?.trim() ||
              null,

            sortOrder:
              input.sortOrder,

            status:
              input.status,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          },
        );

      return reference.id;
    },

    /*
     * ========================================================
     * CREATE MANY
     * ========================================================
     */

    async createMany(
  inputs:
    CreateHallOfFameItemInput[],
): Promise<string[]> {
  const createdIds:
    string[] = [];

  for (
    const input of
      inputs
  ) {
    const itemId =
      await this.create(
        input,
      );

    createdIds.push(
      itemId,
    );
  }

  return createdIds;
},

    /*
     * ========================================================
     * UPDATE
     * ========================================================
     */

    async update(
      input:
        UpdateHallOfFameItemInput,
    ): Promise<void> {
      const existingItem =
        await getById(
          input.itemId,
        );

      if (
        !existingItem
      ) {
        throw new Error(
          "Il premio selezionato non esiste.",
        );
      }

      validateInput(
        input,
      );

      await updateDoc(
        doc(
          db,
          COLLECTION_NAME,
          input.itemId,
        ),

        {
          seasonId:
            input.seasonId.trim(),

          competitionId:
  input.competitionId.trim(),

          seasonLabel:
            input.seasonLabel.trim(),

          /*
           * Nuovo campo.
           */
          section:
            input.section,

          category:
            input.category.trim(),

          awardDescription:
            input.awardDescription
            ?.trim() ||
            null,

          winnerType:
            input.winnerType,

          winnerName:
            input.winnerName.trim(),

          playerId:
            input.playerId ??
            null,

          teamId:
            input.teamId ??
            null,

          imageUrl:
            input.imageUrl ??
            null,

          imageKey:
            input.imageKey ??
            null,

          videoUrl:
            input.videoUrl ??
            null,

          videoKey:
            input.videoKey ??
            null,

          description:
            input.description?.trim() ||
            null,

          sortOrder:
            input.sortOrder,

          status:
            input.status,

          updatedAt:
            serverTimestamp(),
        },
      );
    },

/*
 * ========================================================
 * MERGE RIFERIMENTI GIOCATORE
 * ========================================================
 */

async mergePlayerReferences({
  sourcePlayerId,
  targetPlayerId,
}: {
  sourcePlayerId: string;
  targetPlayerId: string;
}): Promise<void> {
  const normalizedSourcePlayerId =
    sourcePlayerId.trim();

  const normalizedTargetPlayerId =
    targetPlayerId.trim();

  if (
    !normalizedSourcePlayerId ||
    !normalizedTargetPlayerId
  ) {
    throw new Error(
      "playerId non valido.",
    );
  }

  if (
    normalizedSourcePlayerId ===
    normalizedTargetPlayerId
  ) {
    throw new Error(
      "Il profilo principale e quello duplicato devono essere diversi.",
    );
  }

  /*
   * ========================================================
   * PREMI PROFILO SOURCE
   * ========================================================
   */

  const sourceSnapshot =
    await getDocs(
      query(
        collection(
          db,
          COLLECTION_NAME,
        ),

        where(
          "playerId",
          "==",
          normalizedSourcePlayerId,
        ),
      ),
    );

  if (
    sourceSnapshot.empty
  ) {
    return;
  }

  /*
   * ========================================================
   * PREMI GIÀ PRESENTI SUL TARGET
   * ========================================================
   */

  const targetSnapshot =
    await getDocs(
      query(
        collection(
          db,
          COLLECTION_NAME,
        ),

        where(
          "playerId",
          "==",
          normalizedTargetPlayerId,
        ),
      ),
    );

  /*
   * ========================================================
   * CHIAVI DEI PREMI DEL TARGET
   * ========================================================
   *
   * La chiave identifica logicamente un premio.
   *
   * Esempio:
   *
   * ss24-25
   * bestOfSeason
   * the best ludi scorer
   * player
   *
   * Se il source possiede lo stesso premio,
   * non dobbiamo creare due documenti collegati
   * allo stesso giocatore.
   * ========================================================
   */

  const targetAwardKeys =
    new Set<string>();

  for (
    const currentDocument of
      targetSnapshot.docs
  ) {
    const item =
      mapDocument(
        currentDocument,
      );

    targetAwardKeys.add(
      createHallOfFameAwardKey(
        item,
      ),
    );
  }

  /*
   * ========================================================
   * MERGE
   * ========================================================
   */

  const batch =
    writeBatch(
      db,
    );

  for (
    const currentDocument of
      sourceSnapshot.docs
  ) {
    const sourceItem =
      mapDocument(
        currentDocument,
      );

    const sourceAwardKey =
      createHallOfFameAwardKey(
        sourceItem,
      );

    /*
     * Il premio esiste già sul target.
     *
     * Eliminiamo quindi il documento duplicato.
     */
    if (
      targetAwardKeys.has(
        sourceAwardKey,
      )
    ) {
      batch.delete(
        currentDocument.ref,
      );

      continue;
    }

    /*
     * Il premio non esiste ancora sul target.
     *
     * Trasferiamo normalmente il riferimento.
     */
    batch.update(
      currentDocument.ref,

      {
        playerId:
          normalizedTargetPlayerId,

        updatedAt:
          serverTimestamp(),
      },
    );

    /*
     * Inseriamo subito la chiave nel Set.
     *
     * Questo impedisce anche che due premi duplicati
     * già presenti nello stesso profilo source
     * vengano entrambi trasferiti.
     */
    targetAwardKeys.add(
      sourceAwardKey,
    );
  }

  await batch.commit();
},

/*
 * ========================================================
 * RIMOZIONE PREMI DUPLICATI DEL GIOCATORE
 * ========================================================
 */

async deduplicatePlayerAwards(
  playerId: string,
): Promise<void> {
  const normalizedPlayerId =
    playerId.trim();

  if (
    !normalizedPlayerId
  ) {
    throw new Error(
      "playerId non valido.",
    );
  }

  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          COLLECTION_NAME,
        ),

        where(
          "playerId",
          "==",
          normalizedPlayerId,
        ),
      ),
    );

  if (
    snapshot.size <=
    1
  ) {
    return;
  }

  const documents =
    snapshot.docs.map(
      (
        currentDocument,
      ) => ({
        document:
          currentDocument,

        item:
          mapDocument({
            id:
              currentDocument.id,

            data: () =>
              currentDocument.data(),
          }),
      }),
    );

  const grouped =
    new Map<
      string,
      typeof documents
    >();

  for (
    const entry of
      documents
  ) {
    const key =
      createHallOfFameAwardKey(
        entry.item,
      );

    const currentGroup =
      grouped.get(
        key,
      ) ?? [];

    currentGroup.push(
      entry,
    );

    grouped.set(
      key,
      currentGroup,
    );
  }

  const batch =
    writeBatch(
      db,
    );

  let hasDeletes =
    false;

  for (
    const group of
      grouped.values()
  ) {
    if (
      group.length <=
      1
    ) {
      continue;
    }

    const sorted =
      [...group].sort(
        (
          first,
          second,
        ) =>
          getAwardCompletenessScore(
            second.item,
          ) -
          getAwardCompletenessScore(
            first.item,
          ),
      );

    const [
      keep,
      ...duplicates
    ] =
      sorted;

    if (
      !keep
    ) {
      continue;
    }

    for (
      const duplicate of
        duplicates
    ) {
      batch.delete(
        duplicate.document.ref,
      );

      hasDeletes =
        true;
    }
  }

  if (
    hasDeletes
  ) {
    await batch.commit();
  }
},

    /*
     * ========================================================
     * DELETE
     * ========================================================
     */

    async remove(
      itemId: string,
    ): Promise<void> {
      const existingItem =
        await getById(
          itemId,
        );

      if (
        !existingItem
      ) {
        throw new Error(
          "Il premio selezionato non esiste.",
        );
      }

      await deleteDoc(
        doc(
          db,
          COLLECTION_NAME,
          itemId,
        ),
      );
    },
  };
  