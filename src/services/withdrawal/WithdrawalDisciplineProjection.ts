/**
 * Fase 5C: anteprima disciplinare, SOLO LETTURA.
 * Non ricalcola/salva squalifiche: individua effetti certi e casi da ricostruire.
 * I tabellini originali e le decisioni del giudice sportivo restano immutati.
 */
import type { DisciplinarySuspension, PlayerDisciplinaryRecord } from "../../types/DisciplinaryRecord";

type CardPerformance = {
  playerId: string;
  teamId: string | number;
  yellowCards?: number;
  redCards?: number;
  directRedCards?: number;
};
export type DisciplineReport = {
  matchId: string;
  status: "draft" | "published";
  data: { performances: Record<string, CardPerformance> };
};
export type DisciplineMatch = {
  id: string;
  matchweek: number;
  date?: string;
  time?: string;
  matchType?: string;
};
export type DisciplineProjectionInput = {
  seasonId: string;
  excludedMatchIds: readonly string[];
  matches: readonly DisciplineMatch[];
  reports: readonly DisciplineReport[];
  records: readonly PlayerDisciplinaryRecord[];
  suspensions: readonly DisciplinarySuspension[];
};
export type DisciplineProjection = {
  removedCards: Array<{ playerId: string; yellowCards: number; directRedCards: number; excludedMatchIds: string[] }>;
  affectedSuspensions: Array<{ id: string; playerId: string; reason: string; action: "review-source-cancelled" | "review-served-match" | "review-yellow-chain" }>;
  preservedManualSuspensionIds: string[];
  projectedSeasonTotals: Array<{ playerId: string; originalYellowCards: number; projectedYellowCards: number; originalDirectReds: number; projectedDirectReds: number }>;
  blockers: string[];
  canAutoApply: false;
};

function cardCount(value: unknown, max?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  const n = Math.floor(value);
  return max === undefined ? n : Math.min(n, max);
}

export function projectWithdrawalDiscipline(input: DisciplineProjectionInput): DisciplineProjection {
  if (!input.seasonId.trim()) throw new Error("Stagione non valida");
  const excluded = new Set(input.excludedMatchIds.map(String));
  const matchMap = new Map(input.matches.map(m => [String(m.id), m]));
  const blockers = new Set<string>();
  const removed = new Map<string, { playerId: string; yellowCards: number; directRedCards: number; excludedMatchIds: string[] }>();
  const removedReportMatchIds = new Set<string>();
  const seen = new Set<string>();
  for (const report of input.reports) {
    if (report.status !== "published" || !excluded.has(String(report.matchId))) continue;
    const match = matchMap.get(String(report.matchId));
    if (!match) { blockers.add(`Partita ${report.matchId} non trovata: verificare il tabellino.`); continue; }
    if (match.matchType && match.matchType !== "regularSeason") {
      blockers.add(`Partita ${report.matchId} fuori dalla Regular Season: esclusione da verificare.`);
      continue;
    }
    if (removedReportMatchIds.has(String(report.matchId))) {
      blockers.add(`Report pubblicato duplicato per ${report.matchId}.`);
      continue;
    }
    removedReportMatchIds.add(String(report.matchId));
    for (const perf of Object.values(report.data.performances ?? {})) {
      const playerId = String(perf.playerId ?? "").trim();
      if (!playerId) { blockers.add(`Identificativo giocatore mancante in ${report.matchId}.`); continue; }
      const key = `${report.matchId}::${playerId}`;
      if (seen.has(key)) { blockers.add(`Duplicato disciplinare ${key}.`); continue; }
      seen.add(key);
      const yellows = cardCount(perf.yellowCards, 2);
      const direct = cardCount(perf.directRedCards);
      if (!yellows && !direct) continue;
      const current = removed.get(playerId) ?? { playerId, yellowCards: 0, directRedCards: 0, excludedMatchIds: [] };
      current.yellowCards += yellows;
      current.directRedCards += direct;
      current.excludedMatchIds.push(String(report.matchId));
      removed.set(playerId, current);
    }
  }
  const affectedSuspensions: DisciplineProjection["affectedSuspensions"] = [];
  const preservedManualSuspensionIds: string[] = [];
  for (const s of input.suspensions) {
    if (s.seasonId !== input.seasonId) continue;
    // I provvedimenti del giudice sportivo sono INDIPENDENTI dal ricalcolo automatico.
    if (s.reason === "sportsJudge") {
      preservedManualSuspensionIds.push(s.id);
      if (s.servedMatchIds?.some(id => excluded.has(id))) {
        blockers.add(`Provvedimento manuale ${s.id}: gara scontata annullata, verifica del giudice sportivo.`);
      }
      continue;
    }
    if (s.sourceMatchId && excluded.has(s.sourceMatchId)) {
      affectedSuspensions.push({ id: s.id, playerId: s.playerId, reason: s.reason, action: "review-source-cancelled" });
      if (s.servedMatches > 0 || s.status === "completed") {
        blockers.add(`Squalifica ${s.id} già scontata (in tutto o in parte): revisione amministrativa.`);
      }
    } else if (s.servedMatchIds?.some(id => excluded.has(id))) {
      affectedSuspensions.push({ id: s.id, playerId: s.playerId, reason: s.reason, action: "review-served-match" });
      blockers.add(`Squalifica ${s.id}: una gara di espiazione è stata annullata.`);
    } else if (s.reason === "yellowAccumulation" && removed.has(s.playerId)) {
      affectedSuspensions.push({ id: s.id, playerId: s.playerId, reason: s.reason, action: "review-yellow-chain" });
      blockers.add(`Squalifica per accumulo ${s.id}: ricalcolare la cronologia dei gialli.`);
    }
  }
  const projectedSeasonTotals: DisciplineProjection["projectedSeasonTotals"] = [];
  for (const record of input.records) {
    if (record.seasonId !== input.seasonId) continue;
    const d = removed.get(record.playerId);
    if (!d) continue;
    if (record.seasonYellowCards < d.yellowCards || record.directRedCards < d.directRedCards) {
      blockers.add(`Totali incoerenti per ${record.playerId}: necessaria riconciliazione.`);
    }
    projectedSeasonTotals.push({
      playerId: record.playerId,
      originalYellowCards: record.seasonYellowCards,
      projectedYellowCards: Math.max(0, record.seasonYellowCards - d.yellowCards),
      originalDirectReds: record.directRedCards,
      projectedDirectReds: Math.max(0, record.directRedCards - d.directRedCards),
    });
    if (d.yellowCards > 0) blockers.add(`Giocatore ${record.playerId}: ciclo ammonizioni da ricalcolare cronologicamente.`);
  }
  for (const id of excluded) {
    if (!matchMap.has(id)) blockers.add(`Gara annullata ${id} assente nel calendario fornito.`);
  }
  return {
    removedCards: [...removed.values()].sort((a,b)=>a.playerId.localeCompare(b.playerId)),
    affectedSuspensions: affectedSuspensions.sort((a,b)=>a.id.localeCompare(b.id)),
    preservedManualSuspensionIds: preservedManualSuspensionIds.sort(),
    projectedSeasonTotals: projectedSeasonTotals.sort((a,b)=>a.playerId.localeCompare(b.playerId)),
    blockers: [...blockers].sort(),
    canAutoApply: false,
  };
}
