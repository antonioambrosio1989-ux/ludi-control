"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  FirebaseSeasonTeamRepository,
} from "@/src/services/team/FirebaseSeasonTeamRepository";

import type {
  SeasonTeam,
} from "@/src/types/SeasonTeam";

/*
 * ============================================================
 * STATE
 * ============================================================
 */

type SeasonTeamsState = {
  seasonId:
    string | null;

  entries:
    SeasonTeam[];

  error:
    string | null;

  status:
    | "ready"
    | "error";
};

/*
 * ============================================================
 * SEASON TEAMS
 * ============================================================
 */

export function useSeasonTeams(
  seasonId?: string,
) {
  const [
    state,
    setState,
  ] =
    useState<
      SeasonTeamsState
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
   * SUBSCRIPTION
   * ==========================================================
   */

  useEffect(
    () => {
      if (
        !seasonId
      ) {
        return;
      }

      const currentSeasonId =
        seasonId;

      const unsubscribe =
        FirebaseSeasonTeamRepository
          .subscribeAll(
            currentSeasonId,

            (
              nextEntries:
                SeasonTeam[],
            ) => {
              const sortedEntries = [
                ...nextEntries,
              ].sort(
                (
                  firstEntry,
                  secondEntry,
                ) =>
                  firstEntry.teamId.localeCompare(
                    secondEntry.teamId,
                    "it",
                  ),
              );

              setState({
                seasonId:
                  currentSeasonId,

                entries:
                  sortedEntries,

                error:
                  null,

                status:
                  "ready",
              });
            },

            (
              currentError:
                Error,
            ) => {
              console.error(
                "Errore useSeasonTeams:",
                currentError,
              );

              setState({
                seasonId:
                  currentSeasonId,

                entries:
                  [],

                error:
                  currentError.message ||
                  "Impossibile caricare le squadre della stagione.",

                status:
                  "error",
              });
            },
          );

      return unsubscribe;
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
  };
}