import type { SeasonScheduleFormat, WithdrawalMatch, WithdrawalPhase, WithdrawalPolicy } from "./WithdrawalPreview";

/** Dati da registrare in futuro nel documento della stagione; NON sono salvati da questo modulo. */
export type WithdrawalSeasonRules = {
  format: SeasonScheduleFormat;
  /** Prima giornata del ritorno; null nel girone unico. */
  firstReturnMatchweek: number | null;
};

export type WithdrawalDraft = {
  seasonId: string;
  teamId: string;
  rules: WithdrawalSeasonRules;
  /** Giornata effettiva certificata dall'amministratore, non dedotta dal calendario parziale. */
  effectiveMatchweek: number;
};

export type WithdrawalPartialPlan = {
  phase: WithdrawalPhase | null;
  policy: WithdrawalPolicy | null;
  valid: boolean;
  knownPlayed: string[];
  knownPending: { matchId: string; matchweek: number; opponentTeamId: string }[];
  issues: string[];
  /** Mai autorizza la scrittura di risultati o statistiche. */
  safeToApply: false;
};

const played = new Set(["played", "finished", "walkover"]);
const pending = new Set(["scheduled", "postponed"]);

export function planPartialSeasonWithdrawal(draft: WithdrawalDraft, matches: WithdrawalMatch[]): WithdrawalPartialPlan {
  const issues: string[] = [];
  const { format, firstReturnMatchweek } = draft.rules;
  const round = draft.effectiveMatchweek;
  if (!draft.seasonId.trim() || !draft.teamId.trim()) issues.push("Stagione o squadra mancanti.");
  if (!Number.isSafeInteger(round) || round < 1) issues.push("Giornata del ritiro non verificata.");
  if (format !== "single_round_robin" && format !== "double_round_robin") issues.push("Formato non valido.");
  if (format === "double_round_robin" && (!Number.isSafeInteger(firstReturnMatchweek) || (firstReturnMatchweek ?? 0) <= 1)) {
    issues.push("Indicare la prima giornata del girone di ritorno.");
  }
  if (format === "single_round_robin" && firstReturnMatchweek !== null) {
    issues.push("Il girone unico non deve avere una giornata di ritorno.");
  }

  const phase: WithdrawalPhase | null = issues.length ? null :
    format === "double_round_robin" && round >= (firstReturnMatchweek as number) ? "second_leg" : "first_leg";
  const policy: WithdrawalPolicy | null = phase === null ? null :
    phase === "second_leg" ? "retain_and_walkover" : "void_all";

  const teamId = draft.teamId;
  const knownPlayed: string[] = [];
  const knownPending: WithdrawalPartialPlan["knownPending"] = [];
  const ids = new Set<string>();
  const relevant = matches.filter(m => (m.matchType ?? "regularSeason") === "regularSeason" &&
    (String(m.homeTeamId) === teamId || String(m.awayTeamId) === teamId));
  if (!relevant.length) issues.push("Non risultano partite della squadra nel calendario importato.");
  for (const m of relevant) {
    if (!m.id || ids.has(m.id)) issues.push(`ID partita duplicato o assente: ${m.id}.`);
    ids.add(m.id);
    if (!Number.isSafeInteger(m.matchweek) || m.matchweek < 1) issues.push(`Giornata non valida: ${m.id}.`);
    if (played.has(m.status)) {
      if (Number.isSafeInteger(round) && m.matchweek > round) issues.push(`Gara conclusa in una giornata successiva al ritiro: ${m.id}.`);
      knownPlayed.push(m.id);
    } else if (pending.has(m.status)) {
      const opponentTeamId = String(m.homeTeamId) === teamId ? String(m.awayTeamId) : String(m.homeTeamId);
      knownPending.push({ matchId: m.id, matchweek: m.matchweek, opponentTeamId });
    } else {
      issues.push(`Stato partita non gestibile (${m.status}): ${m.id}.`);
    }
  }
  knownPending.sort((a, b) => a.matchweek - b.matchweek || a.matchId.localeCompare(b.matchId));
  return { phase, policy, valid: issues.length === 0, knownPlayed, knownPending, issues, safeToApply: false };
}
