"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useAuth,
} from "@/src/hooks/useAuth";

import { FirebasePlayerRepository } from "@/src/services/player/FirebasePlayerRepository";
import { publicPlayersCache } from "@/src/services/player/PublicPlayersCache";
import type { PlayerProfile } from "@/src/types/PlayerProfile";

export function usePlayers(
  competitionId?: string,
) {
  const {
    isAdmin,
  } =
    useAuth();

  const publicKey = competitionId?.trim() || "*";
  const cachedPlayers = !isAdmin ? publicPlayersCache.peek(publicKey) : undefined;
  const activeRequestKeyRef = useRef("");
  const [players, setPlayers] = useState<PlayerProfile[]>(cachedPlayers ?? []);

  const [isLoading, setIsLoading] =
    useState(!cachedPlayers);

  const [
    loadedRequestKey,
    setLoadedRequestKey,
  ] =
    useState<string | null>(
      cachedPlayers ? `public:${publicKey}` : null,
    );

  const requestKey =
    `${isAdmin ? "admin" : "public"}:${competitionId?.trim() || "*"}`;

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    activeRequestKeyRef.current = requestKey;

    const normalizedCompetitionId =
      competitionId?.trim();

    const loadPlayers = isAdmin
      ? normalizedCompetitionId
        ? FirebasePlayerRepository.getAllWithPrivateByCompetition(normalizedCompetitionId)
        : FirebasePlayerRepository.getAllWithPrivate()
      : publicPlayersCache.load(publicKey, () => normalizedCompetitionId
        ? FirebasePlayerRepository.getByCompetition(normalizedCompetitionId)
        : FirebasePlayerRepository.getAll());

    loadPlayers
      .then((loadedPlayers) => {
        if (!isActive) {
          return;
        }

        setPlayers(loadedPlayers);
        setError(null);
        setLoadedRequestKey(
          requestKey,
        );
      })
      .catch((currentError: unknown) => {
        if (!isActive) {
          return;
        }

        console.error(
          "Errore caricamento giocatori:",
          currentError,
        );

        setError(
          currentError instanceof Error
            ? currentError.message
            : "Impossibile caricare i giocatori.",
        );

        setLoadedRequestKey(
          requestKey,
        );
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    competitionId,
    isAdmin,
    requestKey,
    publicKey,
  ]);

  const refresh = useCallback(
    async () => {
      setIsLoading(true);
      setError(null);

      try {
        const normalizedCompetitionId =
          competitionId?.trim();

        if (!isAdmin) publicPlayersCache.invalidate(publicKey);
        const loadedPlayers = isAdmin
          ? normalizedCompetitionId
            ? await FirebasePlayerRepository.getAllWithPrivateByCompetition(normalizedCompetitionId)
            : await FirebasePlayerRepository.getAllWithPrivate()
          : await publicPlayersCache.load(publicKey, () => normalizedCompetitionId
            ? FirebasePlayerRepository.getByCompetition(normalizedCompetitionId)
            : FirebasePlayerRepository.getAll());
        if (activeRequestKeyRef.current !== requestKey) return;

        setPlayers(loadedPlayers);
        setLoadedRequestKey(
          requestKey,
        );
      } catch (currentError) {
        if (activeRequestKeyRef.current !== requestKey) return;
        console.error(
          "Errore aggiornamento giocatori:",
          currentError,
        );

        setError(
          currentError instanceof Error
            ? currentError.message
            : "Impossibile aggiornare i giocatori.",
        );

        setLoadedRequestKey(
          requestKey,
        );
      } finally {
        if (activeRequestKeyRef.current === requestKey) setIsLoading(false);
      }
    },
    [
      competitionId,
      isAdmin,
      requestKey,
      publicKey,
    ],
  );

  return {
    players: loadedRequestKey === requestKey ? players : [],
    isLoading:
      isLoading ||
      loadedRequestKey !==
        requestKey,
    error,
    refresh,
  };
}
