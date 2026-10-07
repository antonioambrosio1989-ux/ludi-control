"use client";

import type {
  ChangeEvent,
  RefObject,
} from "react";

import type {
  FantasyPlayerPoolImportError,
  FantasyPlayerPoolImportRow,
} from "@/src/services/fantasy/FantasyPlayerPoolImportService";

import type {
  useAdminFantasyPlayerPool,
} from "@/src/hooks/useAdminFantasyPlayerPool";

import type {
  useFantasyPlayerPoolSource,
} from "@/src/hooks/useFantasyPlayerPoolSource";

import {
  MiniStat,
  getFantasyAvailabilityStyle,
  getFantasyRoleLabel,
} from "./AdminFantasyUi";

type PlayerPoolHook =
  ReturnType<
    typeof useAdminFantasyPlayerPool
  >;

type SourceHook =
  ReturnType<
    typeof useFantasyPlayerPoolSource
  >;

type FantasyPlayer =
  PlayerPoolHook["players"][number];

type ImportPreview = {
  fileName:
    string;

  rows:
    FantasyPlayerPoolImportRow[];

  errors:
    FantasyPlayerPoolImportError[];
};

type RoleFilter =
  | "all"
  | "goalkeeper"
  | "defender"
  | "forward";

type AvailabilityStatus =
  | "eligible"
  | "left_tournament"
  | "team_withdrawn";

type AvailabilityFilter =
  | "all"
  | AvailabilityStatus;

type Props = {
  playerCounts: {
    total:
      number;

    goalkeepers:
      number;

    defenders:
      number;

    forwards:
      number;
  };

  isPoolPublished:
    boolean;

  pool:
    PlayerPoolHook["pool"];

  source:
    SourceHook["source"];

  players:
    FantasyPlayer[];

  filteredPlayers:
    FantasyPlayer[];

  poolSaving:
    boolean;

  fileInputRef:
    RefObject<HTMLInputElement | null>;

  importPreview:
    ImportPreview | null;

  importError:
    string | null;

  importSuccess:
    string | null;

  publishError:
    string | null;

  publishSuccess:
    string | null;

  deletePoolError:
    string | null;

  deletePoolSuccess:
    string | null;

  availabilityError:
    string | null;

  playerSearch:
    string;

  roleFilter:
    RoleFilter;

  availabilityFilter:
    AvailabilityFilter;

  updatingAvailabilityPlayerId:
    string | null;

  onDownloadTemplate:
    () => void | Promise<void>;

  onSelectExcel:
    () => void;

  onExcelChange:
    (
      event:
        ChangeEvent<HTMLInputElement>,
    ) => void | Promise<void>;

  onResetImportPreview:
    () => void;

  onConfirmImport:
    () => void | Promise<void>;

  onPublishPool:
    () => void | Promise<void>;

  onDeleteDraftPool:
    () => void | Promise<void>;

  onPlayerSearchChange:
    (
      value:
        string,
    ) => void;

  onRoleFilterChange:
    (
      value:
        RoleFilter,
    ) => void;

  onAvailabilityFilterChange:
    (
      value:
        AvailabilityFilter,
    ) => void;

  onAvailabilityChange:
    (
      fantasyPlayerId:
        string,

      availabilityStatus:
        AvailabilityStatus,
    ) => void | Promise<void>;
};

export default function AdminFantasyPlayerPoolSection({
  playerCounts,
  isPoolPublished,
  pool,
  source,
  players,
  filteredPlayers,
  poolSaving,
  fileInputRef,
  importPreview,
  importError,
  importSuccess,
  publishError,
  publishSuccess,
  deletePoolError,
  deletePoolSuccess,
  availabilityError,
  playerSearch,
  roleFilter,
  availabilityFilter,
  updatingAvailabilityPlayerId,
  onDownloadTemplate,
  onSelectExcel,
  onExcelChange,
  onResetImportPreview,
  onConfirmImport,
  onPublishPool,
  onDeleteDraftPool,
  onPlayerSearchChange,
  onRoleFilterChange,
  onAvailabilityFilterChange,
  onAvailabilityChange,
}: Props) {
  const handleDownloadTemplate =
    onDownloadTemplate;

  const handleSelectExcel =
    onSelectExcel;

  const handleExcelChange =
    onExcelChange;

  const handleResetImportPreview =
    onResetImportPreview;

  const handleConfirmImport =
    onConfirmImport;

  const handlePublishPool =
    onPublishPool;

  const handleDeleteDraftPool =
    onDeleteDraftPool;

  const setPlayerSearch =
    onPlayerSearchChange;

  const setRoleFilter =
    onRoleFilterChange;

  const setAvailabilityFilter =
    onAvailabilityFilterChange;

  const handleAvailabilityChange =
    onAvailabilityChange;

  return (
            <section className="mt-7 rounded-[22px] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
                    Listone
                  </p>

                  <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">
                    Giocatori Fantasy
                  </h2>
                </div>

                <span
                  className={`rounded-full px-3 py-2 text-[9px] font-black uppercase ${
                    isPoolPublished
                      ? "bg-emerald-100 text-emerald-800"
                      : pool
                        ? "bg-amber-100 text-amber-800"
                        : "bg-[#06142E]/[0.06] text-[#06142E]/45"
                  }`}
                >
                  {isPoolPublished
                    ? "Pubblicato"
                    : pool
                      ? `Bozza v${pool.version}`
                      : "Non caricato"}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <MiniStat
                  label="Totale"
                  value={
                    String(
                      playerCounts.total,
                    )
                  }
                />

                <MiniStat
                  label="Portieri"
                  value={
                    String(
                      playerCounts.goalkeepers,
                    )
                  }
                />

                <MiniStat
                  label="Difensori"
                  value={
                    String(
                      playerCounts.defenders,
                    )
                  }
                />

                <MiniStat
                  label="Attaccanti"
                  value={
                    String(
                      playerCounts.forwards,
                    )
                  }
                />
              </div>

              {/* SORGENTE PREMIER LEAGUE */}

              <div className="mt-5 rounded-[16px] bg-[#F5F5F2] p-4">
                <p className="text-xs font-black uppercase text-[#06142E]">
                  Sorgente Premier League
                </p>

                {source ? (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <MiniStat
                      label="Giocatori validi"
                      value={
                        String(
                          source.players.length,
                        )
                      }
                    />

                    <MiniStat
                      label="Squadre valide"
                      value={
                        String(
                          source.teams.length,
                        )
                      }
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-xs font-bold text-[#06142E]/45">
                    Nessuna sorgente disponibile.
                  </p>
                )}
              </div>

              {/* IMPORT EXCEL */}

              <div className="mt-5 rounded-[16px] border border-dashed border-[#06142E]/15 p-5">
                <div className="text-center">
                  <p className="text-sm font-black uppercase text-[#06142E]">
                    Import Excel
                  </p>

                  <p className="mt-2 text-xs font-bold leading-5 text-[#06142E]/45">
                    {isPoolPublished
                      ? "Il Listone ufficiale è già pubblicato. Puoi continuare a scaricare il template, ma non puoi sostituire il Listone dalla schermata di import."
                      : "Scarica il template ufficiale, compila il Listone e ricarica il file Excel per controllare i dati prima del salvataggio in bozza."}
                  </p>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={
                      handleDownloadTemplate
                    }
                    className="min-h-12 rounded-[13px] bg-[#06142E]/[0.06] px-5 text-sm font-black uppercase text-[#06142E] transition hover:bg-[#06142E]/[0.10]"
                  >
                    Scarica template
                  </button>

                  <input
                    ref={
                      fileInputRef
                    }
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={
                      handleExcelChange
                    }
                  />

                  <button
                    type="button"
                    disabled={
                      isPoolPublished
                    }
                    onClick={
                      handleSelectExcel
                    }
                    className="min-h-12 rounded-[13px] bg-[#0B5FFF] px-5 text-sm font-black uppercase text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isPoolPublished
                      ? "Listone pubblicato"
                      : "Carica Excel"}
                  </button>
                </div>

                {importError && (
                  <div className="mt-4 rounded-[13px] bg-red-50 p-4">
                    <p className="text-xs font-black uppercase text-red-700">
                      Errore import
                    </p>

                    <p className="mt-1 text-xs font-bold leading-5 text-red-700/80">
                      {importError}
                    </p>
                  </div>
                )}

                {importSuccess && (
                  <div className="mt-4 rounded-[13px] bg-emerald-50 p-4">
                    <p className="text-xs font-black uppercase text-emerald-800">
                      Import completato
                    </p>

                    <p className="mt-1 text-xs font-bold leading-5 text-emerald-800/75">
                      {importSuccess}
                    </p>
                  </div>
                )}

                {importPreview && (
                  <div className="mt-5 rounded-[16px] bg-[#F5F5F2] p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#06142E]/35">
                          File selezionato
                        </p>

                        <p className="mt-1 break-all text-sm font-black text-[#06142E]">
                          {importPreview.fileName}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-2 text-[9px] font-black uppercase ${
                          importPreview.errors.length ===
                          0
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {importPreview.errors.length ===
                        0
                          ? "File valido"
                          : "Errori presenti"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <MiniStat
                        label="Giocatori validi"
                        value={
                          String(
                            importPreview.rows.length,
                          )
                        }
                      />

                      <MiniStat
                        label="Errori"
                        value={
                          String(
                            importPreview.errors.length,
                          )
                        }
                      />
                    </div>

                    {importPreview.rows.length >
                      0 && (
                      <div className="mt-4 overflow-hidden rounded-[13px] bg-white">
                        <div className="flex items-center justify-between gap-3 border-b border-[#06142E]/[0.06] px-4 py-3">
                          <p className="text-[10px] font-black uppercase text-[#06142E]">
                            Anteprima giocatori
                          </p>

                          <button
                            type="button"
                            onClick={
                              handleResetImportPreview
                            }
                            className="rounded-[9px] bg-[#06142E]/[0.06] px-3 py-2 text-[9px] font-black uppercase text-[#06142E]/60"
                          >
                            Annulla
                          </button>
                        </div>

                        <div className="max-h-[360px] overflow-y-auto">
                          {importPreview.rows.map(
                            (
                              row,
                            ) => (
                              <div
                                key={
                                  `${row.playerSeasonCode}-${row.rowNumber}`
                                }
                                className="grid gap-2 border-b border-[#06142E]/[0.05] px-4 py-3 last:border-b-0 md:grid-cols-[42px_minmax(0,1.5fr)_minmax(0,1fr)_105px_70px]"
                              >
                                <div>
                                  <p className="text-[8px] font-black uppercase text-[#06142E]/30 md:hidden">
                                    Riga
                                  </p>

                                  <p className="text-[10px] font-black text-[#06142E]/45">
                                    {
                                      row.rowNumber
                                    }
                                  </p>
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-xs font-black text-[#06142E]">
                                    {row.nome}{" "}
                                    {row.cognome}
                                  </p>

                                  <p className="mt-1 truncate text-[8px] font-bold text-[#06142E]/30">
                                    {
                                      row.playerSeasonCode
                                    }
                                  </p>
                                </div>

                                <div className="min-w-0">
                                  <p className="text-[8px] font-black uppercase text-[#06142E]/30 md:hidden">
                                    Squadra
                                  </p>

                                  <p className="truncate text-xs font-bold text-[#06142E]/60">
                                    {
                                      row.nomeSquadra
                                    }
                                  </p>
                                </div>

                                <div>
                                  <p className="text-[8px] font-black uppercase text-[#06142E]/30 md:hidden">
                                    Ruolo
                                  </p>

                                  <p className="text-[10px] font-black uppercase text-[#06142E]/60">
                                    {
                                      row.ruolo
                                    }
                                  </p>
                                </div>

                                <div>
                                  <p className="text-[8px] font-black uppercase text-[#06142E]/30 md:hidden">
                                    Costo
                                  </p>

                                  <p className="text-xs font-black text-[#06142E]">
                                    {row.costo} cr
                                  </p>
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                    {importPreview.errors.length >
                      0 && (
                      <div className="mt-4 rounded-[13px] bg-white p-4">
                        <p className="text-[10px] font-black uppercase text-red-700">
                          Problemi da correggere
                        </p>

                        <div className="mt-3 space-y-2">
                          {importPreview.errors
                            .slice(
                              0,
                              10,
                            )
                            .map(
                              (
                                currentImportError,
                                index,
                              ) => (
                                <div
                                  key={
                                    `${currentImportError.rowNumber ?? "general"}-${currentImportError.field ?? "field"}-${index}`
                                  }
                                  className="rounded-[10px] bg-red-50 px-3 py-2"
                                >
                                  <p className="text-xs font-bold leading-5 text-red-700">
                                    {currentImportError.rowNumber
                                      ? `Riga ${currentImportError.rowNumber}: `
                                      : ""}
                                    {currentImportError.message}
                                  </p>
                                </div>
                              ),
                            )}
                        </div>

                        {importPreview.errors.length >
                          10 && (
                          <p className="mt-3 text-[10px] font-black text-red-700/60">
                            Altri{" "}
                            {importPreview.errors.length -
                              10}{" "}
                            errori non mostrati.
                          </p>
                        )}
                      </div>
                    )}

                    {importPreview.errors.length ===
                      0 && (
                      <>
                        <div className="mt-4 rounded-[13px] bg-emerald-50 p-4">
                          <p className="text-xs font-black uppercase text-emerald-800">
                            Anteprima pronta
                          </p>

                          <p className="mt-1 text-xs font-bold leading-5 text-emerald-800/75">
                            Il file è valido. Puoi confermare
                            l&apos;import per salvare il Listone in
                            bozza.
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={
                            poolSaving ||
                            isPoolPublished ||
                            importPreview.rows.length ===
                              0
                          }
                          onClick={() => {
                            void handleConfirmImport();
                          }}
                          className="mt-4 min-h-12 w-full rounded-[13px] bg-emerald-600 px-5 text-sm font-black uppercase text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {poolSaving
                            ? "Importazione..."
                            : `Conferma import (${importPreview.rows.length})`}
                        </button>

                        {pool &&
                          !isPoolPublished && (
                          <p className="mt-2 text-center text-[10px] font-bold leading-4 text-amber-700">
                            Attenzione: la conferma sostituirà la
                            bozza attuale del Listone.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* GIOCATORI DEL LISTONE */}

              {pool && (
                <div className="mt-5 rounded-[16px] bg-[#F5F5F2] p-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#06142E]/35">
                        Elenco
                      </p>

                      <p className="mt-1 text-sm font-black uppercase text-[#06142E]">
                        Giocatori del Listone
                      </p>
                    </div>

                    <span className="rounded-full bg-[#06142E]/[0.06] px-3 py-2 text-[9px] font-black uppercase text-[#06142E]/55">
                      {players.length} giocatori
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.5fr)_180px_190px]">
                    <input
                      type="search"
                      value={
                        playerSearch
                      }
                      onChange={(
                        event,
                      ) =>
                        setPlayerSearch(
                          event.target.value,
                        )
                      }
                      placeholder="Cerca giocatore, squadra o codice..."
                      className="min-h-11 w-full rounded-[11px] bg-white px-4 text-xs font-bold text-[#06142E] outline-none placeholder:text-[#06142E]/25"
                    />

                    <select
                      value={
                        roleFilter
                      }
                      onChange={(
                        event,
                      ) =>
                        setRoleFilter(
                          event.target.value as
                            | "all"
                            | "goalkeeper"
                            | "defender"
                            | "forward",
                        )
                      }
                      className="min-h-11 rounded-[11px] bg-white px-3 text-[10px] font-black uppercase text-[#06142E] outline-none"
                    >
                      <option value="all">
                        Tutti i ruoli
                      </option>

                      <option value="goalkeeper">
                        Portieri
                      </option>

                      <option value="defender">
                        Difensori
                      </option>

                      <option value="forward">
                        Attaccanti
                      </option>
                    </select>

                    <select
                      value={
                        availabilityFilter
                      }
                      onChange={(
                        event,
                      ) =>
                        setAvailabilityFilter(
                          event.target.value as
                            | "all"
                            | "eligible"
                            | "left_tournament"
                            | "team_withdrawn",
                        )
                      }
                      className="min-h-11 rounded-[11px] bg-white px-3 text-[10px] font-black uppercase text-[#06142E] outline-none"
                    >
                      <option value="all">
                        Tutti gli stati
                      </option>

                      <option value="eligible">
                        Disponibili
                      </option>

                      <option value="left_tournament">
                        Usciti
                      </option>

                      <option value="team_withdrawn">
                        Squadra ritirata
                      </option>
                    </select>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-[9px] font-bold uppercase text-[#06142E]/30">
                      Mostrati{" "}
                      {
                        filteredPlayers.length
                      }{" "}
                      di{" "}
                      {
                        players.length
                      }
                    </p>

                    {(playerSearch ||
                      roleFilter !==
                        "all" ||
                      availabilityFilter !==
                        "all") && (
                      <button
                        type="button"
                        onClick={() => {
                          setPlayerSearch(
                            "",
                          );

                          setRoleFilter(
                            "all",
                          );

                          setAvailabilityFilter(
                            "all",
                          );
                        }}
                        className="rounded-[9px] bg-white px-3 py-2 text-[9px] font-black uppercase text-[#06142E]/55"
                      >
                        Azzera filtri
                      </button>
                    )}
                  </div>

                  {availabilityError && (
                    <div className="mt-4 rounded-[13px] bg-red-50 p-4">
                      <p className="text-xs font-black uppercase text-red-700">
                        Errore disponibilità
                      </p>

                      <p className="mt-1 text-xs font-bold leading-5 text-red-700/80">
                        {availabilityError}
                      </p>
                    </div>
                  )}

                  {players.length ===
                  0 ? (
                    <p className="mt-4 text-xs font-bold text-[#06142E]/45">
                      Nessun giocatore presente nel Listone.
                    </p>
                  ) : filteredPlayers.length ===
                    0 ? (
                    <p className="mt-4 rounded-[13px] bg-white p-4 text-xs font-bold text-[#06142E]/45">
                      Nessun giocatore corrisponde ai filtri selezionati.
                    </p>
                  ) : (
                    <div className="mt-4 overflow-hidden rounded-[14px] bg-white">
                      <div className="hidden grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)_110px_80px_120px] gap-3 border-b border-[#06142E]/[0.06] px-4 py-3 md:grid">
                        <p className="text-[9px] font-black uppercase text-[#06142E]/35">
                          Giocatore
                        </p>

                        <p className="text-[9px] font-black uppercase text-[#06142E]/35">
                          Squadra
                        </p>

                        <p className="text-[9px] font-black uppercase text-[#06142E]/35">
                          Ruolo
                        </p>

                        <p className="text-[9px] font-black uppercase text-[#06142E]/35">
                          Costo
                        </p>

                        <p className="text-[9px] font-black uppercase text-[#06142E]/35">
                          Stato
                        </p>
                      </div>

                      <div className="divide-y divide-[#06142E]/[0.06]">
                        {filteredPlayers.map(
                            (
                              player,
                            ) => (
                              <div
                                key={
                                  player.id
                                }
                                className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)_110px_80px_120px] md:items-center"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-[#06142E]">
                                    {player.displayName ||
                                      `${player.firstName} ${player.lastName}`}
                                  </p>

                                  <p className="mt-1 break-all text-[9px] font-bold text-[#06142E]/30">
                                    {
                                      player.playerSeasonCode
                                    }
                                  </p>
                                </div>

                                <div>
                                  <p className="text-[9px] font-black uppercase text-[#06142E]/35 md:hidden">
                                    Squadra
                                  </p>

                                  <p className="mt-1 truncate text-xs font-black text-[#06142E] md:mt-0">
                                    {
                                      player.teamCode
                                    }
                                  </p>
                                </div>

                                <div>
                                  <p className="text-[9px] font-black uppercase text-[#06142E]/35 md:hidden">
                                    Ruolo
                                  </p>

                                  <span className="mt-1 inline-flex rounded-full bg-[#06142E]/[0.06] px-2.5 py-1.5 text-[9px] font-black uppercase text-[#06142E]/65 md:mt-0">
                                    {getFantasyRoleLabel(
                                      player.role,
                                    )}
                                  </span>
                                </div>

                                <div>
                                  <p className="text-[9px] font-black uppercase text-[#06142E]/35 md:hidden">
                                    Costo
                                  </p>

                                  <p className="mt-1 text-sm font-black text-[#06142E] md:mt-0">
                                    {player.cost} cr
                                  </p>
                                </div>

                                <div>
                                  <p className="text-[9px] font-black uppercase text-[#06142E]/35 md:hidden">
                                    Stato
                                  </p>

                                  <select
                                    value={
                                      player.availabilityStatus
                                    }
                                    disabled={
                                      updatingAvailabilityPlayerId ===
                                        player.id
                                    }
                                    onChange={(
                                      event,
                                    ) => {
                                      void handleAvailabilityChange(
                                        player.id,
                                        event.target.value as
                                          | "eligible"
                                          | "left_tournament"
                                          | "team_withdrawn",
                                      );
                                    }}
                                    className={`mt-1 min-h-9 w-full rounded-[10px] border-0 px-2.5 text-[9px] font-black uppercase outline-none md:mt-0 ${getFantasyAvailabilityStyle(
                                      player.availabilityStatus,
                                    )}`}
                                  >
                                    <option value="eligible">
                                      Disponibile
                                    </option>

                                    <option value="left_tournament">
                                      Uscito
                                    </option>

                                    <option value="team_withdrawn">
                                      Squadra ritirata
                                    </option>
                                  </select>

                                  {updatingAvailabilityPlayerId ===
                                    player.id && (
                                    <p className="mt-1 text-[8px] font-black uppercase text-[#06142E]/30">
                                      Aggiornamento...
                                    </p>
                                  )}
                                </div>
                              </div>
                            ),
                          )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PUBBLICAZIONE LISTONE */}

              {pool && (
                <div className="mt-5 rounded-[16px] bg-[#F5F5F2] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#06142E]/35">
                        Pubblicazione
                      </p>

                      <p className="mt-1 text-sm font-black uppercase text-[#06142E]">
                        {isPoolPublished
                          ? "Listone ufficiale"
                          : "Bozza pronta"}
                      </p>

                      <p className="mt-2 text-xs font-bold leading-5 text-[#06142E]/45">
                        {isPoolPublished
                          ? "Il Listone è pubblicato ed è disponibile come elenco ufficiale del Fantacalcio."
                          : `La bozza contiene ${players.length} giocatori. Verifica i dati prima della pubblicazione definitiva.`}
                      </p>
                    </div>

                    <span
                      className={`w-fit rounded-full px-3 py-2 text-[9px] font-black uppercase ${
                        isPoolPublished
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isPoolPublished
                        ? "Pubblicato"
                        : `Bozza v${pool.version}`}
                    </span>
                  </div>

                  {publishError && (
                    <div className="mt-4 rounded-[13px] bg-red-50 p-4">
                      <p className="text-xs font-black uppercase text-red-700">
                        Errore pubblicazione
                      </p>

                      <p className="mt-1 text-xs font-bold leading-5 text-red-700/80">
                        {publishError}
                      </p>
                    </div>
                  )}

                  {publishSuccess && (
                    <div className="mt-4 rounded-[13px] bg-emerald-50 p-4">
                      <p className="text-xs font-black uppercase text-emerald-800">
                        Pubblicazione completata
                      </p>

                      <p className="mt-1 text-xs font-bold leading-5 text-emerald-800/75">
                        {publishSuccess}
                      </p>
                    </div>
                  )}

                  {deletePoolError && (
                    <div className="mt-4 rounded-[13px] bg-red-50 p-4">
                      <p className="text-xs font-black uppercase text-red-700">
                        Errore eliminazione
                      </p>

                      <p className="mt-1 text-xs font-bold leading-5 text-red-700/80">
                        {deletePoolError}
                      </p>
                    </div>
                  )}

                  {deletePoolSuccess && (
                    <div className="mt-4 rounded-[13px] bg-emerald-50 p-4">
                      <p className="text-xs font-black uppercase text-emerald-800">
                        Bozza eliminata
                      </p>

                      <p className="mt-1 text-xs font-bold leading-5 text-emerald-800/75">
                        {deletePoolSuccess}
                      </p>
                    </div>
                  )}

                  {!isPoolPublished && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <button
                        type="button"
                        disabled={
                          poolSaving ||
                          players.length ===
                            0
                        }
                        onClick={() => {
                          void handlePublishPool();
                        }}
                        className="min-h-12 rounded-[13px] bg-[#06142E] px-5 text-sm font-black uppercase text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {poolSaving
                          ? "Operazione..."
                          : `Pubblica Listone (${players.length})`}
                      </button>

                      <button
                        type="button"
                        disabled={
                          poolSaving
                        }
                        onClick={() => {
                          void handleDeleteDraftPool();
                        }}
                        className="min-h-12 rounded-[13px] border border-red-200 bg-white px-5 text-sm font-black uppercase text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {poolSaving
                          ? "Operazione..."
                          : "Elimina bozza"}
                      </button>
                    </div>
                  )}

                  {isPoolPublished && (
                    <div className="mt-4 rounded-[13px] bg-emerald-50 p-4">
                      <p className="text-xs font-black uppercase text-emerald-800">
                        Listone pubblicato
                      </p>

                      <p className="mt-1 text-xs font-bold leading-5 text-emerald-800/75">
                        Il caricamento di un nuovo Excel è stato
                        disabilitato per proteggere il Listone
                        ufficiale.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>
  );
}
