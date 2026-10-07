"use client";

import dynamic from "next/dynamic";
import DeferredSection from "@/components/ui/DeferredSection";
import SectionSkeleton from "@/components/ui/SectionSkeleton";

import Link from "next/link";

import AppShell from "@/components/ui/AppShell";

const AdminFantasyPlayerPoolSection = dynamic(() => import("./AdminFantasyPlayerPoolSection"), {
  loading: () => <SectionSkeleton label="Caricamento Listone Fantacalcio" rows={3} />,
});
const AdminFantasySeasonCreationSection = dynamic(() => import("./AdminFantasySeasonCreationSection"), {
  loading: () => <SectionSkeleton label="Caricamento creazione stagione" rows={3} />,
});

import {
  MiniStat,
  StatCard,
  getFantasySeasonStatusLabel,
} from "./AdminFantasyUi";

import {
  ChangeEvent,
  useRef,
  useMemo,
  useState,
} from "react";

import {
  FantasyPlayerPoolTemplateService,
} from "@/src/services/fantasy/FantasyPlayerPoolTemplateService";

import {
  FantasyPlayerPoolImportService,
  type FantasyPlayerPoolImportError,
  type FantasyPlayerPoolImportRow,
} from "@/src/services/fantasy/FantasyPlayerPoolImportService";

import {
  useSeasons,
} from "@/src/hooks/useSeasons";

import {
  useAdminFantasySeason,
} from "@/src/hooks/useAdminFantasySeason";

import {
  useAdminFantasyPlayerPool,
} from "@/src/hooks/useAdminFantasyPlayerPool";

import {
  useFantasyPlayerPoolSource,
} from "@/src/hooks/useFantasyPlayerPoolSource";

import type {
  CreateFantasyPlayerInput,
} from "@/src/types/FantasyPlayer";

/*
 * ============================================================
 * PROPS
 * ============================================================
 */

type Props = {
  gameId:
    string;

  gamesSeasonId:
    string;
};

/*
 * ============================================================
 * SCREEN
 * ============================================================
 */

export default function AdminFantasyScreen({
  gameId,
  gamesSeasonId,
}: Props) {
  /*
   * ==========================================================
   * STAGIONE SPORTIVA
   * ==========================================================
   */

  const {
    currentSeason,
    isLoading:
      seasonsLoading,
    error:
      seasonsError,
  } =
    useSeasons();

  /*
   * ==========================================================
   * STAGIONE FANTACALCIO
   * ==========================================================
   */

  const {
    fantasySeason,
    isLoading:
      fantasySeasonLoading,
    isSaving:
      fantasySeasonSaving,
    error:
      fantasySeasonError,
    createFantasySeason,
  } =
    useAdminFantasySeason(
      gameId,
    );

  /*
   * ==========================================================
   * PLAYER POOL
   * ==========================================================
   */

  const {
    pool,
    players,
    isLoading:
      poolLoading,
    isSaving:
      poolSaving,
    error:
      poolError,
    isPublished:
      isPoolPublished,
    replaceDraftPool,
    publishPool,
    deleteDraftPool,
    updateAvailability,
  } =
    useAdminFantasyPlayerPool(
      fantasySeason?.id,
    );

  /*
   * ==========================================================
   * SORGENTE PREMIER LEAGUE
   * ==========================================================
   */

  const {
    source,
    isLoading:
      sourceLoading,
    error:
      sourceError,
  } =
    useFantasyPlayerPoolSource(
      fantasySeason?.sportSeasonId,
    );

  /*
   * ==========================================================
   * IMPORT EXCEL LISTONE
   * ==========================================================
   */

  const fileInputRef =
    useRef<HTMLInputElement>(
      null,
    );

  const [
    importPreview,
    setImportPreview,
  ] =
    useState<{
      fileName:
        string;

      rows:
        FantasyPlayerPoolImportRow[];

      errors:
        FantasyPlayerPoolImportError[];
    } | null>(
      null,
    );

  const [
    importError,
    setImportError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    importSuccess,
    setImportSuccess,
  ] =
    useState<string | null>(
      null,
    );

  const [
    publishError,
    setPublishError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    publishSuccess,
    setPublishSuccess,
  ] =
    useState<string | null>(
      null,
    );

  const [
    deletePoolError,
    setDeletePoolError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    deletePoolSuccess,
    setDeletePoolSuccess,
  ] =
    useState<string | null>(
      null,
    );

  const [
    updatingAvailabilityPlayerId,
    setUpdatingAvailabilityPlayerId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    availabilityError,
    setAvailabilityError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    playerSearch,
    setPlayerSearch,
  ] =
    useState(
      "",
    );

  const [
    roleFilter,
    setRoleFilter,
  ] =
    useState<
      "all" |
      "goalkeeper" |
      "defender" |
      "forward"
    >(
      "all",
    );

  const [
    availabilityFilter,
    setAvailabilityFilter,
  ] =
    useState<
      "all" |
      "eligible" |
      "left_tournament" |
      "team_withdrawn"
    >(
      "all",
    );

  /*
   * ==========================================================
   * LOADING
   * ==========================================================
   */

  const isLoading =
    seasonsLoading ||
    fantasySeasonLoading ||
    poolLoading ||
    sourceLoading;

  const isSaving =
    fantasySeasonSaving ||
    poolSaving;

  /*
   * ==========================================================
   * ERROR
   * ==========================================================
   */

  const error =
    seasonsError ||
    fantasySeasonError ||
    poolError ||
    sourceError;

  /*
   * ==========================================================
   * CONTEGGIO GIOCATORI LISTONE
   * ==========================================================
   */

  const playerCounts =
    useMemo(
      () => {
        const goalkeepers =
          players.filter(
            (player) =>
              player.role ===
              "goalkeeper",
          ).length;

        const defenders =
          players.filter(
            (player) =>
              player.role ===
              "defender",
          ).length;

        const forwards =
          players.filter(
            (player) =>
              player.role ===
              "forward",
          ).length;

        return {
          total:
            players.length,

          goalkeepers,

          defenders,

          forwards,
        };
      },
      [
        players,
      ],
    );

  /*
   * ==========================================================
   * FILTRI GIOCATORI LISTONE
   * ==========================================================
   */

  const filteredPlayers =
    useMemo(
      () => {
        const normalizedSearch =
          playerSearch
            .trim()
            .toLocaleLowerCase(
              "it",
            );

        return [
          ...players,
        ]
          .filter(
            (
              player,
            ) => {
              if (
                roleFilter !==
                  "all" &&
                player.role !==
                  roleFilter
              ) {
                return false;
              }

              if (
                availabilityFilter !==
                  "all" &&
                player.availabilityStatus !==
                  availabilityFilter
              ) {
                return false;
              }

              if (
                !normalizedSearch
              ) {
                return true;
              }

              const searchableText =
                [
                  player.firstName,
                  player.lastName,
                  player.displayName,
                  player.playerSeasonCode,
                  player.teamCode,
                ]
                  .join(
                    " ",
                  )
                  .toLocaleLowerCase(
                    "it",
                  );

              return searchableText.includes(
                normalizedSearch,
              );
            },
          )
          .sort(
            (
              first,
              second,
            ) => {
              const roleOrder = {
                goalkeeper:
                  0,
                defender:
                  1,
                forward:
                  2,
              } as const;

              const firstRole =
                roleOrder[
                  first.role
                ] ??
                99;

              const secondRole =
                roleOrder[
                  second.role
                ] ??
                99;

              if (
                firstRole !==
                secondRole
              ) {
                return firstRole -
                  secondRole;
              }

              const lastNameComparison =
                first.lastName.localeCompare(
                  second.lastName,
                  "it",
                );

              if (
                lastNameComparison !==
                0
              ) {
                return lastNameComparison;
              }

              return first.firstName.localeCompare(
                second.firstName,
                "it",
              );
            },
          );
      },
      [
        players,
        playerSearch,
        roleFilter,
        availabilityFilter,
      ],
    );

  /*
   * ==========================================================
   * COMANDI IMPORT EXCEL LISTONE
   * ==========================================================
   */

  async function handleDownloadTemplate() {
    setImportError(
      null,
    );

    setImportSuccess(
      null,
    );

    try {
      await FantasyPlayerPoolTemplateService.download();
    } catch (
      currentError
    ) {
      console.error(
        "Errore download template Listone:",
        currentError,
      );

      setImportError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile scaricare il template del Listone.",
      );
    }
  }

  function handleSelectExcel() {
    setImportError(
      null,
    );

    setImportSuccess(
      null,
    );

    if (
      isPoolPublished
    ) {
      setImportError(
        "Il Listone è già pubblicato e non può essere sostituito.",
      );

      return;
    }

    fileInputRef.current?.click();
  }

  function handleResetImportPreview() {
    setImportPreview(
      null,
    );

    setImportError(
      null,
    );

    setImportSuccess(
      null,
    );

    if (
      fileInputRef.current
    ) {
      fileInputRef.current.value =
        "";
    }
  }

  async function handleExcelChange(
    event:
      ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (
      !file
    ) {
      return;
    }

    setImportError(
      null,
    );

    setImportSuccess(
      null,
    );

    setImportPreview(
      null,
    );

    try {
      const result =
        await FantasyPlayerPoolImportService.parseFile(
          file,
        );

      setImportPreview({
        fileName:
          file.name,

        rows:
          result.rows,

        errors:
          result.errors,
      });
    } catch (
      currentError
    ) {
      console.error(
        "Errore durante la lettura del Listone:",
        currentError,
      );

      setImportError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile leggere il file Excel del Listone.",
      );
    } finally {
      event.target.value =
        "";
    }
  }

  async function handleConfirmImport() {
    if (
      isPoolPublished
    ) {
      setImportError(
        "Il Listone è già pubblicato e non può essere sostituito.",
      );

      return;
    }

    if (
      !fantasySeason?.id
    ) {
      setImportError(
        "Nessuna stagione Fantacalcio disponibile.",
      );

      return;
    }

    if (
      !importPreview
    ) {
      setImportError(
        "Carica prima un file Excel da controllare.",
      );

      return;
    }

    if (
      importPreview.errors.length >
      0
    ) {
      setImportError(
        "Il file contiene errori. Correggili prima di confermare l'import.",
      );

      return;
    }

    if (
      importPreview.rows.length ===
      0
    ) {
      setImportError(
        "Il file non contiene giocatori validi da importare.",
      );

      return;
    }

    const nextPlayers:
      CreateFantasyPlayerInput[] =
      importPreview.rows.map(
        (
          row,
        ) => ({
          fantasySeasonId:
            fantasySeason.id,

          playerSeasonCode:
            row.playerSeasonCode,

          teamCode:
            row.teamCode,

          firstName:
            row.nome,

          lastName:
            row.cognome,

          role:
            mapImportedFantasyRole(
              row.ruolo,
            ),

          cost:
            row.costo,
        }),
      );

    const confirmed =
      window.confirm(
        pool
          ? `Il Listone attuale verrà sostituito con ${nextPlayers.length} giocatori. Confermare?`
          : `Importare ${nextPlayers.length} giocatori nel Listone?`,
      );

    if (
      !confirmed
    ) {
      return;
    }

    setImportError(
      null,
    );

    setImportSuccess(
      null,
    );

    setPublishError(
      null,
    );

    setPublishSuccess(
      null,
    );

    setDeletePoolError(
      null,
    );

    setDeletePoolSuccess(
      null,
    );

    try {
      await replaceDraftPool(
        nextPlayers,
      );

      setImportSuccess(
        `Listone importato correttamente: ${nextPlayers.length} giocatori salvati in bozza.`,
      );

      setImportPreview(
        null,
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore conferma import Listone:",
        currentError,
      );

      setImportError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile salvare il Listone.",
      );
    }
  }

  /*
   * ==========================================================
   * PUBBLICAZIONE LISTONE
   * ==========================================================
   */

  async function handlePublishPool() {
    setPublishError(
      null,
    );

    setPublishSuccess(
      null,
    );

    if (
      !pool
    ) {
      setPublishError(
        "Nessun Listone disponibile da pubblicare.",
      );

      return;
    }

    if (
      isPoolPublished
    ) {
      setPublishError(
        "Il Listone è già stato pubblicato.",
      );

      return;
    }

    if (
      players.length ===
      0
    ) {
      setPublishError(
        "Non puoi pubblicare un Listone vuoto.",
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Pubblicare definitivamente il Listone con ${players.length} giocatori? Dopo la pubblicazione non potrà essere sostituito dalla schermata di import.`,
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      await publishPool();

      setPublishSuccess(
        `Listone pubblicato correttamente con ${players.length} giocatori.`,
      );

      setImportError(
        null,
      );

      setImportSuccess(
        null,
      );

      setImportPreview(
        null,
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore pubblicazione Listone:",
        currentError,
      );

      setPublishError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile pubblicare il Listone.",
      );
    }
  }

  /*
   * ==========================================================
   * STATO DISPONIBILITÀ GIOCATORE
   * ==========================================================
   */

  async function handleAvailabilityChange(
    fantasyPlayerId:
      string,

    availabilityStatus:
      "eligible" |
      "left_tournament" |
      "team_withdrawn",
  ) {
    setAvailabilityError(
      null,
    );

    setUpdatingAvailabilityPlayerId(
      fantasyPlayerId,
    );

    try {
      await updateAvailability(
        fantasyPlayerId,
        availabilityStatus,
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore aggiornamento disponibilità giocatore:",
        currentError,
      );

      setAvailabilityError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile aggiornare lo stato del giocatore.",
      );
    } finally {
      setUpdatingAvailabilityPlayerId(
        null,
      );
    }
  }

  /*
   * ==========================================================
   * ELIMINAZIONE BOZZA LISTONE
   * ==========================================================
   */

  async function handleDeleteDraftPool() {
    setDeletePoolError(
      null,
    );

    setDeletePoolSuccess(
      null,
    );

    if (
      !pool
    ) {
      setDeletePoolError(
        "Nessuna bozza del Listone disponibile.",
      );

      return;
    }

    if (
      isPoolPublished
    ) {
      setDeletePoolError(
        "Un Listone pubblicato non può essere eliminato.",
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Eliminare la bozza del Listone con ${players.length} giocatori? Questa operazione rimuoverà il Listone attuale e potrai caricare un nuovo file Excel.`,
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      await deleteDraftPool();

      setDeletePoolSuccess(
        "Bozza del Listone eliminata correttamente.",
      );

      setImportPreview(
        null,
      );

      setImportError(
        null,
      );

      setImportSuccess(
        null,
      );

      setPublishError(
        null,
      );

      setPublishSuccess(
        null,
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore eliminazione bozza Listone:",
        currentError,
      );

      setDeletePoolError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile eliminare la bozza del Listone.",
      );
    }
  }

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6">
        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#06142E]/35">
              Games · Admin
            </p>

            <h1 className="mt-1 text-3xl font-black uppercase tracking-tight text-[#06142E]">
              Fantacalcio
            </h1>

            <p className="mt-2 text-sm font-bold text-[#06142E]/45">
              Configurazione e gestione della stagione Fantasy.
            </p>
          </div>

          <Link
            href="/admin/games"
            className="rounded-[12px] bg-[#06142E]/[0.06] px-4 py-3 text-[10px] font-black uppercase text-[#06142E]"
          >
            ← Games
          </Link>
        </div>

        {/* ====================================================
            ERRORI GENERALI
        ==================================================== */}

        {error && (
          <div className="mt-6 rounded-[16px] bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {/* ====================================================
            LOADING
        ==================================================== */}

        {isLoading ? (
          <div className="mt-8 rounded-[22px] bg-white p-6 shadow-sm">
            <p className="text-sm font-bold text-[#06142E]/45">
              Caricamento Fantacalcio...
            </p>
          </div>
        ) : !fantasySeason ? (
          <AdminFantasySeasonCreationSection
            gameId={gameId}
            gamesSeasonId={gamesSeasonId}
            currentSeason={currentSeason}
            fantasySeasonSaving={fantasySeasonSaving}
            createFantasySeason={createFantasySeason}
          />
        ) : (
          <>
            {/* ==================================================
                OVERVIEW
            ================================================== */}

            <section className="mt-8">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
                Panoramica
              </p>

              <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
                {fantasySeason.name}
              </h2>

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard
                  label="Stato"
                  value={
                    getFantasySeasonStatusLabel(
                      fantasySeason.status,
                    )
                  }
                />

                <StatCard
                  label="Listone"
                  value={
                    isPoolPublished
                      ? "Pubblicato"
                      : pool
                        ? "Bozza"
                        : "Assente"
                  }
                />

                <StatCard
                  label="Giocatori"
                  value={
                    String(
                      playerCounts.total,
                    )
                  }
                />

                <StatCard
                  label="Prima MW"
                  value={
                    `MW${fantasySeason.firstScoringMatchweek}`
                  }
                />
              </div>
            </section>

            {/* ==================================================
                CONFIGURAZIONE
            ================================================== */}

            <section className="mt-7 rounded-[22px] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
                    Configurazione
                  </p>

                  <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">
                    Regole stagione
                  </h2>
                </div>

                <span className="rounded-full bg-[#06142E]/[0.06] px-3 py-2 text-[9px] font-black uppercase text-[#06142E]/60">
                  {fantasySeason.competitionId}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <MiniStat
                  label="Budget"
                  value={
                    `${fantasySeason.rosterRules.initialBudget} cr`
                  }
                />

                <MiniStat
                  label="Rosa"
                  value={
                    String(
                      fantasySeason.rosterRules.rosterSize,
                    )
                  }
                />

                <MiniStat
                  label="Modulo"
                  value={
                    fantasySeason.lineupRules.formationCode
                  }
                />

                <MiniStat
                  label="Max per club"
                  value={
                    String(
                      fantasySeason.rosterRules
                        .maxPlayersPerRealTeam,
                    )
                  }
                />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <MiniStat
                  label="Portieri"
                  value={
                    String(
                      fantasySeason.rosterRules
                        .goalkeeperCount,
                    )
                  }
                />

                <MiniStat
                  label="Difensori"
                  value={
                    String(
                      fantasySeason.rosterRules
                        .defenderCount,
                    )
                  }
                />

                <MiniStat
                  label="Attaccanti"
                  value={
                    String(
                      fantasySeason.rosterRules
                        .forwardCount,
                    )
                  }
                />
              </div>
            </section>

            <DeferredSection label="Listone Fantacalcio">
              <AdminFantasyPlayerPoolSection
              playerCounts={
                playerCounts
              }
              isPoolPublished={
                isPoolPublished
              }
              pool={
                pool
              }
              source={
                source
              }
              players={
                players
              }
              filteredPlayers={
                filteredPlayers
              }
              poolSaving={
                poolSaving
              }
              fileInputRef={
                fileInputRef
              }
              importPreview={
                importPreview
              }
              importError={
                importError
              }
              importSuccess={
                importSuccess
              }
              publishError={
                publishError
              }
              publishSuccess={
                publishSuccess
              }
              deletePoolError={
                deletePoolError
              }
              deletePoolSuccess={
                deletePoolSuccess
              }
              availabilityError={
                availabilityError
              }
              playerSearch={
                playerSearch
              }
              roleFilter={
                roleFilter
              }
              availabilityFilter={
                availabilityFilter
              }
              updatingAvailabilityPlayerId={
                updatingAvailabilityPlayerId
              }
              onDownloadTemplate={
                handleDownloadTemplate
              }
              onSelectExcel={
                handleSelectExcel
              }
              onExcelChange={
                handleExcelChange
              }
              onResetImportPreview={
                handleResetImportPreview
              }
              onConfirmImport={
                handleConfirmImport
              }
              onPublishPool={
                handlePublishPool
              }
              onDeleteDraftPool={
                handleDeleteDraftPool
              }
              onPlayerSearchChange={
                setPlayerSearch
              }
              onRoleFilterChange={
                setRoleFilter
              }
              onAvailabilityFilterChange={
                setAvailabilityFilter
              }
              onAvailabilityChange={
                handleAvailabilityChange
              }
            />
            </DeferredSection>

            {/* ==================================================
                MATCHWEEK
            ================================================== */}

            <section className="mt-7 rounded-[22px] bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
                Gestione campionato
              </p>

              <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">
                Matchweek Fantasy
              </h2>

              <p className="mt-3 text-sm font-bold leading-6 text-[#06142E]/45">
                Dopo il completamento di configurazione e listone,
                questa sezione conterrà formazioni, bonus/malus,
                calcolo, revisione e pubblicazione dei risultati.
              </p>
            </section>

            {/* SALVATAGGIO */}

            {isSaving && (
              <p className="mt-5 text-center text-xs font-black uppercase text-[#06142E]/40">
                Salvataggio in corso...
              </p>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}

/*
 * ============================================================
 * MAPPA RUOLO IMPORT LISTONE
 * ============================================================
 */

function mapImportedFantasyRole(
  role:
    string,
): CreateFantasyPlayerInput["role"] {
  switch (
    role
      .trim()
      .toLocaleLowerCase(
        "it",
      )
  ) {
    case "portiere":
    case "p":
    case "por":
      return "goalkeeper";

    case "difensore":
    case "d":
    case "dif":
      return "defender";

    case "attaccante":
    case "a":
    case "att":
      return "forward";

    default:
      throw new Error(
        `Ruolo Fantasy non valido: ${role}`,
      );
  }
}
