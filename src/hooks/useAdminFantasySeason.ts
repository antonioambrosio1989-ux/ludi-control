"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  FirebaseFantasySeasonRepository,
} from "@/src/repositories/firebase/FirebaseFantasySeasonRepository";

import type {
  CreateFantasySeasonInput,
  FantasySeason,
  FantasySeasonStatus,
  UpdateFantasySeasonInput,
} from "@/src/types/FantasySeason";

export type UseAdminFantasySeasonResult = {
  fantasySeason:
    FantasySeason | null;

  isLoading:
    boolean;

  isSaving:
    boolean;

  error:
    string | null;

  hasFantasySeason:
    boolean;

  createFantasySeason:
    (
      input:
        CreateFantasySeasonInput,
    ) => Promise<FantasySeason>;

  updateFantasySeason:
    (
      input:
        UpdateFantasySeasonInput,
    ) => Promise<void>;

  updateStatus:
    (
      status:
        FantasySeasonStatus,

      updatedBy?:
        string,
    ) => Promise<void>;

  publishPlayerList:
    (
      publishedBy?:
        string,
    ) => Promise<void>;

  clearError:
    () => void;
};

export function useAdminFantasySeason(
  gameId:
    string | null | undefined,
): UseAdminFantasySeasonResult {
  const [
    fantasySeason,
    setFantasySeason,
  ] =
    useState<FantasySeason | null>(
      null,
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(
      Boolean(
        gameId,
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
      !gameId
    ) {
      return;
    }

    const unsubscribe =
      FirebaseFantasySeasonRepository
        .subscribeByGameId(
          gameId,
          (
            nextFantasySeason,
          ) => {
            setFantasySeason(
              nextFantasySeason,
            );

            setIsLoading(
              false,
            );
          },
        );

    return () => {
      unsubscribe();
    };
  },
  [
    gameId,
  ],
);

  const createFantasySeason =
    useCallback(
      async (
        input:
          CreateFantasySeasonInput,
      ): Promise<FantasySeason> => {
        setIsSaving(
          true,
        );

        setError(
          null,
        );

        try {
          const existing =
            gameId
              ? await FirebaseFantasySeasonRepository
                  .getByGameId(
                    gameId,
                  )
              : null;

          if (
            existing
          ) {
            throw new Error(
              "Per questo gioco esiste già una stagione Fantacalcio.",
            );
          }

          const created =
            await FirebaseFantasySeasonRepository
              .create(
                input,
              );

          setFantasySeason(
            created,
          );

          return created;
        } catch (
          caughtError
        ) {
          const message =
            caughtError instanceof
            Error
              ? caughtError.message
              : "Impossibile creare la stagione Fantacalcio.";

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
        gameId,
      ],
    );

  const updateFantasySeason =
    useCallback(
      async (
        input:
          UpdateFantasySeasonInput,
      ): Promise<void> => {
        setIsSaving(
          true,
        );

        setError(
          null,
        );

        try {
          await FirebaseFantasySeasonRepository
            .update(
              input,
            );
        } catch (
          caughtError
        ) {
          const message =
            caughtError instanceof
            Error
              ? caughtError.message
              : "Impossibile aggiornare la stagione Fantacalcio.";

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

  const updateStatus =
    useCallback(
      async (
        status:
          FantasySeasonStatus,

        updatedBy?:
          string,
      ): Promise<void> => {
        if (
          !fantasySeason
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
          await FirebaseFantasySeasonRepository
            .updateStatus(
              fantasySeason.id,
              status,
              updatedBy,
            );
        } catch (
          caughtError
        ) {
          const message =
            caughtError instanceof
            Error
              ? caughtError.message
              : "Impossibile aggiornare lo stato del Fantacalcio.";

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
        fantasySeason,
      ],
    );

  const publishPlayerList =
    useCallback(
      async (
        publishedBy?:
          string,
      ): Promise<void> => {
        if (
          !fantasySeason
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
          await FirebaseFantasySeasonRepository
            .publishPlayerList(
              fantasySeason.id,
              publishedBy,
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
        fantasySeason,
      ],
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

    const effectiveFantasySeason =
  gameId
    ? fantasySeason
    : null;

const effectiveIsLoading =
  Boolean(
    gameId,
  ) &&
  isLoading;

  return {
    fantasySeason:
  effectiveFantasySeason,

isLoading:
  effectiveIsLoading,

    isSaving,

    error,

    hasFantasySeason:
  Boolean(
    effectiveFantasySeason,
  ),

    createFantasySeason,

    updateFantasySeason,

    updateStatus,

    publishPlayerList,

    clearError,
  };
}