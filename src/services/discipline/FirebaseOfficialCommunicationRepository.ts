import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import type {
  CommunicationClubFine,
  CommunicationSanction,
  CommunicationWarning,
  OfficialCommunication,
} from "@/src/types/OfficialCommunication";

const COLLECTION_NAME =
  "officialCommunications";

function getCommunicationId({
  seasonId,
  matchweek,
}: {
  seasonId: string;
  matchweek: number;
}): string {
  return `${seasonId}-mw${matchweek}`;
}

function mapCommunication(
  id: string,
  data: DocumentData,
): OfficialCommunication {
  return {
    id,

    seasonId: String(
      data.seasonId ?? "",
    ),

    matchweek: Number(
      data.matchweek ?? 0,
    ),

    title: String(
      data.title ?? "",
    ),

    judgeSanctions:
      mapSanctions(
        data.judgeSanctions,
      ),

    directRedSanctions:
      mapSanctions(
        data.directRedSanctions,
      ),

    accumulationSanctions:
      mapSanctions(
        data.accumulationSanctions,
      ),

    warnings:
      mapWarnings(
        data.warnings,
      ),

    clubFines:
      mapClubFines(
        data.clubFines,
      ),

    status:
      data.status === "published"
        ? "published"
        : "draft",

    createdAt:
      mapDateValue(
        data.createdAt,
      ),

    updatedAt:
      mapDateValue(
        data.updatedAt,
      ),

    publishedAt:
      mapDateValue(
        data.publishedAt,
      ),
  };
}

function mapSanctions(
  value: unknown,
): CommunicationSanction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(
    (
      sanction:
        Record<string, unknown>,
      index,
    ) => ({
      id: String(
        sanction.id ??
          `sanction-${index}`,
      ),

      playerId: String(
        sanction.playerId ?? "",
      ),

      playerName: String(
        sanction.playerName ?? "",
      ),

      teamId:
        typeof sanction.teamId ===
        "string"
          ? sanction.teamId
          : undefined,

      teamName: String(
        sanction.teamName ?? "",
      ),

      suspensionMatches:
        sanitizePositiveInteger(
          sanction.suspensionMatches,
        ),

      reason:
        typeof sanction.reason ===
        "string"
          ? sanction.reason
          : undefined,
    }),
  );
}

function mapWarnings(
  value: unknown,
): CommunicationWarning[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(
    (
      warning:
        Record<string, unknown>,
      index,
    ) => ({
      id: String(
        warning.id ??
          `warning-${index}`,
      ),

      playerId: String(
        warning.playerId ?? "",
      ),

      playerName: String(
        warning.playerName ?? "",
      ),

      teamId:
        typeof warning.teamId ===
        "string"
          ? warning.teamId
          : undefined,

      teamName: String(
        warning.teamName ?? "",
      ),

      yellowCards:
        sanitizeNonNegativeInteger(
          warning.yellowCards,
        ),
    }),
  );
}

function mapClubFines(
  value: unknown,
): CommunicationClubFine[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(
    (
      fine: Record<string, unknown>,
      index,
    ) => {
      const type =
        fine.type === "walkover" ||
        fine.type === "facilityDamage"
          ? fine.type
          : "other";

      const amountValue =
        Number(fine.amount);

      return {
        id: String(
          fine.id ??
            `club-fine-${index}`,
        ),

        teamId:
          typeof fine.teamId ===
          "string"
            ? fine.teamId
            : undefined,

        teamName: String(
          fine.teamName ?? "",
        ),

        type,

        amount:
          Number.isFinite(amountValue) &&
          amountValue >= 0
            ? amountValue
            : undefined,

        reason: String(
          fine.reason ?? "",
        ),
      };
    },
  );
}

function mapDateValue(
  value: unknown,
): string | undefined {
  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (
      value as Timestamp
    ).toDate === "function"
  ) {
    return (
      value as Timestamp
    )
      .toDate()
      .toISOString();
  }

  return undefined;
}

function sanitizePositiveInteger(
  value: unknown,
): number {
  const numberValue =
    Number(value);

  if (
    !Number.isFinite(
      numberValue,
    ) ||
    numberValue < 1
  ) {
    return 1;
  }

  return Math.floor(
    numberValue,
  );
}

function sanitizeNonNegativeInteger(
  value: unknown,
): number {
  const numberValue =
    Number(value);

  if (
    !Number.isFinite(
      numberValue,
    ) ||
    numberValue < 0
  ) {
    return 0;
  }

  return Math.floor(
    numberValue,
  );
}

function sanitizeCommunication(
  communication:
    OfficialCommunication,
) {
  return {
    seasonId:
      communication.seasonId,

    matchweek:
      communication.matchweek,

    title:
      communication.title.trim() ||
      `Comunicato disciplinare — Matchweek ${communication.matchweek}`,

    judgeSanctions:
      communication.judgeSanctions.map(
        sanitizeSanction,
      ),

    directRedSanctions:
      communication.directRedSanctions.map(
        sanitizeSanction,
      ),

    accumulationSanctions:
      communication.accumulationSanctions.map(
        sanitizeSanction,
      ),

    warnings:
      communication.warnings.map(
        sanitizeWarning,
      ),

    clubFines:
      communication.clubFines.map(
        sanitizeClubFine,
      ),

    status:
      communication.status,
  };
}

function sanitizeSanction(
  sanction:
    CommunicationSanction,
): CommunicationSanction {
  return {
    id:
      sanction.id,

    playerId:
      sanction.playerId,

    playerName:
      sanction.playerName.trim(),

    teamId:
      sanction.teamId,

    teamName:
      sanction.teamName.trim(),

    suspensionMatches:
      sanitizePositiveInteger(
        sanction.suspensionMatches,
      ),

    reason:
      sanction.reason?.trim() ||
      undefined,
  };
}

function sanitizeWarning(
  warning:
    CommunicationWarning,
): CommunicationWarning {
  return {
    id:
      warning.id,

    playerId:
      warning.playerId,

    playerName:
      warning.playerName.trim(),

    teamId:
      warning.teamId,

    teamName:
      warning.teamName.trim(),

    yellowCards:
      sanitizeNonNegativeInteger(
        warning.yellowCards,
      ),
  };
}

function sanitizeClubFine(
  fine: CommunicationClubFine,
): CommunicationClubFine {
  const amount =
    fine.amount !== undefined &&
    Number.isFinite(fine.amount) &&
    fine.amount >= 0
      ? fine.amount
      : undefined;

  return {
    id: fine.id,

    teamId:
      fine.teamId,

    teamName:
      fine.teamName.trim(),

    type:
      fine.type === "walkover" ||
      fine.type === "facilityDamage"
        ? fine.type
        : "other",

    amount,

    reason:
      fine.reason.trim(),
  };
}

export const FirebaseOfficialCommunicationRepository =
  {
    async getById(
      communicationId: string,
    ): Promise<
      OfficialCommunication | null
    > {
      const snapshot =
        await getDoc(
          doc(
            db,
            COLLECTION_NAME,
            communicationId,
          ),
        );

      if (!snapshot.exists()) {
        return null;
      }

      return mapCommunication(
        snapshot.id,
        snapshot.data(),
      );
    },

    async getBySeasonAndMatchweek({
      seasonId,
      matchweek,
    }: {
      seasonId: string;
      matchweek: number;
    }): Promise<
      OfficialCommunication | null
    > {
      const communicationId =
        getCommunicationId({
          seasonId,
          matchweek,
        });

      return this.getById(
        communicationId,
      );
    },

    async getBySeason(
      seasonId: string,
    ): Promise<
      OfficialCommunication[]
    > {
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
              seasonId,
            ),
            orderBy(
              "matchweek",
              "desc",
            ),
          ),
        );

      return snapshot.docs.map(
        (document) =>
          mapCommunication(
            document.id,
            document.data(),
          ),
      );
    },

    async getPublishedBySeason(
      seasonId: string,
    ): Promise<
      OfficialCommunication[]
    > {
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
              seasonId,
            ),
            where(
              "status",
              "==",
              "published",
            ),
            orderBy(
              "matchweek",
              "desc",
            ),
          ),
        );

      return snapshot.docs.map(
        (document) =>
          mapCommunication(
            document.id,
            document.data(),
          ),
      );
    },

    async saveDraft(
      communication:
        OfficialCommunication,
    ): Promise<string> {
      const communicationId =
        getCommunicationId({
          seasonId:
            communication.seasonId,

          matchweek:
            communication.matchweek,
        });

      const reference =
        doc(
          db,
          COLLECTION_NAME,
          communicationId,
        );

      const existingSnapshot =
        await getDoc(reference);

      await setDoc(
        reference,
        {
          ...sanitizeCommunication({
            ...communication,
            id: communicationId,
            status: "draft",
          }),

          updatedAt:
            serverTimestamp(),

          createdAt:
            existingSnapshot.exists()
              ? existingSnapshot.data()
                  .createdAt ??
                serverTimestamp()
              : serverTimestamp(),

          publishedAt:
            existingSnapshot.exists()
              ? existingSnapshot.data()
                  .publishedAt ??
                null
              : null,
        },
        {
          merge: true,
        },
      );

      return communicationId;
    },

    async updateDraft(
      communication:
        OfficialCommunication,
    ): Promise<void> {
      const communicationId =
        communication.id ||
        getCommunicationId({
          seasonId:
            communication.seasonId,

          matchweek:
            communication.matchweek,
        });

      await setDoc(
        doc(
          db,
          COLLECTION_NAME,
          communicationId,
        ),
        {
          ...sanitizeCommunication({
            ...communication,
            id: communicationId,
            status: "draft",
          }),

          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        },
      );
    },

    async publish(
      communication:
        OfficialCommunication,
    ): Promise<void> {
      const communicationId =
        communication.id ||
        getCommunicationId({
          seasonId:
            communication.seasonId,

          matchweek:
            communication.matchweek,
        });

      await setDoc(
        doc(
          db,
          COLLECTION_NAME,
          communicationId,
        ),
        {
          ...sanitizeCommunication({
            ...communication,
            id: communicationId,
            status: "published",
          }),

          status:
            "published",

          updatedAt:
            serverTimestamp(),

          publishedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        },
      );
    },

    async unpublish(
      communicationId: string,
    ): Promise<void> {
      await updateDoc(
        doc(
          db,
          COLLECTION_NAME,
          communicationId,
        ),
        {
          status: "draft",

          updatedAt:
            serverTimestamp(),

          publishedAt: null,
        },
      );
    },

    subscribeById(
      communicationId: string,
      callback: (
        communication:
          OfficialCommunication | null,
      ) => void,
      onError?: (
        error: Error,
      ) => void,
    ): Unsubscribe {
      return onSnapshot(
        doc(
          db,
          COLLECTION_NAME,
          communicationId,
        ),
        (snapshot) => {
          if (!snapshot.exists()) {
            callback(null);
            return;
          }

          callback(
            mapCommunication(
              snapshot.id,
              snapshot.data(),
            ),
          );
        },
        (error) => {
          onError?.(error);
        },
      );
    },

    subscribePublishedBySeason(
      seasonId: string,
      callback: (
        communications:
          OfficialCommunication[],
      ) => void,
      onError?: (
        error: Error,
      ) => void,
    ): Unsubscribe {
      return onSnapshot(
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
            "status",
            "==",
            "published",
          ),
          orderBy(
            "matchweek",
            "desc",
          ),
        ),
        (snapshot) => {
          callback(
            snapshot.docs.map(
              (document) =>
                mapCommunication(
                  document.id,
                  document.data(),
                ),
            ),
          );
        },
        (error) => {
          onError?.(error);
        },
      );
    },
  };