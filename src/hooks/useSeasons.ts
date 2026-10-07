"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FirebaseSeasonRepository,
} from "@/src/services/season/FirebaseSeasonRepository";

import type {
  Season,
} from "@/src/types/Season";

export function useSeasons(
  competitionId?: string,
) {
  const [
    seasons,
    setSeasons,
  ] =
    useState<
      Season[]
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
        FirebaseSeasonRepository.subscribeAll(
          (
            nextSeasons,
          ) => {
            setSeasons(
              nextSeasons,
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
            setError(
              currentError.message,
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
   * COMPETIZIONE SELEZIONATA
   * ==========================================================
   */

  const normalizedCompetitionId =
    competitionId
      ?.trim() ||
    undefined;

  /*
   * ==========================================================
   * STAGIONI DELLA COMPETIZIONE
   * ==========================================================
   */

  const filteredSeasons =
    useMemo(
      () => {
        if (
          !normalizedCompetitionId
        ) {
          /*
           * Modalità legacy:
           * restituiamo tutte le stagioni.
           */
          return seasons;
        }

        return seasons.filter(
          (
            season,
          ) =>
            season.competitionId ===
            normalizedCompetitionId,
        );
      },

      [
        seasons,
        normalizedCompetitionId,
      ],
    );

  /*
   * ==========================================================
   * STAGIONE CORRENTE
   * ==========================================================
   */

  const currentSeason =
    useMemo(
      () =>
        filteredSeasons.find(
          (
            season,
          ) =>
            season.isCurrent &&
            season.status ===
              "active",
        ),

      [
        filteredSeasons,
      ],
    );

  /*
   * ==========================================================
   * STAGIONI ATTIVE
   * ==========================================================
   */

  const activeSeasons =
    useMemo(
      () =>
        filteredSeasons.filter(
          (
            season,
          ) =>
            season.status ===
            "active",
        ),

      [
        filteredSeasons,
      ],
    );

  /*
   * ==========================================================
   * STAGIONI COMPLETATE
   * ==========================================================
   */

  const completedSeasons =
    useMemo(
      () =>
        filteredSeasons.filter(
          (
            season,
          ) =>
            season.status ===
            "completed",
        ),

      [
        filteredSeasons,
      ],
    );

  /*
   * ==========================================================
   * STAGIONI DRAFT
   * ==========================================================
   */

  const draftSeasons =
    useMemo(
      () =>
        filteredSeasons.filter(
          (
            season,
          ) =>
            season.status ===
            "draft",
        ),

      [
        filteredSeasons,
      ],
    );

  return {
    /*
     * Tutte le stagioni.
     * Manteniamo questo campo per compatibilità
     * con il codice esistente.
     */
    seasons,

    /*
     * Stagioni appartenenti alla competizione
     * selezionata.
     */
    filteredSeasons,

    currentSeason,

    activeSeasons,

    completedSeasons,

    draftSeasons,

    isLoading,

    error,
  };
}