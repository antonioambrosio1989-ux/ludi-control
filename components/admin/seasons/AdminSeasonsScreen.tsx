"use client";

import {
  useRef,
  useState,
} from "react";

import AppShell from "@/components/ui/AppShell";

import { useSeasons } from "@/src/hooks/useSeasons";

import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

import { FirebaseSeasonRepository } from "@/src/services/season/FirebaseSeasonRepository";



import { HistoricalSeasonArchiveImportService } from "@/src/services/season/HistoricalSeasonArchiveImportService";

import { HistoricalSeasonArchiveResetService } from "@/src/services/season/HistoricalSeasonArchiveResetService";

import HistoricalSeasonArchiveImporter from "./HistoricalSeasonArchiveImporter";

type EditableSeason = {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
};

export default function AdminSeasonsScreen() {
  /*
   * ==========================================================
   * COMPETIZIONE
   * ==========================================================
   */

  const {
    selectedCompetition,
    selectedCompetitionId,
    currentSeason,

    isLoading:
      competitionLoading,

    error:
      competitionError,
  } =
    useCompetition();

  /*
   * ==========================================================
   * STAGIONI
   * ==========================================================
   */

  const {
    filteredSeasons:
      seasons,

    isLoading:
      seasonsLoading,

    error:
      seasonsError,
  } =
    useSeasons(
      selectedCompetitionId,
    );

  const isLoading =
    competitionLoading ||
    seasonsLoading;

  const error =
    competitionError ||
    seasonsError;

  /*
   * ==========================================================
   * INPUT STAGIONE PASSATA
   * ==========================================================
   */

  const pastSeasonInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [
    isPastSeasonImporting,
    setIsPastSeasonImporting,
  ] =
    useState(false);

  const [
    pastSeasonError,
    setPastSeasonError,
  ] =
    useState<string | null>(
      null,
    );

  /*
   * ==========================================================
   * REIMPORT ARCHIVIO
   * ==========================================================
   */

  const [
    archiveImportSeasonId,
    setArchiveImportSeasonId,
  ] = useState<string | null>(
    null,
  );

  /*
   * ==========================================================
   * NUOVA STAGIONE
   * ==========================================================
   */

  const [
    showForm,
    setShowForm,
  ] =
    useState(false);

  const [
    name,
    setName,
  ] =
    useState("");

  const [
    startYear,
    setStartYear,
  ] =
    useState(2025);

  const [
    endYear,
    setEndYear,
  ] =
    useState(2026);

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(false);

  const [
    formError,
    setFormError,
  ] =
    useState<string | null>(
      null,
    );

  /*
   * ==========================================================
   * MODIFICA STAGIONE
   * ==========================================================
   */

  const [
    editingSeasonId,
    setEditingSeasonId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    editName,
    setEditName,
  ] =
    useState("");

  const [
    editStartYear,
    setEditStartYear,
  ] =
    useState(2025);

  const [
    editEndYear,
    setEditEndYear,
  ] =
    useState(2026);

  const [
    editError,
    setEditError,
  ] =
    useState<string | null>(
      null,
    );

  /*
   * ==========================================================
   * OPERAZIONI STAGIONE
   * ==========================================================
   */

  const [
    processingSeasonId,
    setProcessingSeasonId,
  ] =
    useState<string | null>(
      null,
    );

  /*
   * ==========================================================
   * CREA STAGIONE NORMALE
   * ==========================================================
   */

  async function handleCreate(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    setIsSaving(
      true,
    );

    setFormError(
      null,
    );

    try {
      if (
        !selectedCompetitionId
      ) {
        throw new Error(
          "Seleziona una competizione prima di creare la stagione.",
        );
      }

      await FirebaseSeasonRepository.create({
        competitionId:
          selectedCompetitionId,

        name:
          name.trim() ||
          `${startYear}/${String(
            endYear,
          ).slice(-2)}`,

        startYear,
        endYear,
      });

      setName("");

      setShowForm(
        false,
      );
    } catch (
      currentError
    ) {
      setFormError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile creare la stagione.",
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  /*
   * ==========================================================
   * CARICA STAGIONE PASSATA DA EXCEL
   * ==========================================================
   *
   * Il parser storico esistente legge il foglio "Stagione" e
   * restituisce i valori presenti nella riga dati del template:
   * - nome stagione  -> B5
   * - anno iniziale  -> D5
   * - anno finale    -> E5
   *
   * La stagione viene creata direttamente come CONCLUSA e lo
   * stesso file viene poi importato come archivio storico.
   * ==========================================================
   */

  async function handlePastSeasonFile(
    file: File,
  ) {
    if (
      isPastSeasonImporting
    ) {
      return;
    }

    setPastSeasonError(
      null,
    );

    if (
      !selectedCompetitionId
    ) {
      setPastSeasonError(
        "Seleziona una competizione prima di caricare una stagione passata.",
      );

      return;
    }

    setIsPastSeasonImporting(
      true,
    );

    let createdSeasonId:
      string | null =
      null;

    try {
      const { parseHistoricalSeasonArchiveExcel } = await import("@/src/services/season/HistoricalSeasonArchiveExcelParser");
      const archive =
        await parseHistoricalSeasonArchiveExcel(
          file,
        );

      const seasonName =
        archive.season.seasonName.trim();

      const historicalStartYear =
        archive.season.startYear;

      const historicalEndYear =
        archive.season.endYear;

      /*
 * ==========================================================
 * CONTROLLO STAGIONE GIÀ ESISTENTE
 * ==========================================================
 */

const existingSeason =
  seasons.find(
    (season) =>
      season.startYear ===
        historicalStartYear &&
      season.endYear ===
        historicalEndYear,
  );

if (
  existingSeason
) {
  throw new Error(
    [
      `La stagione ${existingSeason.name} è già presente.`,
      "",
      "Non caricarla nuovamente come nuova stagione.",
      'Usa il pulsante "Reimporta archivio" nella stagione esistente.',
    ].join(
      "\n",
    ),
  );
}

      if (!seasonName) {
        throw new Error(
          'Nel foglio "Stagione" la cella B5 non contiene il nome della stagione.',
        );
      }

      if (
        !Number.isInteger(
          historicalStartYear,
        )
      ) {
        throw new Error(
          'Nel foglio "Stagione" la cella D5 non contiene un anno iniziale valido.',
        );
      }

      if (
        !Number.isInteger(
          historicalEndYear,
        )
      ) {
        throw new Error(
          'Nel foglio "Stagione" la cella E5 non contiene un anno finale valido.',
        );
      }

      const confirmed =
        window.confirm(
          [
            "Caricare questa stagione passata?",
            "",
            `Nome: ${seasonName}`,
            `Anni: ${historicalStartYear} — ${historicalEndYear}`,
            `File: ${file.name}`,
            "",
            "La stagione verrà creata direttamente come CONCLUSA e il file verrà importato come archivio storico.",
          ].join(
            "\n",
          ),
        );

      if (!confirmed) {
        return;
      }

      const createdSeason =
        await FirebaseSeasonRepository.createCompleted({
          competitionId:
            selectedCompetitionId,

          name:
            seasonName,

          startYear:
            historicalStartYear,

          endYear:
            historicalEndYear,
        });

      createdSeasonId =
        createdSeason.id;

      try {
        const result =
          await HistoricalSeasonArchiveImportService.importArchive({
            seasonId:
              createdSeason.id,

            seasonName:
              createdSeason.name,

            fileName:
              file.name,

            archive,
          });

        window.alert(
          [
            "Stagione passata caricata correttamente.",
            "",
            `Stagione: ${createdSeason.name}`,
            `Squadre: ${archive.teams.length}`,
            `Righe rose/statistiche: ${archive.regularSeasonPlayers.length}`,
            `Premiazioni: ${archive.awards.length}`,
            ...(result.warnings.length >
            0
              ? [
                  "",
                  "Avvisi:",
                  ...result.warnings,
                ]
              : []),
          ].join(
            "\n",
          ),
        );
      } catch (
        importError
      ) {
        /*
         * La creazione della stagione e l'import devono apparire
         * all'admin come un'unica operazione: in caso di errore
         * cancelliamo eventuali dati parziali e la stagione appena
         * creata.
         */
        await HistoricalSeasonArchiveResetService.clear(
          createdSeason.id,
        );

        await FirebaseSeasonRepository.removeCompleted(
          createdSeason.id,
        );

        createdSeasonId =
          null;

        throw importError;
      }
    } catch (
      currentError
    ) {
      console.error(
        "Errore caricamento stagione passata:",
        currentError,
      );

      if (
        createdSeasonId
      ) {
        try {
          await HistoricalSeasonArchiveResetService.clear(
            createdSeasonId,
          );

          await FirebaseSeasonRepository.removeCompleted(
            createdSeasonId,
          );
        } catch (
          rollbackError
        ) {
          console.error(
            "Errore rollback stagione passata:",
            rollbackError,
          );
        }
      }

      setPastSeasonError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile caricare la stagione passata.",
      );
    } finally {
      setIsPastSeasonImporting(
        false,
      );
    }
  }

  /*
   * ==========================================================
   * ATTIVA BOZZA
   * ==========================================================
   */

  async function handleSetCurrent(
    seasonId: string,
  ) {
    if (
      !selectedCompetitionId
    ) {
      window.alert(
        "Seleziona una competizione prima di attivare la stagione.",
      );

      return;
    }

    try {
      await FirebaseSeasonRepository
        .setCurrentForCompetition(
          selectedCompetitionId,
          seasonId,
        );
    } catch (
      currentError
    ) {
      console.error(
        "Errore cambio stagione:",
        currentError,
      );

      window.alert(
        currentError instanceof
          Error
          ? currentError.message
          : "Non è stato possibile attivare la stagione.",
      );
    }
  }

  /*
   * ==========================================================
   * CONCLUDI STAGIONE ATTIVA
   * ==========================================================
   */

  async function handleCompleteSeason(
    seasonId: string,
    seasonName: string,
  ) {
    if (
      processingSeasonId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        [
          `Concludere la stagione ${seasonName}?`,
          "",
          "La stagione verrà archiviata e non sarà più la stagione corrente.",
        ].join(
          "\n",
        ),
      );

    if (!confirmed) {
      return;
    }

    setProcessingSeasonId(
      seasonId,
    );

    try {
      await FirebaseSeasonRepository.completeSeason(
        seasonId,
      );

      setArchiveImportSeasonId(
        null,
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore chiusura stagione:",
        currentError,
      );

      window.alert(
        currentError instanceof
          Error
          ? currentError.message
          : "Non è stato possibile concludere la stagione.",
      );
    } finally {
      setProcessingSeasonId(
        null,
      );
    }
  }

  /*
   * ==========================================================
   * MODIFICA STAGIONE
   * ==========================================================
   */

  function openEditSeason(
    season:
      EditableSeason,
  ) {
    setArchiveImportSeasonId(
      null,
    );

    setEditingSeasonId(
      season.id,
    );

    setEditName(
      season.name,
    );

    setEditStartYear(
      season.startYear,
    );

    setEditEndYear(
      season.endYear,
    );

    setEditError(
      null,
    );
  }

  function closeEditSeason() {
    setEditingSeasonId(
      null,
    );

    setEditError(
      null,
    );
  }

  async function handleSaveSeasonEdit(
    season:
      EditableSeason,
  ) {
    if (
      processingSeasonId
    ) {
      return;
    }

    const normalizedName =
      editName.trim();

    if (!normalizedName) {
      setEditError(
        "Inserisci il nome della stagione.",
      );

      return;
    }

    setEditError(
      null,
    );

    setProcessingSeasonId(
      season.id,
    );

    try {
      await FirebaseSeasonRepository.updateMetadata({
        seasonId:
          season.id,

        name:
          normalizedName,

        startYear:
          editStartYear,

        endYear:
          editEndYear,
      });

      try {
        await HistoricalSeasonArchiveResetService.updateSeasonNameReferences({
          seasonId:
            season.id,

          seasonName:
            normalizedName,
        });
      } catch (
        propagationError
      ) {
        /*
         * Se l'aggiornamento dei riferimenti storici fallisce,
         * ripristiniamo anche il documento stagione per evitare
         * nomi incoerenti tra schermata stagioni e archivio.
         */
        await FirebaseSeasonRepository.updateMetadata({
          seasonId:
            season.id,

          name:
            season.name,

          startYear:
            season.startYear,

          endYear:
            season.endYear,
        });

        try {
          await HistoricalSeasonArchiveResetService.updateSeasonNameReferences({
            seasonId:
              season.id,

            seasonName:
              season.name,
          });
        } catch (
          rollbackError
        ) {
          console.error(
            "Errore rollback nome stagione:",
            rollbackError,
          );
        }

        throw propagationError;
      }

      closeEditSeason();
    } catch (
      currentError
    ) {
      console.error(
        "Errore modifica stagione:",
        currentError,
      );

      setEditError(
        currentError instanceof
          Error
          ? currentError.message
          : "Non è stato possibile modificare la stagione.",
      );
    } finally {
      setProcessingSeasonId(
        null,
      );
    }
  }

  /*
   * ==========================================================
   * ELIMINA STAGIONE CONCLUSA
   * ==========================================================
   */

  async function handleDeleteSeason(
    seasonId: string,
    seasonName: string,
  ) {
    if (
      processingSeasonId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        [
          `Eliminare definitivamente la stagione ${seasonName}?`,
          "",
          "Verranno eliminati anche tutti i dati storici collegati a questa stagione:",
          "• statistiche storiche",
          "• palmarès dei giocatori",
          "• Hall of Fame",
          "• Albo d'Oro / Champions",
          "",
          "I profili globali dei giocatori NON verranno eliminati.",
          "",
          "Questa operazione non può essere annullata.",
        ].join(
          "\n",
        ),
      );

    if (!confirmed) {
      return;
    }

    setProcessingSeasonId(
      seasonId,
    );

    let snapshot:
      Awaited<
        ReturnType<
          typeof HistoricalSeasonArchiveResetService.capture
        >
      > | null =
      null;

    try {
      snapshot =
        await HistoricalSeasonArchiveResetService.capture(
          seasonId,
        );

      await HistoricalSeasonArchiveResetService.clear(
        seasonId,
      );

      try {
        await FirebaseSeasonRepository.removeCompleted(
          seasonId,
        );
      } catch (
        removeError
      ) {
        await HistoricalSeasonArchiveResetService.restore(
          snapshot,
        );

        throw removeError;
      }

      setArchiveImportSeasonId(
        null,
      );

      if (
        editingSeasonId ===
        seasonId
      ) {
        closeEditSeason();
      }
    } catch (
      currentError
    ) {
      console.error(
        "Errore eliminazione stagione:",
        currentError,
      );

      window.alert(
        currentError instanceof
          Error
          ? currentError.message
          : "Non è stato possibile eliminare la stagione.",
      );
    } finally {
      setProcessingSeasonId(
        null,
      );
    }
  }

  /*
   * ==========================================================
   * REIMPORTA ARCHIVIO = SOSTITUZIONE COMPLETA
   * ==========================================================
   */

  async function replaceHistoricalArchive({
    seasonId,
    seasonName,
    fileName,
    archive,
  }: {
    seasonId: string;
    seasonName: string;
    fileName: string;
    archive: Parameters<
      typeof HistoricalSeasonArchiveImportService.importArchive
    >[0]["archive"];
  }) {
    const snapshot =
      await HistoricalSeasonArchiveResetService.capture(
        seasonId,
      );

    await HistoricalSeasonArchiveResetService.clear(
      seasonId,
    );

    try {
      const result =
        await HistoricalSeasonArchiveImportService.importArchive({
          seasonId,
          seasonName,
          fileName,
          archive,
        });

      /*
       * I dati Excel sono stati realmente azzerati e ricreati.
       * Recuperiamo soltanto le immagini caricate manualmente
       * quando il relativo premio esiste ancora nel nuovo file.
       */
      try {
        await HistoricalSeasonArchiveResetService.restoreManualMedia(
          snapshot,
        );
      } catch (
        mediaError
      ) {
        console.error(
          "Archivio reimportato, ma non è stato possibile riagganciare tutte le immagini manuali:",
          mediaError,
        );
      }

      if (
        result.warnings.length >
        0
      ) {
        window.alert(
          [
            "Archivio reimportato con avvisi:",
            "",
            ...result.warnings,
          ].join(
            "\n",
          ),
        );
      }
    } catch (
      currentError
    ) {
      /*
       * Il reimport non deve mai lasciare una stagione a metà.
       * In caso di errore ripristiniamo l'archivio precedente.
       */
      try {
        await HistoricalSeasonArchiveResetService.restore(
          snapshot,
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Errore ripristino archivio precedente:",
          rollbackError,
        );
      }

      throw currentError;
    }
  }

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <AppShell>
      <header className="mt-2 mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#06142E]/35">
            Centro di controllo
          </p>

          <h1 className="mt-1 text-3xl font-black uppercase tracking-[-0.03em] text-[#06142E] sm:text-4xl">
            Stagioni
          </h1>

          <p className="mt-1 text-sm font-bold text-[#06142E]/50">
            Gestisci le stagioni
            {selectedCompetition
              ? ` di ${selectedCompetition.name}.`
              : "."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowForm(
              (current) =>
                !current,
            );

            setPastSeasonError(
              null,
            );
          }}
          className="ludi-button-primary shrink-0"
        >
          {showForm
            ? "Chiudi"
            : "+ Nuova"}
        </button>
      </header>

      {/* ======================================================
          CARICA STAGIONE PASSATA
          ====================================================== */}

      <section className="mb-5">
        <input
          ref={
            pastSeasonInputRef
          }
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={
            isPastSeasonImporting ||
            Boolean(
              processingSeasonId,
            )
          }
          onChange={(
            event,
          ) => {
            const file =
              event.target.files?.[0];

            event.target.value =
              "";

            if (file) {
              void handlePastSeasonFile(
                file,
              );
            }
          }}
          className="hidden"
        />

        <button
          type="button"
          disabled={
            isPastSeasonImporting ||
            Boolean(
              processingSeasonId,
            )
          }
          onClick={() =>
            pastSeasonInputRef.current?.click()
          }
          className="min-h-12 w-full rounded-[14px] border-2 border-dashed border-[#0B5FFF]/30 bg-[#0B5FFF]/[0.06] px-5 text-xs font-black uppercase tracking-[0.08em] text-[#0B5FFF] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPastSeasonImporting
            ? "Caricamento stagione passata..."
            : "Carica stagione passata"}
        </button>

        <p className="mt-2 text-center text-[10px] font-bold leading-4 text-[#06142E]/35">
          Nome e anni vengono letti automaticamente dal foglio
          {" "}
          <span className="font-black">
            Stagione
          </span>
          {" "}
          del file Excel.
        </p>

        {pastSeasonError && (
          <div className="mt-3 rounded-[13px] border border-red-200 bg-red-50 p-4">
            <p className="whitespace-pre-line text-sm font-bold text-red-700">
              {pastSeasonError}
            </p>
          </div>
        )}
      </section>

      {currentSeason && (
        <section className="mb-5 rounded-[20px] bg-[#06142E] p-5 text-white shadow-[0_16px_40px_rgba(6,20,46,0.18)]">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">
            Stagione corrente
            {selectedCompetition
              ? ` · ${selectedCompetition.name}`
              : ""}
          </p>

          <h2 className="mt-2 text-3xl font-black">
            {currentSeason.name}
          </h2>

          <p className="mt-1 text-sm font-bold text-white/55">
            Tutti i nuovi dati saranno collegati a questa stagione.
          </p>
        </section>
      )}

      {/* ======================================================
          NUOVA STAGIONE
          ====================================================== */}

      {showForm && (
        <form
          onSubmit={
            handleCreate
          }
          className="ludi-card mb-5 p-5"
        >
          <h2 className="ludi-section-title">
            Nuova stagione
          </h2>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                Nome visualizzato
              </span>

              <input
                type="text"
                value={
                  name
                }
                onChange={(
                  event,
                ) =>
                  setName(
                    event.target.value,
                  )
                }
                className="ludi-input"
                placeholder="Stagione 2025/26"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <YearField
                label="Anno iniziale"
                value={
                  startYear
                }
                onChange={
                  setStartYear
                }
              />

              <YearField
                label="Anno finale"
                value={
                  endYear
                }
                onChange={
                  setEndYear
                }
              />
            </div>
          </div>

          {formError && (
            <div className="mt-4 rounded-[13px] border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-700">
                {formError}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={
              isSaving
            }
            className="ludi-button-primary mt-5 w-full"
          >
            {isSaving
              ? "Creazione..."
              : "Crea stagione"}
          </button>
        </form>
      )}

      {error && (
        <div className="mb-5 rounded-[13px] border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-700">
            Impossibile caricare le stagioni.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="ludi-card p-6 text-center">
          <p className="font-black text-[#06142E]">
            Caricamento stagioni...
          </p>
        </div>
      ) : (
        <section className="space-y-3">
          {seasons.map(
            (season) => {
              const isEditing =
                editingSeasonId ===
                season.id;

              return (
                <article
                  key={
                    season.id
                  }
                  className="ludi-card p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#06142E]/35">
                        {season.startYear === season.endYear
  ? season.startYear
  : `${season.startYear} — ${season.endYear}`}
                      </p>

                      <h2 className="mt-1 text-xl font-black text-[#06142E]">
                        {season.name}
                      </h2>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={[
                            "inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase",

                            season.status ===
                            "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : season.status ===
                                  "completed"
                                ? "bg-slate-200 text-slate-700"
                                : "bg-amber-100 text-amber-700",
                          ].join(
                            " ",
                          )}
                        >
                          {getStatusLabel(
                            season.status,
                          )}
                        </span>

                        {season.isCurrent && (
                          <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase text-emerald-700">
                            Corrente
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ==========================================
                        AZIONI CARD
                        ========================================== */}

                    <div className="flex w-[164px] shrink-0 flex-col gap-2">
                      <button
                        type="button"
                        disabled={
                          processingSeasonId !==
                          null
                        }
                        onClick={() => {
                          if (isEditing) {
                            closeEditSeason();
                          } else {
                            openEditSeason(
                              season,
                            );
                          }
                        }}
                        className="rounded-[12px] border border-[#06142E]/15 px-3 py-2 text-[10px] font-black uppercase text-[#06142E] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isEditing
                          ? "Chiudi modifica"
                          : "Modifica"}
                      </button>

                      {season.status ===
                        "draft" && (
                        <button
                          type="button"
                          disabled={
                            processingSeasonId !==
                            null
                          }
                          onClick={() => {
                            void handleSetCurrent(
                              season.id,
                            );
                          }}
                          className="rounded-[12px] bg-[#06142E] px-3 py-2 text-[10px] font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Attiva
                        </button>
                      )}

                      {season.status ===
                        "active" && (
                        <button
                          type="button"
                          disabled={
                            processingSeasonId !==
                            null
                          }
                          onClick={() => {
                            void handleCompleteSeason(
                              season.id,
                              season.name,
                            );
                          }}
                          className="rounded-[12px] bg-red-600 px-3 py-2 text-[10px] font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {processingSeasonId ===
                          season.id
                            ? "Chiusura..."
                            : "Concludi"}
                        </button>
                      )}

                      {season.status ===
                        "completed" && (
                        <>
                          <button
                            type="button"
                            disabled={
                              processingSeasonId !==
                              null
                            }
                            onClick={() => {
                              closeEditSeason();

                              setArchiveImportSeasonId(
                                (
                                  current,
                                ) =>
                                  current ===
                                  season.id
                                    ? null
                                    : season.id,
                              );
                            }}
                            className="rounded-[12px] bg-[#0B5FFF] px-3 py-2 text-[10px] font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {archiveImportSeasonId ===
                            season.id
                              ? "Chiudi reimport"
                              : "Reimporta archivio"}
                          </button>

                          <button
                            type="button"
                            disabled={
                              processingSeasonId !==
                              null
                            }
                            onClick={() => {
                              void handleDeleteSeason(
                                season.id,
                                season.name,
                              );
                            }}
                            className="rounded-[12px] bg-red-100 px-3 py-2 text-[10px] font-black uppercase text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {processingSeasonId ===
                            season.id
                              ? "Eliminazione..."
                              : "Elimina"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ============================================
                      FORM MODIFICA
                      ============================================ */}

                  {isEditing && (
                    <div className="mt-5 border-t border-[#06142E]/10 pt-5">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#06142E]/40">
                        Modifica stagione
                      </p>

                      <div className="mt-4 space-y-4">
                        <label className="block">
                          <span className="mb-2 block text-[10px] font-black uppercase text-[#06142E]/50">
                            Nome stagione
                          </span>

                          <input
                            type="text"
                            value={
                              editName
                            }
                            onChange={(
                              event,
                            ) =>
                              setEditName(
                                event.target.value,
                              )
                            }
                            className="ludi-input"
                          />
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                          <YearField
                            label="Anno iniziale"
                            value={
                              editStartYear
                            }
                            onChange={
                              setEditStartYear
                            }
                          />

                          <YearField
                            label="Anno finale"
                            value={
                              editEndYear
                            }
                            onChange={
                              setEditEndYear
                            }
                          />
                        </div>
                      </div>

                      {editError && (
                        <div className="mt-4 rounded-[13px] border border-red-200 bg-red-50 p-4">
                          <p className="text-sm font-bold text-red-700">
                            {editError}
                          </p>
                        </div>
                      )}

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={
                            processingSeasonId !==
                            null
                          }
                          onClick={
                            closeEditSeason
                          }
                          className="min-h-11 rounded-[12px] border border-[#06142E]/15 px-3 text-[10px] font-black uppercase text-[#06142E] disabled:opacity-40"
                        >
                          Annulla
                        </button>

                        <button
                          type="button"
                          disabled={
                            processingSeasonId !==
                            null
                          }
                          onClick={() => {
                            void handleSaveSeasonEdit(
                              season,
                            );
                          }}
                          className="min-h-11 rounded-[12px] bg-[#06142E] px-3 text-[10px] font-black uppercase text-white disabled:opacity-40"
                        >
                          {processingSeasonId ===
                          season.id
                            ? "Salvataggio..."
                            : "Salva modifiche"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ============================================
                      REIMPORT ARCHIVIO
                      ============================================ */}

                  {archiveImportSeasonId ===
                    season.id &&
                    season.status ===
                      "completed" && (
                    <div className="mt-5 border-t border-[#06142E]/10 pt-5">
                      <div className="mb-4 rounded-[14px] border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-black uppercase text-amber-800">
                          Sostituzione completa archivio
                        </p>

                        <p className="mt-2 text-xs font-bold leading-5 text-amber-700">
                          Il nuovo file sostituirà integralmente i dati storici della stagione.
                          I dati del precedente Excel verranno azzerati prima del nuovo import.
                          I profili globali dei giocatori non verranno eliminati.
                        </p>
                      </div>

                      <HistoricalSeasonArchiveImporter
                        seasonId={
                          season.id
                        }
                        seasonName={
                          season.name
                        }
                        replacementMode
                        onImport={async (
                          archive,
                          fileName,
                        ) => {
                          await replaceHistoricalArchive({
                            seasonId:
                              season.id,

                            seasonName:
                              season.name,

                            fileName,

                            archive,
                          });
                        }}
                        onCompleted={() => {
                          setArchiveImportSeasonId(
                            null,
                          );
                        }}
                      />
                    </div>
                  )}
                </article>
              );
            },
          )}
        </section>
      )}
    </AppShell>
  );
}

function YearField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (
    value: number,
  ) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase text-[#06142E]/50">
        {label}
      </span>

      <input
        type="number"
        min={
          2000
        }
        max={
          2100
        }
        value={
          value
        }
        onChange={(
          event,
        ) =>
          onChange(
            Number(
              event.target.value,
            ),
          )
        }
        className="ludi-input"
        required
      />
    </label>
  );
}

function getStatusLabel(
  status:
    | "draft"
    | "active"
    | "completed",
) {
  if (
    status ===
    "active"
  ) {
    return "In corso";
  }

  if (
    status ===
    "completed"
  ) {
    return "Conclusa";
  }

  return "Bozza";
}
