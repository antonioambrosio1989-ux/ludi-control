import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import type {
  CreateSeasonTeamInput,
  SeasonTeam,
  SeasonTeamStatus,
} from "@/src/types/SeasonTeam";

export type UpdateSeasonTeamInput = {
  seasonId: string;
  teamId: string;

  president?: string;

  status?: SeasonTeamStatus;
};

const SEASONS_COLLECTION = "seasons";
const TEAM_ENTRIES_COLLECTION = "teamEntries";

function getSeasonTeamCollection(
  seasonId: string,
) {
  return collection(
    db,
    SEASONS_COLLECTION,
    seasonId,
    TEAM_ENTRIES_COLLECTION,
  );
}

function getSeasonTeamDocument(
  seasonId: string,
  teamId: string,
) {
  return doc(
    db,
    SEASONS_COLLECTION,
    seasonId,
    TEAM_ENTRIES_COLLECTION,
    teamId,
  );
}

function normalizeOptionalText(
  value?: string,
) {
  const normalizedValue =
    value?.trim();

  return normalizedValue || null;
}

function mapDocumentToSeasonTeam(
  documentId: string,
  data: Record<string, unknown>,
): SeasonTeam {
  const status =
    data.status === "withdrawn" ||
    data.status === "completed"
      ? data.status
      : "active";

  return {
    id: documentId,

    teamId:
      typeof data.teamId === "string"
        ? data.teamId
        : documentId,

    seasonId:
      typeof data.seasonId === "string"
        ? data.seasonId
        : "",

    president:
      typeof data.president === "string"
        ? data.president
        : undefined,

    status,

    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

type SeasonTeamSubscriber = {
  onChange: (
    entries: SeasonTeam[],
  ) => void;
  onError?: (
    error: Error,
  ) => void;
};

type SharedSeasonTeamSubscription = {
  subscribers:
    Set<SeasonTeamSubscriber>;
  cache?: SeasonTeam[];
  unsubscribe?: Unsubscribe;
};

const seasonTeamSubscriptions =
  new Map<
    string,
    SharedSeasonTeamSubscription
  >();

function subscribeSharedSeasonTeams({
  seasonId,
  subscriber,
}: {
  seasonId: string;
  subscriber:
    SeasonTeamSubscriber;
}): Unsubscribe {
  const normalizedSeasonId =
    seasonId.trim();

  if (!normalizedSeasonId) {
    throw new Error(
      "Season ID non valido.",
    );
  }

  let shared =
    seasonTeamSubscriptions.get(
      normalizedSeasonId,
    );

  if (!shared) {
    shared = {
      subscribers:
        new Set<
          SeasonTeamSubscriber
        >(),
    };

    seasonTeamSubscriptions.set(
      normalizedSeasonId,
      shared,
    );
  }

  shared.subscribers.add(
    subscriber,
  );

  if (shared.cache) {
    subscriber.onChange(
      shared.cache,
    );
  }

  if (!shared.unsubscribe) {
    const currentShared =
      shared;

    currentShared.unsubscribe =
      onSnapshot(
        getSeasonTeamCollection(
          normalizedSeasonId,
        ),
        (snapshot) => {
          currentShared.cache =
            snapshot.docs
              .map(
                (
                  currentDocument,
                ) =>
                  mapDocumentToSeasonTeam(
                    currentDocument.id,
                    currentDocument.data(),
                  ),
              )
              .sort(
                (
                  firstEntry,
                  secondEntry,
                ) =>
                  firstEntry.teamId.localeCompare(
                    secondEntry.teamId,
                    "it",
                  ),
              );

          for (
            const currentSubscriber of
              currentShared.subscribers
          ) {
            currentSubscriber.onChange(
              currentShared.cache,
            );
          }
        },
        (error) => {
          console.error(
            "Errore caricamento squadre stagionali:",
            error,
          );

          for (
            const currentSubscriber of
              currentShared.subscribers
          ) {
            currentSubscriber.onError?.(
              error,
            );
          }
        },
      );
  }

  return () => {
    const currentShared =
      seasonTeamSubscriptions.get(
        normalizedSeasonId,
      );

    if (!currentShared) {
      return;
    }

    currentShared.subscribers.delete(
      subscriber,
    );

    if (
      currentShared.subscribers.size ===
      0
    ) {
      currentShared.unsubscribe?.();
      seasonTeamSubscriptions.delete(
        normalizedSeasonId,
      );
    }
  };
}

export const FirebaseSeasonTeamRepository = {
  async getBySeasonId(
  seasonId: string,
): Promise<SeasonTeam[]> {
  const normalizedSeasonId =
    seasonId.trim();

  if (!normalizedSeasonId) {
    throw new Error(
      "Season ID non valido.",
    );
  }

  const snapshot = await getDocs(
    getSeasonTeamCollection(
      normalizedSeasonId,
    ),
  );

  return snapshot.docs
    .map((currentDocument) =>
      mapDocumentToSeasonTeam(
        currentDocument.id,
        currentDocument.data(),
      ),
    )
    .sort(
      (
        firstEntry,
        secondEntry,
      ) =>
        firstEntry.teamId.localeCompare(
          secondEntry.teamId,
          "it",
        ),
    );
},
  subscribeAll(
    seasonId: string,
    onChange: (
      entries: SeasonTeam[],
    ) => void,
    onError?: (
      error: Error,
    ) => void,
  ): Unsubscribe {
    return subscribeSharedSeasonTeams({
      seasonId,
      subscriber: {
        onChange,
        onError,
      },
    });
  },

  async getById(
    seasonId: string,
    teamId: string,
  ): Promise<
    SeasonTeam | undefined
  > {
    const snapshot =
      await getDoc(
        getSeasonTeamDocument(
          seasonId,
          teamId,
        ),
      );

    if (!snapshot.exists()) {
      return undefined;
    }

    return mapDocumentToSeasonTeam(
      snapshot.id,
      snapshot.data(),
    );
  },

      async updateDetails({
  seasonId,
  teamId,
  president,
}: {
  seasonId: string;
  teamId: string;
  president?: string;
}): Promise<void> {
  const normalizedSeasonId = seasonId.trim();
  const normalizedTeamId = teamId.trim();
  
  if (!normalizedSeasonId) {
    throw new Error(
      "La stagione è obbligatoria.",
    );
  }
  
  if (!normalizedTeamId) {
    throw new Error(
      "La squadra è obbligatoria.",
    );
  }
  
  const reference =
  getSeasonTeamDocument(
    normalizedSeasonId,
    normalizedTeamId,
  );

  const existingSnapshot =
  await getDoc(reference);

  if (!existingSnapshot.exists()) {
    throw new Error(
      "Iscrizione stagionale della squadra non trovata.",
    );
  }

    await updateDoc(reference, {
      president: president?.trim() || null,
      updatedAt: serverTimestamp(),
    });
  },

  async create(
    input: CreateSeasonTeamInput,
  ): Promise<SeasonTeam> {
    const seasonId =
      input.seasonId.trim();

    const teamId =
      input.teamId.trim();

    if (!seasonId) {
      throw new Error(
        "La stagione è obbligatoria.",
      );
    }

    if (!teamId) {
      throw new Error(
        "La squadra è obbligatoria.",
      );
    }

    const reference =
      getSeasonTeamDocument(
        seasonId,
        teamId,
      );

    const existingSnapshot =
      await getDoc(reference);

    if (
      existingSnapshot.exists()
    ) {
      throw new Error(
        "La squadra è già iscritta a questa stagione.",
      );
    }

    const seasonTeam: SeasonTeam =
      {
        id: teamId,
        teamId,
        seasonId,

        president:
          input.president?.trim() ||
          undefined,

        status: "active",
      };

    await setDoc(reference, {
      ...seasonTeam,

      president:
        normalizeOptionalText(
          seasonTeam.president,
        ),

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    });

    return seasonTeam;
  },

  async update(
    input: UpdateSeasonTeamInput,
  ): Promise<void> {
    const seasonId =
      input.seasonId.trim();

    const teamId =
      input.teamId.trim();

    if (
      !seasonId ||
      !teamId
    ) {
      throw new Error(
        "Stagione o squadra non valida.",
      );
    }

    const payload: Record<
      string,
      unknown
    > = {
      updatedAt:
        serverTimestamp(),
    };

    if (
      input.president !==
      undefined
    ) {
      payload.president =
        normalizeOptionalText(
          input.president,
        );
    }

    if (
      input.status !==
      undefined
    ) {
      payload.status =
        input.status;
    }

    await updateDoc(
      getSeasonTeamDocument(
        seasonId,
        teamId,
      ),
      payload,
    );
  },

  async remove(
    seasonId: string,
    teamId: string,
  ): Promise<void> {
    if (
      !seasonId.trim() ||
      !teamId.trim()
    ) {
      throw new Error(
        "Stagione o squadra non valida.",
      );
    }

    await deleteDoc(
      getSeasonTeamDocument(
        seasonId,
        teamId,
      ),
    );
  },
};