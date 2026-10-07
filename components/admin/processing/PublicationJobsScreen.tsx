"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";

import AppShell from "@/components/ui/AppShell";
import { useCompetition } from "@/src/contexts/CompetitionContext";
import { PublishMatchService } from "@/src/application/match-publishing/PublishMatchService";
import { PublishFinalStageMatchService } from "@/src/application/match-publishing/PublishFinalStageMatchService";
import { FirebaseMatchRepository } from "@/src/services/match/FirebaseMatchRepository";
import { FirebaseFinalStageMatchRepository } from "@/src/services/final-stage/FirebaseFinalStageMatchRepository";
import {
  PublicationJobService,
  type PublicationPhase,
} from "@/src/services/match/PublicationJobService";
import { db } from "@/src/lib/firebase";
import type { MatchWizardData } from "@/src/types/MatchWizardData";

type PublicationJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

type PublicationJob = {
  id: string;
  phase: PublicationPhase;
  matchId: string;
  seasonId: string;
  version: number;
  status: PublicationJobStatus;
  attempts: number;
  error: string | null;
  updatedAt?: unknown;
};

type MessageState =
  | {
      type: "success" | "error";
      text: string;
    }
  | null;

function normalizeJob(
  id: string,
  value: Record<string, unknown>,
): PublicationJob | null {
  const phase =
    value.phase === "regular" || value.phase === "final"
      ? value.phase
      : null;

  const status =
    value.status === "pending" ||
    value.status === "running" ||
    value.status === "completed" ||
    value.status === "failed"
      ? value.status
      : null;

  if (!phase || !status) {
    return null;
  }

  const matchId = String(value.matchId ?? "").trim();
  const seasonId = String(value.seasonId ?? "").trim();
  const version = Number(value.version ?? 0);

  if (!matchId || !seasonId || !Number.isFinite(version)) {
    return null;
  }

  return {
    id,
    phase,
    matchId,
    seasonId,
    version,
    status,
    attempts: Number.isFinite(Number(value.attempts ?? 0))
      ? Number(value.attempts ?? 0)
      : 0,
    error: typeof value.error === "string" ? value.error : null,
    updatedAt: value.updatedAt,
  };
}

function timestampToMillis(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (value && typeof value === "object" && "seconds" in value) {
    const seconds = Number(
      (value as { seconds?: unknown }).seconds ?? 0,
    );

    if (Number.isFinite(seconds)) {
      return seconds * 1000;
    }
  }

  return 0;
}

function formatTimestamp(value: unknown) {
  const millis = timestampToMillis(value);

  if (!millis) {
    return "—";
  }

  return new Date(millis).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPhaseLabel(phase: PublicationPhase) {
  return phase === "regular" ? "Regular Season" : "Final Stage";
}

function getStatusLabel(status: PublicationJobStatus) {
  switch (status) {
    case "pending":
      return "In attesa";
    case "running":
      return "In elaborazione";
    case "completed":
      return "Completata";
    case "failed":
      return "Errore";
  }
}

function getStatusClassName(status: PublicationJobStatus) {
  switch (status) {
    case "pending":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "running":
      return "bg-sky-50 text-sky-700 ring-sky-200";
    case "completed":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "failed":
      return "bg-red-50 text-red-700 ring-red-200";
  }
}

async function loadPublishedReportVersion({
  phase,
  matchId,
  version,
}: {
  phase: PublicationPhase;
  matchId: string;
  version: number;
}): Promise<MatchWizardData> {
  const collectionName =
    phase === "regular" ? "matchReports" : "finalStageMatchReports";

  const snapshot = await getDoc(
    doc(
      db,
      collectionName,
      matchId,
      "versions",
      String(version),
    ),
  );

  if (!snapshot.exists()) {
    throw new Error(`Versione ${version} del tabellino non trovata.`);
  }

  const value = snapshot.data() as {
    matchId?: unknown;
    seasonId?: unknown;
    version?: unknown;
    data?: unknown;
  };

  if (Number(value.version ?? version) !== version) {
    throw new Error(
      "La versione salvata del tabellino non corrisponde al job da recuperare.",
    );
  }

  if (!value.data || typeof value.data !== "object") {
    throw new Error(
      "I dati del tabellino pubblicato non sono disponibili.",
    );
  }

  return value.data as MatchWizardData;
}

async function retryRegularJob(job: PublicationJob) {
  const [match, report] = await Promise.all([
    FirebaseMatchRepository.getById(job.matchId),
    loadPublishedReportVersion({
      phase: "regular",
      matchId: job.matchId,
      version: job.version,
    }),
  ]);

  if (!match) {
    throw new Error("La partita Regular Season non esiste più.");
  }

  if (String(match.seasonId) !== job.seasonId) {
    throw new Error(
      "La partita non appartiene alla stagione del job.",
    );
  }

  return PublicationJobService.run(
    "regular",
    job.matchId,
    job.version,
    async () => {
      const result = await PublishMatchService.processPublished({
        match,
        report,
        expectedVersion: job.version,
      });

      if (result.processing.status === "failed") {
        throw new Error(
          result.processing.error ??
            "Elaborazione Regular Season non completata.",
        );
      }

      return result;
    },
  );
}

async function retryFinalStageJob(job: PublicationJob) {
  const [match, report, seasonMatchesForAdvancement] =
    await Promise.all([
      FirebaseFinalStageMatchRepository.getById(job.matchId),
      loadPublishedReportVersion({
        phase: "final",
        matchId: job.matchId,
        version: job.version,
      }),
      FirebaseFinalStageMatchRepository.getBySeason(job.seasonId),
    ]);

  if (!match) {
    throw new Error(
      "La partita delle fasi finali non esiste più.",
    );
  }

  if (String(match.seasonId) !== job.seasonId) {
    throw new Error(
      "La partita non appartiene alla stagione del job.",
    );
  }

  return PublicationJobService.run(
    "final",
    job.matchId,
    job.version,
    async () =>
      PublishFinalStageMatchService.processPublished({
        match,
        report,
        seasonMatchesForAdvancement,
      }),
  );
}

export default function PublicationJobsScreen() {
  const { currentSeason } = useCompetition();

  const [jobs, setJobs] = useState<PublicationJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState<MessageState>(null);

  useEffect(
    () =>
      onSnapshot(
        collection(db, "matchPublicationJobs"),
        (snapshot) => {
          const nextJobs = snapshot.docs
            .map((currentDocument) =>
              normalizeJob(
                currentDocument.id,
                currentDocument.data(),
              ),
            )
            .filter(
              (job): job is PublicationJob => job !== null,
            );

          setJobs(nextJobs);
          setLoadError(null);
          setIsLoading(false);
        },
        (error) => {
          console.error(
            "Errore caricamento elaborazioni:",
            error,
          );
          setLoadError("Impossibile caricare le elaborazioni.");
          setIsLoading(false);
        },
      ),
    [],
  );

  const visibleJobs = useMemo(() => {
    const seasonId = String(currentSeason?.id ?? "").trim();

    return jobs
      .filter(
        (job) => !seasonId || job.seasonId === seasonId,
      )
      .sort((first, second) => {
        const statusOrder: Record<
          PublicationJobStatus,
          number
        > = {
          failed: 0,
          pending: 1,
          running: 2,
          completed: 3,
        };

        const statusDifference =
          statusOrder[first.status] - statusOrder[second.status];

        if (statusDifference !== 0) {
          return statusDifference;
        }

        return (
          timestampToMillis(second.updatedAt) -
          timestampToMillis(first.updatedAt)
        );
      });
  }, [currentSeason?.id, jobs]);

  const recoverableCount = visibleJobs.filter(
    (job) =>
      job.status === "failed" ||
      job.status === "pending" ||
      job.status === "running",
  ).length;

  async function retryJob(job: PublicationJob) {
    if (retryingJobId) {
      return;
    }

    setRetryingJobId(job.id);
    setMessage(null);

    try {
      if (job.phase === "regular") {
        await retryRegularJob(job);
      } else {
        await retryFinalStageJob(job);
      }

      setMessage({
        type: "success",
        text: "Elaborazione completata correttamente.",
      });
    } catch (error) {
      console.error(
        "Recupero elaborazione non riuscito:",
        error,
      );

      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Elaborazione non riuscita.",
      });
    } finally {
      setRetryingJobId(null);
    }
  }

  return (
    <AppShell>
      <header className="mt-2 mb-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#06142E]/35">
          Amministrazione
        </p>

        <h1 className="mt-1 text-3xl font-black uppercase tracking-[-0.03em] text-[#06142E] sm:text-4xl">
          Elaborazioni
        </h1>

        <p className="mt-1 text-sm font-bold text-[#06142E]/50">
          Controlla le elaborazioni successive alla pubblicazione dei
          tabellini e recupera quelle interrotte.
        </p>
      </header>

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex h-full min-w-0 flex-col rounded-[16px] border border-[#06142E]/8 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#06142E]/40">
            Elaborazioni
          </p>
          <p className="mt-1 text-2xl font-black text-[#06142E]">
            {visibleJobs.length}
          </p>
        </div>

        <div className="rounded-[13px] bg-white p-4 shadow-[0_10px_24px_rgba(6,20,46,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#06142E]/40">
            Da verificare
          </p>
          <p className="mt-1 text-2xl font-black text-[#06142E]">
            {recoverableCount}
          </p>
        </div>
      </section>

      {message && (
        <div
          className={`mb-4 rounded-[13px] p-4 text-sm font-bold ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {isLoading ? (
        <section className="rounded-[13px] bg-white p-6 text-center shadow-[0_10px_24px_rgba(6,20,46,0.08)]">
          <p className="text-sm font-bold text-[#06142E]/45">
            Caricamento elaborazioni...
          </p>
        </section>
      ) : loadError ? (
        <section className="rounded-[13px] bg-red-50 p-5 text-sm font-bold text-red-700">
          {loadError}
        </section>
      ) : visibleJobs.length === 0 ? (
        <section className="rounded-[13px] bg-white p-6 text-center shadow-[0_10px_24px_rgba(6,20,46,0.08)]">
          <p className="text-sm font-black text-[#06142E]">
            Nessuna elaborazione presente.
          </p>
          <p className="mt-1 text-xs font-bold text-[#06142E]/45">
            I job compariranno qui dopo la pubblicazione di un
            tabellino.
          </p>
        </section>
      ) : (
        <div className="grid min-w-0 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {visibleJobs.map((job) => {
            const retrying = retryingJobId === job.id;
            const canRetry = job.status !== "completed";

            return (
              <section
                key={job.id}
                className="rounded-[13px] bg-white p-4 shadow-[0_10px_24px_rgba(6,20,46,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#06142E]/40">
                      {getPhaseLabel(job.phase)}
                    </p>
                    <p className="mt-1 truncate text-base font-black text-[#06142E]">
                      Partita {job.matchId}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase ring-1 ${getStatusClassName(
                      job.status,
                    )}`}
                  >
                    {getStatusLabel(job.status)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-[10px] bg-[#06142E]/5 p-3">
                    <p className="font-bold text-[#06142E]/40">
                      Versione
                    </p>
                    <p className="mt-1 font-black text-[#06142E]">
                      {job.version}
                    </p>
                  </div>

                  <div className="rounded-[10px] bg-[#06142E]/5 p-3">
                    <p className="font-bold text-[#06142E]/40">
                      Tentativi
                    </p>
                    <p className="mt-1 font-black text-[#06142E]">
                      {job.attempts}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-[11px] font-bold text-[#06142E]/45">
                  Ultimo aggiornamento:{" "}
                  {formatTimestamp(job.updatedAt)}
                </p>

                {job.error && (
                  <div className="mt-3 rounded-[10px] bg-red-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-red-700/60">
                      Errore
                    </p>
                    <p className="mt-1 break-words text-xs font-bold text-red-700">
                      {job.error}
                    </p>
                  </div>
                )}

                {canRetry && (
                  <button
                    type="button"
                    disabled={Boolean(retryingJobId)}
                    onClick={() => void retryJob(job)}
                    className="mt-auto min-h-11 w-full rounded-[12px] bg-[#06142E] px-4 text-xs font-black uppercase tracking-[0.08em] text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {retrying
                      ? "Elaborazione..."
                      : job.status === "running"
                        ? "Riprova elaborazione"
                        : "Riprova"}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
