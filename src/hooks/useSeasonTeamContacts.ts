"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  FirebaseSeasonTeamContactRepository,
} from "@/src/services/team/FirebaseSeasonTeamContactRepository";

import type {
  SeasonTeamContact,
} from "@/src/types/SeasonTeamContact";

export function useSeasonTeamContacts(
  seasonId?: string,
) {
  const [
    contacts,
    setContacts,
  ] = useState<SeasonTeamContact[]>(
    [],
  );

  const [
    loadedSeasonId,
    setLoadedSeasonId,
  ] = useState<string>();

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  useEffect(
    () => {
      if (!seasonId) {
        return;
      }

      const currentSeasonId =
        seasonId;

      const unsubscribe =
        FirebaseSeasonTeamContactRepository.subscribeAll(
          currentSeasonId,
          (nextContacts) => {
            setContacts(
              nextContacts,
            );
            setLoadedSeasonId(
              currentSeasonId,
            );
            setError(null);
          },
          (currentError) => {
            setContacts([]);
            setLoadedSeasonId(
              currentSeasonId,
            );
            setError(
              currentError.message,
            );
          },
        );

      return unsubscribe;
    },
    [
      seasonId,
    ],
  );

  const matchesCurrentSeason =
    Boolean(
      seasonId &&
        loadedSeasonId ===
          seasonId,
    );

  return {
    contacts:
      matchesCurrentSeason
        ? contacts
        : [],

    isLoading:
      Boolean(seasonId) &&
      !matchesCurrentSeason,

    error:
      matchesCurrentSeason
        ? error
        : null,
  };
}
