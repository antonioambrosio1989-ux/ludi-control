import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import {
  FirebaseSeasonPlayerRepository,
} from "@/src/services/player/FirebaseSeasonPlayerRepository";

import {
  assertSeasonWritable,
} from "@/src/services/season/SeasonWriteGuard";

import {
  FirebaseSeasonTeamRepository,
} from "@/src/services/team/FirebaseSeasonTeamRepository";

import type {
  CreateFinalStagePlayerInput,
  FinalStagePlayer,
  UpdateFinalStagePlayerInput,
} from "@/src/types/FinalStagePlayer";

/*
 * ============================================================
 * COLLECTION
 * ============================================================
 */

const COLLECTION_NAME =
  "finalStagePlayers";

/*
 * ============================================================
 * MAPPING FIRESTORE
 * ============================================================
 */

function mapFinalStagePlayer(
  documentId: string,

  data:
    Record<
      string,
      unknown
    >,
): FinalStagePlayer {
  return {
    id:
      documentId,

    seasonId:
      typeof data.seasonId ===
      "string"
        ? data.seasonId
        : "",

    teamId:
      typeof data.teamId ===
      "string"
        ? data.teamId
        : "",

    playerId:
      typeof data.playerId ===
      "string"
        ? data.playerId
        : "",

    role:
      data.role as
        FinalStagePlayer["role"],

    shirtNumber:
      typeof data.shirtNumber ===
        "number" &&
      Number.isFinite(
        data.shirtNumber,
      )
        ? data.shirtNumber
        : undefined,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/*
 * ============================================================
 * CHIAVE LOGICA
 * ============================================================
 */

function buildFinalStagePlayerKey({
  seasonId,
  playerId,
}: {
  seasonId: string;

  playerId: string;
}) {
  return [
    seasonId,
    playerId,
  ].join("|");
}

/*
 * ============================================================
 * VALIDAZIONE
 * ============================================================
 */

function validateInput(
  input:
    CreateFinalStagePlayerInput,
) {
  if (
    !input.seasonId.trim()
  ) {
    throw new Error(
      "La stagione non è stata specificata.",
    );
  }

  if (
    !input.teamId.trim()
  ) {
    throw new Error(
      "La squadra non è stata specificata.",
    );
  }

  if (
    !input.playerId.trim()
  ) {
    throw new Error(
      "Il giocatore non è stato specificato.",
    );
  }

  if (
    ![
      "Portiere",
      "Difensore",
      "Attaccante",
    ].includes(
      input.role,
    )
  ) {
    throw new Error(
      "Ruolo giocatore non valido.",
    );
  }

  if (
    input.shirtNumber !==
      undefined &&
    (
      !Number.isInteger(
        input.shirtNumber,
      ) ||
      input.shirtNumber <
        0
    )
  ) {
    throw new Error(
      "Numero di maglia non valido.",
    );
  }
}

/*
 * ============================================================
 * REPOSITORY
 * ============================================================
 */

export const FirebaseFinalStagePlayerRepository =
  {
    /*
     * ========================================================
     * SUBSCRIBE BY SEASON
     * ========================================================
     */

    subscribeBySeason(
      seasonId:
        string,

      onChange:
        (
          players:
            FinalStagePlayer[],
        ) => void,

      onError?:
        (
          error:
            Error,
        ) => void,
    ): Unsubscribe {
      const normalizedSeasonId =
        seasonId.trim();

      const playersQuery =
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
        );

      return onSnapshot(
        playersQuery,

        (
          snapshot,
        ) => {
          const players =
            snapshot.docs.map(
              (
                currentDocument,
              ) =>
                mapFinalStagePlayer(
                  currentDocument.id,

                  currentDocument.data(),
                ),
            );

          onChange(
            players,
          );
        },

        (
          error,
        ) => {
          console.error(
            "Errore caricamento giocatori fasi finali:",
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
     * GET BY SEASON
     * ========================================================
     */

    async getBySeason(
      seasonId:
        string,
    ): Promise<
      FinalStagePlayer[]
    > {
      const normalizedSeasonId =
        seasonId.trim();

      if (
        !normalizedSeasonId
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
              "seasonId",
              "==",
              normalizedSeasonId,
            ),
          ),
        );

      return snapshot.docs.map(
        (
          currentDocument,
        ) =>
          mapFinalStagePlayer(
            currentDocument.id,

            currentDocument.data(),
          ),
      );
    },

    /*
     * ========================================================
     * GET BY TEAM
     * ========================================================
     */

    async getByTeam({
      seasonId,
      teamId,
    }: {
      seasonId:
        string;

      teamId:
        string;
    }): Promise<
      FinalStagePlayer[]
    > {
      const normalizedSeasonId =
        seasonId.trim();

      const normalizedTeamId =
        teamId.trim();

      if (
        !normalizedSeasonId ||
        !normalizedTeamId
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
              "seasonId",
              "==",
              normalizedSeasonId,
            ),

            where(
              "teamId",
              "==",
              normalizedTeamId,
            ),
          ),
        );

      return snapshot.docs.map(
        (
          currentDocument,
        ) =>
          mapFinalStagePlayer(
            currentDocument.id,

            currentDocument.data(),
          ),
      );
    },

    /*
     * ========================================================
     * GET BY ID
     * ========================================================
     */

    async getById(
      finalStagePlayerId:
        string,
    ): Promise<
      FinalStagePlayer |
      undefined
    > {
      const normalizedId =
        finalStagePlayerId.trim();

      if (
        !normalizedId
      ) {
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

      if (
        !snapshot.exists()
      ) {
        return undefined;
      }

      return mapFinalStagePlayer(
        snapshot.id,

        snapshot.data(),
      );
    },

    /*
     * ========================================================
     * CREATE MANY
     * ========================================================
     */

    async createMany(
      inputs:
        CreateFinalStagePlayerInput[],
    ): Promise<void> {
      if (
        inputs.length ===
        0
      ) {
        throw new Error(
          "Non ci sono giocatori da inserire.",
        );
      }

      if (
        inputs.length >
        500
      ) {
        throw new Error(
          "Puoi inserire al massimo 500 giocatori alla volta.",
        );
      }

      const seasonIds =
        Array.from(
          new Set(
            inputs.map(
              (
                input,
              ) =>
                input.seasonId.trim(),
            ),
          ),
        );

      if (
        seasonIds.length !==
        1
      ) {
        throw new Error(
          "Tutti i giocatori devono appartenere alla stessa stagione.",
        );
      }

      const seasonId =
        seasonIds[0];

      await assertSeasonWritable(
        seasonId,
      );

      const seasonTeams =
  await FirebaseSeasonTeamRepository.getBySeasonId(
    seasonId,
  );

const registeredTeamIds =
  new Set(
    seasonTeams.map(
      (seasonTeam) =>
        String(
          seasonTeam.teamId,
        ),
    ),
  );

const seasonPlayers =
  await FirebaseSeasonPlayerRepository.getBySeasonId(
    seasonId,
  );

const eligiblePlayerKeys =
  new Set(
    seasonPlayers
      .filter(
        (seasonPlayer) =>
          seasonPlayer.status !==
          "withdrawn",
      )
      .map(
        (seasonPlayer) =>
          [
            String(
              seasonPlayer.teamId,
            ),
            String(
              seasonPlayer.playerId,
            ),
          ].join("|"),
      ),
  );

      const existingPlayers =
        await this.getBySeason(
          seasonId,
        );

      const existingKeys =
        new Set(
          existingPlayers.map(
            (
              player,
            ) =>
              buildFinalStagePlayerKey({
                seasonId:
                  player.seasonId,

                playerId:
                  player.playerId,
              }),
          ),
        );

      const importedKeys =
        new Set<string>();

      for (
        const input of
          inputs
      ) {
        validateInput(
          input,
        );

        if (
  !registeredTeamIds.has(
    String(
      input.teamId,
    ),
  )
) {
  throw new Error(
    "La lista contiene una squadra non iscritta alla stagione.",
  );
}

const eligiblePlayerKey =
  [
    String(
      input.teamId,
    ),
    String(
      input.playerId,
    ),
  ].join("|");

if (
  !eligiblePlayerKeys.has(
    eligiblePlayerKey,
  )
) {
  throw new Error(
    `Il giocatore ${input.playerId} non appartiene alla rosa stagionale della squadra.`,
  );
}

        const key =
          buildFinalStagePlayerKey({
            seasonId:
              input.seasonId,

            playerId:
              input.playerId,
          });

        if (
          existingKeys.has(
            key,
          )
        ) {
          throw new Error(
            `Il giocatore ${input.playerId} è già presente nella rosa della competizione.`,
          );
        }

        if (
          importedKeys.has(
            key,
          )
        ) {
          throw new Error(
            "La lista contiene un giocatore duplicato.",
          );
        }

        importedKeys.add(
          key,
        );
      }

      const batch =
        writeBatch(
          db,
        );

      for (
        const input of
          inputs
      ) {
        const reference =
          doc(
            collection(
              db,
              COLLECTION_NAME,
            ),
          );

        batch.set(
          reference,

          {
            seasonId:
              input.seasonId.trim(),

            teamId:
              input.teamId.trim(),

            playerId:
              input.playerId.trim(),

            role:
              input.role,

            shirtNumber:
              input.shirtNumber ??
              null,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          },
        );
      }

      await batch.commit();
    },

    /*
     * ========================================================
     * UPDATE
     * ========================================================
     */

    async update(
      input:
        UpdateFinalStagePlayerInput,
    ): Promise<void> {
      const existing =
        await this.getById(
          input.finalStagePlayerId,
        );

      if (
        !existing
      ) {
        throw new Error(
          "Giocatore della fase finale non trovato.",
        );
      }

      await assertSeasonWritable(
        existing.seasonId,
      );

      const seasonTeams =
  await FirebaseSeasonTeamRepository.getBySeasonId(
    existing.seasonId,
  );

const teamIsRegistered =
  seasonTeams.some(
    (seasonTeam) =>
      String(
        seasonTeam.teamId,
      ) ===
      String(
        input.teamId,
      ),
  );

if (!teamIsRegistered) {
  throw new Error(
    "La squadra selezionata non è iscritta alla stagione.",
  );
}

const seasonPlayers =
  await FirebaseSeasonPlayerRepository.getBySeasonAndTeam(
    existing.seasonId,
    input.teamId,
  );

const playerIsEligible =
  seasonPlayers.some(
    (seasonPlayer) =>
      String(
        seasonPlayer.playerId,
      ) ===
        String(
          existing.playerId,
        ) &&
      seasonPlayer.status !==
        "withdrawn",
  );

if (!playerIsEligible) {
  throw new Error(
    "Il giocatore non appartiene alla rosa stagionale della squadra selezionata.",
  );
}

      if (
        !input.teamId.trim()
      ) {
        throw new Error(
          "La squadra non è stata specificata.",
        );
      }

      if (
        ![
          "Portiere",
          "Difensore",
          "Attaccante",
        ].includes(
          input.role,
        )
      ) {
        throw new Error(
          "Ruolo giocatore non valido.",
        );
      }

      if (
        input.shirtNumber !==
          undefined &&
        (
          !Number.isInteger(
            input.shirtNumber,
          ) ||
          input.shirtNumber <
            0
        )
      ) {
        throw new Error(
          "Numero di maglia non valido.",
        );
      }

      const batch =
        writeBatch(
          db,
        );

      batch.update(
        doc(
          db,
          COLLECTION_NAME,
          input.finalStagePlayerId,
        ),

        {
          teamId:
            input.teamId.trim(),

          role:
            input.role,

          shirtNumber:
            input.shirtNumber ??
            null,

          updatedAt:
            serverTimestamp(),
        },
      );

      await batch.commit();
    },

    /*
 * ========================================================
 * REPLACE TEAM PLAYERS
 * ========================================================
 *
 * Sostituisce completamente la lista
 * dei giocatori ammessi alle fasi finali
 * per una determinata squadra.
 *
 * La nuova selezione diventa la lista
 * ufficiale della squadra.
 * ========================================================
 */

async replaceTeamPlayers({
  seasonId,
  teamId,
  players,
}: {
  seasonId: string;

  teamId: string;

  players:
    CreateFinalStagePlayerInput[];
}): Promise<void> {
  const normalizedSeasonId =
    seasonId.trim();

  const normalizedTeamId =
    teamId.trim();

  if (
    !normalizedSeasonId ||
    !normalizedTeamId
  ) {
    throw new Error(
      "Stagione o squadra non valida.",
    );
  }

  await assertSeasonWritable(
    normalizedSeasonId,
  );

  const seasonTeams =
  await FirebaseSeasonTeamRepository.getBySeasonId(
    normalizedSeasonId,
  );

const teamIsRegistered =
  seasonTeams.some(
    (seasonTeam) =>
      String(
        seasonTeam.teamId,
      ) ===
      normalizedTeamId,
  );

if (!teamIsRegistered) {
  throw new Error(
    "La squadra selezionata non è iscritta alla stagione.",
  );
}

const seasonPlayers =
  await FirebaseSeasonPlayerRepository.getBySeasonAndTeam(
    normalizedSeasonId,
    normalizedTeamId,
  );

const eligiblePlayerIds =
  new Set(
    seasonPlayers
      .filter(
        (seasonPlayer) =>
          seasonPlayer.status !==
          "withdrawn",
      )
      .map(
        (seasonPlayer) =>
          String(
            seasonPlayer.playerId,
          ),
      ),
  );

  /*
   * ======================================================
   * VALIDAZIONE NUOVA LISTA
   * ======================================================
   */

  const playerIds =
    new Set<string>();

  for (
    const player of
      players
  ) {
    validateInput(
      player,
    );

    if (
  !eligiblePlayerIds.has(
    player.playerId.trim(),
  )
) {
  throw new Error(
    `Il giocatore ${player.playerId} non appartiene alla rosa stagionale della squadra.`,
  );
}

    if (
      player.seasonId.trim() !==
      normalizedSeasonId
    ) {
      throw new Error(
        "Tutti i giocatori devono appartenere alla stessa stagione.",
      );
    }

    if (
      player.teamId.trim() !==
      normalizedTeamId
    ) {
      throw new Error(
        "Tutti i giocatori devono appartenere alla stessa squadra.",
      );
    }

    const normalizedPlayerId =
      player.playerId.trim();

    if (
      playerIds.has(
        normalizedPlayerId,
      )
    ) {
      throw new Error(
        "La selezione contiene un giocatore duplicato.",
      );
    }

    playerIds.add(
      normalizedPlayerId,
    );
  }

  /*
   * ======================================================
   * GIOCATORI ATTUALMENTE SALVATI
   * ======================================================
   */

  const existingPlayers =
    await this.getByTeam({
      seasonId:
        normalizedSeasonId,

      teamId:
        normalizedTeamId,
    });

  /*
   * ======================================================
   * BATCH
   * ======================================================
   */

  const batch =
    writeBatch(
      db,
    );

  /*
   * Eliminiamo la vecchia lista.
   */

  for (
    const player of
      existingPlayers
  ) {
    batch.delete(
      doc(
        db,
        COLLECTION_NAME,
        player.id,
      ),
    );
  }

  /*
   * Scriviamo la nuova lista.
   */

  for (
    const player of
      players
  ) {
    const reference =
      doc(
        collection(
          db,
          COLLECTION_NAME,
        ),
      );

    batch.set(
      reference,
      {
        seasonId:
          normalizedSeasonId,

        teamId:
          normalizedTeamId,

        playerId:
          player.playerId.trim(),

        role:
          player.role,

        shirtNumber:
          player.shirtNumber ??
          null,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      },
    );
  }

  await batch.commit();
},

    /*
     * ========================================================
     * DELETE
     * ========================================================
     */

    async remove(
      finalStagePlayerId:
        string,
    ): Promise<void> {
      const existing =
        await this.getById(
          finalStagePlayerId,
        );

      if (
        !existing
      ) {
        throw new Error(
          "Giocatore della fase finale non trovato.",
        );
      }

      await assertSeasonWritable(
        existing.seasonId,
      );

      await deleteDoc(
        doc(
          db,
          COLLECTION_NAME,
          finalStagePlayerId,
        ),
      );
    },
  };