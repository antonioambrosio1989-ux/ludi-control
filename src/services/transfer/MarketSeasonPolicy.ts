import type { SeasonMarketConfiguration } from "@/src/types/Season";

/** Controlli puri da usare sia nella UI sia nei validatori server. */
export function isCivilDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseMarketConfiguration(data: Record<string, unknown>): SeasonMarketConfiguration {
  const format = data.format;
  if (format !== "single_round_robin" && format !== "double_round_robin") return {};
  const firstReturn = data.firstReturnMatchweek;
  if (format === "single_round_robin") {
    // Le stagioni a sola andata non espongono mai una finestra di mercato.
    return { format: "single_round_robin", firstReturnMatchweek: null };
  }
  if (!Number.isSafeInteger(firstReturn) || (firstReturn as number) < 2 || (firstReturn as number) > 100) {
    // Configurazione A/R incompleta: mai abilitare il mercato.
    return {};
  }
  const window = data.marketWindow;
  if (window === null || typeof window !== "object" || Array.isArray(window)) {
    return { format: "double_round_robin", firstReturnMatchweek: firstReturn as number };
  }
  const raw = window as Record<string, unknown>;
  if (!isCivilDate(raw.startDate) || !isCivilDate(raw.endDate) || raw.startDate > raw.endDate) {
    return { format: "double_round_robin", firstReturnMatchweek: firstReturn as number };
  }
  return {
    format: "double_round_robin",
    firstReturnMatchweek: firstReturn as number,
    marketWindow: { startDate: raw.startDate, endDate: raw.endDate },
  };
}

export function isMarketEligible(config: SeasonMarketConfiguration | null | undefined): boolean {
  return config?.format === "double_round_robin" &&
    Number.isSafeInteger(config.firstReturnMatchweek) &&
    (config.firstReturnMatchweek as number) >= 2;
}

export function assertMarketDate(config: SeasonMarketConfiguration | null | undefined, todayRome: string): void {
  if (!isMarketEligible(config)) throw new Error("Mercato non previsto per questa stagione.");
  const window = config?.marketWindow;
  if (!window || !isCivilDate(window.startDate) || !isCivilDate(window.endDate) || window.startDate > window.endDate) {
    throw new Error("Finestra di mercato non configurata correttamente.");
  }
  if (!isCivilDate(todayRome) || todayRome < window.startDate || todayRome > window.endDate) {
    throw new Error("Operazione fuori dalla finestra di mercato.");
  }
}

/** Validazione esplicita per nuovi documenti; non modifica le stagioni legacy. */
export function validateNewSeasonMarketConfiguration(config: SeasonMarketConfiguration): SeasonMarketConfiguration {
  if (config.format === undefined) {
    if (config.firstReturnMatchweek !== undefined || config.marketWindow !== undefined) {
      throw new Error("Specifica il formato della stagione prima della configurazione mercato.");
    }
    return {};
  }
  if (config.format !== "single_round_robin" && config.format !== "double_round_robin") {
    throw new Error("Formato stagione non valido.");
  }
  if (config.format === "single_round_robin") {
    if (config.firstReturnMatchweek != null || config.marketWindow !== undefined) {
      throw new Error("Il mercato non e previsto nelle stagioni a sola andata.");
    }
    return { format: "single_round_robin", firstReturnMatchweek: null };
  }
  const first = config.firstReturnMatchweek;
  if (!Number.isSafeInteger(first) || (first as number) < 2 || (first as number) > 100) {
    throw new Error("Prima giornata del girone di ritorno non valida.");
  }
  const window = config.marketWindow;
  if (window !== undefined && (!isCivilDate(window.startDate) || !isCivilDate(window.endDate) || window.startDate > window.endDate)) {
    throw new Error("Finestra di mercato non valida.");
  }
  return { format: "double_round_robin", firstReturnMatchweek: first as number, ...(window ? { marketWindow: window } : {}) };
}
