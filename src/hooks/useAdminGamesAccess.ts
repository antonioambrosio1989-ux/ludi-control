"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  GamesAccessCode,
} from "@/src/types/GamesAccessCode";

import type {
  GamesSubscription,
} from "@/src/types/GamesSubscription";

import {
  FirebaseGamesAccessCodeRepository,
} from "@/src/services/games/FirebaseGamesAccessCodeRepository";

import {
  FirebaseGamesSubscriptionsAdminRepository,
} from "@/src/services/games/FirebaseGamesSubscriptionsAdminRepository";

export function useAdminGamesAccess(
  gamesSeasonId?:
    string,
) {
  const [
    accessCodes,
    setAccessCodes,
  ] =
    useState<
      GamesAccessCode[]
    >([]);

  const [
    subscriptions,
    setSubscriptions,
  ] =
    useState<
      GamesSubscription[]
    >([]);

  const [
    codesLoading,
    setCodesLoading,
  ] =
    useState(
      Boolean(
        gamesSeasonId,
      ),
    );

  const [
    subscriptionsLoading,
    setSubscriptionsLoading,
  ] =
    useState(
      Boolean(
        gamesSeasonId,
      ),
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

  useEffect(() => {
    if (
      !gamesSeasonId
    ) {
      return;
    }

    const unsubscribeCodes =
      FirebaseGamesAccessCodeRepository.subscribeByGamesSeason(
        gamesSeasonId,

        (
          items,
        ) => {
          setAccessCodes(
            items,
          );

          setCodesLoading(
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

          setCodesLoading(
            false,
          );

          setError(
            "Impossibile caricare i pass Presidenti.",
          );
        },
      );

    const unsubscribeSubscriptions =
      FirebaseGamesSubscriptionsAdminRepository.subscribeByGamesSeason(
        gamesSeasonId,

        (
          items,
        ) => {
          setSubscriptions(
            items,
          );

          setSubscriptionsLoading(
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

          setSubscriptionsLoading(
            false,
          );

          setError(
            "Impossibile caricare gli iscritti Games.",
          );
        },
      );

    return () => {
      unsubscribeCodes();
      unsubscribeSubscriptions();
    };
  }, [
    gamesSeasonId,
  ]);

  const activeSubscriptions =
    useMemo(
      () =>
        subscriptions.filter(
          (
            item,
          ) =>
            item.status ===
            "active",
        ),
      [
        subscriptions,
      ],
    );

  const paidSubscribers =
    useMemo(
      () =>
        activeSubscriptions.filter(
          (
            item,
          ) =>
            item.accessMethod ===
            "payment",
        ).length,
      [
        activeSubscriptions,
      ],
    );

  const presidentSubscribers =
    useMemo(
      () =>
        activeSubscriptions.filter(
          (
            item,
          ) =>
            item.accessMethod ===
            "president_code",
        ).length,
      [
        activeSubscriptions,
      ],
    );

  const availableCodes =
    useMemo(
      () =>
        accessCodes.filter(
          (
            item,
          ) =>
            item.status ===
            "available",
        ).length,
      [
        accessCodes,
      ],
    );

  const redeemedCodes =
    useMemo(
      () =>
        accessCodes.filter(
          (
            item,
          ) =>
            item.status ===
            "redeemed",
        ).length,
      [
        accessCodes,
      ],
    );

  return {
    accessCodes,

    subscriptions,

    totalSubscribers:
      activeSubscriptions.length,

    paidSubscribers,

    presidentSubscribers,

    availableCodes,

    redeemedCodes,

    isLoading:
      codesLoading ||
      subscriptionsLoading,

    error,
  };
}