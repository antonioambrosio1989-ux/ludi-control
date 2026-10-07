"use client";

import {
  useRef,
  useState,
} from "react";

import {
  CheckCircle2,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
  XCircle,
} from "lucide-react";

import type {
  HistoricalSeasonArchiveImport,
} from "@/src/services/season/HistoricalSeasonArchiveExcelParser";

type Props = {
  seasonId: string;
  seasonName: string;

  disabled?: boolean;

  replacementMode?: boolean;

  onImport: (
    archive:
      HistoricalSeasonArchiveImport,
    fileName:
      string,
  ) =>
    Promise<void>;

  onCompleted?:
    () =>
      Promise<void> |
      void;
};

export default function HistoricalSeasonArchiveImporter({
  seasonId,
  seasonName,
  disabled = false,
  replacementMode = false,
  onImport,
  onCompleted,
}: Props) {
  const inputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [
    fileName,
    setFileName,
  ] =
    useState("");

  const [
    archive,
    setArchive,
  ] =
    useState<
      HistoricalSeasonArchiveImport |
      null
    >(null);

  const [
    isReading,
    setIsReading,
  ] =
    useState(false);

  const [
    isImporting,
    setIsImporting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  function reset() {
    setFileName("");
    setArchive(null);
    setError(null);

    if (
      inputRef.current
    ) {
      inputRef.current.value =
        "";
    }
  }

  async function handleFile(
    file: File,
  ) {
    if (
      !file.name
        .toLocaleLowerCase("it")
        .endsWith(".xlsx")
    ) {
      setError(
        "Seleziona il file archivio stagionale in formato .xlsx.",
      );

      return;
    }

    setIsReading(
      true,
    );

    setError(
      null,
    );

    try {
      const { parseHistoricalSeasonArchiveExcel } = await import("@/src/services/season/HistoricalSeasonArchiveExcelParser");
      const parsed =
        await parseHistoricalSeasonArchiveExcel(
          file,
        );

      /*
       * Evitiamo di importare per errore
       * un file riferito a un'altra stagione.
       */
      const normalizedAdminSeason =
        normalizeSeasonName(
          seasonName,
        );

      const normalizedExcelSeason =
        normalizeSeasonName(
          parsed.season.seasonName,
        );

      if (
        normalizedAdminSeason &&
        normalizedExcelSeason &&
        !normalizedExcelSeason.includes(
          normalizedAdminSeason,
        ) &&
        !normalizedAdminSeason.includes(
          normalizedExcelSeason,
        )
      ) {
        throw new Error(
          [
            "Il file selezionato sembra appartenere a una stagione diversa.",
            "",
            `Stagione admin: ${seasonName}`,
            `Stagione Excel: ${parsed.season.seasonName}`,
          ].join("\n"),
        );
      }

      setFileName(
        file.name,
      );

      setArchive(
        parsed,
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore lettura archivio stagione:",
        currentError,
      );

      setArchive(
        null,
      );

      setError(
        currentError instanceof Error
          ? currentError.message
          : "Impossibile leggere l'archivio stagionale.",
      );
    } finally {
      setIsReading(
        false,
      );
    }
  }

  async function confirmImport() {
    if (
      !archive ||
      isImporting
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        [
          replacementMode
            ? `Reimportare l'archivio della stagione ${seasonName}?`
            : `Importare l'archivio della stagione ${seasonName}?`,
          "",
          `Squadre: ${archive.teams.length}`,
          `Righe rose/statistiche: ${archive.regularSeasonPlayers.length}`,
          `Classifica finale: ${archive.finalStandings.length} squadre`,
          `Partite Champions: ${archive.championsMatches.length}`,
          `Statistiche giocatori Champions: ${archive.championsPlayerStats.length}`,
          `Tabellino finale: ${
  archive.championsFinalReport
    ? "Presente"
    : "Non presente"
}`,
          `Premiazioni: ${archive.awards.length}`,
          "",
          replacementMode
            ? "ATTENZIONE: i dati del precedente file Excel verranno azzerati e sostituiti integralmente con quelli del nuovo file."
            : "I dati storici già presenti per questa stagione potranno essere aggiornati.",
        ].join("\n"),
      );

    if (
      !confirmed
    ) {
      return;
    }

    setIsImporting(
      true,
    );

    setError(
      null,
    );

    try {
      await onImport(
        archive,
        fileName,
      );

      window.alert(
        [
          replacementMode
            ? "Archivio stagionale reimportato e sostituito."
            : "Archivio stagionale importato.",
          "",
          `Stagione: ${archive.season.seasonName}`,
          `Squadre: ${archive.teams.length}`,
          `Giocatori/esperienze: ${archive.regularSeasonPlayers.length}`,
          `Partite Champions: ${archive.championsMatches.length}`,
          `Premi: ${archive.awards.length}`,
        ].join("\n"),
      );

      reset();

      await onCompleted?.();
    } catch (
      currentError
    ) {
      console.error(
        "Errore importazione archivio stagione:",
        currentError,
      );

      setError(
        currentError instanceof Error
          ? currentError.message
          : "Impossibile completare l'importazione dell'archivio.",
      );
    } finally {
      setIsImporting(
        false,
      );
    }
  }

  return (
    <div>
      <input
        ref={
          inputRef
        }
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={
          disabled ||
          isReading ||
          isImporting
        }
        onChange={(
          event,
        ) => {
          const file =
            event.target.files?.[0];

          event.target.value =
            "";

          if (
            file
          ) {
            void handleFile(
              file,
            );
          }
        }}
        className="hidden"
      />

      {!archive && (
        <button
          type="button"
          disabled={
            disabled ||
            isReading ||
            isImporting
          }
          onClick={() =>
            inputRef.current?.click()
          }
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-emerald-600 px-4 text-xs font-black uppercase tracking-wide text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isReading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}

          {isReading
            ? "Lettura archivio..."
            : replacementMode
              ? "Seleziona nuovo archivio"
              : "Carica archivio stagione"}
        </button>
      )}

      {error && (
        <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

            <p className="whitespace-pre-line text-xs font-bold leading-5 text-red-700">
              {error}
            </p>
          </div>
        </div>
      )}

      {archive && (
        <ArchivePreview
          archive={
            archive
          }
          fileName={
            fileName
          }
          seasonId={
            seasonId
          }
          seasonName={
            seasonName
          }
          isImporting={
            isImporting
          }
          replacementMode={
            replacementMode
          }
          onConfirm={() => {
            void confirmImport();
          }}
          onCancel={
            reset
          }
        />
      )}
    </div>
  );
}

function ArchivePreview({
  archive,
  fileName,
  seasonId,
  seasonName,
  isImporting,
  replacementMode,
  onConfirm,
  onCancel,
}: {
  archive:
    HistoricalSeasonArchiveImport;

  fileName: string;

  seasonId: string;
  seasonName: string;

  isImporting: boolean;

  replacementMode: boolean;

  onConfirm:
    () => void;

  onCancel:
    () => void;
}) {
  const regularSeasonWinner =
    archive.finalStandings.find(
      (entry) =>
        entry.position ===
        1,
    );

  const winnerTeam =
    regularSeasonWinner
      ? archive.teams.find(
          (team) =>
            team.teamCode ===
            regularSeasonWinner.teamCode,
        )
      : undefined;

  const championsFinal =
    archive.championsMatches.find(
      (match) =>
        normalizeText(
          match.round,
        ) ===
        "finale" ||
        normalizeText(
          match.matchCode,
        ) ===
        "final",
    );

  const championsWinner =
    championsFinal
      ? getMatchWinner({
          match:
            championsFinal,
          teams:
            archive.teams,
        })
      : undefined;

  return (
    <section className="mt-5 overflow-hidden rounded-[18px] border border-[#06142E]/10 bg-white shadow-sm">
      <div className="bg-[#06142E] p-5 text-white">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-1 h-6 w-6 shrink-0 text-emerald-300" />

          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
              Archivio riconosciuto
            </p>

            <h3 className="mt-1 whitespace-normal break-words text-xl font-black">
              {
                archive.season.seasonName
              }
            </h3>

            <p className="mt-1 whitespace-normal break-words text-xs font-bold text-white/50">
              {fileName}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatBox
            label="Squadre"
            value={
              archive.teams.length
            }
          />

          <StatBox
            label="Rose / esperienze"
            value={
              archive.regularSeasonPlayers.length
            }
          />

          <StatBox
            label="Classifica"
            value={
              archive.finalStandings.length
            }
          />

          <StatBox
            label="Partite Champions"
            value={
              archive.championsMatches.length
            }
          />

          <StatBox
            label="Gol Champions"
            value={
              archive.championsPlayerStats.length
            }
          />

          <StatBox
            label="Premiazioni"
            value={
              archive.awards.length
            }
          />
        </div>

        <div className="mt-5 space-y-3">
          <InfoRow
            label="Stagione admin"
            value={
              seasonName
            }
          />

          <InfoRow
            label="seasonId"
            value={
              seasonId
            }
          />

          <InfoRow
            label="Codice Excel"
            value={
              archive.season.seasonCode
            }
          />

          <InfoRow
            label="Competizione"
            value={
              archive.season.competitionName
            }
          />

          <InfoRow
            label="Vincitore Regular Season"
            value={
              winnerTeam?.name ??
              "Non disponibile"
            }
          />

          <InfoRow
            label="Vincitore Champions"
            value={
              championsWinner ??
              "Non disponibile"
            }
          />
        </div>

        <div className="mt-5 rounded-[14px] bg-emerald-50 p-4">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />

            <div>
              <p className="text-xs font-black uppercase text-emerald-700">
                File pronto
              </p>

              <p className="mt-1 text-xs font-bold leading-5 text-emerald-700/70">
                L&apos;archivio è stato letto e validato.
                La scrittura su Firestore avverrà solo dopo la conferma.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={
              isImporting
            }
            onClick={
              onConfirm
            }
            className="flex h-12 items-center justify-center gap-2 rounded-[13px] bg-[#0B5FFF] px-4 text-xs font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isImporting && (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            )}

            {isImporting
              ? "Importazione..."
              : replacementMode
                ? "Conferma reimport"
                : "Conferma importazione"}
          </button>

          <button
            type="button"
            disabled={
              isImporting
            }
            onClick={
              onCancel
            }
            className="h-12 rounded-[13px] bg-[#06142E]/5 px-4 text-xs font-black uppercase text-[#06142E] disabled:opacity-40"
          >
            Annulla
          </button>
        </div>
      </div>
    </section>
  );
}

function StatBox({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[14px] bg-[#06142E]/[0.04] p-4">
      <p className="text-2xl font-black text-[#06142E]">
        {value}
      </p>

      <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-[#06142E]/40">
        {label}
      </p>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#06142E]/5 pb-3 last:border-0">
      <p className="text-xs font-black uppercase text-[#06142E]/40">
        {label}
      </p>

      <p className="max-w-[60%] whitespace-normal break-words text-right text-xs font-black text-[#06142E]">
        {value}
      </p>
    </div>
  );
}

function getMatchWinner({
  match,
  teams,
}: {
  match:
    HistoricalSeasonArchiveImport["championsMatches"][number];

  teams:
    HistoricalSeasonArchiveImport["teams"];
}) {
  let winnerCode:
    string |
    undefined;

  /*
   * ==========================================================
   * RISULTATO EFFETTIVO
   * ==========================================================
   *
   * homeScore / awayScore = risultato al 90'
   * homeExtraTimeScore / awayExtraTimeScore = totale dopo DTS
   * homePenalties / awayPenalties = shootout
   *
   * Se i supplementari non sono presenti, il risultato
   * effettivo resta quello dei 90'.
   * ==========================================================
   */

  const effectiveHomeScore =
    match.homeExtraTimeScore ??
    match.homeScore;

  const effectiveAwayScore =
    match.awayExtraTimeScore ??
    match.awayScore;

  if (
    effectiveHomeScore !==
      undefined &&
    effectiveAwayScore !==
      undefined
  ) {
    if (
      effectiveHomeScore >
      effectiveAwayScore
    ) {
      winnerCode =
        match.homeTeamCode;
    } else if (
      effectiveAwayScore >
      effectiveHomeScore
    ) {
      winnerCode =
        match.awayTeamCode;
    } else if (
      match.homePenalties !==
        undefined &&
      match.awayPenalties !==
        undefined
    ) {
      if (
        match.homePenalties >
        match.awayPenalties
      ) {
        winnerCode =
          match.homeTeamCode;
      } else if (
        match.awayPenalties >
        match.homePenalties
      ) {
        winnerCode =
          match.awayTeamCode;
      }
    }
  }

  if (
    !winnerCode
  ) {
    return undefined;
  }

  return (
    teams.find(
      (team) =>
        team.teamCode ===
        winnerCode,
    )?.name ??
    winnerCode
  );
}

function normalizeText(
  value: string,
) {
  return value
    .trim()
    .toLocaleLowerCase(
      "it",
    )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    );
}

function normalizeSeasonName(
  value: string,
) {
  /*
   * "Ludi Premier League 2025/26"
   * e "2025/26" devono essere
   * considerati compatibili.
   */
  const normalized =
    normalizeText(
      value,
    );

  const seasonMatch =
    normalized.match(
      /\b(20\d{2})\s*[/-]\s*(\d{2,4})\b/,
    );

  if (
    seasonMatch
  ) {
    return `${seasonMatch[1]}/${seasonMatch[2].slice(-2)}`;
  }

  return normalized;
}