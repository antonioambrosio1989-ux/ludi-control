"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  GamesSeason,
} from "@/src/types/GamesSeason";

import {
  FirebaseGamesSeasonRepository,
} from "@/src/services/games/FirebaseGamesSeasonRepository";

import {
  getNextGamesSeasonBoundaryTimestamp,
  selectActiveGamesSeason,
  selectManagedGamesSeason,
} from "@/src/services/games/GamesSeasonStatusService";

const MAX_TIMEOUT_MS =
  2_147_000_000;

/*
 * ============================================================
 * ADMIN GAMES SEASONS
 * ============================================================
 *
 * Non esiste più un archivio amministrativo.
 *
 * Manteniamo comunque l'elenco letto da Firestore perché serve
 * a impedire duplicati e a gestire la transizione dai vecchi
 * documenti.
 * ============================================================
 */

export function useAdminGamesSeasons() {
  const [
    gamesSeasons,
    setGamesSeasons,
  ] =
    useState<
      GamesSeason[]
    >([]);

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

  const [
    now,
    setNow,
  ] =
    useState(
      () =>
        new Date(),
    );

  useEffect(() => {
    const unsubscribe =
      FirebaseGamesSeasonRepository.subscribeAll(
        (
          items,
        ) => {
          setGamesSeasons(
            items,
          );

          setNow(
            new Date(),
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
            "Errore caricamento stagioni Games:",
            currentError,
          );

          setError(
            currentError.message ||
              "Impossibile caricare le stagioni Games.",
          );

          setIsLoading(
            false,
          );
        },
      );

    return unsubscribe;
  }, []);

  /*
   * Rivalutazione automatica quando inizia o termina
   * una Games Season.
   */
  useEffect(() => {
    const nextBoundary =
      getNextGamesSeasonBoundaryTimestamp(
        gamesSeasons,
        now,
      );

    if (
      nextBoundary ===
      null
    ) {
      return;
    }

    const delay =
      Math.max(
        1,
        Math.min(
          MAX_TIMEOUT_MS,
          nextBoundary -
            Date.now() +
            25,
        ),
      );

    const timer =
      window.setTimeout(
        () => {
          setNow(
            new Date(),
          );
        },
        delay,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [
    gamesSeasons,
    now,
  ]);

  const activeGamesSeason =
    useMemo(
      () =>
        selectActiveGamesSeason(
          gamesSeasons,
          now,
        ) ??
        null,
      [
        gamesSeasons,
        now,
      ],
    );

  /*
   * managedGamesSeason può essere:
   * - attiva;
   * - futura ma già configurata.
   *
   * In questo modo prezzi e pass possono essere preparati
   * prima della data di apertura.
   */
  const managedGamesSeason =
    useMemo(
      () =>
        selectManagedGamesSeason(
          gamesSeasons,
          now,
        ) ??
        null,
      [
        gamesSeasons,
        now,
      ],
    );

  return {
    gamesSeasons,

    activeGamesSeason,

    managedGamesSeason,

    isLoading,

    error,
  };
}
