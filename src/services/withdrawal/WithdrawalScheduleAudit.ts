import type { SeasonScheduleFormat, WithdrawalMatch, WithdrawalPhase } from "./WithdrawalPreview";

/** Read-only audit. A manual format is NOT sufficient: require a complete schedule. */
export type ScheduleAudit = {
  phase: WithdrawalPhase | null;
  complete: boolean;
  expectedMatches: number;
  foundMatches: number;
  firstReturnMatchweek: number | null;
  issues: string[];
};

function key(a: string, b: string): string {
  return [a, b].sort().join("\u0000");
}
function validDateTime(match: WithdrawalMatch): boolean {
  const timestamp = `${match.date}T${match.time}`;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(timestamp) &&
    Number.isFinite(Date.parse(timestamp));
}

export function auditWithdrawalSchedule(input: {
  format: SeasonScheduleFormat;
  teamIds: string[];
  matches: WithdrawalMatch[];
  /** Local clock in Rome: YYYY-MM-DDTHH:mm */
  nowRome: string;
}): ScheduleAudit {
  const issues: string[] = [];
  const teamIds = [...new Set(input.teamIds.map(String).filter(Boolean))].sort();
  const teamSet = new Set(teamIds);
  const expectedPerPair = input.format === "double_round_robin" ? 2 : 1;
  const expectedMatches = teamIds.length * (teamIds.length - 1) / 2 * expectedPerPair;
  const fixtures = input.matches.filter(m => (m.matchType ?? "regularSeason") === "regularSeason");
  if (teamIds.length < 2) issues.push("Elenco delle squadre iscritte insufficiente.");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.nowRome)) issues.push("Data e ora del ritiro non valide.");
  const pairs = new Map<string, WithdrawalMatch[]>();
  const seenIds = new Set<string>();
  for (const match of fixtures) {
    const a = String(match.homeTeamId), b = String(match.awayTeamId);
    if (a === b || !teamSet.has(a) || !teamSet.has(b)) {
      issues.push(`Partita ${match.id}: squadre non coerenti con le iscrizioni stagionali.`);
      continue;
    }
    if (seenIds.has(match.id)) issues.push(`ID partita duplicato: ${match.id}.`);
    seenIds.add(match.id);
    if (!Number.isInteger(match.matchweek) || match.matchweek < 1 || !validDateTime(match)) {
      issues.push(`Partita ${match.id}: giornata, data o ora non valide.`);
    }
    if (!["played", "finished", "walkover", "scheduled", "postponed"].includes(match.status)) {
      issues.push(`Partita ${match.id}: stato ${match.status} da verificare.`);
    }
    const pair = key(a, b);
    pairs.set(pair, [...(pairs.get(pair) ?? []), match]);
  }
  if (fixtures.length !== expectedMatches) {
    issues.push(`Calendario incompleto o eccedente: ${fixtures.length} partite, attese ${expectedMatches} per ${teamIds.length} squadre e formato selezionato.`);
  }
  const firstLeg: WithdrawalMatch[] = [], secondLeg: WithdrawalMatch[] = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const games = [...(pairs.get(key(teamIds[i], teamIds[j])) ?? [])]
        .sort((a, b) => a.matchweek - b.matchweek || `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
      if (games.length !== expectedPerPair) {
        issues.push(`Accoppiamento ${teamIds[i]} / ${teamIds[j]}: ${games.length} gare presenti, attese ${expectedPerPair}.`);
        continue;
      }
      firstLeg.push(games[0]);
      if (expectedPerPair === 2) {
        secondLeg.push(games[1]);
        if (String(games[0].homeTeamId) === String(games[1].homeTeamId)) {
          issues.push(`Accoppiamento ${teamIds[i]} / ${teamIds[j]}: casa/trasferta non invertite.`);
        }
      }
    }
  }
  let firstReturnMatchweek: number | null = null;
  if (secondLeg.length) {
    const lastFirst = Math.max(...firstLeg.map(m => m.matchweek));
    firstReturnMatchweek = Math.min(...secondLeg.map(m => m.matchweek));
    if (lastFirst >= firstReturnMatchweek) {
      issues.push("Gironi sovrapposti: non si può individuare un confine univoco tra andata e ritorno.");
    }
    // Cross-check dates, not just matchweeks.
    const lastFirstDate = firstLeg.map(m => `${m.date}T${m.time}`).sort().at(-1) ?? "";
    const firstSecondDate = secondLeg.map(m => `${m.date}T${m.time}`).sort()[0] ?? "";
    if (lastFirstDate >= firstSecondDate) issues.push("Le date dei gironi si sovrappongono.");
  }
  const complete = issues.length === 0;
  const firstSecondTime = secondLeg.map(m => `${m.date}T${m.time}`).sort()[0];
  const phase: WithdrawalPhase | null = !complete ? null :
    (input.format === "single_round_robin" || !firstSecondTime || input.nowRome < firstSecondTime)
      ? "first_leg" : "second_leg";
  return { phase, complete, expectedMatches, foundMatches: fixtures.length, firstReturnMatchweek, issues };
}
