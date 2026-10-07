"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FirebaseGamesSubscriptionRepository,
} from "@/src/services/games/FirebaseGamesSubscriptionRepository";

import {
  hasActiveGamesSubscription,
  type GamesSubscription,
} from "@/src/types/GamesSubscription";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

type UseGamesSubscriptionResult = {
  subscription:
    GamesSubscription | null;

  hasAccess:
    boolean;

  isLoading:
    boolean;

  error:
    string | null;
};

type SubscriptionState = {
  key:
    string | null;

  subscription:
    GamesSubscription | null;

  error:
    string | null;

  status:
    | "ready"
    | "error";
};

/*
 * ============================================================
 * GAMES SUBSCRIPTION
 * ============================================================
 */

export function useGamesSubscription({
  userId,
  gamesSeasonId,
}: {
  userId?:
    string;

  gamesSeasonId?:
    string;
}): UseGamesSubscriptionResult {
  const [
    state,
    setState,
  ] =
    useState<
      SubscriptionState
    >({
      key:
        null,

      subscription:
        null,

      error:
        null,

      status:
        "ready",
    });

  /*
   * ==========================================================
   * CURRENT KEY
   * ==========================================================
   */

  const currentKey =
    userId &&
    gamesSeasonId
      ? `${userId}:${gamesSeasonId}`
      : null;

  /*
   * ==========================================================
   * SUBSCRIPTION
   * ==========================================================
   */

  useEffect(
    () => {
      if (
        !userId ||
        !gamesSeasonId
      ) {
        return;
      }

      const currentUserId =
        userId;

      const currentGamesSeasonId =
        gamesSeasonId;

      const subscriptionKey =
        `${currentUserId}:${currentGamesSeasonId}`;

      const unsubscribe =
        FirebaseGamesSubscriptionRepository
          .subscribeByUserAndGamesSeason({
            userId:
              currentUserId,

            gamesSeasonId:
              currentGamesSeasonId,

            onChange: (
              nextSubscription,
            ) => {
              setState({
                key:
                  subscriptionKey,

                subscription:
                  nextSubscription,

                error:
                  null,

                status:
                  "ready",
              });
            },

            onError: (
              currentError,
            ) => {
              console.error(
                "Errore caricamento Games Pass:",
                currentError,
              );

              setState({
                key:
                  subscriptionKey,

                subscription:
                  null,

                error:
                  currentError.message ||
                  "Impossibile verificare il Games Pass.",

                status:
                  "error",
              });
            },
          });

      return unsubscribe;
    },
    [
      userId,
      gamesSeasonId,
    ],
  );

  /*
   * ==========================================================
   * CURRENT STATE
   * ==========================================================
   */

  const stateMatchesCurrentRequest =
    Boolean(
      currentKey &&
        state.key ===
          currentKey,
    );

  const currentSubscription =
    stateMatchesCurrentRequest
      ? state.subscription
      : null;

  /*
   * ==========================================================
   * ACCESS
   * ==========================================================
   */

  const hasAccess =
    useMemo(
      () => {
        if (
          !gamesSeasonId ||
          !currentSubscription
        ) {
          return false;
        }

        return hasActiveGamesSubscription(
          currentSubscription,
          gamesSeasonId,
        );
      },
      [
        currentSubscription,
        gamesSeasonId,
      ],
    );

  /*
   * ==========================================================
   * OUTPUT
   * ==========================================================
   */

  return {
    subscription:
      currentKey
        ? currentSubscription
        : null,

    hasAccess,

    isLoading:
      Boolean(
        currentKey,
      ) &&
      !stateMatchesCurrentRequest,

    error:
      currentKey &&
      stateMatchesCurrentRequest &&
      state.status ===
        "error"
        ? state.error
        : null,
  };
}