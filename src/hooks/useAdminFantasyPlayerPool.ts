"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  FirebaseFantasyPlayerRepository,
} from "@/src/repositories/firebase/FirebaseFantasyPlayerRepository";

import {
  FantasyPlayerPoolPublishingService,
} from "@/src/services/fantasy/FantasyPlayerPoolPublishingService";

import type {
  CreateFantasyPlayerInput,
  FantasyPlayer,
  FantasyPlayerAvailabilityStatus,
  FantasyPlayerPool,
} from "@/src/types/FantasyPlayer";

export type UseAdminFantasyPlayerPoolResult = {
  pool:
    FantasyPlayerPool | null;

  players:
    FantasyPlayer[];

  isLoading:
    boolean;

  isSaving:
    boolean;

  error:
    string | null;

  hasPool:
    boolean;

  isPublished:
    boolean;

  replaceDraftPool:
    (
      players:
        CreateFantasyPlayerInput[],

      importedBy?:
        string,
    ) => Promise<void>;

  publishPool:
    (
      publishedBy?:
        string,
    ) => Promise<void>;

  deleteDraftPool:
    () => Promise<void>;

  updateAvailability:
    (
      fantasyPlayerId:
        string,

      availabilityStatus:
        FantasyPlayerAvailabilityStatus,
    ) => Promise<void>;

  clearError:
    () => void;
};

export function useAdminFantasyPlayerPool(
  fantasySeasonId:
    string | null | undefined,
): UseAdminFantasyPlayerPoolResult {
  const [
    pool,
    setPool,
  ] =
    useState<FantasyPlayerPool | null>(
      null,
    );

  const [
    players,
    setPlayers,
  ] =
    useState<FantasyPlayer[]>(
      [],
    );

  const [
    isPoolLoading,
    setIsPoolLoading,
  ] =
    useState(
      Boolean(
        fantasySeasonId,
      ),
    );

  const [
    arePlayersLoading,
    setArePlayersLoading,
  ] =
    useState(
      Boolean(
        fantasySeasonId,
      ),
    );

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(
    () => {
      if (
  !fantasySeasonId
) {
  return;
}

      const unsubscribePool =
        FirebaseFantasyPlayerRepository
          .subscribePoolBySeasonId(
            fantasySeasonId,
            (
              nextPool,
            ) => {
              setPool(
                nextPool,
              );

              setIsPoolLoading(
                false,
              );
            },
          );

      const unsubscribePlayers =
        FirebaseFantasyPlayerRepository
          .subscribePlayersBySeasonId(
            fantasySeasonId,
            (
              nextPlayers,
            ) => {
              setPlayers(
                nextPlayers,
              );

              setArePlayersLoading(
                false,
              );
            },
          );

      return () => {
        unsubscribePool();
        unsubscribePlayers();
      };
    },
    [
      fantasySeasonId,
    ],
  );

  const replaceDraftPool =
    useCallback(
      async (
        nextPlayers:
          CreateFantasyPlayerInput[],

        importedBy?:
          string,
      ): Promise<void> => {
        if (
          !fantasySeasonId
        ) {
          throw new Error(
            "Nessuna stagione Fantacalcio disponibile.",
          );
        }

        setIsSaving(
          true,
        );

        setError(
          null,
        );

        try {
          await FirebaseFantasyPlayerRepository
            .replaceDraftPool(
              fantasySeasonId,
              nextPlayers,
              importedBy,
            );
        } catch (
          caughtError
        ) {
          const message =
            caughtError instanceof
            Error
              ? caughtError.message
              : "Impossibile importare il listone.";

          setError(
            message,
          );

          throw caughtError;
        } finally {
          setIsSaving(
            false,
          );
        }
      },
      [
        fantasySeasonId,
      ],
    );

  const publishPool =
    useCallback(
      async (
        publishedBy?:
          string,
      ): Promise<void> => {
        if (
          !fantasySeasonId
        ) {
          throw new Error(
            "Nessuna stagione Fantacalcio disponibile.",
          );
        }

        if (
          !pool
        ) {
          throw new Error(
            "Nessun listone disponibile.",
          );
        }

        if (
          pool.status ===
          "published"
        ) {
          throw new Error(
            "Il listone è già stato pubblicato.",
          );
        }

        if (
          players.length ===
          0
        ) {
          throw new Error(
            "Non puoi pubblicare un listone vuoto.",
          );
        }

        setIsSaving(
          true,
        );

        setError(
          null,
        );

        try {
          await FantasyPlayerPoolPublishingService
  .publish(
    {
      fantasySeasonId,

      publishedBy,
    },
  );
        } catch (
          caughtError
        ) {
          const message =
            caughtError instanceof
            Error
              ? caughtError.message
              : "Impossibile pubblicare il listone.";

          setError(
            message,
          );

          throw caughtError;
        } finally {
          setIsSaving(
            false,
          );
        }
      },
      [
        fantasySeasonId,
        pool,
        players.length,
      ],
    );

  const deleteDraftPool =
    useCallback(
      async (): Promise<void> => {
        if (
          !fantasySeasonId
        ) {
          throw new Error(
            "Nessuna stagione Fantacalcio disponibile.",
          );
        }

        if (
          pool?.status ===
          "published"
        ) {
          throw new Error(
            "Un listone pubblicato non può essere eliminato.",
          );
        }

        setIsSaving(
          true,
        );

        setError(
          null,
        );

        try {
          await FirebaseFantasyPlayerRepository
            .deleteDraftPool(
              fantasySeasonId,
            );
        } catch (
          caughtError
        ) {
          const message =
            caughtError instanceof
            Error
              ? caughtError.message
              : "Impossibile eliminare il listone.";

          setError(
            message,
          );

          throw caughtError;
        } finally {
          setIsSaving(
            false,
          );
        }
      },
      [
        fantasySeasonId,
        pool,
      ],
    );

  const updateAvailability =
    useCallback(
      async (
        fantasyPlayerId:
          string,

        availabilityStatus:
          FantasyPlayerAvailabilityStatus,
      ): Promise<void> => {
        setIsSaving(
          true,
        );

        setError(
          null,
        );

        try {
          await FirebaseFantasyPlayerRepository
            .updateAvailability(
              fantasyPlayerId,
              availabilityStatus,
            );
        } catch (
          caughtError
        ) {
          const message =
            caughtError instanceof
            Error
              ? caughtError.message
              : "Impossibile aggiornare lo stato del giocatore.";

          setError(
            message,
          );

          throw caughtError;
        } finally {
          setIsSaving(
            false,
          );
        }
      },
      [],
    );

  const clearError =
    useCallback(
      () => {
        setError(
          null,
        );
      },
      [],
    );

  const effectivePool =
  fantasySeasonId
    ? pool
    : null;

const effectivePlayers =
  fantasySeasonId
    ? players
    : [];

const isLoading =
  Boolean(
    fantasySeasonId,
  ) &&
  (
    isPoolLoading ||
    arePlayersLoading
  );

  const hasPool =
  Boolean(
    effectivePool,
  );

const isPublished =
  effectivePool?.status ===
  "published";

  return {
  pool:
    effectivePool,

  players:
    effectivePlayers,

  isLoading,

  isSaving,

  error,

  hasPool,

  isPublished,

  replaceDraftPool,

  publishPool,

  deleteDraftPool,

  updateAvailability,

  clearError,
};
}