"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import TeamLogo from "@/components/common/TeamLogo";
import AppShell from "@/components/ui/AppShell";

import {
  useAuth,
} from "@/src/hooks/useAuth";

import {
  useTeams,
} from "@/src/hooks/useTeams";

import {
  FirebaseFinalStageMatchRepository,
} from "@/src/services/final-stage/FirebaseFinalStageMatchRepository";

import {
  FirebaseFinalStageMatchLifecycleService,
} from "@/src/services/final-stage/FirebaseFinalStageMatchLifecycleService";

import type {
  FinalStageMatch,
} from "@/src/types/FinalStageMatch";

type Props = {
  matchId:
    string;
};

type ScoreSide =
  | "home"
  | "away";

export default function AdminFinalStageLiveMatchScreen({
  matchId,
}: Props) {
  const {
    isAdmin,
    isLoading:
      authLoading,
  } =
    useAuth();

  const {
    teams,
    isLoading:
      teamsLoading,
    error:
      teamsError,
  } =
    useTeams();

  const [
    match,
    setMatch,
  ] =
    useState<
      FinalStageMatch | null
    >(
      null,
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(
      true,
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
    useState<
      string | null
    >(
      null,
    );

  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(
      null,
    );

  useEffect(() => {
    let active =
      true;

    async function loadMatch() {
      if (
        authLoading
      ) {
        return;
      }

      if (
        !isAdmin
      ) {
        if (
          active
        ) {
          setIsLoading(
            false,
          );
        }

        return;
      }

      setIsLoading(
        true,
      );

      setError(
        null,
      );

      try {
        let loadedMatch =
          await FirebaseFinalStageMatchRepository.getById(
            matchId,
          );

        if (
          loadedMatch?.status ===
          "scheduled"
        ) {
          await FirebaseFinalStageMatchLifecycleService.syncAutomaticLiveState({
            seasonId:
              loadedMatch.seasonId,
          });

          loadedMatch =
            await FirebaseFinalStageMatchRepository.getById(
              matchId,
            );
        }

        if (
          !active
        ) {
          return;
        }

        if (
          !loadedMatch
        ) {
          setMatch(
            null,
          );

          setError(
            "La partita delle fasi finali selezionata non esiste.",
          );

          return;
        }

        setMatch(
          loadedMatch,
        );
      } catch (
        currentError
      ) {
        if (
          !active
        ) {
          return;
        }

        setError(
          currentError instanceof
            Error
            ? currentError.message
            : "Impossibile caricare la partita.",
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

    void loadMatch();

    return () => {
      active =
        false;
    };
  }, [
    authLoading,
    isAdmin,
    matchId,
  ]);

  const homeTeam =
    useMemo(
      () =>
        match
          ? teams.find(
              (
                team,
              ) =>
                String(
                  team.id,
                ) ===
                String(
                  match.homeTeamId,
                ),
            )
          : undefined,
      [
        match,
        teams,
      ],
    );

  const awayTeam =
    useMemo(
      () =>
        match
          ? teams.find(
              (
                team,
              ) =>
                String(
                  team.id,
                ) ===
                String(
                  match.awayTeamId,
                ),
            )
          : undefined,
      [
        match,
        teams,
      ],
    );

  const homeName =
    homeTeam?.aliasName?.trim() ||
    homeTeam?.name ||
    "Squadra casa";

  const awayName =
    awayTeam?.aliasName?.trim() ||
    awayTeam?.name ||
    "Squadra ospite";

  const isLive =
    match?.status ===
    "live";

  const isFinished =
    match?.status ===
    "finished";

  const scoreControlsDisabled =
    !isLive ||
    isSaving;

  async function changeScore(
    side:
      ScoreSide,
    delta:
      -1 | 1,
  ) {
    if (
      !match ||
      !isLive ||
      isSaving
    ) {
      return;
    }

    const currentHome =
      match.homeScore ??
      0;

    const currentAway =
      match.awayScore ??
      0;

    const nextHome =
      side ===
      "home"
        ? Math.max(
            0,
            currentHome +
              delta,
          )
        : currentHome;

    const nextAway =
      side ===
      "away"
        ? Math.max(
            0,
            currentAway +
              delta,
          )
        : currentAway;

    if (
      nextHome ===
        currentHome &&
      nextAway ===
        currentAway
    ) {
      return;
    }

    setIsSaving(
      true,
    );

    setError(
      null,
    );

    setMessage(
      null,
    );

    setMatch({
      ...match,

      homeScore:
        nextHome,

      awayScore:
        nextAway,
    });

    try {
      await FirebaseFinalStageMatchLifecycleService.updateLiveScore({
        matchId:
          match.id,

        homeScore:
          nextHome,

        awayScore:
          nextAway,
      });
    } catch (
      currentError
    ) {
      setMatch(
        match,
      );

      setError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile aggiornare il risultato live.",
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  async function finishMatch() {
    if (
      !match ||
      !isLive ||
      isSaving
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Confermare la fine di ${homeName} - ${awayName} sul risultato ${match.homeScore ?? 0}-${match.awayScore ?? 0}?`,
      );

    if (
      !confirmed
    ) {
      return;
    }

    setIsSaving(
      true,
    );

    setError(
      null,
    );

    setMessage(
      null,
    );

    try {
      const updated =
        await FirebaseFinalStageMatchLifecycleService.finishMatch({
          matchId:
            match.id,
        });

      setMatch(
        updated,
      );

      setMessage(
        "Partita terminata. Il risultato è definitivo e il tabellino è in elaborazione.",
      );
    } catch (
      currentError
    ) {
      setError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile terminare la partita.",
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  async function restoreLive() {
    if (
      !match ||
      !isFinished ||
      isSaving
    ) {
      return;
    }

    setIsSaving(
      true,
    );

    setError(
      null,
    );

    setMessage(
      null,
    );

    try {
      const updated =
        await FirebaseFinalStageMatchLifecycleService.restoreLive({
          matchId:
            match.id,
        });

      setMatch(
        updated,
      );

      setMessage(
        "Partita ripristinata in LIVE. Il punteggio è nuovamente modificabile.",
      );
    } catch (
      currentError
    ) {
      setError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile ripristinare il live.",
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  if (
    authLoading ||
    teamsLoading ||
    isLoading
  ) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md">
          <div className="ludi-card p-7 text-center text-sm font-bold text-[#06142E]/45">
            Caricamento gestionale live...
          </div>
        </div>
      </AppShell>
    );
  }

  if (
    !isAdmin
  ) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md">
          <section className="rounded-[20px] border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-500">
              Area riservata
            </p>

            <h1 className="mt-2 text-2xl font-black uppercase text-red-700">
              Accesso Admin richiesto
            </h1>

            <Link
              href="/admin/fasi-finali/calendario"
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-[13px] bg-[#06142E] px-5 text-xs font-black uppercase text-white"
            >
              Torna alle fasi finali
            </Link>
          </section>
        </div>
      </AppShell>
    );
  }

  if (
    teamsError ||
    error ||
    !match
  ) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md">
          <section className="rounded-[20px] border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-bold leading-6 text-red-700">
              {error ??
                teamsError ??
                "Partita non disponibile."}
            </p>

            <Link
              href="/admin"
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-[13px] bg-[#06142E] px-5 text-xs font-black uppercase text-white"
            >
              Torna all&apos;Admin
            </Link>
          </section>
        </div>
      </AppShell>
    );
  }

  const homeScore =
    match.homeScore ??
    0;

  const awayScore =
    match.awayScore ??
    0;

  return (
    <AppShell>
      <div className="mx-auto max-w-md space-y-5">
        <header>
          <Link
            href="/admin"
            className="text-xs font-black uppercase tracking-[0.12em] text-[#06142E]/45"
          >
            ← Admin
          </Link>

          <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
            Final Stage · FS{match.finalStageWeek ?? "-"}
          </p>

          <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
            Gestione Live
          </h1>

          <p className="mt-2 text-sm font-bold text-[#06142E]/45">
            {formatItalianDate(
              match.date,
            )} · {match.time}
          </p>
        </header>

        <section className="overflow-hidden rounded-[26px] bg-[#06142E] px-4 py-6 text-white shadow-[0_18px_42px_rgba(6,20,46,0.18)]">
          <div className="flex justify-center">
            <span
              className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${
                isLive
                  ? "bg-red-500/15 text-red-400"
                  : isFinished
                    ? "bg-white/10 text-white/75"
                    : "bg-white/10 text-white/45"
              }`}
            >
              {isLive
                ? "Partita live"
                : isFinished
                  ? "Tabellino in elaborazione"
                  : "Partita non live"}
            </span>
          </div>

          <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
            <TeamScoreColumn
              name={
                homeName
              }
              logoUrl={
                homeTeam?.logoUrl
              }
              score={
                homeScore
              }
              disabled={
                scoreControlsDisabled
              }
              onIncrease={() => {
                void changeScore(
                  "home",
                  1,
                );
              }}
              onDecrease={() => {
                void changeScore(
                  "home",
                  -1,
                );
              }}
            />

            <div className="pt-[76px] text-center">
              <span className="text-3xl font-black text-white/35">
                -
              </span>
            </div>

            <TeamScoreColumn
              name={
                awayName
              }
              logoUrl={
                awayTeam?.logoUrl
              }
              score={
                awayScore
              }
              disabled={
                scoreControlsDisabled
              }
              onIncrease={() => {
                void changeScore(
                  "away",
                  1,
                );
              }}
              onDecrease={() => {
                void changeScore(
                  "away",
                  -1,
                );
              }}
            />
          </div>

          <p
            className={`mt-6 text-center text-xs font-black uppercase tracking-[0.15em] ${
              isLive
                ? "text-red-400"
                : "text-white/60"
            }`}
          >
            {isSaving
              ? "Salvataggio..."
              : isLive
                ? "Risultato live"
                : isFinished
                  ? "Risultato finale"
                  : "In attesa del live"}
          </p>
        </section>

        {message && (
          <div className="rounded-[16px] border border-green-200 bg-green-50 p-4 text-sm font-bold leading-6 text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-[16px] border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">
            {error}
          </div>
        )}

        {!isLive &&
          !isFinished && (
            <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
              Questa partita non è ancora entrata nel lifecycle LIVE. L&apos;avvio resta automatico a 15 minuti dall&apos;orario di calendario.
            </div>
          )}

        <section className="space-y-3">
          <button
            type="button"
            onClick={() => {
              void finishMatch();
            }}
            disabled={
              !isLive ||
              isSaving
            }
            className="min-h-14 w-full rounded-[15px] bg-red-600 px-5 text-sm font-black uppercase text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          >
            Fine partita
          </button>

          <button
            type="button"
            onClick={() => {
              void restoreLive();
            }}
            disabled={
              !isFinished ||
              isSaving
            }
            className="min-h-14 w-full rounded-[15px] border border-[#06142E]/10 bg-[#06142E] px-5 text-sm font-black uppercase text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
          >
            Ritorna al live
          </button>
        </section>
      </div>
    </AppShell>
  );
}

function TeamScoreColumn({
  name,
  logoUrl,
  score,
  disabled,
  onIncrease,
  onDecrease,
}: {
  name:
    string;

  logoUrl?:
    string;

  score:
    number;

  disabled:
    boolean;

  onIncrease:
    () => void;

  onDecrease:
    () => void;
}) {
  return (
    <div className="min-w-0 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center">
        <TeamLogo
          logoUrl={
            logoUrl
          }
          teamName={
            name
          }
          size={
            60
          }
        />
      </div>

      <p className="mt-3 min-h-9 truncate text-[11px] font-black uppercase leading-4 text-white/80">
        {name}
      </p>

      <div className="mt-3 flex flex-col items-center">
        <button
          type="button"
          aria-label={`Aumenta gol ${name}`}
          disabled={
            disabled ||
            score >=
              99
          }
          onClick={
            onIncrease
          }
          className="flex h-10 w-12 items-center justify-center rounded-[10px] bg-white/10 text-2xl font-black text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-25"
        >
          +
        </button>

        <div className="my-2 flex h-20 w-20 items-center justify-center rounded-[16px] bg-white text-4xl font-black tabular-nums text-[#06142E] shadow-[0_8px_20px_rgba(0,0,0,0.20)]">
          {score}
        </div>

        <button
          type="button"
          aria-label={`Diminuisci gol ${name}`}
          disabled={
            disabled ||
            score <=
              0
          }
          onClick={
            onDecrease
          }
          className="flex h-10 w-12 items-center justify-center rounded-[10px] bg-white/10 text-2xl font-black text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-25"
        >
          −
        </button>
      </div>
    </div>
  );
}

function formatItalianDate(
  value:
    string,
): string {
  const [
    year,
    month,
    day,
  ] =
    value.split(
      "-",
    );

  if (
    !year ||
    !month ||
    !day
  ) {
    return value;
  }

  return `${day}/${month}/${year}`;
}
