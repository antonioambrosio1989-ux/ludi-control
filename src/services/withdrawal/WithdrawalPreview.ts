/**
 * Modello di simulazione del ritiro. Nessuna scrittura Firestore.
 * Non inferire il girone dal nome della competizione o dalla giornata.
 * Il chiamante deve fornire un formato stagionale verificato e la fase del ritiro.
 */
export type SeasonScheduleFormat = "single_round_robin" | "double_round_robin";
export type WithdrawalPhase = "first_leg" | "second_leg";
export type WithdrawalPolicy = "void_all" | "retain_and_walkover";

export type WithdrawalMatch = {
  id: string;
  homeTeamId: string | number;
  awayTeamId: string | number;
  matchType?: string;
  matchweek: number;
  date: string;
  time: string;
  status: string;
};

export type WithdrawalPreviewInput = {
  teamId: string;
  seasonFormat: SeasonScheduleFormat;
  withdrawalPhase: WithdrawalPhase;
  matches: WithdrawalMatch[];
};

export type WithdrawalPreview = {
  policy: WithdrawalPolicy;
  teamId: string;
  alreadyPlayed: string[];
  pending: { matchId: string; matchweek: number; opponentTeamId: string }[];
  impactedTeamIds: string[];
  issues: string[];
  /** La simulazione non attribuisce punti e non cancella report. */
  safeToApply: false;
};

const endedStatuses = new Set(["played", "finished", "walkover"]);
const pendingStatuses = new Set(["scheduled", "postponed"]);

export function previewTeamWithdrawal(input: WithdrawalPreviewInput): WithdrawalPreview {
  const teamId = input.teamId.trim();
  const issues: string[] = [];
  if (!teamId) issues.push("ID squadra assente.");
  if (input.seasonFormat === "single_round_robin" && input.withdrawalPhase === "second_leg") {
    issues.push("Un campionato di sola andata non prevede il girone di ritorno.");
  }
  const policy: WithdrawalPolicy = input.seasonFormat === "double_round_robin" &&
    input.withdrawalPhase === "second_leg" ? "retain_and_walkover" : "void_all";

  const relevant = input.matches.filter(match =>
    (match.matchType ?? "regularSeason") === "regularSeason" &&
    (String(match.homeTeamId) === teamId || String(match.awayTeamId) === teamId));
  if (!relevant.length) issues.push("Nessuna partita di Regular Season per la squadra selezionata.");
  const ids = new Set<string>();
  const opponents = new Set<string>();
  const alreadyPlayed: string[] = [];
  const pending: WithdrawalPreview["pending"] = [];
  for (const match of relevant) {
    if (ids.has(match.id)) issues.push(`Identificativo partita duplicato: ${match.id}.`);
    ids.add(match.id);
    const opponentTeamId = String(match.homeTeamId) === teamId
      ? String(match.awayTeamId) : String(match.homeTeamId);
    opponents.add(opponentTeamId);
    if (endedStatuses.has(match.status)) {
      alreadyPlayed.push(match.id);
    } else if (pendingStatuses.has(match.status)) {
      pending.push({ matchId: match.id, matchweek: match.matchweek, opponentTeamId });
    } else {
      issues.push(`Stato partita ${match.id} (${match.status}) da verificare manualmente.`);
    }
  }
  pending.sort((a,b) => a.matchweek - b.matchweek || a.matchId.localeCompare(b.matchId));
  return {
    policy, teamId, alreadyPlayed, pending, impactedTeamIds: [...opponents].sort(),
    issues, safeToApply: false,
  };
}
