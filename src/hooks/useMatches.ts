"use client";

import {
  useEffect,
  useState,
} from "react";

import { FirebaseMatchRepository } from "@/src/services/match/FirebaseMatchRepository";
import type { Match } from "@/src/types/Match";

export function useMatches(
  seasonId?: string,
) {
  const [matches, setMatches] =
    useState<Match[]>([]);

  const [isLoading, setIsLoading] =
    useState(Boolean(seasonId));

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!seasonId) {
     return;
    }

    const unsubscribe =
      FirebaseMatchRepository.subscribeBySeason(
        seasonId,
        (loadedMatches) => {
          setMatches(loadedMatches);
          setIsLoading(false);
          setError(null);
        },
        (currentError) => {
          setMatches([]);
          setIsLoading(false);

          setError(
            currentError.message ||
              "Impossibile caricare le partite.",
          );
        },
      );

    return unsubscribe;
  }, [seasonId]);

  async function refresh() {
    if (!seasonId) {
      setMatches([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const loadedMatches =
        await FirebaseMatchRepository.getBySeason(
          seasonId,
        );

      setMatches(loadedMatches);
    } catch (currentError) {
      console.error(
        "Errore aggiornamento partite:",
        currentError,
      );

      setError(
        currentError instanceof Error
          ? currentError.message
          : "Impossibile aggiornare le partite.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return {
    matches:
    seasonId
    ? matches
    : [],

    isLoading:
    Boolean(seasonId) &&
    isLoading,

    error:
    seasonId
    ? error
    :null,

    refresh
  };
}