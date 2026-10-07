import { mapDocumentToTeam } from "@/src/lib/firestore/mappers/TeamDocumentMapper";
﻿import {
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
  CreateTeamInput,
  Team,
  UpdateTeamInput,
} from "@/src/types/Team";

const COLLECTION_NAME = "teams";

function createSlug(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    );
}




function normalizeOptionalText(
  value: string | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized =
    value.trim();

  return normalized || null;
}

type TeamSubscriber = {
  onChange: (
    teams: Team[],
  ) => void;
  onError?: (
    error: Error,
  ) => void;
};

const teamSubscribers =
  new Set<TeamSubscriber>();

let teamsCache:
  Team[] | undefined;

let teamsUnsubscribe:
  Unsubscribe | undefined;

function subscribeSharedTeams(
  subscriber:
    TeamSubscriber,
): Unsubscribe {
  teamSubscribers.add(
    subscriber,
  );

  if (teamsCache) {
    subscriber.onChange(
      teamsCache,
    );
  }

  if (!teamsUnsubscribe) {
    teamsUnsubscribe =
      onSnapshot(
        collection(
          db,
          COLLECTION_NAME,
        ),
        (snapshot) => {
          teamsCache =
            snapshot.docs
              .map(
                (
                  currentDocument,
                ) =>
                  mapDocumentToTeam(
                    currentDocument.id,
                    currentDocument.data(),
                  ),
              )
              .sort(
                (
                  firstTeam,
                  secondTeam,
                ) =>
                  firstTeam.name.localeCompare(
                    secondTeam.name,
                    "it",
                  ),
              );

          for (
            const currentSubscriber of
              teamSubscribers
          ) {
            currentSubscriber.onChange(
              teamsCache,
            );
          }
        },
        (error) => {
          console.error(
            "Errore caricamento squadre:",
            error,
          );

          for (
            const currentSubscriber of
              teamSubscribers
          ) {
            currentSubscriber.onError?.(
              error,
            );
          }
        },
      );
  }

  return () => {
    teamSubscribers.delete(
      subscriber,
    );

    if (
      teamSubscribers.size ===
        0 &&
      teamsUnsubscribe
    ) {
      teamsUnsubscribe();
      teamsUnsubscribe =
        undefined;
      teamsCache =
        undefined;
    }
  };
}

export const FirebaseTeamRepository = {
  async getAll(): Promise<Team[]> {
    const snapshot =
      await getDocs(
        collection(
          db,
          COLLECTION_NAME,
        ),
      );

    return snapshot.docs
      .map((currentDocument) =>
        mapDocumentToTeam(
          currentDocument.id,
          currentDocument.data(),
        ),
      )
      .sort(
        (
          firstTeam,
          secondTeam,
        ) =>
          firstTeam.name.localeCompare(
            secondTeam.name,
            "it",
          ),
      );
  },

  async getById(
    teamId: string,
  ): Promise<Team | undefined> {
    const snapshot =
      await getDoc(
        doc(
          db,
          COLLECTION_NAME,
          teamId,
        ),
      );

    if (!snapshot.exists()) {
      return undefined;
    }

    return mapDocumentToTeam(
      snapshot.id,
      snapshot.data(),
    );
  },

  subscribeAll(
    onChange: (
      teams: Team[],
    ) => void,
    onError?: (
      error: Error,
    ) => void,
  ): Unsubscribe {
    return subscribeSharedTeams({
      onChange,
      onError,
    });
  },

  async create(
    input: CreateTeamInput,
  ): Promise<Team> {
    const normalizedName =
      input.name.trim();

    if (
      normalizedName.length < 2
    ) {
      throw new Error(
        "Inserisci un nome squadra valido.",
      );
    }

    const slug =
      createSlug(
        normalizedName,
      );

    if (!slug) {
      throw new Error(
        "Non è stato possibile generare l'identificativo della squadra.",
      );
    }

    const reference = doc(
      db,
      COLLECTION_NAME,
      slug,
    );

    const existingDocument =
      await getDoc(reference);

    if (
      existingDocument.exists()
    ) {
      throw new Error(
        "Esiste già una squadra con questo nome.",
      );
    }

    const team: Team = {
      id: slug,
      slug,
      name: normalizedName,

      shortName:
        input.shortName
          ?.trim()
          .toUpperCase() ||
        undefined,

      aliasName:
        input.aliasName
          ?.trim()
          .toUpperCase() ||
        undefined,

      nickname:
        input.nickname?.trim() ||
        undefined,


      logoUrl:
        input.logoUrl?.trim() ||
        undefined,

      teamPhotoUrl:
        input.teamPhotoUrl
          ?.trim() ||
        undefined,


      primaryColor:
        input.primaryColor,

      secondaryColor:
        input.secondaryColor,
      presidentName:
        input.presidentName
          ?.trim() ||
        undefined,

      captainPlayerId:
        input.captainPlayerId
          ?.trim() ||
        undefined,
    };

    await setDoc(
      reference,
      {
        ...team,

        shortName:
          team.shortName ?? null,

        aliasName:
          team.aliasName ?? null,

        nickname:
          team.nickname ?? null,
        logoUrl:
          team.logoUrl ?? null,

        teamPhotoUrl:
          team.teamPhotoUrl ??
          null,
        presidentName:
          team.presidentName ??
          null,

        captainPlayerId:
          team.captainPlayerId ??
          null,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      },
    );

    return team;
  },

  async update(
    teamId: string,
    input: UpdateTeamInput,
  ): Promise<void> {
    const updateData: Record<
      string,
      unknown
    > = {
      updatedAt:
        serverTimestamp(),
    };

    if (
      input.name !== undefined
    ) {
      const normalizedName =
        input.name.trim();

      if (
        normalizedName.length < 2
      ) {
        throw new Error(
          "Inserisci un nome squadra valido.",
        );
      }

      updateData.name =
        normalizedName;
    }

    if (
      input.shortName !== undefined
    ) {
      const shortName =
        normalizeOptionalText(
          input.shortName,
        );

      updateData.shortName =
        typeof shortName ===
          "string"
          ? shortName.toUpperCase()
          : shortName;
    }

    if (
      input.aliasName !== undefined
    ) {
      const aliasName =
        normalizeOptionalText(
          input.aliasName,
        );

      updateData.aliasName =
        typeof aliasName ===
          "string"
          ? aliasName.toUpperCase()
          : aliasName;
    }

    if (
      input.logoUrl !== undefined
    ) {
      updateData.logoUrl =
        normalizeOptionalText(
          input.logoUrl,
        );
    }

    if (
      input.teamPhotoUrl !==
      undefined
    ) {
      updateData.teamPhotoUrl =
        normalizeOptionalText(
          input.teamPhotoUrl,
        );
    }


    if (
      input.primaryColor !==
      undefined
    ) {
      updateData.primaryColor =
        input.primaryColor;
    }

    if (
      input.secondaryColor !==
      undefined
    ) {
      updateData.secondaryColor =
        input.secondaryColor;
    }
    if (
      input.presidentName !==
      undefined
    ) {
      updateData.presidentName =
        normalizeOptionalText(
          input.presidentName,
        );
    }

    if (
      input.captainPlayerId !==
      undefined
    ) {
      updateData.captainPlayerId =
        normalizeOptionalText(
          input.captainPlayerId,
        );
    }

    await updateDoc(
      doc(
        db,
        COLLECTION_NAME,
        teamId,
      ),
      updateData,
    );
  },

  async remove(
    teamId: string,
  ): Promise<void> {
    await deleteDoc(
      doc(
        db,
        COLLECTION_NAME,
        teamId,
      ),
    );
  },
};

