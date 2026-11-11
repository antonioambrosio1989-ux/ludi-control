/**
 * Fase 5D: replay deterministico SOLO LETTURA della Regular Season.
 * Nessuna scrittura e nessun provvedimento è emesso/annullato.
 * Per tutti i casi non dimostrabili si espone un blocco alla futura applicazione.
 */
import type { DisciplinarySuspension } from "../../types/DisciplinaryRecord";

export type ReplayMatch = {
  id: string; matchweek: number; homeTeamId: string; awayTeamId: string;
  date?: string; time?: string; matchType?: string;
};
export type ReplayReport = {
  matchId: string; status: "draft" | "published";
  data: {
    status?: string;
    performances: Record<string, {
      playerId: string; teamId: string | number; yellowCards?: number;
      directRedCards?: number; redCards?: number;
    }>;
  };
};
export type ReplayInput = {
  seasonId: string;
  excludedMatchIds: readonly string[];
  matches: readonly ReplayMatch[];
  reports: readonly ReplayReport[];
  existingSuspensions: readonly DisciplinarySuspension[];
};
export type ReplayedSuspension = {
  key: string; playerId: string; teamId: string;
  reason: "directRed" | "yellowAccumulation";
  sourceMatchId: string; sourceMatchweek: number;
  servedMatchIds: string[];
  status: "active" | "completed";
  remainingMatches: number;
};
export type ReplayPlayer = {
  playerId: string; teamId: string; yellowCards: number;
  directRedCards: number; currentYellowCycle: number;
  pendingAutomaticSuspensions: number;
};
export type ReplayResult = {
  players: ReplayPlayer[];
  projectedSuspensions: ReplayedSuspension[];
  preservedManualSuspensionIds: string[];
  historicalAutomaticReviewIds: string[];
  excludedMatchIds: string[];
  blockers: string[];
  canAutoApply: false;
};

type State = {
  playerId: string; teamId: string; yellowCards: number;
  directRedCards: number; currentYellowCycle: number;
  suspensions: ReplayedSuspension[];
};
const norm = (v: string | number) => String(v).trim();
function count(v: unknown, max?: number): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return 0;
  const n = Math.floor(v); return max === undefined ? n : Math.min(n, max);
}
function sortMatch(a: ReplayMatch, b: ReplayMatch): number {
  return a.matchweek - b.matchweek ||
    `${a.date ?? ""}T${a.time ?? ""}`.localeCompare(`${b.date ?? ""}T${b.time ?? ""}`) ||
    a.id.localeCompare(b.id);
}

export function replayWithdrawalDiscipline(input: ReplayInput): ReplayResult {
  if (!input.seasonId.trim()) throw new Error("Stagione mancante");
  const excluded = new Set(input.excludedMatchIds.map(norm));
  const blockers = new Set<string>();
  const matchById = new Map<string, ReplayMatch>();
  for (const m of input.matches) {
    const id = norm(m.id);
    if (!id || matchById.has(id)) { blockers.add(`Partita duplicata o senza ID: ${id}`); continue; }
    matchById.set(id, m);
    if (!Number.isInteger(m.matchweek) || m.matchweek < 1) blockers.add(`Matchweek invalida: ${id}`);
    if (!norm(m.homeTeamId) || !norm(m.awayTeamId) || norm(m.homeTeamId) === norm(m.awayTeamId)) blockers.add(`Squadre invalide: ${id}`);
    if (m.matchType && m.matchType !== "regularSeason") continue;
  }
  for (const id of excluded) {
    const m = matchById.get(id);
    if (!m) blockers.add(`Partita esclusa assente: ${id}`);
    else if (m.matchType && m.matchType !== "regularSeason") blockers.add(`Esclusione fuori Regular Season: ${id}`);
  }
  const reportById = new Map<string, ReplayReport>();
  for (const r of input.reports) {
    if (r.status !== "published") continue;
    const id = norm(r.matchId);
    if (reportById.has(id)) blockers.add(`Report pubblicato duplicato: ${id}`);
    else reportById.set(id, r);
    if (!matchById.has(id)) blockers.add(`Report senza partita nel calendario: ${id}`);
  }
  const states = new Map<string, State>();
  const replayed: ReplayedSuspension[] = [];
  const usedMatchweeks = new Map<string, Set<number>>();
  const matches = [...matchById.values()]
    .filter(m => (!m.matchType || m.matchType === "regularSeason") && !excluded.has(norm(m.id)))
    .sort(sortMatch);
  for (const m of matches) {
    const id = norm(m.id);
    const report = reportById.get(id);
    if (!report) {
      blockers.add(`Report pubblicato mancante per ${id}: impossibile attestare la gara disputata e lo sconto squalifiche.`);
      continue;
    }
    if (report.data.status === "walkover") continue; // Tavolino: non costituisce gara giocata per scontare.
    // Prima scontiamo le squalifiche nate in giornate precedenti,
    // massimo una volta per squadra/giocatore/giornata.
    const playedTeams = new Set([norm(m.homeTeamId), norm(m.awayTeamId)]);
    for (const state of states.values()) {
      if (!playedTeams.has(state.teamId)) continue;
      const weeks = usedMatchweeks.get(state.playerId) ?? new Set<number>();
      if (weeks.has(m.matchweek)) continue;
      const pending = state.suspensions.filter(s => s.status === "active" && s.sourceMatchweek < m.matchweek);
      if (!pending.length) continue;
      weeks.add(m.matchweek); usedMatchweeks.set(state.playerId, weeks);
      for (const suspension of pending) {
        suspension.servedMatchIds.push(id);
        suspension.remainingMatches -= 1;
        if (suspension.remainingMatches === 0) {
          suspension.status = "completed";
          if (suspension.reason === "yellowAccumulation") {
            state.currentYellowCycle = Math.max(0, state.currentYellowCycle - 5);
          }
        }
      }
    }
    const byPlayer = new Map<string, { teamId: string; yellow: number; red: number }>();
    for (const perf of Object.values(report.data.performances ?? {})) {
      const playerId = norm(perf.playerId ?? "");
      const teamId = norm(perf.teamId ?? "");
      if (!playerId || !playedTeams.has(teamId)) {
        blockers.add(`Giocatore/squadra incompatibile nel report ${id}`); continue;
      }
      const yellow = count(perf.yellowCards, 2);
      const red = count(perf.directRedCards); // redCards statistico NON usato.
      const old = byPlayer.get(playerId);
      if (old && old.teamId !== teamId) {
        blockers.add(`Giocatore ${playerId} in due squadre nel report ${id}`); continue;
      }
      // Il report può contenere performance duplicate: usa max, non somma.
      byPlayer.set(playerId, { teamId, yellow: Math.max(old?.yellow ?? 0, yellow), red: Math.max(old?.red ?? 0, red) });
    }
    for (const [playerId, p] of byPlayer) {
      const old = states.get(playerId);
      if (old && old.teamId !== p.teamId) {
        blockers.add(`Trasferimento giocatore ${playerId}: cronologia squadre da verificare.`);
        continue;
      }
      const state = old ?? { playerId, teamId: p.teamId, yellowCards: 0, directRedCards: 0, currentYellowCycle: 0, suspensions: [] };
      states.set(playerId, state);
      state.yellowCards += p.yellow;
      state.currentYellowCycle += p.yellow;
      state.directRedCards += p.red;
      if (p.red > 0 && !state.suspensions.some(s => s.sourceMatchId === id && s.reason === "directRed")) {
        const s: ReplayedSuspension = { key:`${playerId}:${id}:directRed`, playerId, teamId:p.teamId, reason:"directRed", sourceMatchId:id, sourceMatchweek:m.matchweek, servedMatchIds:[], status:"active", remainingMatches:1 };
        state.suspensions.push(s); replayed.push(s);
      }
      if (state.currentYellowCycle >= 5 && !state.suspensions.some(s => s.reason === "yellowAccumulation" && s.status === "active")) {
        const s: ReplayedSuspension = { key:`${playerId}:${id}:yellowAccumulation`, playerId, teamId:p.teamId, reason:"yellowAccumulation", sourceMatchId:id, sourceMatchweek:m.matchweek, servedMatchIds:[], status:"active", remainingMatches:1 };
        state.suspensions.push(s); replayed.push(s);
      }
    }
  }
  const manual = input.existingSuspensions.filter(s => s.seasonId === input.seasonId && s.reason === "sportsJudge");
  for (const s of manual) {
    if (s.sourceMatchId && excluded.has(norm(s.sourceMatchId))) blockers.add(`Provvedimento del giudice ${s.id} collegato a gara esclusa: revisione manuale.`);
    if (s.servedMatchIds?.some(id => excluded.has(norm(id)))) blockers.add(`Provvedimento del giudice ${s.id} scontato in gara esclusa: revisione manuale.`);
    if ((s.servedMatchweeks?.length ?? 0) > 0 && !(s.servedMatchIds?.length)) blockers.add(`Provvedimento del giudice ${s.id}: sconto solo per giornata, verifica necessaria.`);
  }
  const automatic = input.existingSuspensions.filter(s => s.seasonId === input.seasonId && s.reason !== "sportsJudge");
  // Gli ID esistenti non sono necessariamente uguali alle chiavi della proiezione.
  // Perciò nessun aggiornamento automatico delle squalifiche già registrate.
  for (const s of automatic) {
    const expected = replayed.find(x => x.playerId === s.playerId && x.reason === s.reason && x.sourceMatchId === s.sourceMatchId);
    if (!expected || expected.status !== s.status || expected.remainingMatches !== s.remainingMatches ||
      (s.servedMatchIds && JSON.stringify([...s.servedMatchIds].sort()) !== JSON.stringify([...expected.servedMatchIds].sort()))) {
      blockers.add(`Squalifica storica ${s.id}: differenza rispetto alla ricostruzione, revisione necessaria.`);
    }
    if ((s.servedMatchweeks?.length ?? 0) && !(s.servedMatchIds?.length)) blockers.add(`Squalifica ${s.id}: sconti legacy per giornata non riconciliabili con certezza.`);
  }
  // Rileviamo report esclusi con sanzioni manuali senza modificarli.
  return {
    players:[...states.values()].map(s => ({ playerId:s.playerId, teamId:s.teamId, yellowCards:s.yellowCards, directRedCards:s.directRedCards, currentYellowCycle:s.currentYellowCycle, pendingAutomaticSuspensions:s.suspensions.filter(x=>x.status==="active").length })).sort((a,b)=>a.playerId.localeCompare(b.playerId)),
    projectedSuspensions:replayed.map(s=>({...s,servedMatchIds:[...s.servedMatchIds]})),
    preservedManualSuspensionIds:manual.map(s=>s.id).sort(),
    historicalAutomaticReviewIds:automatic.map(s=>s.id).sort(),
    excludedMatchIds:[...excluded].sort(),
    blockers:[...blockers].sort(),
    canAutoApply:false,
  };
}
