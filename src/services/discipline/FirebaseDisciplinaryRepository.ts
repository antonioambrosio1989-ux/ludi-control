import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  DISCIPLINARY_RECORDS_COLLECTION,
  DISCIPLINARY_SUSPENSIONS_COLLECTION,
  getDisciplinaryRecordDocumentId,
  mapDisciplinaryRecord,
  mapDisciplinarySuspension,
} from "@/src/services/discipline/DisciplinaryFirestoreCodec";

import {
  db,
} from "@/src/lib/firebase";

import type {
  DisciplinarySuspension,
  PlayerDisciplinaryRecord,
} from "@/src/types/DisciplinaryRecord";

/*
 * ============================================================
 * REPOSITORY
 * ============================================================
 */

export const FirebaseDisciplinaryRepository =
  {
    /*
     * ========================================================
     * RECORD DISCIPLINARI
     * ========================================================
     */

    async getRecordsBySeason(
      seasonId:
        string,
    ): Promise<
      PlayerDisciplinaryRecord[]
    > {
      const snapshot =
        await getDocs(
          query(
            collection(
              db,
              DISCIPLINARY_RECORDS_COLLECTION,
            ),

            where(
              "seasonId",
              "==",
              seasonId,
            ),
          ),
        );

      return snapshot.docs.map(
        (
          document,
        ) =>
          mapDisciplinaryRecord(
            document.id,
            document.data(),
          ),
      );
    },

    /*
     * ========================================================
     * CREAZIONE SQUALIFICA CON ID DETERMINISTICO
     * ========================================================
     */

    async createSuspensionWithId(
      suspensionId:
        string,

      suspension:
        Omit<
          DisciplinarySuspension,
          | "id"
          | "createdAt"
          | "updatedAt"
          | "completedAt"
        >,
    ): Promise<void> {
      await setDoc(
        doc(
          db,
          DISCIPLINARY_SUSPENSIONS_COLLECTION,
          suspensionId,
        ),

        {
          ...suspension,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),

          completedAt:
            null,
        },

        {
          merge:
            true,
        },
      );
    },

    /*
     * ========================================================
     * TUTTE LE SQUALIFICHE DELLA STAGIONE
     * ========================================================
     */

    async getSuspensionsBySeason(
      seasonId:
        string,
    ): Promise<
      DisciplinarySuspension[]
    > {
      const snapshot =
        await getDocs(
          query(
            collection(
              db,
              DISCIPLINARY_SUSPENSIONS_COLLECTION,
            ),

            where(
              "seasonId",
              "==",
              seasonId,
            ),
          ),
        );

      return snapshot.docs.map(
        (
          document,
        ) =>
          mapDisciplinarySuspension(
            document.id,
            document.data(),
          ),
      );
    },

    /*
     * ========================================================
     * SQUALIFICHE ATTIVE DELLA STAGIONE
     * ========================================================
     */

    async getActiveSuspensionsBySeason(
      seasonId:
        string,
    ): Promise<
      DisciplinarySuspension[]
    > {
      const snapshot =
        await getDocs(
          query(
            collection(
              db,
              DISCIPLINARY_SUSPENSIONS_COLLECTION,
            ),

            where(
              "seasonId",
              "==",
              seasonId,
            ),

            where(
              "status",
              "==",
              "active",
            ),
          ),
        );

      return snapshot.docs.map(
        (
          document,
        ) =>
          mapDisciplinarySuspension(
            document.id,
            document.data(),
          ),
      );
    },

    /*
     * ========================================================
     * UPSERT RECORD GIOCATORE
     * ========================================================
     */

    async upsertRecord(
      record:
        Omit<
          PlayerDisciplinaryRecord,
          | "id"
          | "createdAt"
          | "updatedAt"
        >,
    ): Promise<void> {
      const documentId =
        getDisciplinaryRecordDocumentId({
          seasonId:
            record.seasonId,

          playerId:
            record.playerId,
        });

      await setDoc(
        doc(
          db,
          DISCIPLINARY_RECORDS_COLLECTION,
          documentId,
        ),

        {
          ...record,

          updatedAt:
            serverTimestamp(),

          createdAt:
            serverTimestamp(),
        },

        {
          merge:
            true,
        },
      );
    },

    /*
     * ========================================================
     * CREAZIONE SQUALIFICA CON ID FIRESTORE
     * ========================================================
     */

    async createSuspension(
      suspension:
        Omit<
          DisciplinarySuspension,
          | "id"
          | "createdAt"
          | "updatedAt"
          | "completedAt"
        >,
    ): Promise<string> {
      const reference =
        doc(
          collection(
            db,
            DISCIPLINARY_SUSPENSIONS_COLLECTION,
          ),
        );

      await setDoc(
        reference,

        {
          ...suspension,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),

          completedAt:
            null,
        },
      );

      return reference.id;
    },

    /*
     * ========================================================
     * UPDATE SQUALIFICA
     * ========================================================
     */

    async updateSuspension(
      suspensionId:
        string,

      data:
        Partial<
          Omit<
            DisciplinarySuspension,
            | "id"
            | "createdAt"
          >
        >,
    ): Promise<void> {
      await updateDoc(
        doc(
          db,
          DISCIPLINARY_SUSPENSIONS_COLLECTION,
          suspensionId,
        ),

        {
          ...data,

          updatedAt:
            serverTimestamp(),

          completedAt:
            data.status ===
            "completed"
              ? serverTimestamp()
              : undefined,
        },
      );
    },

    /*
     * ========================================================
     * COMPLETAMENTO SQUALIFICA
     * ========================================================
     */

    async completeSuspension({
      suspensionId,
      servedMatches,
    }: {
      suspensionId:
        string;

      servedMatches:
        number;
    }): Promise<void> {
      await updateDoc(
        doc(
          db,
          DISCIPLINARY_SUSPENSIONS_COLLECTION,
          suspensionId,
        ),

        {
          servedMatches,

          remainingMatches:
            0,

          status:
            "completed",

          updatedAt:
            serverTimestamp(),

          completedAt:
            serverTimestamp(),
        },
      );
    },
  };