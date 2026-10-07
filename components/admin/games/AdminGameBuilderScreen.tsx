"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import dynamic from "next/dynamic";

import {
  Boxes,
  Braces,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  CircleGauge,
  Database,
  Gamepad2,
  ListChecks,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";

import AppShell from "@/components/ui/AppShell";


const AdminQuizBuilder =
  dynamic(
    () =>
      import(
        "@/components/admin/games/quiz/AdminQuizBuilder"
      ),
    {
      loading: () => (
        <BuilderLazyLoading
          label="Quiz"
        />
      ),
    },
  );

const AdminPredictionBuilder =
  dynamic(
    () =>
      import(
        "@/components/admin/games/prediction/AdminPredictionBuilder"
      ),
    {
      loading: () => (
        <BuilderLazyLoading
          label="Pronostici"
        />
      ),
    },
  );

const AdminSurvivorBuilder =
  dynamic(
    () =>
      import(
        "@/components/admin/games/survivor/AdminSurvivorBuilder"
      ),
    {
      loading: () => (
        <BuilderLazyLoading
          label="Survivor"
        />
      ),
    },
  );

import {
  FirebaseGamesGameRepository,
} from "@/src/services/games/FirebaseGamesGameRepository";

import type {
  GamesGame,
} from "@/src/types/GamesGame";
import { isSurvivorGame } from "@/src/types/GamesGame";

/*
 * ============================================================
 * GENERIC GAME BUILDER
 * ============================================================
 *
 * Primo contenitore comune per lo sviluppo materiale dei giochi.
 *
 * In questa fase NON inventiamo ancora uno schema universale per
 * quiz, pronostici, votazioni, ecc. La pagina definisce invece le
 * aree che ogni gioco potrà implementare progressivamente.
 *
 * Il Fantacalcio continua ad avere il proprio builder dedicato.
 * ============================================================
 */

export default function AdminGameBuilderScreen({
  gameId,
}: {
  gameId:
    string;
}) {
  const [
    games,
    setGames,
  ] =
    useState<
      GamesGame[]
    >([]);

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

  useEffect(
    () => {
      const unsubscribe =
        FirebaseGamesGameRepository.subscribeCatalog(
          (
            items,
          ) => {
            setGames(
              items,
            );

            setIsLoading(
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
              "Errore caricamento catalogo Games:",
              currentError,
            );

            setIsLoading(
              false,
            );

            setError(
              "Impossibile caricare il gioco.",
            );
          },
        );

      return () => {
        unsubscribe();
      };
    },
    [],
  );

  const game =
    useMemo(
      () =>
        games.find(
          (
            currentGame,
          ) =>
            currentGame.id ===
            gameId,
        ) ??
        null,
      [
        games,
        gameId,
      ],
    );

  if (
    isLoading
  ) {
    return (
      <AppShell>
        <BuilderShell>
          <MessageCard>
            Caricamento gioco...
          </MessageCard>
        </BuilderShell>
      </AppShell>
    );
  }

  if (
    error
  ) {
    return (
      <AppShell>
        <BuilderShell>
          <MessageCard
            error
          >
            {error}
          </MessageCard>
        </BuilderShell>
      </AppShell>
    );
  }

  if (
    !game
  ) {
    return (
      <AppShell>
        <BuilderShell>
          <MessageCard
            error
          >
            Il gioco richiesto non esiste nel catalogo Games.
          </MessageCard>

          <Link
            href="/admin/games"
            className="mt-4 flex min-h-12 w-full items-center justify-center rounded-[13px] bg-[#06142E] px-5 text-xs font-black uppercase text-white"
          >
            Torna ai Games
          </Link>
        </BuilderShell>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ====================================================
            HEADER
        ==================================================== */}

        <header>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
                Sviluppa gioco
              </p>

              <h1 className="mt-1 truncate text-3xl font-black uppercase text-[#06142E]">
                {game.name}
              </h1>

              <p className="mt-1 text-sm font-bold leading-6 text-[#06142E]/50">
                Ambiente di sviluppo e configurazione del gioco.
              </p>
            </div>

            <Link
              href="/admin/games"
              className="shrink-0 rounded-[12px] bg-[#06142E]/[0.06] px-4 py-3 text-[10px] font-black uppercase text-[#06142E]"
            >
              ← Games
            </Link>
          </div>
        </header>

        {/* ====================================================
            GAME SUMMARY
        ==================================================== */}

        <section className="overflow-hidden rounded-[24px] bg-[#06142E] p-5 text-white shadow-[0_16px_38px_rgba(6,20,46,0.16)]">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[17px] bg-white/10">
              <Gamepad2
                size={26}
                strokeWidth={2.3}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={
                    game.status
                  }
                />

                <span className="rounded-full bg-white/10 px-3 py-1 text-[8px] font-black uppercase text-white/65">
                  {game.priceCents ===
                  0
                    ? "Gratuito"
                    : formatEuro(
                        game.priceCents,
                      )}
                </span>
              </div>

              <p className="mt-3 truncate text-xl font-black uppercase">
                {game.name}
              </p>

              <p className="mt-1 break-all text-[10px] font-bold text-white/35">
                {game.slug}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <SummaryStat
              label="Accesso"
              value={
                game.priceCents ===
                0
                  ? "Free"
                  : "Premium"
              }
            />

            <SummaryStat
              label="Competizioni"
              value="3"
            />

            <SummaryStat
              label="Catalogo"
              value="Globale"
            />
          </div>
        </section>

        {/* ====================================================
            DEVELOPMENT STATUS
        ==================================================== */}

        <section className="rounded-[22px] border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-amber-100 text-amber-800">
              <CircleGauge
                size={21}
                strokeWidth={2.3}
              />
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-amber-800/55">
                Stato sviluppo
              </p>

              <h2 className="mt-1 text-lg font-black uppercase text-[#06142E]">
                Struttura iniziale
              </h2>

              <p className="mt-1 text-xs font-bold leading-5 text-[#06142E]/45">
                Il contenitore è pronto. Le funzioni specifiche del gioco verranno aggiunte nelle sezioni sottostanti senza modificare il catalogo generale.
              </p>
            </div>
          </div>
        </section>

        {game.gameType === "quiz" ? (
          <AdminQuizBuilder
            game={
              game
            }
          />
        ) : game.gameType === "votazioni" ? (
          <section className="rounded-[22px] border border-[#06142E]/10 bg-white p-5 shadow-[0_12px_30px_rgba(6,20,46,0.07)]">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
              Votazioni
            </p>
            <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
              Gestione separata
            </h2>
            <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/45">
              Ogni votazione ha sviluppo, demo, modifica, reset ed eliminazione indipendenti.
            </p>
            <Link
              href={`/admin/games/giochi/${encodeURIComponent(game.id)}/votazioni`}
              className="mt-4 flex min-h-12 w-full items-center justify-center rounded-[13px] bg-[#0B5FFF] px-5 text-xs font-black uppercase text-white"
            >
              Apri elenco votazioni
            </Link>
          </section>
        ) : isSurvivorGame(game) ? (
          <AdminSurvivorBuilder gameId={game.id} />
        ) : game.gameType === "pronostici" ? (
          <AdminPredictionBuilder gameId={game.id} />
        ) : (
          <>
        {/* ====================================================
            BUILDER MODULES
        ==================================================== */}

        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
            Builder
          </p>

          <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
            Struttura gioco
          </h2>

          <div className="mt-4 space-y-3">
            <BuilderModuleCard
              icon={
                Settings2
              }
              title="Configurazione"
              description="Regole operative e impostazioni specifiche del gioco."
              status="Da sviluppare"
            />

            <BuilderModuleCard
              icon={
                Boxes
              }
              title="Contenuti"
              description="Domande, pronostici, votazioni, round o altri contenuti del gioco."
              status="Da sviluppare"
            />

            <BuilderModuleCard
              icon={
                ListChecks
              }
              title="Regole e scoring"
              description="Punteggi, validazione delle risposte e criteri di ordinamento."
              status="Da sviluppare"
            />

            <BuilderModuleCard
              icon={
                Users
              }
              title="Partecipanti"
              description="Iscritti al gioco, stato della partecipazione e accessi."
              status="Da sviluppare"
            />

            <BuilderModuleCard
              icon={
                ChartNoAxesColumnIncreasing
              }
              title="Classifica"
              description="Risultati, ranking generale e andamento della Games Season."
              status="Da sviluppare"
            />

            <BuilderModuleCard
              icon={
                Database
              }
              title="Dati stagionali"
              description="Dati runtime separati dal catalogo permanente del gioco."
              status="Da sviluppare"
            />
          </div>
        </section>

        {/* ====================================================
            ARCHITECTURE
        ==================================================== */}

        <section className="rounded-[22px] bg-[#F5F5F2] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-white">
              <Braces
                size={20}
                strokeWidth={2.2}
                className="text-[#06142E]"
              />
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#06142E]/35">
                Architettura
              </p>

              <h2 className="mt-1 text-lg font-black uppercase text-[#06142E]">
                Catalogo + dati stagionali
              </h2>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <ArchitectureRow
              icon={
                Gamepad2
              }
              title="Game"
              text="Definizione permanente del gioco: nome, prezzo e stato."
            />

            <ArchitectureRow
              icon={
                Database
              }
              title="Game Season Data"
              text="Partecipanti, risultati e classifiche riferiti alla singola Games Season."
            />

            <ArchitectureRow
              icon={
                ShieldCheck
              }
              title="Accesso"
              text="Gioco gratuito, Games Pass oppure acquisto singolo quando il sistema pagamenti sarà attivato."
            />
          </div>
        </section>
          </>
        )}

      </div>
    </AppShell>
  );
}

/*
 * ============================================================
 * COMPONENTS
 * ============================================================
 */

function BuilderLazyLoading({
  label,
}: {
  label:
    string;
}) {
  return (
    <section className="rounded-[22px] border border-[#06142E]/10 bg-white p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
        {label}
      </p>

      <p className="mt-2 text-sm font-bold text-[#06142E]/50">
        Caricamento modulo...
      </p>
    </section>
  );
}

function BuilderShell({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
          Sviluppa gioco
        </p>

        <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
          Games
        </h1>
      </header>

      {children}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status:
    GamesGame["status"];
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[8px] font-black uppercase ${
        status ===
        "active"
          ? "bg-emerald-300 text-emerald-950"
          : status ===
              "waiting"
            ? "bg-amber-300 text-amber-950"
            : "bg-white/10 text-white/50"
      }`}
    >
      {status ===
      "active"
        ? "Attivo"
        : status ===
            "waiting"
          ? "Prossimamente"
          : "Non visibile"}
    </span>
  );
}

function SummaryStat({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div className="rounded-[14px] bg-white/[0.07] p-3">
      <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/30">
        {label}
      </p>

      <p className="mt-1 truncate text-xs font-black text-white">
        {value}
      </p>
    </div>
  );
}

function BuilderModuleCard({
  icon:
    Icon,
  title,
  description,
  status,
}: {
  icon:
    typeof Settings2;

  title:
    string;

  description:
    string;

  status:
    string;
}) {
  return (
    <article className="rounded-[20px] bg-[#F5F5F2] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-white">
          <Icon
            size={20}
            strokeWidth={2.2}
            className="text-[#06142E]"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="font-black uppercase text-[#06142E]">
              {title}
            </p>

            <ChevronRight
              size={18}
              className="shrink-0 text-[#06142E]/25"
            />
          </div>

          <p className="mt-1 text-xs font-bold leading-5 text-[#06142E]/40">
            {description}
          </p>

          <span className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[8px] font-black uppercase text-[#06142E]/35">
            {status}
          </span>
        </div>
      </div>
    </article>
  );
}

function ArchitectureRow({
  icon:
    Icon,
  title,
  text,
}: {
  icon:
    typeof Gamepad2;

  title:
    string;

  text:
    string;
}) {
  return (
    <div className="flex gap-3 rounded-[16px] bg-white p-4">
      <Icon
        size={18}
        strokeWidth={2.2}
        className="mt-0.5 shrink-0 text-[#06142E]/55"
      />

      <div>
        <p className="text-xs font-black uppercase text-[#06142E]">
          {title}
        </p>

        <p className="mt-1 text-xs font-bold leading-5 text-[#06142E]/40">
          {text}
        </p>
      </div>
    </div>
  );
}

function MessageCard({
  children,
  error = false,
}: {
  children:
    React.ReactNode;

  error?:
    boolean;
}) {
  return (
    <div
      className={`rounded-[20px] p-5 text-center ${
        error
          ? "bg-red-50 text-red-700"
          : "bg-[#F5F5F2] text-[#06142E]/45"
      }`}
    >
      <p className="text-sm font-bold">
        {children}
      </p>
    </div>
  );
}

function formatEuro(
  priceCents:
    number,
): string {
  return new Intl.NumberFormat(
    "it-IT",
    {
      style:
        "currency",

      currency:
        "EUR",
    },
  ).format(
    priceCents /
      100,
  );
}
