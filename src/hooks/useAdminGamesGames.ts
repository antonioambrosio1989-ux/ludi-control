"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  GamesGame,
} from "@/src/types/GamesGame";

import {
  getEffectiveGamesGameStatus,
} from "@/src/services/games/GamesGameStatusService";

import {
  FirebaseGamesGameRepository,
} from "@/src/services/games/FirebaseGamesGameRepository";

const MAX_TIMEOUT_MS =
  2_147_000_000;

/*
 * ============================================================
 * ADMIN PERMANENT GAMES CATALOG
 * ============================================================
 *
 * Non richiede più gamesSeasonId:
 * l'admin gestisce il catalogo permanente anche quando nessuna
 * Games Season è attiva.
 * ============================================================
 */

export function useAdminGamesGames() {
  const [
    games,
    setGames,
  ] =
    useState<
      GamesGame[]
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
      FirebaseGamesGameRepository.subscribeCatalog(
        (
          items,
        ) => {
          setGames(
            items,
          );

          setNow(
            new Date(),
          );

          setIsLoading(
            false,
          );

          setError(
            null,
          );
        },

        (
          currentError,
        ) => {
          console.error(
            currentError,
          );

          setIsLoading(
            false,
          );

          setError(
            "Impossibile caricare il catalogo Games.",
          );
        },
      );

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const nextActivation =
      games
        .filter(
          (
            game,
          ) =>
            game.status ===
              "waiting",
        )
        .map(
          (
            game,
          ) =>
            toTimestamp(
              game.activatesAt,
            ),
        )
        .filter(
          (
            timestamp,
          ): timestamp is number =>
            typeof timestamp ===
              "number" &&
            timestamp >
              now.getTime(),
        )
        .sort(
          (
            first,
            second,
          ) =>
            first -
            second,
        )[0];

    if (
      !nextActivation
    ) {
      return;
    }

    const delay =
      Math.max(
        1,
        Math.min(
          MAX_TIMEOUT_MS,
          nextActivation -
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
    games,
    now,
  ]);

  const visibleGames =
    useMemo(
      () =>
        games
          .filter(
            (
              game,
            ) =>
              getEffectiveGamesGameStatus(
                game,
                now,
              ) !==
              "suppressed",
          )
          .map(
            (
              game,
            ) => ({
              ...game,

              status:
                getEffectiveGamesGameStatus(
                  game,
                  now,
                ),
            }),
          ),
      [
        games,
        now,
      ],
    );

  const activeGames =
    useMemo(
      () =>
        visibleGames.filter(
          (
            game,
          ) =>
            game.status ===
              "active",
        ),
      [
        visibleGames,
      ],
    );

  const waitingGames =
    useMemo(
      () =>
        visibleGames.filter(
          (
            game,
          ) =>
            game.status ===
              "waiting",
        ),
      [
        visibleGames,
      ],
    );

  return {
    games:
      visibleGames,

    activeGames,

    waitingGames,

    /*
     * Nessun archivio "giochi eliminati" in UI.
     */
    suppressedGames:
      [],

    isLoading,

    error,
  };
}

function toTimestamp(
  value:
    unknown,
): number | undefined {
  if (
    value instanceof
    Date
  ) {
    return value.getTime();
  }

  if (
    value &&
    typeof value ===
      "object" &&
    "toDate" in
      value &&
    typeof (
      value as {
        toDate?: unknown;
      }
    ).toDate ===
      "function"
  ) {
    return (
      value as {
        toDate: () => Date;
      }
    ).toDate().getTime();
  }

  return undefined;
}
