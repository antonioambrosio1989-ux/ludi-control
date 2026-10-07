import type { MatchWizardData } from "@/src/types/MatchWizardData";

export type StoredMatchReportStatus =
  | "draft"
  | "published";

export type StoredMatchReport = {
  matchId: string;
  status: StoredMatchReportStatus;
  version: number;

  updatedAt: string;
  publishedAt?: string;

  data: MatchWizardData;
};

const STORAGE_KEY = "ludi-os-match-reports";

function readAll(): StoredMatchReport[] {
  if (typeof window === "undefined") {
    return [];
  }

  let value: string | null;
  try { value = window.localStorage.getItem(STORAGE_KEY); } catch { return []; }

  if (!value) {
    return [];
  }

  try {
    return JSON.parse(
      value,
    ) as StoredMatchReport[];
  } catch {
    return [];
  }
}

function writeAll(
  reports: StoredMatchReport[],
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY,JSON.stringify(reports));
  } catch (error) {
    console.warn("La copia locale del tabellino non è disponibile; il salvataggio cloud resta valido.",error);
  }
}

function upsertReport(
  nextReport: StoredMatchReport,
) {
  const reports = readAll();

  const existingIndex = reports.findIndex(
    (report) =>
      report.matchId === nextReport.matchId,
  );

  if (existingIndex === -1) {
    writeAll([...reports, nextReport]);
    return;
  }

  const updatedReports = [...reports];

  updatedReports[existingIndex] = nextReport;

  writeAll(updatedReports);
}

export const MatchReportStorage = {
  getByMatchId(
    matchId: string,
  ): StoredMatchReport | undefined {
    return readAll().find(
      (report) => report.matchId === matchId,
    );
  },

  getAll(): StoredMatchReport[] {
    return readAll();
  },

  saveDraft(
    data: MatchWizardData,
  ): StoredMatchReport {
    const existing = this.getByMatchId(
      data.matchId,
    );

    if (existing?.status === "published") return existing;

    const report: StoredMatchReport = {
      matchId: data.matchId,
      status: "draft",
      version: existing?.version ?? 1,
      updatedAt: new Date().toISOString(),
      data,
    };

    upsertReport(report);

    return report;
  },

  publish(
    data: MatchWizardData,
  ): StoredMatchReport {
    const existing = this.getByMatchId(
      data.matchId,
    );

    const report: StoredMatchReport = {
      matchId: data.matchId,
      status: "published",
      version:
        existing?.status === "published"
          ? existing.version + 1
          : existing?.version ?? 1,

      updatedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),

      data,
    };

    upsertReport(report);

    return report;
  },
};