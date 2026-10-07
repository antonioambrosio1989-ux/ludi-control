"use client";

import {
  useEffect,
  useState,
} from "react";

import type {
  InstagramPost,
} from "@/app/api/instagram/route";

type FeatureType =
  | "gotw"
  | "totw"
  | "potw";

type State = {
  requestKey?: string;
  post: InstagramPost | null;
  isLoading: boolean;
  error: string | null;
};

const FEATURE_REFRESH_MS =
  60_000;

export function useInstagramFeaturePost(
  type: FeatureType,
  matchweek: number | null,
  competitionId?: string,
  refreshKey = 0,
) {
  const requestKey = `${type}:${competitionId ?? ""}:${matchweek ?? ""}:${refreshKey}`;

  const [state, setState] =
    useState<State>({
      post: null,
      isLoading: false,
      error: null,
    });

  useEffect(() => {
    let active = true;
    let intervalId:
      ReturnType<typeof setInterval> | undefined;

    async function load(
      showLoading: boolean,
    ) {
      if (
        matchweek === null ||
        !competitionId
      ) {
        setState({
          requestKey,
          post: null,
          isLoading: false,
          error: null,
        });

        return;
      }

      if (showLoading) {
        setState({
          requestKey,
          post: null,
          isLoading: true,
          error: null,
        });
      }

      try {
        const response =
          await fetch(
            `/api/instagram?type=${type}&matchweek=${matchweek}&competitionId=${encodeURIComponent(
              competitionId,
            )}`,
            {
              cache: "no-store",
            },
          );

        const payload =
          (await response.json()) as {
            post?: InstagramPost | null;
            error?: string;
          };

        if (!active) {
          return;
        }

        if (!response.ok) {
          setState({
            requestKey,
            post: null,
            isLoading: false,
            error:
              payload.error ??
              "Errore caricamento Instagram.",
          });

          return;
        }

        setState({
          requestKey,
          post:
            payload.post ?? null,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        console.error(
          "Errore feature Instagram:",
          error,
        );

        setState({
          requestKey,
          post: null,
          isLoading: false,
          error:
            "Impossibile collegarsi a Instagram.",
        });
      }
    }

    void load(true);

    if (
      matchweek !== null &&
      competitionId
    ) {
      intervalId = setInterval(
        () => {
          void load(false);
        },
        FEATURE_REFRESH_MS,
      );
    }

    return () => {
      active = false;

      if (intervalId) {
        clearInterval(
          intervalId,
        );
      }
    };
  }, [
    type,
    matchweek,
    competitionId,
    requestKey,
  ]);

  return state.requestKey === requestKey
    ? state
    : {
        post: null,
        isLoading:
          matchweek !== null &&
          Boolean(
            competitionId,
          ),
        error: null,
      };
}
