"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  useCompetitions,
} from "@/src/hooks/useCompetitions";

import {
  useSeasons,
} from "@/src/hooks/useSeasons";

import type {
  Competition,
} from "@/src/types/Competition";

import type {
  Season,
} from "@/src/types/Season";

/*
 * ============================================================
 * CONFIGURAZIONE
 * ============================================================
 */

const STORAGE_KEY =
  "ludi:selectedCompetitionId";

const DEFAULT_COMPETITION_ID =
  "premier-league";

/*
 * ============================================================
 * CONTEXT TYPE
 * ============================================================
 */

type CompetitionContextValue = {
  competitions:
    Competition[];

  activeCompetitions:
    Competition[];

  selectedCompetition:
    Competition | undefined;

  selectedCompetitionId:
    string | undefined;

  currentSeason:
    Season | undefined;

  setSelectedCompetitionId: (
    competitionId:
      string,
  ) => void;

  isLoading:
    boolean;

  error:
    string | null;

  primaryColor:
  string;

textColor:
  string;
};

/*
 * ============================================================
 * CONTEXT
 * ============================================================
 */

const CompetitionContext =
  createContext<
    CompetitionContextValue | undefined
  >(
    undefined,
  );

/*
 * ============================================================
 * PROVIDER
 * ============================================================
 */

export function CompetitionProvider({
  children,
}: {
  children:
    ReactNode;
}) {
  const {
    competitions,

    activeCompetitions,

    isLoading:
      competitionsLoading,

    error:
      competitionsError,
  } =
    useCompetitions();

  const [
    selectedCompetitionId,
    setSelectedCompetitionIdState,
  ] =
    useState<
      string | undefined
    >(
      undefined,
    );

  /*
   * ==========================================================
   * COMPETIZIONE RISOLTA
   * ==========================================================
   */

  const resolvedCompetitionId =
    useMemo(
      () => {
        /*
         * Se la selezione corrente è valida,
         * utilizziamo quella.
         */
        if (
          selectedCompetitionId &&
          activeCompetitions.some(
            (
              competition,
            ) =>
              competition.id ===
              selectedCompetitionId,
          )
        ) {
          return selectedCompetitionId;
        }

        /*
         * Durante il rendering server
         * localStorage non è disponibile.
         */
        if (
          typeof window !==
          "undefined"
        ) {
          const storedCompetitionId =
            window.localStorage.getItem(
              STORAGE_KEY,
            );

          if (
            storedCompetitionId &&
            activeCompetitions.some(
              (
                competition,
              ) =>
                competition.id ===
                storedCompetitionId,
            )
          ) {
            return storedCompetitionId;
          }
        }

        /*
         * Fallback:
         * prima competizione attiva.
         */
        const defaultCompetition =
  activeCompetitions.find(
    (
      competition,
    ) =>
      competition.id ===
      DEFAULT_COMPETITION_ID,
  );

if (defaultCompetition) {
  return defaultCompetition.id;
}

return activeCompetitions[0]
  ?.id;
      },

      [
        activeCompetitions,
        selectedCompetitionId,
      ],
    );

  /*
   * ==========================================================
   * COMPETIZIONE SELEZIONATA
   * ==========================================================
   */

  const selectedCompetition =
    useMemo(
      () =>
        activeCompetitions.find(
          (
            competition,
          ) =>
            competition.id ===
            resolvedCompetitionId,
        ),

      [
        activeCompetitions,
        resolvedCompetitionId,
      ],
    );

  const primaryColor =
  selectedCompetition
    ?.primaryColor
    ?.trim() ||
  "#06142E";

const textColor =
  selectedCompetition
    ?.textColor
    ?.trim() ||
  "#FFFFFF";

  /*
   * ==========================================================
   * STAGIONE CORRENTE
   * ==========================================================
   */

  const {
    currentSeason,

    isLoading:
      seasonsLoading,

    error:
      seasonsError,
  } =
    useSeasons(
      resolvedCompetitionId,
    );

  /*
   * ==========================================================
   * CAMBIO COMPETIZIONE
   * ==========================================================
   */

  const setSelectedCompetitionId =
  useCallback(
    (
      competitionId:
        string,
    ) => {
      const normalizedId =
        competitionId.trim();

      if (!normalizedId) {
        return;
      }

      const exists =
        activeCompetitions.some(
          (
            competition,
          ) =>
            competition.id ===
            normalizedId,
        );

      if (!exists) {
        console.warn(
          `Competizione non disponibile: ${normalizedId}`,
        );

        return;
      }

      setSelectedCompetitionIdState(
        normalizedId,
      );

      if (
        typeof window !==
        "undefined"
      ) {
        window.localStorage.setItem(
          STORAGE_KEY,
          normalizedId,
        );
      }
    },

    [
      activeCompetitions,
    ],
  );

  /*
   * ==========================================================
   * VALUE
   * ==========================================================
   */

  const value =
    useMemo<
      CompetitionContextValue
    >(
      () => ({
        competitions,

        activeCompetitions,

        selectedCompetition,

        selectedCompetitionId:
          resolvedCompetitionId,

        currentSeason,

        setSelectedCompetitionId,

        isLoading:
          competitionsLoading ||
          seasonsLoading,

        error:
          competitionsError ||
          seasonsError,

        primaryColor,
        textColor,
      }),

      [
        competitions,
        activeCompetitions,
        selectedCompetition,
        resolvedCompetitionId,
        currentSeason,
        primaryColor,
        textColor,
        competitionsLoading,
        seasonsLoading,
        competitionsError,
        seasonsError,
        setSelectedCompetitionId,
      ],
    );

  return (
    <CompetitionContext.Provider
      value={
        value
      }
    >
      {children}
    </CompetitionContext.Provider>
  );
}

/*
 * ============================================================
 * HOOK
 * ============================================================
 */

export function useCompetition() {
  const context =
    useContext(
      CompetitionContext,
    );

  if (!context) {
    throw new Error(
      "useCompetition deve essere utilizzato all'interno di CompetitionProvider.",
    );
  }

  return context;
}