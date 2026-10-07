import { mapDocument } from "@/src/lib/firestore/mappers/HallOfChampionsDocumentMapper";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import type {
  CreateHallOfChampionsEntryInput,
  HallOfChampionsEntry,
  HallOfChampionsFinalPlayer,
  HallOfChampionsPlayer,
  UpdateHallOfChampionsEntryInput,
} from "@/src/types/HallOfChampionsEntry";

const COLLECTION_NAME =
  "hallOfChampions";


/*
 * ============================================================
 * HELPERS BASE
 * ============================================================
 */











/*
 * ============================================================
 * MARCATORI FINALE
 * ============================================================
 */



/*
 * ============================================================
 * ROSA CAMPIONE
 * ============================================================
 */



/*
 * ============================================================
 * MINUTI GOL TABELLINO FINALE
 * ============================================================
 */



/*
 * ============================================================
 * RIGORI TABELLINO FINALE
 * ============================================================
 */



/*
 * ============================================================
 * GIOCATORI TABELLINO FINALE
 * ============================================================
 */



/*
 * ============================================================
 * TABELLINO COMPLETO FINALE
 * ============================================================
 */



/*
 * ============================================================
 * MAPPING DOCUMENTO FIRESTORE
 * ============================================================
 */



/*
 * ============================================================
 * GET BY ID
 * ============================================================
 */

async function getById(
  entryId: string,
): Promise<
  HallOfChampionsEntry | undefined
> {
  const snapshot =
    await getDoc(
      doc(
        db,
        COLLECTION_NAME,
        entryId,
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
 * GET BY SEASON
 * ============================================================
 */

async function getBySeasonId(
  seasonId: string,
): Promise<
  HallOfChampionsEntry | undefined
> {
  const normalizedSeasonId =
    seasonId.trim();

  if (
    !normalizedSeasonId
  ) {
    return undefined;
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

        limit(
          1,
        ),
      ),
    );

  const firstDocument =
    snapshot.docs[0];

  if (
    !firstDocument
  ) {
    return undefined;
  }

  return mapDocument({
    id:
      firstDocument.id,

    data: () =>
      firstDocument.data(),
  });
}

/*
 * ============================================================
 * GET ALL
 * ============================================================
 */

async function getAll(): Promise<
  HallOfChampionsEntry[]
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
}

/*
 * ============================================================
 * VALIDAZIONE
 * ============================================================
 */

function validateInput(
  input:
    CreateHallOfChampionsEntryInput,
) {
  if (
    input.seasonName.trim()
      .length < 4
  ) {
    throw new Error(
      "Inserisci la stagione.",
    );
  }

  if (
    input.competitionName.trim()
      .length < 2
  ) {
    throw new Error(
      "Inserisci la competizione.",
    );
  }

  if (
    input.championTeamName.trim()
      .length < 2
  ) {
    throw new Error(
      "Inserisci la squadra campione.",
    );
  }

  if (
    input.runnerUpTeamName.trim()
      .length < 2
  ) {
    throw new Error(
      "Inserisci la squadra finalista.",
    );
  }

  if (
    input.championScore <
      0 ||
    input.runnerUpScore <
      0
  ) {
    throw new Error(
      "Il risultato della finale non è valido.",
    );
  }

  if (
    input.championPenalties !==
      undefined &&
    input.championPenalties <
      0
  ) {
    throw new Error(
      "Il risultato ai rigori della squadra campione non è valido.",
    );
  }

  if (
    input.runnerUpPenalties !==
      undefined &&
    input.runnerUpPenalties <
      0
  ) {
    throw new Error(
      "Il risultato ai rigori della squadra finalista non è valido.",
    );
  }
}

/*
 * ============================================================
 * MERGE PLAYER ID - HELPERS
 * ============================================================
 */

function replaceRosterPlayerId(
  roster:
    HallOfChampionsPlayer[],

  sourcePlayerId:
    string,

  targetPlayerId:
    string,
): HallOfChampionsPlayer[] {
  return roster.map(
    (
      player,
    ) => {
      if (
        player.playerId !==
        sourcePlayerId
      ) {
        return player;
      }

      return {
        ...player,

        playerId:
          targetPlayerId,
      };
    },
  );
}

function replaceFinalPlayersPlayerId(
  players:
    HallOfChampionsFinalPlayer[],

  sourcePlayerId:
    string,

  targetPlayerId:
    string,
): HallOfChampionsFinalPlayer[] {
  return players.map(
    (
      player,
    ) => {
      if (
        player.playerId !==
        sourcePlayerId
      ) {
        return player;
      }

      return {
        ...player,

        playerId:
          targetPlayerId,
      };
    },
  );
}

function entryContainsPlayerId(
  entry:
    HallOfChampionsEntry,

  playerId:
    string,
): boolean {
  const rosterContainsPlayer =
    entry.roster.some(
      (
        player,
      ) =>
        player.playerId ===
        playerId,
    );

  const homePlayersContainPlayer =
    entry.finalReport
      ?.homePlayers.some(
        (
          player,
        ) =>
          player.playerId ===
          playerId,
      ) ??
    false;

  const awayPlayersContainPlayer =
    entry.finalReport
      ?.awayPlayers.some(
        (
          player,
        ) =>
          player.playerId ===
          playerId,
      ) ??
    false;

  return (
    rosterContainsPlayer ||
    homePlayersContainPlayer ||
    awayPlayersContainPlayer
  );
}

/*
 * ============================================================
 * REPOSITORY
 * ============================================================
 */

export const FirebaseHallOfChampionsRepository =
  {
    /*
     * ========================================================
     * SUBSCRIBE ALL
     * ========================================================
     */

    subscribeAll(
      onChange: (
        entries:
          HallOfChampionsEntry[],
      ) => void,

      onError?: (
        error: Error,
      ) => void,
    ): Unsubscribe {
      /*
       * Non usiamo orderBy("seasonName") qui.
       *
       * In Firestore orderBy esclude dalla query i documenti
       * che non possiedono il campo ordinato. Le entry legacy
       * più vecchie possono usare season / seasonLabel e quindi
       * non arrivavano mai alla pagina.
       */
      return onSnapshot(
        collection(
          db,
          COLLECTION_NAME,
        ),

        (
          snapshot,
        ) => {
          const entries =
            snapshot.docs
              .map(
                mapDocument,
              )
              .sort(
                (
                  first,
                  second,
                ) =>
                  second.seasonName.localeCompare(
                    first.seasonName,
                    "it",
                    {
                      numeric: true,
                    },
                  ),
              );

          onChange(
            entries,
          );
        },

        (
          error,
        ) => {
          console.error(
            "Errore caricamento Albo d'Oro:",
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
      entryId:
        string,
    ) {
      return getById(
        entryId,
      );
    },

    /*
     * ========================================================
     * GET BY SEASON ID
     * ========================================================
     */

    async getBySeasonId(
      seasonId:
        string,
    ) {
      return getBySeasonId(
        seasonId,
      );
    },

    /*
     * ========================================================
     * GET ALL
     * ========================================================
     */

    async getAll() {
      return getAll();
    },

    /*
     * ========================================================
     * CREATE
     * ========================================================
     */

    async create(
      input:
        CreateHallOfChampionsEntryInput,
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
              input.seasonId ??
              null,

            seasonName:
              input.seasonName.trim(),

            competitionId:
  input.competitionId ??
  null,

            competitionName:
              input.competitionName.trim(),

            championTeamId:
              input.championTeamId ??
              null,

            championTeamName:
              input.championTeamName.trim(),

            runnerUpTeamId:
              input.runnerUpTeamId ??
              null,

            runnerUpTeamName:
              input.runnerUpTeamName.trim(),

            championScore:
              input.championScore,

            runnerUpScore:
              input.runnerUpScore,

            championPenalties:
              input.championPenalties ??
              null,

            runnerUpPenalties:
              input.runnerUpPenalties ??
              null,

            finalGoals:
              input.finalGoals,

            finalReport:
              input.finalReport ??
              null,

            winnerPhotoUrl:
              input.winnerPhotoUrl ??
              null,

            winnerPhotoKey:
              input.winnerPhotoKey ??
              null,

            finalMvpPhotoUrl:
              input.finalMvpPhotoUrl ??
              null,

            finalMvpPhotoKey:
              input.finalMvpPhotoKey ??
              null,

            roster:
              input.roster,

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
     * UPDATE
     * ========================================================
     */

    async update(
      input:
        UpdateHallOfChampionsEntryInput,
    ): Promise<void> {
      const existingEntry =
        await getById(
          input.entryId,
        );

      if (
        !existingEntry
      ) {
        throw new Error(
          "La voce dell'Albo d'Oro non esiste.",
        );
      }

      validateInput(
        input,
      );

      await updateDoc(
        doc(
          db,
          COLLECTION_NAME,
          input.entryId,
        ),

        {
          seasonId:
            input.seasonId ??
            null,

          seasonName:
            input.seasonName.trim(),

          competitionId:
  input.competitionId ??
  null,

          competitionName:
            input.competitionName.trim(),

          championTeamId:
            input.championTeamId ??
            null,

          championTeamName:
            input.championTeamName.trim(),

          runnerUpTeamId:
            input.runnerUpTeamId ??
            null,

          runnerUpTeamName:
            input.runnerUpTeamName.trim(),

          championScore:
            input.championScore,

          runnerUpScore:
            input.runnerUpScore,

          championPenalties:
            input.championPenalties ??
            null,

          runnerUpPenalties:
            input.runnerUpPenalties ??
            null,

          finalGoals:
            input.finalGoals,

          finalReport:
            input.finalReport ??
            null,

          winnerPhotoUrl:
            input.winnerPhotoUrl ??
            null,

          winnerPhotoKey:
            input.winnerPhotoKey ??
            null,

          finalMvpPhotoUrl:
            input.finalMvpPhotoUrl ??
            null,

          finalMvpPhotoKey:
            input.finalMvpPhotoKey ??
            null,

          roster:
            input.roster,

          updatedAt:
            serverTimestamp(),
        },
      );
    },

    /*
     * ========================================================
     * MERGE RIFERIMENTI GIOCATORE
     * ========================================================
     *
     * sourcePlayerId:
     * profilo duplicato da eliminare.
     *
     * targetPlayerId:
     * profilo principale da conservare.
     *
     * Vengono aggiornati:
     *
     * - roster[].playerId
     * - finalReport.homePlayers[].playerId
     * - finalReport.awayPlayers[].playerId
     *
     * NON vengono modificati:
     *
     * - foto vincitori
     * - foto MVP
     * - risultati
     * - alias squadre
     * - marcatori
     * - voti
     * - minuti gol
     * - autoreti
     * ========================================================
     */

    async mergePlayerReferences({
      sourcePlayerId,
      targetPlayerId,
    }: {
      sourcePlayerId:
        string;

      targetPlayerId:
        string;
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
       * Firestore non permette una query semplice
       * su playerId annidato negli array di oggetti.
       *
       * Leggiamo quindi tutte le edizioni.
       */

      const snapshot =
        await getDocs(
          collection(
            db,
            COLLECTION_NAME,
          ),
        );

      const affectedDocuments =
        snapshot.docs.filter(
          (
            currentDocument,
          ) => {
            const entry =
              mapDocument({
                id:
                  currentDocument.id,

                data: () =>
                  currentDocument.data(),
              });

            return entryContainsPlayerId(
              entry,
              normalizedSourcePlayerId,
            );
          },
        );

      if (
        affectedDocuments.length ===
        0
      ) {
        return;
      }

      /*
       * Ogni documento genera una sola
       * operazione update nel batch.
       */

      if (
        affectedDocuments.length >
        500
      ) {
        throw new Error(
          "Troppe edizioni da aggiornare in una singola operazione.",
        );
      }

      const batch =
        writeBatch(
          db,
        );

      for (
        const currentDocument of
          affectedDocuments
      ) {
        const entry =
          mapDocument({
            id:
              currentDocument.id,

            data: () =>
              currentDocument.data(),
          });

        /*
         * ----------------------------------------------------
         * ROSA CAMPIONE
         * ----------------------------------------------------
         */

        const nextRoster =
          replaceRosterPlayerId(
            entry.roster,
            normalizedSourcePlayerId,
            normalizedTargetPlayerId,
          );

        const updateData:
          Record<
            string,
            unknown
          > = {
          roster:
            nextRoster,

          updatedAt:
            serverTimestamp(),
        };

        /*
         * ----------------------------------------------------
         * TABELLINO FINALE
         * ----------------------------------------------------
         */

        if (
          entry.finalReport
        ) {
          updateData.finalReport =
            {
              ...entry.finalReport,

              homePlayers:
                replaceFinalPlayersPlayerId(
                  entry.finalReport
                    .homePlayers,

                  normalizedSourcePlayerId,

                  normalizedTargetPlayerId,
                ),

              awayPlayers:
                replaceFinalPlayersPlayerId(
                  entry.finalReport
                    .awayPlayers,

                  normalizedSourcePlayerId,

                  normalizedTargetPlayerId,
                ),
            };
        }

        batch.update(
          currentDocument.ref,

          updateData,
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
      entryId:
        string,
    ): Promise<void> {
      const existingEntry =
        await getById(
          entryId,
        );

      if (
        !existingEntry
      ) {
        throw new Error(
          "La voce dell'Albo d'Oro non esiste.",
        );
      }

      await deleteDoc(
        doc(
          db,
          COLLECTION_NAME,
          entryId,
        ),
      );
    },
  };