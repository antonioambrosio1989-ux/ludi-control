"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  LoaderCircle,
  MailCheck,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

import AppShell from "@/components/ui/AppShell";

import {
  useAuth,
} from "@/src/hooks/useAuth";

type AdminAuthUser = {
  uid:
    string;

  email:
    string;

  displayName:
    string;

  emailVerified:
    boolean;

  disabled:
    boolean;

  creationTime:
    string | null;

  lastSignInTime:
    string | null;
};

type UsersResponse = {
  users?:
    AdminAuthUser[];

  error?:
    string;
};

type VerifyResponse = {
  success?:
    boolean;

  alreadyVerified?:
    boolean;

  error?:
    string;

  user?: {
    uid:
      string;

    email:
      string;

    emailVerified:
      boolean;
  };
};

type DeleteResponse = {
  success?:
    boolean;

  error?:
    string;

  deletedUser?: {
    uid:
      string;

    email:
      string;
  };
};

type ProcessingAction =
  | "verify"
  | "delete";

export default function AdminUsersScreen() {
  const {
    user,
    isAdmin,
    isLoading:
      isAuthLoading,
  } =
    useAuth();

  const [
    users,
    setUsers,
  ] =
    useState<
      AdminAuthUser[]
    >(
      [],
    );

  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState(
      "",
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(
      true,
    );

  const [
    processingUid,
    setProcessingUid,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    processingAction,
    setProcessingAction,
  ] =
    useState<
      ProcessingAction | null
    >(
      null,
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

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const loadUsers =
    useCallback(
      async () => {
        if (
          !user ||
          !isAdmin
        ) {
          return;
        }

        setIsLoading(
          true,
        );

        setError(
          null,
        );

        try {
          const token =
            await user.getIdToken();

          const response =
            await fetch(
              "/api/admin/users/email-verification",
              {
                method:
                  "GET",

                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },

                cache:
                  "no-store",
              },
            );

          const data =
            (
              await response.json()
            ) as
              UsersResponse;

          if (
            !response.ok
          ) {
            throw new Error(
              data.error ??
                "Impossibile caricare gli utenti.",
            );
          }

          setUsers(
            data.users ??
              [],
          );
        } catch (
          currentError
        ) {
          console.error(
            "Errore caricamento utenti:",
            currentError,
          );

          setError(
            currentError instanceof
              Error
              ? currentError.message
              : "Impossibile caricare gli utenti.",
          );
        } finally {
          setIsLoading(
            false,
          );
        }
      },
      [
        user,
        isAdmin,
      ],
    );

  useEffect(
    () => {
      if (
        isAuthLoading
      ) {
        return;
      }

      if (
        !user ||
        !isAdmin
      ) {
        return;
      }

      const timerId =
        window.setTimeout(
          () => {
            void loadUsers();
          },
          0,
        );

      return () => {
        window.clearTimeout(
          timerId,
        );
      };
    },
    [
      isAuthLoading,
      user,
      isAdmin,
      loadUsers,
    ],
  );

  const filteredUsers =
    useMemo(
      () => {
        const query =
          searchQuery
            .trim()
            .toLocaleLowerCase(
              "it",
            );

        if (!query) {
          return users;
        }

        return users.filter(
          (
            currentUser,
          ) =>
            [
              currentUser.email,
              currentUser.displayName,
              currentUser.uid,
            ]
              .join(
                " ",
              )
              .toLocaleLowerCase(
                "it",
              )
              .includes(
                query,
              ),
        );
      },
      [
        users,
        searchQuery,
      ],
    );

  const unverifiedCount =
    users.filter(
      (
        currentUser,
      ) =>
        !currentUser
          .emailVerified,
    ).length;

  async function verifyUserEmail(
    target:
      AdminAuthUser,
  ) {
    if (
      !user ||
      processingUid
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Confermare manualmente l'email ${target.email || target.uid}?\n\nQuesta operazione imposterà emailVerified=true in Firebase Authentication.`,
      );

    if (
      !confirmed
    ) {
      return;
    }

    setProcessingUid(
      target.uid,
    );

    setProcessingAction(
      "verify",
    );

    setError(
      null,
    );

    setSuccessMessage(
      null,
    );

    try {
      const token =
        await user.getIdToken(
          true,
        );

      const response =
        await fetch(
          "/api/admin/users/email-verification",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                uid:
                  target.uid,
              }),
          },
        );

      const data =
        (
          await response.json()
        ) as
          VerifyResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ??
            "Impossibile verificare l'email.",
        );
      }

      setUsers(
        (
          currentUsers,
        ) =>
          currentUsers.map(
            (
              currentUser,
            ) =>
              currentUser.uid ===
              target.uid
                ? {
                    ...currentUser,
                    emailVerified:
                      true,
                  }
                : currentUser,
          ),
      );

      setSuccessMessage(
        data.alreadyVerified
          ? "L'email risultava già verificata."
          : `Email ${target.email || target.uid} verificata manualmente.`,
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore verifica manuale email:",
        currentError,
      );

      setError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile verificare l'email.",
      );
    } finally {
      setProcessingUid(
        null,
      );

      setProcessingAction(
        null,
      );
    }
  }

  async function deleteUnverifiedUser(
    target:
      AdminAuthUser,
  ) {
    if (
      !user ||
      processingUid ||
      target.emailVerified
    ) {
      return;
    }

    const targetLabel =
      target.email ||
      target.displayName ||
      target.uid;

    const confirmed =
      window.confirm(
        [
          `Eliminare definitivamente l'account ${targetLabel}?`,
          "",
          "Verranno eliminati l'utente da Firebase Authentication e il relativo profilo Firestore.",
          "L'operazione non può essere annullata.",
        ].join(
          "\n",
        ),
      );

    if (!confirmed) {
      return;
    }

    setProcessingUid(
      target.uid,
    );

    setProcessingAction(
      "delete",
    );

    setError(
      null,
    );

    setSuccessMessage(
      null,
    );

    try {
      const token =
        await user.getIdToken(
          true,
        );

      const response =
        await fetch(
          "/api/admin/users/email-verification",
          {
            method:
              "DELETE",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                uid:
                  target.uid,
              }),
          },
        );

      const data =
        (
          await response.json()
        ) as
          DeleteResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ??
            "Impossibile eliminare l'utente.",
        );
      }

      setUsers(
        (
          currentUsers,
        ) =>
          currentUsers.filter(
            (
              currentUser,
            ) =>
              currentUser.uid !==
              target.uid,
          ),
      );

      setSuccessMessage(
        `Account ${targetLabel} eliminato definitivamente.`,
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore eliminazione utente non verificato:",
        currentError,
      );

      setError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile eliminare l'utente.",
      );
    } finally {
      setProcessingUid(
        null,
      );

      setProcessingAction(
        null,
      );
    }
  }

  if (
    isAuthLoading
  ) {
    return (
      <AppShell>
        <StatusCard>
          Verifica permessi amministratore...
        </StatusCard>
      </AppShell>
    );
  }

  if (
    !user ||
    !isAdmin
  ) {
    return (
      <AppShell>
        <StatusCard
          error
        >
          Accesso riservato agli amministratori.
        </StatusCard>
      </AppShell>
    );
  }

  return (
    <AppShell>
     <header className="mt-2 mb-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#06142E]/35">
          Centro di controllo
        </p>

        <h1 className="mt-1 text-3xl font-black uppercase tracking-[-0.03em] text-[#06142E] sm:text-4xl">
          Utenti
        </h1>

        <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/45">
          Gestisci la verifica email degli account Firebase Authentication.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[16px] bg-[#06142E] p-4 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
            Account
          </p>

          <p className="mt-2 text-2xl font-black">
            {users.length}
          </p>
        </article>

        <article className="rounded-[16px] bg-amber-100 p-4 text-amber-900">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-900/55">
            Da verificare
          </p>

          <p className="mt-2 text-2xl font-black">
            {unverifiedCount}
          </p>
        </article>
      </section>

      <section className="mt-5 rounded-[18px] bg-white p-4 shadow-[0_10px_24px_rgba(6,20,46,0.08)]">
        <div className="flex items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#06142E]/35"
            />

            <input
              type="search"
              value={
                searchQuery
              }
              onChange={(
                event,
              ) => {
                setSearchQuery(
                  event.target.value,
                );
              }}
              placeholder="Cerca email, nome o UID..."
              aria-label="Cerca utente"
              className="h-12 w-full rounded-[13px] border border-[#06142E]/10 bg-[#F7F8FA] pl-11 pr-4 text-base font-bold text-[#06142E] outline-none placeholder:text-[#06142E]/30 sm:text-sm"
            />
          </div>

          <button
            type="button"
            disabled={
              isLoading
            }
            onClick={() => {
              void loadUsers();
            }}
            aria-label="Aggiorna utenti"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[13px] bg-[#06142E] text-white disabled:opacity-40"
          >
            <RefreshCw
              size={19}
              className={
                isLoading
                  ? "animate-spin"
                  : ""
              }
            />
          </button>
        </div>
      </section>

      {error && (
        <section className="mt-4 rounded-[16px] border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-700">
            {error}
          </p>
        </section>
      )}

      {successMessage && (
        <section className="mt-4 rounded-[16px] border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-bold text-emerald-700">
            {successMessage}
          </p>
        </section>
      )}

      <section className="mt-5 grid min-w-0 gap-4 xl:grid-cols-2">
        {isLoading ? (
          <StatusCard>
            <span className="inline-flex items-center gap-2">
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
              Caricamento utenti...
            </span>
          </StatusCard>
        ) : filteredUsers.length ===
          0 ? (
          <StatusCard>
            Nessun utente trovato.
          </StatusCard>
        ) : (
          filteredUsers.map(
            (
              currentUser,
            ) => (
              <article
                key={
                  currentUser.uid
                }
                className="rounded-[18px] bg-white p-4 shadow-[0_10px_24px_rgba(6,20,46,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-black text-[#06142E]">
                      {currentUser.displayName ||
                        "Utente"}
                    </p>

                    <p className="mt-1 break-all text-sm font-bold text-[#06142E]/55">
                      {currentUser.email ||
                        "Email non disponibile"}
                    </p>

                    <p className="mt-2 break-all text-[10px] font-bold text-[#06142E]/30">
                      UID:{" "}
                      {currentUser.uid}
                    </p>
                  </div>

                  {currentUser.emailVerified ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase text-emerald-700">
                      <CheckCircle2
                        size={13}
                      />
                      Verificata
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase text-amber-700">
                      Non verificata
                    </span>
                  )}
                </div>

                {!currentUser.emailVerified && (
                  <div className="mt-4 grid gap-2">
                    <button
                      type="button"
                      disabled={
                        processingUid !==
                        null
                      }
                      onClick={() => {
                        void verifyUserEmail(
                          currentUser,
                        );
                      }}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-[#06142E] px-4 text-xs font-black uppercase text-white transition active:scale-[0.99] disabled:opacity-40"
                    >
                      {processingUid ===
                        currentUser.uid &&
                      processingAction ===
                        "verify" ? (
                        <>
                          <LoaderCircle
                            size={17}
                            className="animate-spin"
                          />
                          Verifica...
                        </>
                      ) : (
                        <>
                          <MailCheck
                            size={17}
                          />
                          Verifica email manualmente
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={
                        processingUid !==
                        null
                      }
                      onClick={() => {
                        void deleteUnverifiedUser(
                          currentUser,
                        );
                      }}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] border border-red-200 bg-red-50 px-4 text-xs font-black uppercase text-red-700 transition active:scale-[0.99] disabled:opacity-40"
                    >
                      {processingUid ===
                        currentUser.uid &&
                      processingAction ===
                        "delete" ? (
                        <>
                          <LoaderCircle
                            size={17}
                            className="animate-spin"
                          />
                          Eliminazione...
                        </>
                      ) : (
                        <>
                          <Trash2
                            size={17}
                          />
                          Elimina utente
                        </>
                      )}
                    </button>
                  </div>
                )}
              </article>
            ),
          )
        )}
      </section>
    </AppShell>
  );
}

function StatusCard({
  children,
  error = false,
}: {
  children:
    React.ReactNode;

  error?:
    boolean;
}) {
  return (
    <section
      className={`rounded-[18px] p-5 text-center shadow-[0_10px_24px_rgba(6,20,46,0.08)] ${
        error
          ? "bg-red-50 text-red-700"
          : "bg-white text-[#06142E]/45"
      }`}
    >
      <p className="text-sm font-bold">
        {children}
      </p>
    </section>
  );
}
