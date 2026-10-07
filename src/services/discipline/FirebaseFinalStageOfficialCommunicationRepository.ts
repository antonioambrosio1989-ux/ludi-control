import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  db,
} from "@/src/lib/firebase";

import type {
  FinalStageOfficialCommunication,
} from "@/src/types/FinalStageOfficialCommunication";

const COLLECTION_NAME =
  "finalStageOfficialCommunications";

function documentId({
  seasonId,
  finalStageWeek,
}: {
  seasonId:
    string;
  finalStageWeek:
    number;
}) {
  return `${seasonId}-fs${finalStageWeek}`;
}

export const FirebaseFinalStageOfficialCommunicationRepository =
  {
    async getBySeasonAndWeek({
      seasonId,
      finalStageWeek,
    }: {
      seasonId:
        string;
      finalStageWeek:
        number;
    }): Promise<
      FinalStageOfficialCommunication |
      undefined
    > {
      const snapshot =
        await getDoc(
          doc(
            db,
            COLLECTION_NAME,
            documentId({
              seasonId,
              finalStageWeek,
            }),
          ),
        );

      if (
        !snapshot.exists()
      ) {
        return undefined;
      }

      return snapshot.data() as
        FinalStageOfficialCommunication;
    },

    async saveDraft(
      communication:
        FinalStageOfficialCommunication,
    ): Promise<string> {
      const id =
        documentId({
          seasonId:
            communication.seasonId,
          finalStageWeek:
            communication.finalStageWeek,
        });

      await setDoc(
        doc(
          db,
          COLLECTION_NAME,
          id,
        ),
        {
          ...communication,
          id,
          phase:
            "finalStage",
          roundSlug:
            `fs${communication.finalStageWeek}`,
          status:
            "draft",
          updatedAt:
            serverTimestamp(),
        },
        {
          merge:
            true,
        },
      );

      return id;
    },

    async publish(
      communication:
        FinalStageOfficialCommunication,
    ): Promise<void> {
      const id =
        documentId({
          seasonId:
            communication.seasonId,
          finalStageWeek:
            communication.finalStageWeek,
        });

      await setDoc(
        doc(
          db,
          COLLECTION_NAME,
          id,
        ),
        {
          ...communication,
          id,
          phase:
            "finalStage",
          roundSlug:
            `fs${communication.finalStageWeek}`,
          status:
            "published",
          updatedAt:
            serverTimestamp(),
          publishedAt:
            serverTimestamp(),
        },
        {
          merge:
            true,
        },
      );
    },

    async unpublish({
      seasonId,
      finalStageWeek,
    }: {
      seasonId:
        string;
      finalStageWeek:
        number;
    }): Promise<void> {
      await updateDoc(
        doc(
          db,
          COLLECTION_NAME,
          documentId({
            seasonId,
            finalStageWeek,
          }),
        ),
        {
          status:
            "draft",
          publishedAt:
            null,
          updatedAt:
            serverTimestamp(),
        },
      );
    }
  };
