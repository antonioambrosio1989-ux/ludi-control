"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import AppShell from "@/components/ui/AppShell";

import {
  LoaderCircle,
} from "lucide-react";

import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

import {
  useAuth,
} from "@/src/hooks/useAuth";

import {
  FirebaseMatchRepository,
} from "@/src/services/match/FirebaseMatchRepository";

import {
  FirebaseOfficialCommunicationRepository,
} from "@/src/services/discipline/FirebaseOfficialCommunicationRepository";

import type {
  Match,
} from "@/src/types/Match";

import type {
  OfficialCommunication,
} from "@/src/types/OfficialCommunication";

/*
 * ============================================================
 * ADMIN COMMUNICATIONS SCREEN
 * ============================================================
 */

export default function AdminCommunicationsScreen() {
  /*
   * ==========================================================
   * AUTH
   * ==========================================================
   */

  const {
    isAdmin,

    isLoading:
      isAuthLoading,
  } =
    useAuth();

  /*
   * ==========================================================
   * COMPETITION
   * ==========================================================
   */

  const {
    currentSeason,

    isLoading:
      competitionLoading,

    error:
      competitionError,
  } =
    useCompetition();

    const currentSeasonId =
  currentSeason?.id;

  /*
   * ==========================================================
   * STATE
   * ==========================================================
   */

  const [
    matches,
    setMatches,
  ] =
    useState<
      Match[]
    >(
      [],
    );

  const [
    communications,
    setCommunications,
  ] =
    useState<
      OfficialCommunication[]
    >(
      [],
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(
      true,
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<
      string | null
    >(
      null,
    );

  /*
 * ==========================================================
 * LOAD DATA
 * ==========================================================
 */

useEffect(
  () => {
    if (
      isAuthLoading ||
      competitionLoading ||
      !isAdmin ||
      !currentSeasonId
    ) {
      return;
    }

    const seasonId =
  currentSeasonId;

    let active =
      true;

    async function loadData() {
      setIsLoading(
        true,
      );

      setErrorMessage(
        null,
      );

      try {
        const [
          loadedMatches,
          loadedCommunications,
        ] =
          await Promise.all([
            FirebaseMatchRepository.getBySeason(
              seasonId,
            ),

            FirebaseOfficialCommunicationRepository.getBySeason(
              seasonId,
            ),
          ]);

        if (
          !active
        ) {
          return;
        }

        setMatches(
          loadedMatches,
        );

        setCommunications(
          loadedCommunications,
        );
      } catch (
        error
      ) {
        console.error(
          "Errore caricamento comunicati disciplinari:",
          error,
        );

        if (
          !active
        ) {
          return;
        }

        setMatches(
          [],
        );

        setCommunications(
          [],
        );

        setErrorMessage(
          error instanceof
            Error
            ? error.message
            : "Impossibile caricare i comunicati disciplinari.",
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
    }

    void loadData();

    return () => {
      active =
        false;
    };
  },
  [
    isAdmin,
    isAuthLoading,
    competitionLoading,
    currentSeasonId,
  ],
);

  /*
   * ==========================================================
   * MATCHWEEKS
   * ==========================================================
   */

  const availableMatchweeks =
    useMemo(
      () =>
        Array.from(
          new Set(
            matches.map(
              (
                match,
              ) =>
                match.matchweek,
            ),
          ),
        ).sort(
          (
            firstMatchweek,
            secondMatchweek,
          ) =>
            secondMatchweek -
            firstMatchweek,
        ),
      [
        matches,
      ],
    );

  /*
   * ==========================================================
   * COMMUNICATION MAP
   * ==========================================================
   */

  const communicationsByMatchweek =
    useMemo(
      () =>
        new Map(
          communications.map(
            (
              communication,
            ) => [
              communication.matchweek,
              communication,
            ],
          ),
        ),
      [
        communications,
      ],
    );

  /*
   * ==========================================================
   * PAGE ERROR
   * ==========================================================
   */

  const pageError =
    competitionError ||
    errorMessage;

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <AppShell>
      <div className="space-y-5">
        {/* HEADER */}

        <header className="mt-2 mb-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#06142E]/35">
            Centro di controllo
          </p>

          <h1 className="mt-1 text-3xl font-black uppercase tracking-[-0.03em] text-[#06142E] sm:text-4xl">
            Comunicati
          </h1>

          <p className="mt-1 max-w-2xl text-sm font-bold leading-6 text-[#06142E]/50">
            Genera, modifica e pubblica i comunicati delle diverse Matchweek.
          </p>
        </header>

        {/* LOADING */}

        {isLoading ||
        isAuthLoading ||
        competitionLoading ? (
          <section className="mt-5 rounded-[24px] bg-white px-5 py-12 text-center shadow-sm">
            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[#06142E]/35" />

            <p className="mt-3 text-sm font-black text-[#06142E]/45">
              Caricamento comunicati...
            </p>
          </section>
        ) : pageError ? (
          <section className="mt-5 rounded-[24px] border border-red-200 bg-red-50 px-5 py-6 shadow-sm">
            <p className="text-sm font-black text-red-700">
              {pageError}
            </p>
          </section>
        ) : !currentSeason ? (
          <section className="mt-5 rounded-[24px] bg-white px-5 py-12 text-center shadow-sm">
            <p className="text-sm font-black text-[#06142E]/45">
              Nessuna stagione attiva per la competizione selezionata.
            </p>
          </section>
        ) : availableMatchweeks.length >
          0 ? (
          <section className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {availableMatchweeks.map(
              (
                matchweek,
              ) => {
                const communication =
                  communicationsByMatchweek.get(
                    matchweek,
                  );

                return (
                  <CommunicationCard
                    key={
                      matchweek
                    }
                    matchweek={
                      matchweek
                    }
                    communication={
                      communication
                    }
                  />
                );
              },
            )}
          </section>
        ) : (
          <section className="mt-5 rounded-[24px] bg-white px-5 py-12 text-center shadow-sm">
            <p className="text-sm font-black text-[#06142E]/45">
              Nessuna Matchweek disponibile.
            </p>
          </section>
        )}
      </div>
    </AppShell>
  );
}

/*
 * ============================================================
 * COMMUNICATION CARD
 * ============================================================
 */

function CommunicationCard({
  matchweek,
  communication,
}: {
  matchweek:
    number;

  communication?:
    OfficialCommunication;
}) {
  const status =
    communication?.status ??
    "missing";

  return (
    <Link
      href={`/admin/comunicati/mw${matchweek}`}
      className="block h-full rounded-[22px] border border-[#06142E]/8 bg-white p-5 transition hover:-translate-y-0.5 active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#06142E]/35">
            Comunicato disciplinare
          </p>

          <h2 className="mt-1 text-lg font-black text-[#06142E]">
            Matchweek{" "}
            {
              matchweek
            }
          </h2>

          <p className="mt-2 text-xs font-bold text-[#06142E]/45">
            {getStatusDescription(
              status,
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <CommunicationStatusBadge
            status={
              status
            }
          />

          <span className="text-xl font-black text-[#06142E]/25">
            ›
          </span>
        </div>
      </div>

      {communication?.updatedAt ? (
        <p className="mt-4 border-t border-[#06142E]/8 pt-3 text-[11px] font-semibold text-[#06142E]/35">
          Ultimo aggiornamento:{" "}
          {formatDate(
            communication.updatedAt,
          )}
        </p>
      ) : null}
    </Link>
  );
}

/*
 * ============================================================
 * STATUS BADGE
 * ============================================================
 */

function CommunicationStatusBadge({
  status,
}: {
  status:
    | "draft"
    | "published"
    | "missing";
}) {
  if (
    status ===
    "published"
  ) {
    return (
      <span className="rounded-full bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700">
        Pubblicato
      </span>
    );
  }

  if (
    status ===
    "draft"
  ) {
    return (
      <span className="rounded-full bg-amber-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-amber-700">
        Bozza
      </span>
    );
  }

  return (
    <span className="rounded-full bg-[#F1F4F8] px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#06142E]/45">
      Non generato
    </span>
  );
}

/*
 * ============================================================
 * STATUS DESCRIPTION
 * ============================================================
 */

function getStatusDescription(
  status:
    | "draft"
    | "published"
    | "missing",
): string {
  if (
    status ===
    "published"
  ) {
    return "Il comunicato è visibile pubblicamente.";
  }

  if (
    status ===
    "draft"
  ) {
    return "Il comunicato è ancora in fase di revisione.";
  }

  return "Il comunicato non è stato ancora generato.";
}

/*
 * ============================================================
 * DATE
 * ============================================================
 */

function formatDate(
  value:
    string,
): string {
  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "data non disponibile";
  }

  return new Intl.DateTimeFormat(
    "it-IT",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    },
  ).format(
    date,
  );
}