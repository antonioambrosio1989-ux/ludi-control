import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

const HISTORICAL_STATS_COLLECTION =
  "historicalPlayerSeasonStats";
const HALL_OF_FAME_COLLECTION =
  "hallOfFame";
const HALL_OF_CHAMPIONS_COLLECTION =
  "hallOfChampions";
const PLAYERS_COLLECTION =
  "players";
const SEASONS_COLLECTION =
  "seasons";

const BATCH_SIZE =
  400;

type StoredDocument = {
  id: string;
  data: DocumentData;
};

type StoredPlayerAchievements = {
  playerId: string;
  achievements: unknown[];
};

type LogicalSeasonIdentity = {
  competitionId: string;
  seasonName: string;
};

export type HistoricalSeasonArchiveSnapshot = {
  seasonId: string;

  historicalStats:
    StoredDocument[];

  hallOfFame:
    StoredDocument[];

  hallOfChampions:
    StoredDocument[];

  playerAchievements:
    StoredPlayerAchievements[];
};

type BatchOperation =
  | {
      type: "delete";
      collectionName: string;
      id: string;
    }
  | {
      type: "set";
      collectionName: string;
      id: string;
      data: DocumentData;
    }
  | {
      type: "update";
      collectionName: string;
      id: string;
      data: DocumentData;
    };

export class HistoricalSeasonArchiveResetService {
  /*
   * ==========================================================
   * SNAPSHOT PRIMA DI REIMPORT / ELIMINAZIONE
   * ==========================================================
   *
   * Lo snapshot permette di ripristinare l'archivio precedente
   * qualora il nuovo import fallisca dopo l'azzeramento.
   * ==========================================================
   */

  static async capture(
    seasonId: string,
  ): Promise<HistoricalSeasonArchiveSnapshot> {
    const normalizedSeasonId =
      normalizeSeasonId(
        seasonId,
      );

    const logicalSeason =
      await getLogicalSeasonIdentity(
        normalizedSeasonId,
      );

    const [
      historicalStats,
      hallOfFame,
      hallOfChampions,
      playersSnapshot,
    ] =
      await Promise.all([
        getSeasonDocuments(
          HISTORICAL_STATS_COLLECTION,
          normalizedSeasonId,
          logicalSeason,
        ),

        getSeasonDocuments(
          HALL_OF_FAME_COLLECTION,
          normalizedSeasonId,
          logicalSeason,
        ),

        getSeasonDocuments(
          HALL_OF_CHAMPIONS_COLLECTION,
          normalizedSeasonId,
          logicalSeason,
        ),

        getDocs(
          collection(
            db,
            PLAYERS_COLLECTION,
          ),
        ),
      ]);

    const playerAchievements:
      StoredPlayerAchievements[] =
      [];

    for (
      const playerDocument of
        playersSnapshot.docs
    ) {
      const achievements =
        getAchievements(
          playerDocument.data()
            .achievements,
        );

      if (
        !achievements.some(
          (achievement) =>
            belongsToLogicalSeason(
              achievement,
              normalizedSeasonId,
              logicalSeason,
            ),
        )
      ) {
        continue;
      }

      playerAchievements.push({
        playerId:
          playerDocument.id,

        achievements,
      });
    }

    return {
      seasonId:
        normalizedSeasonId,

      historicalStats,
      hallOfFame,
      hallOfChampions,
      playerAchievements,
    };
  }

  /*
   * ==========================================================
   * AZZERA ARCHIVIO STAGIONE
   * ==========================================================
   *
   * Vengono rimossi i dati associati al seasonId e gli eventuali
   * record legacy della stessa competizione e stagione logica.
   * I profili globali dei giocatori NON vengono eliminati.
   * ==========================================================
   */

  static async clear(
    seasonId: string,
  ): Promise<void> {
    const normalizedSeasonId =
      normalizeSeasonId(
        seasonId,
      );

    const logicalSeason =
      await getLogicalSeasonIdentity(
        normalizedSeasonId,
      );

    const [
      historicalStats,
      hallOfFame,
      hallOfChampions,
      playersSnapshot,
    ] =
      await Promise.all([
        getSeasonDocuments(
          HISTORICAL_STATS_COLLECTION,
          normalizedSeasonId,
          logicalSeason,
        ),

        getSeasonDocuments(
          HALL_OF_FAME_COLLECTION,
          normalizedSeasonId,
          logicalSeason,
        ),

        getSeasonDocuments(
          HALL_OF_CHAMPIONS_COLLECTION,
          normalizedSeasonId,
          logicalSeason,
        ),

        getDocs(
          collection(
            db,
            PLAYERS_COLLECTION,
          ),
        ),
      ]);

    const operations:
      BatchOperation[] =
      [];

    for (
      const entry of [
        ...historicalStats.map(
          (document) => ({
            collectionName:
              HISTORICAL_STATS_COLLECTION,
            document,
          }),
        ),

        ...hallOfFame.map(
          (document) => ({
            collectionName:
              HALL_OF_FAME_COLLECTION,
            document,
          }),
        ),

        ...hallOfChampions.map(
          (document) => ({
            collectionName:
              HALL_OF_CHAMPIONS_COLLECTION,
            document,
          }),
        ),
      ]
    ) {
      operations.push({
        type:
          "delete",

        collectionName:
          entry.collectionName,

        id:
          entry.document.id,
      });
    }

    for (
      const playerDocument of
        playersSnapshot.docs
    ) {
      const achievements =
        getAchievements(
          playerDocument.data()
            .achievements,
        );

      const filteredAchievements =
        achievements.filter(
          (achievement) =>
            !belongsToLogicalSeason(
              achievement,
              normalizedSeasonId,
              logicalSeason,
            ),
        );

      if (
        filteredAchievements.length ===
        achievements.length
      ) {
        continue;
      }

      operations.push({
        type:
          "update",

        collectionName:
          PLAYERS_COLLECTION,

        id:
          playerDocument.id,

        data: {
          achievements:
            filteredAchievements,

          updatedAt:
            serverTimestamp(),
        },
      });
    }

    await executeOperations(
      operations,
    );
  }

  /*
   * ==========================================================
   * AZZERA TUTTE LE STATISTICHE STORICHE
   * ==========================================================
   *
   * Utilizzare solo per un reset completo delle statistiche
   * storiche che alimentano la classifica All-Time Goalscorers.
   *
   * Non vengono eliminati:
   * - profili globali dei giocatori;
   * - fotografie;
   * - Hall of Fame;
   * - Albo d'Oro / Champions;
   * - palmarès dei giocatori.
   * ==========================================================
   */

  static async clearAllHistoricalStats(): Promise<void> {
    const snapshot =
      await getDocs(
        collection(
          db,
          HISTORICAL_STATS_COLLECTION,
        ),
      );

    const operations:
      BatchOperation[] =
      snapshot.docs.map(
        (document) => ({
          type:
            "delete" as const,

          collectionName:
            HISTORICAL_STATS_COLLECTION,

          id:
            document.id,
        }),
      );

    await executeOperations(
      operations,
    );
  }

  /*
   * ==========================================================
   * RIPRISTINO SNAPSHOT
   * ==========================================================
   */

  static async restore(
    snapshot:
      HistoricalSeasonArchiveSnapshot,
  ): Promise<void> {
    /*
     * Elimina eventuali dati creati dal tentativo di import
     * prima di ripristinare lo stato precedente.
     */
    await this.clear(
      snapshot.seasonId,
    );

    const operations:
      BatchOperation[] =
      [];

    for (
      const document of
        snapshot.historicalStats
    ) {
      operations.push({
        type:
          "set",

        collectionName:
          HISTORICAL_STATS_COLLECTION,

        id:
          document.id,

        data:
          document.data,
      });
    }

    for (
      const document of
        snapshot.hallOfFame
    ) {
      operations.push({
        type:
          "set",

        collectionName:
          HALL_OF_FAME_COLLECTION,

        id:
          document.id,

        data:
          document.data,
      });
    }

    for (
      const document of
        snapshot.hallOfChampions
    ) {
      operations.push({
        type:
          "set",

        collectionName:
          HALL_OF_CHAMPIONS_COLLECTION,

        id:
          document.id,

        data:
          document.data,
      });
    }

    for (
      const player of
        snapshot.playerAchievements
    ) {
      operations.push({
        type:
          "update",

        collectionName:
          PLAYERS_COLLECTION,

        id:
          player.playerId,

        data: {
          achievements:
            player.achievements,

          updatedAt:
            serverTimestamp(),
        },
      });
    }

    await executeOperations(
      operations,
    );
  }

  /*
   * ==========================================================
   * RIPRISTINA SOLO LE IMMAGINI CARICATE MANUALMENTE
   * ==========================================================
   *
   * Reimportare significa sostituire i dati Excel, ma non deve
   * costringere l'admin a ricaricare le fotografie già inserite.
   * Le immagini vengono riagganciate solo quando il nuovo record
   * rappresenta ancora lo stesso premio / la stessa stagione.
   * ==========================================================
   */

  static async restoreManualMedia(
    snapshot:
      HistoricalSeasonArchiveSnapshot,
  ): Promise<void> {
    const [
      newHallOfFame,
      newHallOfChampions,
    ] =
      await Promise.all([
        getSeasonDocuments(
          HALL_OF_FAME_COLLECTION,
          snapshot.seasonId,
        ),

        getSeasonDocuments(
          HALL_OF_CHAMPIONS_COLLECTION,
          snapshot.seasonId,
        ),
      ]);

    const oldHallOfFameByKey =
      new Map<
        string,
        StoredDocument
      >();

    for (
      const oldItem of
        snapshot.hallOfFame
    ) {
      oldHallOfFameByKey.set(
        createHallOfFameKey(
          oldItem.data,
        ),
        oldItem,
      );
    }

    const operations:
      BatchOperation[] =
      [];

    for (
      const newItem of
        newHallOfFame
    ) {
      const oldItem =
        oldHallOfFameByKey.get(
          createHallOfFameKey(
            newItem.data,
          ),
        );

      if (!oldItem) {
        continue;
      }

      const imageUrl =
        normalizeOptionalString(
          oldItem.data.imageUrl,
        );

      const imageKey =
        normalizeOptionalString(
          oldItem.data.imageKey,
        );

      if (
        !imageUrl &&
        !imageKey
      ) {
        continue;
      }

      operations.push({
        type:
          "update",

        collectionName:
          HALL_OF_FAME_COLLECTION,

        id:
          newItem.id,

        data: {
          ...(imageUrl
            ? {
                imageUrl,
              }
            : {}),

          ...(imageKey
            ? {
                imageKey,
              }
            : {}),

          updatedAt:
            serverTimestamp(),
        },
      });
    }

    const oldChampion =
      snapshot.hallOfChampions[0];

    const newChampion =
      newHallOfChampions[0];

    if (
      oldChampion &&
      newChampion
    ) {
      const media =
        pickChampionMedia(
          oldChampion.data,
        );

      if (
        Object.keys(
          media,
        ).length >
        0
      ) {
        operations.push({
          type:
            "update",

          collectionName:
            HALL_OF_CHAMPIONS_COLLECTION,

          id:
            newChampion.id,

          data: {
            ...media,

            updatedAt:
              serverTimestamp(),
          },
        });
      }
    }

    await executeOperations(
      operations,
    );
  }

  /*
   * ==========================================================
   * PROPAGA IL NUOVO NOME STAGIONE NEI DATI STORICI
   * ==========================================================
   */

  static async updateSeasonNameReferences({
    seasonId,
    seasonName,
  }: {
    seasonId: string;
    seasonName: string;
  }): Promise<void> {
    const normalizedSeasonId =
      normalizeSeasonId(
        seasonId,
      );

    const normalizedSeasonName =
      seasonName.trim();

    if (!normalizedSeasonName) {
      throw new Error(
        "Nome stagione non valido.",
      );
    }

    const [
      historicalStats,
      hallOfFame,
      hallOfChampions,
      playersSnapshot,
    ] =
      await Promise.all([
        getSeasonDocuments(
          HISTORICAL_STATS_COLLECTION,
          normalizedSeasonId,
        ),

        getSeasonDocuments(
          HALL_OF_FAME_COLLECTION,
          normalizedSeasonId,
        ),

        getSeasonDocuments(
          HALL_OF_CHAMPIONS_COLLECTION,
          normalizedSeasonId,
        ),

        getDocs(
          collection(
            db,
            PLAYERS_COLLECTION,
          ),
        ),
      ]);

    const operations:
      BatchOperation[] =
      [];

    for (
      const document of
        historicalStats
    ) {
      operations.push({
        type:
          "update",

        collectionName:
          HISTORICAL_STATS_COLLECTION,

        id:
          document.id,

        data: {
          seasonName:
            normalizedSeasonName,

          updatedAt:
            serverTimestamp(),
        },
      });
    }

    for (
      const document of
        hallOfFame
    ) {
      operations.push({
        type:
          "update",

        collectionName:
          HALL_OF_FAME_COLLECTION,

        id:
          document.id,

        data: {
          seasonLabel:
            normalizedSeasonName,

          updatedAt:
            serverTimestamp(),
        },
      });
    }

    for (
      const document of
        hallOfChampions
    ) {
      operations.push({
        type:
          "update",

        collectionName:
          HALL_OF_CHAMPIONS_COLLECTION,

        id:
          document.id,

        data: {
          seasonName:
            normalizedSeasonName,

          updatedAt:
            serverTimestamp(),
        },
      });
    }

    for (
      const playerDocument of
        playersSnapshot.docs
    ) {
      const achievements =
        getAchievements(
          playerDocument.data()
            .achievements,
        );

      let changed =
        false;

      const nextAchievements =
        achievements.map(
          (achievement) => {
            if (
              getAchievementSeasonId(
                achievement,
              ) !==
              normalizedSeasonId
            ) {
              return achievement;
            }

            if (
              !achievement ||
              typeof achievement !==
                "object"
            ) {
              return achievement;
            }

            changed =
              true;

            return {
              ...achievement,

              seasonLabel:
                normalizedSeasonName,
            };
          },
        );

      if (!changed) {
        continue;
      }

      operations.push({
        type:
          "update",

        collectionName:
          PLAYERS_COLLECTION,

        id:
          playerDocument.id,

        data: {
          achievements:
            nextAchievements,

          updatedAt:
            serverTimestamp(),
        },
      });
    }

    await executeOperations(
      operations,
    );
  }
}

async function getSeasonDocuments(
  collectionName: string,
  seasonId: string,
  logicalSeason?:
    LogicalSeasonIdentity,
): Promise<StoredDocument[]> {
  if (logicalSeason) {
    const snapshot =
      await getDocs(
        collection(
          db,
          collectionName,
        ),
      );

    return snapshot.docs
      .filter(
        (document) =>
          belongsToLogicalSeason(
            document.data(),
            seasonId,
            logicalSeason,
          ),
      )
      .map(
        (document) => ({
          id:
            document.id,

          data:
            document.data(),
        }),
      );
  }

  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          collectionName,
        ),

        where(
          "seasonId",
          "==",
          seasonId,
        ),
      ),
    );

  return snapshot.docs.map(
    (document) => ({
      id:
        document.id,

      data:
        document.data(),
    }),
  );
}

async function getLogicalSeasonIdentity(
  seasonId: string,
): Promise<LogicalSeasonIdentity | undefined> {
  const snapshot =
    await getDoc(
      doc(
        db,
        SEASONS_COLLECTION,
        seasonId,
      ),
    );

  if (!snapshot.exists()) {
    return undefined;
  }

  const data =
    snapshot.data();

  const competitionId =
    normalizeKeyPart(
      data.competitionId,
    );

  const seasonName =
    normalizeSeasonName(
      data.name,
    );

  if (
    !competitionId ||
    !seasonName
  ) {
    return undefined;
  }

  return {
    competitionId,
    seasonName,
  };
}

function belongsToLogicalSeason(
  value: unknown,
  seasonId: string,
  logicalSeason?:
    LogicalSeasonIdentity,
): boolean {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return false;
  }

  const data =
    value as Record<
      string,
      unknown
    >;

  if (
    normalizeOptionalString(
      data.seasonId,
    ) ===
    seasonId
  ) {
    return true;
  }

  if (!logicalSeason) {
    return false;
  }

  const competitionId =
    normalizeKeyPart(
      data.competitionId,
    );

  if (
    !competitionId ||
    competitionId !==
      logicalSeason.competitionId
  ) {
    return false;
  }

  const seasonName =
    normalizeSeasonName(
      data.seasonName ??
        data.seasonLabel ??
        data.name,
    );

  return (
    Boolean(
      seasonName,
    ) &&
    seasonName ===
      logicalSeason.seasonName
  );
}

function normalizeSeasonName(
  value: unknown,
): string {
  return String(
    value ?? "",
  )
    .trim()
    .toLocaleLowerCase(
      "it",
    )
    .replace(
      /^stagione\s+/i,
      "",
    )
    .replace(
      /-/g,
      "/",
    )
    .replace(
      /(\d{4})\/(\d{4})/,
      (
        _match,
        firstYear: string,
        secondYear: string,
      ) =>
        `${firstYear}/${secondYear.slice(-2)}`,
    )
    .replace(
      /\s+/g,
      "",
    );
}

function normalizeSeasonId(
  seasonId: string,
): string {
  const normalized =
    seasonId.trim();

  if (!normalized) {
    throw new Error(
      "seasonId non valido.",
    );
  }

  return normalized;
}

function getAchievements(
  value: unknown,
): unknown[] {
  return Array.isArray(
    value,
  )
    ? value
    : [];
}

function getAchievementSeasonId(
  achievement: unknown,
): string {
  if (
    !achievement ||
    typeof achievement !==
      "object"
  ) {
    return "";
  }

  const value =
    (
      achievement as Record<
        string,
        unknown
      >
    ).seasonId;

  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function normalizeOptionalString(
  value: unknown,
): string | undefined {
  if (
    typeof value !==
    "string"
  ) {
    return undefined;
  }

  const normalized =
    value.trim();

  return normalized ||
    undefined;
}

function normalizeKeyPart(
  value: unknown,
): string {
  return String(
    value ?? "",
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

function createHallOfFameKey(
  data: DocumentData,
): string {
  return [
    normalizeKeyPart(
      data.section,
    ),

    normalizeKeyPart(
      data.category,
    ),

    normalizeKeyPart(
      data.winnerName,
    ),
  ].join(
    "|",
  );
}

function pickChampionMedia(
  data: DocumentData,
): DocumentData {
  const result:
    DocumentData =
    {};

  for (
    const field of [
      "winnerPhotoUrl",
      "winnerPhotoKey",
      "finalMvpPhotoUrl",
      "finalMvpPhotoKey",
    ]
  ) {
    const value =
      normalizeOptionalString(
        data[field],
      );

    if (value) {
      result[field] =
        value;
    }
  }

  return result;
}

async function executeOperations(
  operations:
    BatchOperation[],
): Promise<void> {
  for (
    let start = 0;
    start <
    operations.length;
    start +=
      BATCH_SIZE
  ) {
    const chunk =
      operations.slice(
        start,
        start +
          BATCH_SIZE,
      );

    const batch =
      writeBatch(
        db,
      );

    for (
      const operation of
        chunk
    ) {
      const reference =
        doc(
          db,
          operation.collectionName,
          operation.id,
        );

      if (
        operation.type ===
        "delete"
      ) {
        batch.delete(
          reference,
        );

        continue;
      }

      if (
        operation.type ===
        "set"
      ) {
        batch.set(
          reference,
          operation.data,
        );

        continue;
      }

      batch.update(
        reference,
        operation.data,
      );
    }

    await batch.commit();
  }
}
