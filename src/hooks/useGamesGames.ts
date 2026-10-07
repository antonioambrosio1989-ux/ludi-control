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

type GamesState = {
  visibilitySeasonId:
    string | null;

  games:
    GamesGame[];

  error:
    string | null;

  status:
    | "ready"
    | "error";
};

/*
 * ============================================================
 * PUBLIC GAMES CATALOG
 * ============================================================
 *
 * gamesSeasonId è soltanto il "gate" di visibilità:
 * i giochi non vengono più filtrati per Games Season.
 *
 * - senza Games Season attiva => []
 * - con Games Season attiva   => catalogo permanente
 * ============================================================
 */

export function useGamesGames(
  gamesSeasonId?:
    string,
) {
  const [
    state,
    setState,
  ] =
    useState<
      GamesState
    >({
      visibilitySeasonId:
        null,

      games:
        [],

      error:
        null,

      status:
        "ready",
    });

  const [
    now,
    setNow,
  ] =
    useState(
      () =>
        new Date(),
    );

  useEffect(
    () => {
      if (
        !gamesSeasonId
      ) {
        /*
         * Senza Games Season attiva il valore pubblico viene
         * già derivato come array vuoto più in basso.
         *
         * Manteniamo quindi lo state precedente senza fare
         * setState sincronamente dentro l'effect.
         */
        return;
      }

      const currentGamesSeasonId =
        gamesSeasonId;

      const unsubscribe =
        FirebaseGamesGameRepository.subscribeCatalog(
          (
            items,
          ) => {
            setState({
              visibilitySeasonId:
                currentGamesSeasonId,

              games:
                items,

              error:
                null,

              status:
                "ready",
            });

            setNow(
              new Date(),
            );
          },

          (
            currentError,
          ) => {
            console.error(
              currentError,
            );

            setState({
              visibilitySeasonId:
                currentGamesSeasonId,

              games:
                [],

              error:
                "Impossibile caricare i Games.",

              status:
                "error",
            });
          },
        );

      return () => {
        unsubscribe();
      };
    },
    [
      gamesSeasonId,
    ],
  );

  /*
   * Aggiorna automaticamente i giochi "Prossimamente"
   * quando raggiungono activatesAt.
   */
  useEffect(() => {
    if (
      !gamesSeasonId
    ) {
      return;
    }

    const nextActivation =
      state.games
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
    gamesSeasonId,
    state.games,
    now,
  ]);

  const stateMatchesCurrentSeason =
    Boolean(
      gamesSeasonId &&
      state.visibilitySeasonId ===
        gamesSeasonId,
    );

  const visibleGames =
    useMemo(
      () => {
        if (
          !gamesSeasonId ||
          state.visibilitySeasonId !==
            gamesSeasonId
        ) {
          return [];
        }

        return state.games
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
          );
      },
      [
        gamesSeasonId,
        state.visibilitySeasonId,
        state.games,
        now,
      ],
    );

  return {
    games:
      gamesSeasonId
        ? visibleGames
        : [],

    isLoading:
      Boolean(
        gamesSeasonId,
      ) &&
      !stateMatchesCurrentSeason,

    error:
      gamesSeasonId &&
      stateMatchesCurrentSeason &&
      state.status ===
        "error"
        ? state.error
        : null,
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
