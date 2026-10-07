"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  FirebaseSeasonPlayerRepository,
} from "@/src/services/player/FirebaseSeasonPlayerRepository";

import type {
  SeasonPlayer,
} from "@/src/types/SeasonPlayer";

/*
 * ============================================================
 * STATE
 * ============================================================
 */

type SeasonPlayersState = {
  seasonId:
    string | null;

  entries:
    SeasonPlayer[];

  error:
    string | null;

  status:
    | "ready"
    | "error";
};

/*
 * ============================================================
 * SEASON PLAYERS
 * ============================================================
 */

export function useSeasonPlayers(
  seasonId?: string,
) {
  const [
    state,
    setState,
  ] =
    useState<
      SeasonPlayersState
    >({
      seasonId:
        null,

      entries:
        [],

      error:
        null,

      status:
        "ready",
    });

  /*
   * ==========================================================
   * ACTIVE SEASON
   * ==========================================================
   *
   * Manteniamo il riferimento alla stagione richiesta
   * attualmente dal componente.
   *
   * Serve anche a impedire che una richiesta asincrona
   * appartenente alla stagione precedente sovrascriva i dati
   * della nuova stagione.
   * ==========================================================
   */

  const activeSeasonIdRef =
  useRef<
    string | undefined
  >(
    undefined,
  );

useEffect(
  () => {
    activeSeasonIdRef.current =
      seasonId;
  },
  [
    seasonId,
  ],
);

  /*
   * ==========================================================
   * LOAD
   * ==========================================================
   */

  useEffect(
    () => {
      if (
        !seasonId
      ) {
        return;
      }

      let isActive =
        true;

      const currentSeasonId =
        seasonId;

      FirebaseSeasonPlayerRepository
        .getBySeasonId(
          currentSeasonId,
        )
        .then(
          (
            result,
          ) => {
            if (
              !isActive ||
              activeSeasonIdRef.current !==
                currentSeasonId
            ) {
              return;
            }

            setState({
              seasonId:
                currentSeasonId,

              entries:
                result,

              error:
                null,

              status:
                "ready",
            });
          },
        )
        .catch(
          (
            currentError:
              unknown,
          ) => {
            if (
              !isActive ||
              activeSeasonIdRef.current !==
                currentSeasonId
            ) {
              return;
            }

            console.error(
              "Errore caricamento giocatori stagionali:",
              currentError,
            );

            setState({
              seasonId:
                currentSeasonId,

              entries:
                [],

              error:
                currentError instanceof
                  Error
                  ? currentError.message
                  : "Impossibile caricare i giocatori della stagione.",

              status:
                "error",
            });
          },
        );

      return () => {
        isActive =
          false;
      };
    },
    [
      seasonId,
    ],
  );

  /*
   * ==========================================================
   * REFRESH
   * ==========================================================
   */

  const refresh =
    useCallback(
      async () => {
        if (
          !seasonId
        ) {
          return;
        }

        const currentSeasonId =
          seasonId;

        try {
          const result =
            await FirebaseSeasonPlayerRepository
              .getBySeasonId(
                currentSeasonId,
              );

          if (
            activeSeasonIdRef.current !==
              currentSeasonId
          ) {
            return;
          }

          setState({
            seasonId:
              currentSeasonId,

            entries:
              result,

            error:
              null,

            status:
              "ready",
          });
        } catch (
          currentError
        ) {
          if (
            activeSeasonIdRef.current !==
              currentSeasonId
          ) {
            return;
          }

          console.error(
            "Errore aggiornamento giocatori stagionali:",
            currentError,
          );

          setState({
            seasonId:
              currentSeasonId,

            entries:
              [],

            error:
              currentError instanceof
                Error
                ? currentError.message
                : "Impossibile aggiornare i giocatori della stagione.",

            status:
              "error",
          });
        }
      },
      [
        seasonId,
      ],
    );

  /*
   * ==========================================================
   * CURRENT STATE
   * ==========================================================
   */

  const stateMatchesCurrentSeason =
    Boolean(
      seasonId &&
        state.seasonId ===
          seasonId,
    );

  const entries =
    stateMatchesCurrentSeason
      ? state.entries
      : [];

  /*
   * ==========================================================
   * OUTPUT
   * ==========================================================
   */

  return {
    entries,

    seasonPlayers:
      entries,

    isLoading:
      Boolean(
        seasonId,
      ) &&
      !stateMatchesCurrentSeason,

    error:
      stateMatchesCurrentSeason &&
      state.status ===
        "error"
        ? state.error
        : null,

    refresh,
  };
}