"use client";

import {
  useEffect,
  useState,
} from "react";

import { FirebaseTeamRepository } from "@/src/services/team/FirebaseTeamRepository";

import type { Team } from "@/src/types/Team";

export function useTeams() {
  const [teams, setTeams] =
    useState<Team[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const unsubscribe =
      FirebaseTeamRepository.subscribeAll(
        (nextTeams: Team[]) => {
          setTeams(nextTeams);
          setError(null);
          setIsLoading(false);
        },

        (currentError: Error) => {
          setError(currentError.message);
          setIsLoading(false);
        },
      );

    return unsubscribe;
  }, []);

  return {
    teams,
    isLoading,
    error,
  };
}