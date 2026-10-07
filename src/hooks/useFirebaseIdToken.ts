"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  onIdTokenChanged,
} from "firebase/auth";

import {
  auth,
} from "@/src/lib/firebase";

export function useFirebaseIdToken() {
  const [
    idToken,
    setIdToken,
  ] =
    useState<string | null>(
      null,
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  useEffect(() => {
    const unsubscribe =
      onIdTokenChanged(
        auth,
        async (
          user,
        ) => {
          if (!user) {
            setIdToken(
              null,
            );

            setIsLoading(
              false,
            );

            return;
          }

          try {
            const token =
              await user.getIdToken();

            setIdToken(
              token,
            );
          } catch (
            error
          ) {
            console.error(
              "Errore recupero Firebase ID token:",
              error,
            );

            setIdToken(
              null,
            );
          } finally {
            setIsLoading(
              false,
            );
          }
        },
      );

    return unsubscribe;
  }, []);

  return {
    idToken,
    isLoading,
  };
}