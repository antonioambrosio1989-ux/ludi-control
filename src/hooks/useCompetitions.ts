"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FirebaseCompetitionRepository,
} from "@/src/services/competition/FirebaseCompetitionRepository";

import type {
  Competition,
} from "@/src/types/Competition";

/*
 * ============================================================
 * HOOK
 * ============================================================
 */

export function useCompetitions() {
  const [
    competitions,
    setCompetitions,
  ] =
    useState<
      Competition[]
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

  /*
   * ==========================================================
   * SOTTOSCRIZIONE FIREBASE
   * ==========================================================
   */

  useEffect(
    () => {
      const unsubscribe =
        FirebaseCompetitionRepository.subscribeAll(
          (
            nextCompetitions,
          ) => {
            setCompetitions(
              nextCompetitions,
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
              "Errore useCompetitions:",
              currentError,
            );

            setCompetitions(
              [],
            );

            setError(
              currentError.message ||
                "Impossibile caricare le competizioni.",
            );

            setIsLoading(
              false,
            );
          },
        );

      return unsubscribe;
    },
    [],
  );

  /*
   * ==========================================================
   * COMPETIZIONI ATTIVE
   * ==========================================================
   */

  const activeCompetitions =
    useMemo(
      () =>
        competitions.filter(
          (
            competition,
          ) =>
            competition.status ===
            "active",
        ),

      [
        competitions,
      ],
    );

  /*
   * ==========================================================
   * LOOKUP
   * ==========================================================
   */

  const competitionsById =
    useMemo(
      () =>
        new Map(
          competitions.map(
            (
              competition,
            ) => [
              competition.id,
              competition,
            ],
          ),
        ),

      [
        competitions,
      ],
    );

  function getCompetitionById(
    competitionId:
      string | undefined,
  ):
    | Competition
    | undefined {
    if (
      !competitionId
    ) {
      return undefined;
    }

    return competitionsById.get(
      competitionId,
    );
  }

  return {
    competitions,

    activeCompetitions,

    competitionsById,

    getCompetitionById,

    isLoading,

    error,
  };
}