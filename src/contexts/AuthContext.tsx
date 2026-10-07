"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  onAuthStateChanged,
  reload,
  type User,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/src/lib/firebase";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

type AuthContextValue = {
  user:
    User | null;

  isAdmin:
    boolean;

  isEmailVerified:
    boolean;

  refreshAuthUser:
    () => Promise<void>;

  isLoading:
    boolean;

  error:
    string | null;
};

/*
 * ============================================================
 * CONTEXT
 * ============================================================
 */

const AuthContext =
  createContext<
    AuthContextValue | undefined
  >(
    undefined,
  );

/*
 * ============================================================
 * PROVIDER
 * ============================================================
 */

export function AuthProvider({
  children,
}: {
  children:
    ReactNode;
}) {
  const [
    user,
    setUser,
  ] =
    useState<
      User | null
    >(
      null,
    );

  const [
    isAdmin,
    setIsAdmin,
  ] =
    useState(
      false,
    );

  const [
    isEmailVerified,
    setIsEmailVerified,
  ] =
    useState(
      false,
    );

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
   * FIREBASE AUTH LISTENER
   * ==========================================================
   */

  useEffect(
    () => {
      let active =
        true;

      const unsubscribe =
        onAuthStateChanged(
          auth,

          async (
            currentUser,
          ) => {
            if (
              !active
            ) {
              return;
            }

            setIsLoading(
              true,
            );

            setError(
              null,
            );

            /*
             * ================================================
             * NOT AUTHENTICATED
             * ================================================
             */

            if (
              !currentUser
            ) {
              setUser(
                null,
              );

              setIsAdmin(
                false,
              );

              setIsEmailVerified(
                false,
              );

              setIsLoading(
                false,
              );

              return;
            }

            /*
             * ================================================
             * AUTHENTICATED USER
             * ================================================
             */

            setUser(
              currentUser,
            );

            setIsEmailVerified(
              currentUser.emailVerified,
            );

            /*
             * ================================================
             * ADMIN CHECK
             * ================================================
             */

            try {
              const adminSnapshot =
                await getDoc(
                  doc(
                    db,
                    "admins",
                    currentUser.uid,
                  ),
                );

              if (
                !active
              ) {
                return;
              }

              const adminData =
                adminSnapshot.exists()
                  ? adminSnapshot.data()
                  : undefined;

              const adminIsActive =
                adminSnapshot.exists() &&
                adminData?.active ===
                  true;

              setIsAdmin(
                adminIsActive,
              );
            } catch (
              currentError
            ) {
              console.error(
                "Errore verifica ruolo Admin:",
                currentError,
              );

              if (
                !active
              ) {
                return;
              }

              /*
               * Fail-closed:
               * in caso di errore nessun
               * privilegio Admin.
               */

              setIsAdmin(
                false,
              );

              setError(
                currentError instanceof
                  Error
                  ? currentError.message
                  : "Impossibile verificare i permessi amministratore.",
              );
            } finally {
              if (
                active
              ) {
                setIsLoading(
                  false,
                );
              }
            }
          },
        );

      return () => {
        active =
          false;

        unsubscribe();
      };
    },
    [],
  );


  /*
   * ==========================================================
   * REFRESH AUTH USER
   * ==========================================================
   *
   * Utile dopo la conferma del link ricevuto via email:
   * reload() aggiorna emailVerified senza richiedere logout/login.
   * ==========================================================
   */

  async function refreshAuthUser() {
    const currentUser =
      auth.currentUser;

    if (
      !currentUser
    ) {
      setUser(
        null,
      );

      setIsEmailVerified(
        false,
      );

      return;
    }

    await reload(
      currentUser,
    );

    setUser(
      currentUser,
    );

    setIsEmailVerified(
      currentUser.emailVerified,
    );
  }

  /*
   * ==========================================================
   * VALUE
   * ==========================================================
   */

  const value =
    useMemo<
      AuthContextValue
    >(
      () => ({
        user,

        isAdmin,

        isEmailVerified,

        refreshAuthUser,

        isLoading,

        error,
      }),
      [
        user,
        isAdmin,
        isEmailVerified,
        isLoading,
        error,
      ],
    );

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <AuthContext.Provider
      value={
        value
      }
    >
      {children}
    </AuthContext.Provider>
  );
}

/*
 * ============================================================
 * CONTEXT HOOK
 * ============================================================
 */

export function useAuthContext() {
  const context =
    useContext(
      AuthContext,
    );

  if (
    context ===
    undefined
  ) {
    throw new Error(
      "useAuth deve essere utilizzato all'interno di AuthProvider.",
    );
  }

  return context;
}