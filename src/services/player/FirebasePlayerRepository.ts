import { mapPlayerWithPrivateData, mapPlayer, getHistoricalImportSources } from "@/src/lib/firestore/mappers/PlayerDocumentMapper";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import type {
  CreatePlayerInput,
  HistoricalImportSource,
  PlayerProfile,
  UpdatePlayerInput,
} from "@/src/types/PlayerProfile";

import type {
  PlayerAchievement,
} from "@/src/types/PlayerAchievement";

const COLLECTION =
  "players";

const PRIVATE_COLLECTION =
  "playerPrivateProfiles";

function normalizeText(
  value: string,
): string {
  return value
    .trim()
    .toLocaleLowerCase(
      "it",
    )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /\s+/g,
      " ",
    );
}












function mergeHistoricalImportSources(
  current: HistoricalImportSource[] | undefined,
  incoming: HistoricalImportSource[] | undefined,
): HistoricalImportSource[] {
  const bySeason =
    new Map<string, HistoricalImportSource>();

  for (const source of current ?? []) {
    bySeason.set(source.seasonId, source);
  }

  for (const source of incoming ?? []) {
    bySeason.set(source.seasonId, source);
  }

  return Array.from(bySeason.values());
}

function normalizeOptionalText(
  value:
    | string
    | undefined,
):
  | string
  | null
  | undefined {
  if (
    value === undefined
  ) {
    return undefined;
  }

  const normalized =
    value.trim();

  return normalized ||
    null;
}

function normalizeBaseRating(
  value:
    | number
    | undefined,
): number | null {
  if (
    value === undefined ||
    !Number.isFinite(
      value,
    )
  ) {
    return null;
  }

  return value;
}






export const FirebasePlayerRepository =
  {
    async getAll():
      Promise<
        PlayerProfile[]
      > {
      const snapshot =
        await getDocs(
          query(
            collection(
              db,
              COLLECTION,
            ),

            orderBy(
              "lastName",
            ),
          ),
        );

      return snapshot.docs.map(
        mapPlayer,
      );
    },

    async getByCompetition(
      competitionId: string,
    ): Promise<
      PlayerProfile[]
    > {
      const normalizedCompetitionId =
        competitionId.trim();

      if (
        !normalizedCompetitionId
      ) {
        return [];
      }

      const snapshot =
        await getDocs(
          query(
            collection(
              db,
              COLLECTION,
            ),

            where(
              "competitionId",
              "==",
              normalizedCompetitionId,
            ),
          ),
        );

      return snapshot.docs
        .map(
          mapPlayer,
        )
        .sort(
          (first, second) =>
            first.lastName.localeCompare(
              second.lastName,
              "it",
              {
                sensitivity:
                  "base",
              },
            ) ||
            first.firstName.localeCompare(
              second.firstName,
              "it",
              {
                sensitivity:
                  "base",
              },
            ),
        );
    },

    async getAllWithPrivate():
      Promise<
        PlayerProfile[]
      > {
      const [
        publicSnapshot,
        privateSnapshot,
      ] =
        await Promise.all([
          getDocs(
            query(
              collection(
                db,
                COLLECTION,
              ),

              orderBy(
                "lastName",
              ),
            ),
          ),

          getDocs(
            collection(
              db,
              PRIVATE_COLLECTION,
            ),
          ),
        ]);

      const privateByPlayerId =
        new Map<
          string,
          Record<
            string,
            unknown
          >
        >(
          privateSnapshot.docs.map(
            (currentDocument) => [
              currentDocument.id,
              currentDocument.data(),
            ],
          ),
        );

      return publicSnapshot.docs.map(
        (currentDocument) =>
          mapPlayerWithPrivateData(
            currentDocument,
            privateByPlayerId.get(
              currentDocument.id,
            ),
          ),
      );
    },

    async getAllWithPrivateByCompetition(
      competitionId: string,
    ): Promise<
      PlayerProfile[]
    > {
      const normalizedCompetitionId =
        competitionId.trim();

      if (
        !normalizedCompetitionId
      ) {
        return [];
      }

      const [
        publicSnapshot,
        privateSnapshot,
      ] =
        await Promise.all([
          getDocs(
            query(
              collection(
                db,
                COLLECTION,
              ),

              where(
                "competitionId",
                "==",
                normalizedCompetitionId,
              ),
            ),
          ),

          getDocs(
            collection(
              db,
              PRIVATE_COLLECTION,
            ),
          ),
        ]);

      const privateByPlayerId =
        new Map<
          string,
          Record<
            string,
            unknown
          >
        >(
          privateSnapshot.docs.map(
            (currentDocument) => [
              currentDocument.id,
              currentDocument.data(),
            ],
          ),
        );

      return publicSnapshot.docs
        .map(
          (currentDocument) =>
            mapPlayerWithPrivateData(
              currentDocument,
              privateByPlayerId.get(
                currentDocument.id,
              ),
            ),
        )
        .sort(
          (first, second) =>
            first.lastName.localeCompare(
              second.lastName,
              "it",
              {
                sensitivity:
                  "base",
              },
            ) ||
            first.firstName.localeCompare(
              second.firstName,
              "it",
              {
                sensitivity:
                  "base",
              },
            ),
        );
    },

    async getById(
      playerId: string,
    ): Promise<
      PlayerProfile | undefined
    > {
      const snapshot =
        await getDoc(
          doc(
            db,
            COLLECTION,
            playerId,
          ),
        );

      if (
        !snapshot.exists()
      ) {
        return undefined;
      }

      return mapPlayer(
        snapshot,
      );
    },

    async getByIdWithPrivate(
      playerId: string,
    ): Promise<
      PlayerProfile | undefined
    > {
      const [
        publicSnapshot,
        privateSnapshot,
      ] =
        await Promise.all([
          getDoc(
            doc(
              db,
              COLLECTION,
              playerId,
            ),
          ),

          getDoc(
            doc(
              db,
              PRIVATE_COLLECTION,
              playerId,
            ),
          ),
        ]);

      if (
        !publicSnapshot.exists()
      ) {
        return undefined;
      }

      return mapPlayerWithPrivateData(
        publicSnapshot,

        privateSnapshot.exists()
          ? privateSnapshot.data()
          : undefined,
      );
    },

    async findByIdentity(
      competitionId: string,
      firstName: string,
      lastName: string,
      birthYear?: number,
    ): Promise<
      PlayerProfile | undefined
    > {
      const normalizedCompetitionId =
        competitionId.trim();

      if (
        !normalizedCompetitionId
      ) {
        throw new Error(
          "La competizione del giocatore è obbligatoria.",
        );
      }

      const players =
        await this.getAllWithPrivateByCompetition(
          normalizedCompetitionId,
        );

      const normalizedFirstName =
        normalizeText(
          firstName,
        );

      const normalizedLastName =
        normalizeText(
          lastName,
        );

      const playersWithSameName =
        players.filter(
          (player) =>
            normalizeText(
              player.firstName,
            ) ===
              normalizedFirstName &&
            normalizeText(
              player.lastName,
            ) ===
              normalizedLastName,
        );

      if (
        birthYear !==
        undefined
      ) {
        return playersWithSameName.find(
          (player) =>
            player.birthYear ===
            birthYear,
        );
      }

      if (
        playersWithSameName.length ===
        1
      ) {
        return playersWithSameName[0];
      }

      return undefined;
    },

    async findOrCreate(
      input:
        CreatePlayerInput,
    ): Promise<{
      player:
        PlayerProfile;

      created:
        boolean;
    }> {
      const existingPlayer =
        await this.findByIdentity(
          input.competitionId,
          input.firstName,
          input.lastName,
          input.birthYear,
        );

      if (
        existingPlayer
      ) {
        return {
          player:
            existingPlayer,

          created:
            false,
        };
      }

      const playerId =
        await this.create(
          input,
        );

      return {
        player: {
          id:
            playerId,

          competitionId:
            input.competitionId.trim(),

          firstName:
            input.firstName.trim(),

          lastName:
            input.lastName.trim(),

          birthYear:
            input.birthYear,

          photoUrl:
            input.photoUrl
              ?.trim() ||
            undefined,

          coverImageUrl:
            input.coverImageUrl
              ?.trim() ||
            undefined,

          historicalImportSources:
            input.historicalImportSources ??
            [],

          preferredFoot:
            input.preferredFoot,

          baseRating:
            input.baseRating,
        },

        created:
          true,
      };
    },

    async create(
      input:
        CreatePlayerInput,
    ): Promise<string> {
      const competitionId =
        input.competitionId.trim();

      const firstName =
        input.firstName.trim();

      const lastName =
        input.lastName.trim();

      if (
        !competitionId
      ) {
        throw new Error(
          "La competizione del giocatore è obbligatoria.",
        );
      }

      if (
        firstName.length <
          2 ||
        lastName.length <
          2
      ) {
        throw new Error(
          "Inserisci nome e cognome validi.",
        );
      }

      const playerReference =
        doc(
          collection(
            db,
            COLLECTION,
          ),
        );

      const batch =
        writeBatch(
          db,
        );

      batch.set(
        playerReference,

        {
          competitionId,

          firstName,

          lastName,

          photoUrl:
            normalizeOptionalText(
              input.photoUrl,
            ) ??
            null,

          coverImageUrl:
            normalizeOptionalText(
              input.coverImageUrl,
            ) ??
            null,

          historicalImportSources:
            input.historicalImportSources ??
            [],

          preferredFoot:
            input.preferredFoot ??
            null,

          baseRating:
            normalizeBaseRating(
              input.baseRating,
            ),

          achievements:
            [],

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
      );

      if (
        input.birthYear !==
        undefined
      ) {
        batch.set(
          doc(
            db,
            PRIVATE_COLLECTION,
            playerReference.id,
          ),

          {
            birthYear:
              input.birthYear,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          },
        );
      }

      await batch.commit();

      return playerReference.id;
    },

    async update(
      input:
        UpdatePlayerInput,
    ): Promise<void> {
      const updateData:
        Record<
          string,
          unknown
        > = {
        updatedAt:
          serverTimestamp(),
      };

      if (
        input.firstName !==
        undefined
      ) {
        const firstName =
          input.firstName.trim();

        if (
          firstName.length <
          2
        ) {
          throw new Error(
            "Inserisci un nome valido.",
          );
        }

        updateData.firstName =
          firstName;
      }

      if (
        input.lastName !==
        undefined
      ) {
        const lastName =
          input.lastName.trim();

        if (
          lastName.length <
          2
        ) {
          throw new Error(
            "Inserisci un cognome valido.",
          );
        }

        updateData.lastName =
          lastName;
      }

      if (
        input.photoUrl !==
        undefined
      ) {
        updateData.photoUrl =
          normalizeOptionalText(
            input.photoUrl,
          );
      }

      if (
        input.coverImageUrl !==
        undefined
      ) {
        updateData.coverImageUrl =
          normalizeOptionalText(
            input.coverImageUrl,
          );
      }

      if (
        input.preferredFoot !==
        undefined
      ) {
        updateData.preferredFoot =
          input.preferredFoot;
      }

      if (
        input.baseRating !==
        undefined
      ) {
        updateData.baseRating =
          input.baseRating;
      }

      if (
        input.historicalImportSources !==
        undefined
      ) {
        const currentSnapshot =
          await getDoc(
            doc(
              db,
              COLLECTION,
              input.playerId,
            ),
          );

        const currentSources =
          currentSnapshot.exists()
            ? getHistoricalImportSources(
                currentSnapshot.data()
                  .historicalImportSources,
              )
            : [];

        updateData.historicalImportSources =
          mergeHistoricalImportSources(
            currentSources,
            input.historicalImportSources,
          );
      }

      const batch =
        writeBatch(
          db,
        );

      batch.update(
        doc(
          db,
          COLLECTION,
          input.playerId,
        ),

        updateData,
      );

      if (
        input.birthYear !==
        undefined
      ) {
        batch.set(
          doc(
            db,
            PRIVATE_COLLECTION,
            input.playerId,
          ),

          {
            birthYear:
              input.birthYear,

            updatedAt:
              serverTimestamp(),
          },

          {
            merge:
              true,
          },
        );
      }

      await batch.commit();
    },

    async upsertAchievement({
  playerId,
  achievement,
}: {
  playerId: string;

  achievement:
    PlayerAchievement;
}): Promise<void> {
  const player =
    await this.getById(
      playerId,
    );

  if (!player) {
    throw new Error(
      "Giocatore non trovato.",
    );
  }

  const currentAchievements =
    player.achievements ??
    [];

  /*
   * L'id dell'achievement è deterministico:
   *
   * seasonId + competition
   *
   * quindi lo stesso titolo non può
   * essere duplicato sullo stesso
   * giocatore.
   */

  const existingIndex =
    currentAchievements.findIndex(
      (currentAchievement) =>
        currentAchievement.id ===
        achievement.id,
    );

  const nextAchievements =
    [...currentAchievements];

  if (
    existingIndex >=
    0
  ) {
    nextAchievements[
      existingIndex
    ] = achievement;
  } else {
    nextAchievements.push(
      achievement,
    );
  }

  await updateDoc(
    doc(
      db,
      COLLECTION,
      playerId,
    ),

    {
      achievements:
        nextAchievements,

      updatedAt:
        serverTimestamp(),
    },
  );
},

    async mergeProfileData({
  targetPlayerId,
  sourcePlayerId,
}: {
  targetPlayerId: string;
  sourcePlayerId: string;
}): Promise<void> {
  if (
    targetPlayerId ===
    sourcePlayerId
  ) {
    throw new Error(
      "I due profili devono essere diversi.",
    );
  }

  const [
    targetPlayer,
    sourcePlayer,
  ] =
    await Promise.all([
      this.getByIdWithPrivate(
        targetPlayerId,
      ),

      this.getByIdWithPrivate(
        sourcePlayerId,
      ),
    ]);

  if (
    !targetPlayer
  ) {
    throw new Error(
      "Profilo principale non trovato.",
    );
  }

  if (
    !sourcePlayer
  ) {
    throw new Error(
      "Profilo duplicato non trovato.",
    );
  }

  if (
    targetPlayer.competitionId !==
      sourcePlayer.competitionId
  ) {
    throw new Error(
      "Non è possibile unire profili appartenenti a competizioni diverse.",
    );
  }

  const updateData:
    Record<
      string,
      unknown
    > = {
    updatedAt:
      serverTimestamp(),
  };

  const privateUpdateData:
    Record<
      string,
      unknown
    > = {};

  /*
   * Manteniamo sempre i dati già presenti
   * nel profilo principale.
   *
   * Utilizziamo il duplicato solo per
   * completare eventuali campi mancanti.
   */

  if (
    targetPlayer.birthYear ===
      undefined &&
    sourcePlayer.birthYear !==
      undefined
  ) {
    privateUpdateData.birthYear =
      sourcePlayer.birthYear;
  }

  if (
    !targetPlayer.photoUrl &&
    sourcePlayer.photoUrl
  ) {
    updateData.photoUrl =
      sourcePlayer.photoUrl;
  }

  if (
    !targetPlayer.coverImageUrl &&
    sourcePlayer.coverImageUrl
  ) {
    updateData.coverImageUrl =
      sourcePlayer.coverImageUrl;
  }

  if (
    !targetPlayer.preferredFoot &&
    sourcePlayer.preferredFoot
  ) {
    updateData.preferredFoot =
      sourcePlayer.preferredFoot;
  }

  if (
    targetPlayer.baseRating ===
      undefined &&
    sourcePlayer.baseRating !==
      undefined
  ) {
    updateData.baseRating =
      sourcePlayer.baseRating;
  }

  const targetAchievements =
  targetPlayer.achievements ??
  [];

const sourceAchievements =
  sourcePlayer.achievements ??
  [];

if (
  sourceAchievements.length >
  0
) {
  const achievementsById =
    new Map<
      string,
      PlayerAchievement
    >();

  for (
    const achievement of
    targetAchievements
  ) {
    achievementsById.set(
      achievement.id,
      achievement,
    );
  }

  for (
    const achievement of
    sourceAchievements
  ) {
    /*
     * Il profilo principale ha
     * precedenza in caso di
     * achievement già presente.
     */
    if (
      !achievementsById.has(
        achievement.id,
      )
    ) {
      achievementsById.set(
        achievement.id,
        achievement,
      );
    }
  }

  updateData.achievements =
    Array.from(
      achievementsById.values(),
    );
}

  const batch =
    writeBatch(
      db,
    );

  batch.update(
    doc(
      db,
      COLLECTION,
      targetPlayerId,
    ),

    updateData,
  );

  if (
    Object.keys(
      privateUpdateData,
    ).length >
    0
  ) {
    batch.set(
      doc(
        db,
        PRIVATE_COLLECTION,
        targetPlayerId,
      ),

      {
        ...privateUpdateData,

        updatedAt:
          serverTimestamp(),
      },

      {
        merge:
          true,
      },
    );
  }

  await batch.commit();
},

    async remove(
      playerId: string,
    ): Promise<void> {
      const batch =
        writeBatch(
          db,
        );

      batch.delete(
        doc(
          db,
          COLLECTION,
          playerId,
        ),
      );

      batch.delete(
        doc(
          db,
          PRIVATE_COLLECTION,
          playerId,
        ),
      );

      await batch.commit();
    },
  };