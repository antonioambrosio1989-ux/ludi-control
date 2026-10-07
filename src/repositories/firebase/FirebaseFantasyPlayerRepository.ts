import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import {
  db,
} from "@/src/lib/firebase";

import type {
  CreateFantasyPlayerInput,
  FantasyPlayer,
  FantasyPlayerAvailabilityStatus,
  FantasyPlayerPool,
  FantasyPlayerPoolStatus,
} from "@/src/types/FantasyPlayer";

const PLAYERS_COLLECTION =
  "fantasyPlayers";

const POOLS_COLLECTION =
  "fantasyPlayerPools";

function normalizeFantasyPlayer(
  snapshot:
    DocumentSnapshot<DocumentData>,
): FantasyPlayer {
  const data =
    snapshot.data();

  if (
    !data
  ) {
    throw new Error(
      `Documento FantasyPlayer ${snapshot.id} privo di dati.`,
    );
  }

  return {
    id:
      snapshot.id,

    fantasySeasonId:
      String(
        data.fantasySeasonId ?? "",
      ),

    playerSeasonCode:
      String(
        data.playerSeasonCode ?? "",
      ),

    teamCode:
      String(
        data.teamCode ?? "",
      ),

    firstName:
      String(
        data.firstName ?? "",
      ),

    lastName:
      String(
        data.lastName ?? "",
      ),

    displayName:
      String(
        data.displayName ??
          `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim(),
      ),

    role:
      data.role,

    cost:
      Number(
        data.cost ?? 0,
      ),

    availabilityStatus:
      (
        data.availabilityStatus ??
        "eligible"
      ) as FantasyPlayerAvailabilityStatus,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

function normalizeFantasyPlayerPool(
  snapshot:
    DocumentSnapshot<DocumentData>,
): FantasyPlayerPool {
  const data =
    snapshot.data();

  if (
    !data
  ) {
    throw new Error(
      `Documento FantasyPlayerPool ${snapshot.id} privo di dati.`,
    );
  }

  return {
    id:
      snapshot.id,

    fantasySeasonId:
      String(
        data.fantasySeasonId ?? "",
      ),

    status:
      (
        data.status ??
        "draft"
      ) as FantasyPlayerPoolStatus,

    version:
      Number(
        data.version ?? 1,
      ),

    playerCount:
      Number(
        data.playerCount ?? 0,
      ),

    importedAt:
      data.importedAt,

    importedBy:
      data.importedBy,

    publishedAt:
      data.publishedAt,

    publishedBy:
      data.publishedBy,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

export class FirebaseFantasyPlayerRepository {
  static async getPoolBySeasonId(
    fantasySeasonId:
      string,
  ): Promise<FantasyPlayerPool | null> {
    const poolQuery =
      query(
        collection(
          db,
          POOLS_COLLECTION,
        ),
        where(
          "fantasySeasonId",
          "==",
          fantasySeasonId,
        ),
      );

    const snapshot =
      await getDocs(
        poolQuery,
      );

    const first =
      snapshot.docs[0];

    return first
      ? normalizeFantasyPlayerPool(
          first,
        )
      : null;
  }

  static async getPlayersBySeasonId(
    fantasySeasonId:
      string,
  ): Promise<FantasyPlayer[]> {
    const playersQuery =
      query(
        collection(
          db,
          PLAYERS_COLLECTION,
        ),
        where(
          "fantasySeasonId",
          "==",
          fantasySeasonId,
        ),
      );

    const snapshot =
      await getDocs(
        playersQuery,
      );

    return snapshot.docs.map(
      normalizeFantasyPlayer,
    );
  }

  static async getPlayerById(
    fantasyPlayerId:
      string,
  ): Promise<FantasyPlayer | null> {
    const snapshot =
      await getDoc(
        doc(
          db,
          PLAYERS_COLLECTION,
          fantasyPlayerId,
        ),
      );

    if (
      !snapshot.exists()
    ) {
      return null;
    }

    return normalizeFantasyPlayer(
      snapshot,
    );
  }

  static async replaceDraftPool(
    fantasySeasonId:
      string,

    players:
      CreateFantasyPlayerInput[],

    importedBy?:
      string,
  ): Promise<void> {
    const existingPool =
      await this.getPoolBySeasonId(
        fantasySeasonId,
      );

    if (
      existingPool?.status ===
      "published"
    ) {
      throw new Error(
        "Il listone è già stato pubblicato e non può essere sostituito.",
      );
    }

    const existingPlayers =
      await this.getPlayersBySeasonId(
        fantasySeasonId,
      );

    const batch =
      writeBatch(
        db,
      );

    for (
      const player
      of existingPlayers
    ) {
      batch.delete(
        doc(
          db,
          PLAYERS_COLLECTION,
          player.id,
        ),
      );
    }

    for (
      const player
      of players
    ) {
      const playerRef =
        doc(
          collection(
            db,
            PLAYERS_COLLECTION,
          ),
        );

      batch.set(
        playerRef,
        {
          fantasySeasonId,

          playerSeasonCode:
            player.playerSeasonCode,

          teamCode:
            player.teamCode,

          firstName:
            player.firstName.trim(),

          lastName:
            player.lastName.trim(),

          displayName:
            `${player.firstName} ${player.lastName}`
              .trim()
              .replace(
                /\s+/g,
                " ",
              ),

          role:
            player.role,

          cost:
            player.cost,

          availabilityStatus:
            "eligible",

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
      );
    }

    const poolRef =
      existingPool
        ? doc(
            db,
            POOLS_COLLECTION,
            existingPool.id,
          )
        : doc(
            collection(
              db,
              POOLS_COLLECTION,
            ),
          );

    batch.set(
      poolRef,
      {
        fantasySeasonId,

        status:
          "draft",

        version:
          (
            existingPool?.version ??
            0
          ) + 1,

        playerCount:
          players.length,

        importedAt:
          serverTimestamp(),

        importedBy:
          importedBy ?? null,

        publishedAt:
          null,

        publishedBy:
          null,

        createdAt:
          existingPool?.createdAt ??
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      },
      {
        merge:
          true,
      },
    );

    await batch.commit();
  }

  static async publishPool(
    fantasySeasonId:
      string,

    publishedBy?:
      string,
  ): Promise<void> {
    const pool =
      await this.getPoolBySeasonId(
        fantasySeasonId,
      );

    if (
      !pool
    ) {
      throw new Error(
        "Nessun listone trovato per questa stagione Fantasy.",
      );
    }

    if (
      pool.status ===
      "published"
    ) {
      throw new Error(
        "Il listone è già stato pubblicato.",
      );
    }

    const players =
      await this.getPlayersBySeasonId(
        fantasySeasonId,
      );

    if (
      players.length ===
      0
    ) {
      throw new Error(
        "Impossibile pubblicare un listone vuoto.",
      );
    }

    await setDoc(
      doc(
        db,
        POOLS_COLLECTION,
        pool.id,
      ),
      {
        status:
          "published",

        playerCount:
          players.length,

        publishedAt:
          serverTimestamp(),

        publishedBy:
          publishedBy ?? null,

        updatedAt:
          serverTimestamp(),
      },
      {
        merge:
          true,
      },
    );
  }

  static async updateAvailability(
    fantasyPlayerId:
      string,

    availabilityStatus:
      FantasyPlayerAvailabilityStatus,
  ): Promise<void> {
    const playerRef =
      doc(
        db,
        PLAYERS_COLLECTION,
        fantasyPlayerId,
      );

    const snapshot =
      await getDoc(
        playerRef,
      );

    if (
      !snapshot.exists()
    ) {
      throw new Error(
        "Giocatore Fantasy non trovato.",
      );
    }

    await setDoc(
      playerRef,
      {
        availabilityStatus,

        updatedAt:
          serverTimestamp(),
      },
      {
        merge:
          true,
      },
    );
  }

  static async deleteDraftPool(
    fantasySeasonId:
      string,
  ): Promise<void> {
    const pool =
      await this.getPoolBySeasonId(
        fantasySeasonId,
      );

    if (
      !pool
    ) {
      return;
    }

    if (
      pool.status ===
      "published"
    ) {
      throw new Error(
        "Un listone pubblicato non può essere eliminato.",
      );
    }

    const players =
      await this.getPlayersBySeasonId(
        fantasySeasonId,
      );

    const batch =
      writeBatch(
        db,
      );

    for (
      const player
      of players
    ) {
      batch.delete(
        doc(
          db,
          PLAYERS_COLLECTION,
          player.id,
        ),
      );
    }

    batch.delete(
      doc(
        db,
        POOLS_COLLECTION,
        pool.id,
      ),
    );

    await batch.commit();
  }

  static subscribePoolBySeasonId(
    fantasySeasonId:
      string,

    callback:
      (
        pool:
          FantasyPlayerPool | null,
      ) => void,
  ): Unsubscribe {
    const poolQuery =
      query(
        collection(
          db,
          POOLS_COLLECTION,
        ),
        where(
          "fantasySeasonId",
          "==",
          fantasySeasonId,
        ),
      );

    return onSnapshot(
      poolQuery,
      (
        snapshot,
      ) => {
        const first =
          snapshot.docs[0];

        callback(
          first
            ? normalizeFantasyPlayerPool(
                first,
              )
            : null,
        );
      },
    );
  }

  static subscribePlayersBySeasonId(
    fantasySeasonId:
      string,

    callback:
      (
        players:
          FantasyPlayer[],
      ) => void,
  ): Unsubscribe {
    const playersQuery =
      query(
        collection(
          db,
          PLAYERS_COLLECTION,
        ),
        where(
          "fantasySeasonId",
          "==",
          fantasySeasonId,
        ),
      );

    return onSnapshot(
      playersQuery,
      (
        snapshot,
      ) => {
        callback(
          snapshot.docs.map(
            normalizeFantasyPlayer,
          ),
        );
      },
    );
  }
}