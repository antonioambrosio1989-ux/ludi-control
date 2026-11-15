/** Riposi storici: soltanto lettura, nessuna modifica ai risultati preesistenti. */
export const LUDI_HISTORICAL_BYE_TEAM_ID = "__ludi_bye__";

export type HistoricByeMatch = {
  id?: string | number;
  matchweek: number;
  status: string;
  homeTeamId: string | number;
  awayTeamId: string | number;
  date?: string;
  time?: string;
};

export type LegacyBye = { teamId: string; matchweek: number; sourceMatchId?: string | number };

/**
 * Un incontro realmente concluso contro una squadra oggi ritirata vale come
 * turno di riposo già scontato SOLO per la rotazione futura (mai per punti/voti).
 * Anche un RIPOSO esplicito ed un riposo dedotto vengono contati al massimo una
 * volta per squadra e per giornata.
 */
export function getHistoricalByeHistory(input: {
  matches: readonly HistoricByeMatch[];
  activeTeamIds: readonly string[];
  withdrawnTeamIds: readonly string[];
  beforeMatchweek: number;
}): LegacyBye[] {
  const active = new Set(input.activeTeamIds.map(String));
  const withdrawn = new Set(input.withdrawnTeamIds.map(String).filter((id) => !active.has(id)));
  const prior = input.matches.filter((match) => Number.isInteger(match.matchweek) &&
    match.matchweek > 0 && match.matchweek < input.beforeMatchweek);
  const byKey = new Map<string, LegacyBye>();
  function add(team: string, week: number, sourceMatchId?: string | number) {
    if (!active.has(team)) return;
    const key = `${week}|${team}`;
    if (!byKey.has(key)) byKey.set(key, { teamId: team, matchweek: week, sourceMatchId });
  }
  const explicitlyCompleted = new Set<number>();
  for (const match of prior) {
    const home = String(match.homeTeamId), away = String(match.awayTeamId);
    if (match.status === "cancelled" && away === LUDI_HISTORICAL_BYE_TEAM_ID) {
      add(home, match.matchweek, match.id);
      explicitlyCompleted.add(match.matchweek);
    } else if (["played", "finished", "walkover"].includes(match.status)) {
      // Non riconvertiamo mai la partita: usiamo soltanto l'incontro per
      // contrassegnare RIPOSO sul tabellone della stagione attuale.
      if (withdrawn.has(home)) add(away, match.matchweek, match.id);
      if (withdrawn.has(away)) add(home, match.matchweek, match.id);
    }
  }
  // Compatibilita con le giornate precedenti alla introduzione di RIPOSO.
  // Solo una giornata completa con tutte le attuali squadre tranne una
  // consente di dedurre in modo certo un riposo non esplicitato.
  if (active.size % 2 === 1) {
    const byWeek = new Map<number, HistoricByeMatch[]>();
    for (const match of prior) {
      if (match.status === "cancelled" || explicitlyCompleted.has(match.matchweek)) continue;
      const list = byWeek.get(match.matchweek) ?? [];
      list.push(match);
      byWeek.set(match.matchweek, list);
    }
    for (const [week, matches] of byWeek) {
      const participants = matches.flatMap((m) => [String(m.homeTeamId), String(m.awayTeamId)]);
      if (matches.length !== Math.floor(active.size / 2) ||
          new Set(participants).size !== participants.length ||
          participants.some((team) => !active.has(team))) continue;
      const absent = [...active].filter((team) => !participants.includes(team));
      if (absent.length === 1) add(absent[0], week);
    }
  }
  return [...byKey.values()].sort((a,b) => a.matchweek - b.matchweek || a.teamId.localeCompare(b.teamId));
}

export function getHistoricalByeCounts(input: Parameters<typeof getHistoricalByeHistory>[0]): Map<string, number> {
  const counts = new Map(input.activeTeamIds.map((id) => [String(id), 0]));
  for (const bye of getHistoricalByeHistory(input)) {
    counts.set(bye.teamId, (counts.get(bye.teamId) ?? 0) + 1);
  }
  return counts;
}
