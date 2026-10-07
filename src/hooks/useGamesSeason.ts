"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  FirebaseGamesSeasonRepository,
} from "@/src/services/games/FirebaseGamesSeasonRepository";

import type {
  GamesSeason,
} from "@/src/types/GamesSeason";

type UseGamesSeasonResult = {
  currentGamesSeason:
    GamesSeason | undefined;

  isLoading:
    boolean;

  error:
    string | null;
};

/*
 * ============================================================
 * PUBLIC GAMES SEASON
 * ============================================================
 *
 * Il repository emette una Games Season soltanto quando:
 *
 * startsAt <= now <= fine giornata di endsAt
 *
 * Alla scadenza il listener si aggiorna anche senza una nuova
 * scrittura Firestore, quindi tutti i giochi spariscono
 * automaticamente dal contenitore pubblico.
 * ============================================================
 */

export function useGamesSeason():
  UseGamesSeasonResult {
  const [
    currentGamesSeason,
    setCurrentGamesSeason,
  ] =
    useState<
      GamesSeason | undefined
    >(undefined);

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(
      true,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  useEffect(() => {
    const unsubscribe =
      FirebaseGamesSeasonRepository
        .subscribeActive(
          (
            nextGamesSeason,
          ) => {
            setCurrentGamesSeason(
              nextGamesSeason,
            );

            setError(
              null,
            );

            setIsLoading(
              false,
            );
          },

          (
            currentError,
          ) => {
            console.error(
              "Errore caricamento stagione Games:",
              currentError,
            );

            setError(
              currentError.message ||
                "Impossibile caricare la stagione Games.",
            );

            setIsLoading(
              false,
            );
          },
        );

    return unsubscribe;
  }, []);

  return {
    currentGamesSeason,
    isLoading,
    error,
  };
}
