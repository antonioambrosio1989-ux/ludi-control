"use client";

import {
  useState,
} from "react";

import {
  PlayerResidualAuditService,
  type ResidualPlayerAuditResult,
} from "@/src/services/player/PlayerResidualAuditService";

import type {
  PlayerProfile,
} from "@/src/types/PlayerProfile";

type Props = {
  competitionId:
    string | null | undefined;

  players:
    PlayerProfile[];

  onChanged:
    () =>
      Promise<void> |
      void;
};

export default function PlayerResidualCleanupPanel({
  competitionId,
  players,
  onChanged,
}: Props) {
  const [
    report,
    setReport,
  ] =
    useState<
      ResidualPlayerAuditResult |
      null
    >(
      null,
    );

  const [
    isAnalyzing,
    setIsAnalyzing,
  ] =
    useState(
      false,
    );

  const [
    isDeleting,
    setIsDeleting,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const [
    message,
    setMessage,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  async function analyze() {
    if (
      !competitionId ||
      isAnalyzing ||
      isDeleting
    ) {
      return;
    }

    setIsAnalyzing(
      true,
    );

    setError(
      null,
    );

    setMessage(
      null,
    );

    try {
      const nextReport =
        await PlayerResidualAuditService.analyze({
          competitionId,
          players,
        });

      setReport(
        nextReport,
      );
    } catch (
      currentError
    ) {
      setError(
        currentError instanceof Error
          ? currentError.message
          : "Impossibile analizzare i residui.",
      );
    } finally {
      setIsAnalyzing(
        false,
      );
    }
  }

  async function deleteSafePlayers() {
    if (
      !report ||
      report.deletablePlayers
        .length ===
        0 ||
      isDeleting
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        [
          `Eliminare definitivamente ${report.deletablePlayers.length} giocatori residui?`,
          "",
          "La procedura ricontrollerà ogni profilo prima della cancellazione.",
          "",
          "I giocatori con collegamenti Hall of Fame, statistiche storiche o rose NON verranno eliminati.",
        ].join(
          "\n",
        ),
      );

    if (
      !confirmed
    ) {
      return;
    }

    setIsDeleting(
      true,
    );

    setError(
      null,
    );

    setMessage(
      null,
    );

    try {
      const result =
        await PlayerResidualAuditService.deleteAllSafe(
          report.deletablePlayers,
        );

      await onChanged();

      setMessage(
        result.skipped.length >
          0
          ? `Eliminati ${result.deleted} giocatori. ${result.skipped.length} profili non sono stati cancellati perché non risultavano più sicuri.`
          : `Eliminati ${result.deleted} giocatori residui non collegati.`,
      );

      const refreshed =
        await PlayerResidualAuditService.analyze({
          competitionId:
            report.competitionId,

          players:
            players.filter(
              (player) =>
                !report.deletablePlayers.some(
                  (entry) =>
                    entry.player.id ===
                    player.id &&
                    !result.skipped.some(
                      (skipped) =>
                        skipped.playerId ===
                        player.id,
                    ),
                ),
            ),
        });

      setReport(
        refreshed,
      );
    } catch (
      currentError
    ) {
      setError(
        currentError instanceof Error
          ? currentError.message
          : "Impossibile completare la pulizia.",
      );
    } finally {
      setIsDeleting(
        false,
      );
    }
  }

  return (
    <section className="mb-5 rounded-[18px] border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700/60">
            Manutenzione anagrafica
          </p>

          <h2 className="mt-1 text-lg font-black uppercase text-[#06142E]">
            Residui giocatori
          </h2>

          <p className="mt-1 text-xs font-bold leading-5 text-[#06142E]/55">
            Analizza solo i profili senza importazioni archivio storico.
            Nessun giocatore viene cancellato durante l&apos;analisi.
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={
          !competitionId ||
          isAnalyzing ||
          isDeleting
        }
        onClick={() => {
          void analyze();
        }}
        className="mt-4 h-11 w-full rounded-[13px] bg-[#06142E] px-4 text-xs font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isAnalyzing
          ? "Analisi..."
          : report
            ? "Rianalizza residui"
            : "Analizza residui"}
      </button>

      {error && (
        <div className="mt-4 rounded-[13px] border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-bold text-red-700">
            {
              error
            }
          </p>
        </div>
      )}

      {message && (
        <div className="mt-4 rounded-[13px] border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-bold text-emerald-700">
            {
              message
            }
          </p>
        </div>
      )}

      {report && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <AuditStat
              label="Residui"
              value={
                report
                  .residualPlayers
                  .length
              }
            />

            <AuditStat
              label="Da verificare"
              value={
                report
                  .linkedPlayers
                  .length
              }
            />

            <AuditStat
              label="Cancellabili"
              value={
                report
                  .deletablePlayers
                  .length
              }
            />
          </div>

          {report.linkedPlayers
            .length >
            0 && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-red-700">
                Collegati — non cancellare
              </p>

              <div className="space-y-2">
                {report.linkedPlayers.map(
                  (
                    entry,
                  ) => (
                    <AuditPlayerCard
                      key={
                        entry
                          .player
                          .id
                      }
                      entry={
                        entry
                      }
                    />
                  ),
                )}
              </div>
            </div>
          )}

          {report.deletablePlayers
            .length >
            0 && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                Non collegati — cancellabili
              </p>

              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {report.deletablePlayers.map(
                  (
                    entry,
                  ) => (
                    <div
                      key={
                        entry
                          .player
                          .id
                      }
                      className="rounded-[12px] border border-emerald-200 bg-white px-3 py-3"
                    >
                      <p className="text-sm font-black text-[#06142E]">
                        {
                          entry
                            .player
                            .lastName
                        }{" "}
                        {
                          entry
                            .player
                            .firstName
                        }
                      </p>

                      <p className="mt-1 break-all text-[10px] font-bold text-[#06142E]/35">
                        {
                          entry
                            .player
                            .id
                        }
                      </p>
                    </div>
                  ),
                )}
              </div>

              <button
                type="button"
                disabled={
                  isDeleting
                }
                onClick={() => {
                  void deleteSafePlayers();
                }}
                className="mt-3 h-11 w-full rounded-[13px] bg-red-600 px-4 text-xs font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDeleting
                  ? "Eliminazione..."
                  : `Elimina ${report.deletablePlayers.length} residui sicuri`}
              </button>
            </div>
          )}

          {report.residualPlayers
            .length ===
            0 && (
            <div className="rounded-[13px] border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-black text-emerald-700">
                Nessun residuo rilevato.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function AuditPlayerCard({
  entry,
}: {
  entry:
    import("@/src/services/player/PlayerResidualAuditService")
      .ResidualPlayerAuditEntry;
}) {
  return (
    <div className="rounded-[12px] border border-red-200 bg-white px-3 py-3">
      <p className="text-sm font-black text-[#06142E]">
        {
          entry.player
            .lastName
        }{" "}
        {
          entry.player
            .firstName
        }
      </p>

      <p className="mt-1 break-all text-[10px] font-bold text-[#06142E]/35">
        {
          entry.player.id
        }
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {entry.hallOfFameItems
          .length >
          0 && (
          <AuditBadge
            label={`Hall of Fame: ${entry.hallOfFameItems.length}`}
          />
        )}

        {entry.isAllTimeTop20 && (
          <AuditBadge
            label="All-Time Top 20"
          />
        )}

        {entry.historicalStats
          .length >
          0 && (
          <AuditBadge
            label={`Statistiche: ${entry.historicalStats.length}`}
          />
        )}

        {entry.seasonPlayerEntries
          .length >
          0 && (
          <AuditBadge
            label={`Rose: ${entry.seasonPlayerEntries.length}`}
          />
        )}
      </div>

      {entry.hallOfFameItems
        .length >
        0 && (
        <div className="mt-3 space-y-1">
          {entry.hallOfFameItems.map(
            (
              item,
            ) => (
              <p
                key={
                  item.id
                }
                className="text-[11px] font-bold text-[#06142E]/55"
              >
                {item.seasonLabel} · {item.category}
              </p>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function AuditStat({
  label,
  value,
}: {
  label:
    string;

  value:
    number;
}) {
  return (
    <div className="rounded-[12px] bg-white p-3 text-center">
      <p className="text-xl font-black text-[#06142E]">
        {
          value
        }
      </p>

      <p className="mt-1 text-[9px] font-black uppercase text-[#06142E]/40">
        {
          label
        }
      </p>
    </div>
  );
}

function AuditBadge({
  label,
}: {
  label:
    string;
}) {
  return (
    <span className="rounded-full bg-red-50 px-2 py-1 text-[9px] font-black uppercase text-red-700">
      {
        label
      }
    </span>
  );
}
