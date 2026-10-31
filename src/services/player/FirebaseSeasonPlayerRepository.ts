import { mapSeasonPlayer } from "@/src/lib/firestore/mappers/SeasonPlayerDocumentMapper";
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
  runTransaction,
} from "firebase/firestore";

import {
  FirebaseSeasonTeamRepository,
} from "@/src/services/team/FirebaseSeasonTeamRepository";

import { db } from "@/src/lib/firebase";

import { assertSeasonWritable } from "@/src/services/season/SeasonWriteGuard";

import type {
  CreateSeasonPlayerInput,
  SeasonPlayer,
  UpdateSeasonPlayerInput,
} from "@/src/types/SeasonPlayer";

const COLLECTION_NAME =
  "seasonPlayers";

// FASE 14I: stesso formato di registro della anteprima 14G
const REGISTRY_COLLECTION = "seasonPlayerKeys";
function registryId(seasonId: string, playerId: string): string {
  const input = new TextEncoder().encode(JSON.stringify([seasonId, playerId]));
  let binary = "";
  for (const byte of input) binary += String.fromCharCode(byte);
  return "sp_" + btoa(binary).replace(/[+]/g, "-").replace(/[/]/g, "_").replace(/=+$/g, "");
}


function normalizeOptionalNumber(
  value?: number,
): number | null {
  return typeof value === "number"
    ? value
    : null;
}



function buildSeasonPlayerKey({
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

function chooseSeasonPlayerStatus(
  first:
    SeasonPlayer["status"],

  second:
    SeasonPlayer["status"],
): SeasonPlayer["status"] {
  /*
   * Se uno dei due documenti è attivo,
   * consideriamo il giocatore attivo.
   */

  if (
    first === "active" ||
    second === "active"
  ) {
    return "active";
  }

  /*
   * Un trasferito ha priorità rispetto
   * a un semplice inattivo.
   */

  if (
    first === "transferred" ||
    second === "transferred"
  ) {
    return "transferred";
  }

  if (
    first === "withdrawn" ||
    second === "withdrawn"
  ) {
    return "withdrawn";
  }

  return "inactive";
}

export const FirebaseSeasonPlayerRepository =
  {
    async getAll(): Promise<
      SeasonPlayer[]
    > {
      const snapshot =
        await getDocs(
          collection(
            db,
            COLLECTION_NAME,
          ),
        );

      return snapshot.docs.map(
        (currentDocument) =>
          mapSeasonPlayer(
            currentDocument.id,
            currentDocument.data(),
          ),
      );
    },

    async getByPlayerId(
      playerId: string,
    ): Promise<
      SeasonPlayer[]
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
        (currentDocument) =>
          mapSeasonPlayer(
            currentDocument.id,
            currentDocument.data(),
          ),
      );
    },

    async getBySeasonId(
      seasonId: string,
    ): Promise<SeasonPlayer[]> {
      const seasonPlayersQuery =
        query(
          collection(
            db,
            COLLECTION_NAME,
          ),

          where(
            "seasonId",
            "==",
            seasonId,
          ),

          orderBy(
            "createdAt",
            "asc",
          ),
        );

      const snapshot =
        await getDocs(
          seasonPlayersQuery,
        );

      return snapshot.docs.map(
        (currentDocument) =>
          mapSeasonPlayer(
            currentDocument.id,
            currentDocument.data(),
          ),
      );
    },

    async getBySeasonAndTeam(
      seasonId: string,
      teamId: string,
    ): Promise<SeasonPlayer[]> {
      const seasonPlayersQuery =
        query(
          collection(
            db,
            COLLECTION_NAME,
          ),

          where(
            "seasonId",
            "==",
            seasonId,
          ),

          where(
            "teamId",
            "==",
            teamId,
          ),

          orderBy(
            "createdAt",
            "asc",
          ),
        );

      const snapshot =
        await getDocs(
          seasonPlayersQuery,
        );

      return snapshot.docs.map(
        (currentDocument) =>
          mapSeasonPlayer(
            currentDocument.id,
            currentDocument.data(),
          ),
      );
    },

    async getById(
      seasonPlayerId: string,
    ): Promise<
      SeasonPlayer | undefined
    > {
      const snapshot =
        await getDoc(
          doc(
            db,
            COLLECTION_NAME,
            seasonPlayerId,
          ),
        );

      if (!snapshot.exists()) {
        return undefined;
      }

      return mapSeasonPlayer(
        snapshot.id,
        snapshot.data(),
      );
    },

    async exists(
      seasonId: string,
      teamId: string,
      playerId: string,
    ): Promise<boolean> {
      const existingQuery =
        query(
          collection(
            db,
            COLLECTION_NAME,
          ),

          where(
            "seasonId",
            "==",
            seasonId,
          ),

          where(
            "teamId",
            "==",
            teamId,
          ),

          where(
            "playerId",
            "==",
            playerId,
          ),
        );

      const snapshot =
        await getDocs(
          existingQuery,
        );

      return !snapshot.empty;
    },

    async create(
      input: CreateSeasonPlayerInput,
    ): Promise<string> {
      await assertSeasonWritable(
        input.seasonId,
      );

      const seasonTeams =
  await FirebaseSeasonTeamRepository.getBySeasonId(
    input.seasonId,
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
        await FirebaseSeasonPlayerRepository.getBySeasonId(
          input.seasonId,
        );

      const playerAlreadyRegistered =
        seasonPlayers.some(
          (seasonPlayer) =>
            seasonPlayer.playerId ===
            input.playerId,
        );

      if (playerAlreadyRegistered) {
        throw new Error(
          "Il giocatore è già registrato in una squadra per questa stagione.",
        );
      }

      if (
        typeof input.shirtNumber ===
        "number"
      ) {
        const shirtNumberAlreadyUsed =
          seasonPlayers.some(
            (seasonPlayer) =>
              seasonPlayer.teamId ===
                input.teamId &&
              seasonPlayer.status ===
                "active" &&
              seasonPlayer.shirtNumber ===
                input.shirtNumber,
          );

        if (
          shirtNumberAlreadyUsed
        ) {
          throw new Error(
            `Il numero ${input.shirtNumber} è già utilizzato nella squadra selezionata.`,
          );
        }
      }

      const rosterRef = doc(collection(db, COLLECTION_NAME));
      const registryRef = doc(db, REGISTRY_COLLECTION, registryId(input.seasonId, input.playerId));
      await runTransaction(db, async (tx) => {
        const existing = await tx.get(registryRef);
        if (existing.exists()) throw new Error("Giocatore gia registrato nella stagione.");
        tx.set(rosterRef, {
          seasonId: input.seasonId, playerId: input.playerId, teamId: input.teamId,
          role: input.role, shirtNumber: normalizeOptionalNumber(input.shirtNumber),
          status: "active", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        tx.set(registryRef, { seasonId: input.seasonId, playerId: input.playerId, seasonPlayerId: rosterRef.id });
      });
      return rosterRef.id;
    },

    async createMany(
      inputs: CreateSeasonPlayerInput[],
    ): Promise<void> {
      if (inputs.length === 0) {
        return;
      }

      if (inputs.length > 500) {
        throw new Error(
          "Puoi importare al massimo 500 giocatori alla volta.",
        );
      }

      const seasonIds =
        Array.from(
          new Set(
            inputs.map(
              (input) =>
                input.seasonId,
            ),
          ),
        );

      if (
        seasonIds.length !== 1
      ) {
        throw new Error(
          "Tutti i giocatori importati devono appartenere alla stessa stagione.",
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

const invalidTeamInput =
  inputs.find(
    (input) =>
      !registeredTeamIds.has(
        String(
          input.teamId,
        ),
      ),
  );

if (invalidTeamInput) {
  throw new Error(
    "Il file contiene una squadra non iscritta alla stagione.",
  );
}

      const existingSeasonPlayers =
        await FirebaseSeasonPlayerRepository.getBySeasonId(
          seasonId,
        );

      const existingPlayerKeys =
        new Set(
          existingSeasonPlayers.map(
            (seasonPlayer) =>
              buildSeasonPlayerKey({
                seasonId:
                  seasonPlayer.seasonId,

                playerId:
                  seasonPlayer.playerId,
              }),
          ),
        );

      const existingShirtNumbers =
        new Set(
          existingSeasonPlayers
            .filter(
              (seasonPlayer) =>
                seasonPlayer.status ===
                  "active" &&
                typeof seasonPlayer.shirtNumber ===
                  "number",
            )
            .map(
              (seasonPlayer) =>
                [
                  seasonPlayer.teamId,
                  seasonPlayer.shirtNumber,
                ].join("|"),
            ),
        );

      const importedPlayerKeys =
        new Set<string>();

      const importedShirtNumbers =
        new Set<string>();

      for (const input of inputs) {
        const playerKey =
          buildSeasonPlayerKey({
            seasonId:
              input.seasonId,

            playerId:
              input.playerId,
          });

        if (
          existingPlayerKeys.has(
            playerKey,
          )
        ) {
          throw new Error(
            `Il giocatore ${input.playerId} è già registrato nella stagione.`,
          );
        }

        if (
          importedPlayerKeys.has(
            playerKey,
          )
        ) {
          throw new Error(
            "Il file Excel contiene lo stesso giocatore più di una volta.",
          );
        }

        importedPlayerKeys.add(
          playerKey,
        );

        if (
          typeof input.shirtNumber ===
          "number"
        ) {
          const shirtNumberKey = [
            input.teamId,
            input.shirtNumber,
          ].join("|");

          if (
            existingShirtNumbers.has(
              shirtNumberKey,
            )
          ) {
            throw new Error(
              `Il numero ${input.shirtNumber} è già utilizzato nella squadra ${input.teamId}.`,
            );
          }

          if (
            importedShirtNumbers.has(
              shirtNumberKey,
            )
          ) {
            throw new Error(
              `Il file Excel assegna più volte il numero ${input.shirtNumber} alla stessa squadra.`,
            );
          }

          importedShirtNumbers.add(
            shirtNumberKey,
          );
        }
      }

      // FASE 14J: lettura delle chiavi dentro la transazione.
      // Ogni blocco e atomico. Blocchi diversi NON sono atomici tra loro.
      // Non pubblicare finche registro storico e regole sono completi.
      for (let offset = 0; offset < inputs.length; offset += 2) {
        const slice = inputs.slice(offset, offset + 2);
        const items = slice.map((input) => ({
          input,
          rosterRef: doc(collection(db, COLLECTION_NAME)),
          registryRef: doc(db, REGISTRY_COLLECTION, registryId(input.seasonId, input.playerId)),
        }));
        await runTransaction(db, async (tx) => {
          // Firestore impone tutte le letture prima delle scritture.
          const keys = await Promise.all(items.map(({registryRef}) => tx.get(registryRef)));
          for (let index = 0; index < keys.length; index++) {
            if (keys[index].exists()) {
              throw new Error(`Giocatore ${items[index].input.playerId} gia presente nel registro.`);
            }
          }
          for (const {input, rosterRef, registryRef} of items) {
            tx.set(rosterRef, {
              seasonId: input.seasonId, playerId: input.playerId, teamId: input.teamId,
              role: input.role, shirtNumber: normalizeOptionalNumber(input.shirtNumber),
              status: "active", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
            });
            tx.set(registryRef, {
              seasonId: input.seasonId, playerId: input.playerId, seasonPlayerId: rosterRef.id,
            });
          }
        });
      }
    },

    async update(
      input: UpdateSeasonPlayerInput,
    ): Promise<void> {
      const existingSeasonPlayer =
        await FirebaseSeasonPlayerRepository.getById(
          input.seasonPlayerId,
        );

      if (!existingSeasonPlayer) {
        throw new Error(
          "Il giocatore stagionale selezionato non esiste.",
        );
      }

      await assertSeasonWritable(
        existingSeasonPlayer.seasonId,
      );

      const seasonTeams =
  await FirebaseSeasonTeamRepository.getBySeasonId(
    existingSeasonPlayer.seasonId,
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
        await FirebaseSeasonPlayerRepository.getBySeasonId(
          existingSeasonPlayer.seasonId,
        );

      if (
        typeof input.shirtNumber ===
        "number"
      ) {
        const shirtNumberAlreadyUsed =
          seasonPlayers.some(
            (seasonPlayer) =>
              seasonPlayer.id !==
                input.seasonPlayerId &&
              seasonPlayer.teamId ===
                input.teamId &&
              seasonPlayer.status ===
                "active" &&
              seasonPlayer.shirtNumber ===
                input.shirtNumber,
          );

        if (
          shirtNumberAlreadyUsed
        ) {
          throw new Error(
            `Il numero ${input.shirtNumber} è già utilizzato nella squadra selezionata.`,
          );
        }
      }

      await updateDoc(
        doc(
          db,
          COLLECTION_NAME,
          input.seasonPlayerId,
        ),
        {
          teamId:
            input.teamId,

          role:
            input.role,

          shirtNumber:
            normalizeOptionalNumber(
              input.shirtNumber,
            ),

          status:
            input.status,

          updatedAt:
            serverTimestamp(),
        },
      );
    },

    /*
 * ============================================================
 * MERGE RIFERIMENTI GIOCATORE
 * ============================================================
 *
 * Utilizzato esclusivamente dalla procedura amministrativa
 * di unione di due profili globali.
 *
 * sourcePlayerId = profilo duplicato da eliminare
 * targetPlayerId = profilo principale da conservare
 *
 * IMPORTANTE:
 * questa operazione è una migrazione di identità e quindi
 * NON utilizza assertSeasonWritable().
 *
 * Deve poter correggere riferimenti anche appartenenti
 * a stagioni già concluse.
 */

async mergePlayerReferences({
  sourcePlayerId,
  targetPlayerId,
}: {
  sourcePlayerId: string;
  targetPlayerId: string;
}): Promise<void> {
  // FASE 14J-B: protezione registro nelle operazioni di identita
  if (typeof sourcePlayerId === "string" && typeof targetPlayerId === "string") {
    throw new Error("Unione profili temporaneamente sospesa: migrazione registro univoco non completata.");
  }

  if (
    !sourcePlayerId.trim() ||
    !targetPlayerId.trim()
  ) {
    throw new Error(
      "playerId non valido.",
    );
  }

  if (
    sourcePlayerId ===
    targetPlayerId
  ) {
    throw new Error(
      "Il profilo principale e quello duplicato devono essere diversi.",
    );
  }

  /*
   * ========================================================
   * DOCUMENTI DEL PROFILO DUPLICATO
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
          sourcePlayerId,
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
   * DOCUMENTI DEL PROFILO PRINCIPALE
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
          targetPlayerId,
        ),
      ),
    );

  const targetSeasonPlayers =
    targetSnapshot.docs.map(
      (currentDocument) => ({
        reference:
          currentDocument.ref,

        player:
          mapSeasonPlayer(
            currentDocument.id,
            currentDocument.data(),
          ),
      }),
    );

  /*
   * ========================================================
   * PRE-CONTROLLO CONFLITTI
   * ========================================================
   *
   * Prima di scrivere qualsiasi cosa controlliamo
   * tutti i possibili conflitti.
   *
   * In questo modo il merge non rimane eseguito
   * soltanto a metà.
   */

  for (
    const sourceDocument of
      sourceSnapshot.docs
  ) {
    const sourcePlayer =
      mapSeasonPlayer(
        sourceDocument.id,
        sourceDocument.data(),
      );

    const existingTarget =
      targetSeasonPlayers.find(
        (currentTarget) =>
          currentTarget.player.seasonId ===
          sourcePlayer.seasonId,
      );

    if (
      !existingTarget
    ) {
      continue;
    }

    /*
     * Se entrambi i profili risultano già presenti
     * nella stessa stagione ma in squadre diverse,
     * non possiamo decidere automaticamente quale
     * associazione sia corretta.
     */

    if (
      existingTarget.player.teamId !==
      sourcePlayer.teamId
    ) {
      throw new Error(
        [
          "Impossibile unire automaticamente i profili.",
          "",
          `Entrambi risultano presenti nella stagione ${sourcePlayer.seasonId},`,
          "ma sono associati a squadre differenti.",
          "",
          "Correggi prima questa anomalia dalla gestione rose.",
        ].join(
          "\n",
        ),
      );
    }
  }

  /*
   * ========================================================
   * MIGRAZIONE
   * ========================================================
   */

  const batch =
    writeBatch(
      db,
    );

  for (
    const sourceDocument of
      sourceSnapshot.docs
  ) {
    const sourcePlayer =
      mapSeasonPlayer(
        sourceDocument.id,
        sourceDocument.data(),
      );

    const existingTarget =
      targetSeasonPlayers.find(
        (currentTarget) =>
          currentTarget.player.seasonId ===
          sourcePlayer.seasonId,
      );

    /*
     * ======================================================
     * CASO 1
     *
     * Il profilo principale NON è ancora presente
     * in questa stagione.
     *
     * È sufficiente cambiare playerId nel documento
     * già esistente.
     * ======================================================
     */

    if (
      !existingTarget
    ) {
      batch.update(
        sourceDocument.ref,

        {
          playerId:
            targetPlayerId,

          updatedAt:
            serverTimestamp(),
        },
      );

      continue;
    }

    /*
     * ======================================================
     * CASO 2
     *
     * Entrambi i profili esistono già nella stessa stagione
     * e nella stessa squadra.
     *
     * Conserviamo il documento del profilo principale
     * ed eliminiamo quello duplicato.
     *
     * Prima recuperiamo eventuali informazioni mancanti.
     * ======================================================
     */

    const mergedShirtNumber =
      existingTarget.player.shirtNumber ??
      sourcePlayer.shirtNumber;

    const mergedStatus =
      chooseSeasonPlayerStatus(
        existingTarget.player.status,
        sourcePlayer.status,
      );

    batch.update(
      existingTarget.reference,

      {
        shirtNumber:
          normalizeOptionalNumber(
            mergedShirtNumber,
          ),

        status:
          mergedStatus,

        updatedAt:
          serverTimestamp(),
      },
    );

    batch.delete(
      sourceDocument.ref,
    );
  }

  await batch.commit();
},

    async remove(
      seasonPlayerId: string,
    ): Promise<void> {
      const existingSeasonPlayer =
        await FirebaseSeasonPlayerRepository.getById(seasonPlayerId);
      if (!existingSeasonPlayer) {
        throw new Error("Il giocatore stagionale selezionato non esiste.");
      }
      await assertSeasonWritable(existingSeasonPlayer.seasonId);
      const rosterRef = doc(db, COLLECTION_NAME, seasonPlayerId);
      const keyRef = doc(
        db,
        REGISTRY_COLLECTION,
        registryId(existingSeasonPlayer.seasonId, existingSeasonPlayer.playerId),
      );
      await runTransaction(db, async (tx) => {
        const roster = await tx.get(rosterRef);
        const key = await tx.get(keyRef);
        if (!roster.exists() || !key.exists()) {
          throw new Error("Registro non migrato o iscrizione assente: eliminazione bloccata.");
        }
        const r = roster.data();
        if (
          r.seasonId !== existingSeasonPlayer.seasonId ||
          r.playerId !== existingSeasonPlayer.playerId ||
          key.data().seasonPlayerId !== seasonPlayerId ||
          key.data().seasonId !== r.seasonId ||
          key.data().playerId !== r.playerId
        ) {
          throw new Error("Incoerenza tra iscrizione e registro: eliminazione bloccata.");
        }
        tx.delete(rosterRef);
        tx.delete(keyRef);
      });
    },
  };