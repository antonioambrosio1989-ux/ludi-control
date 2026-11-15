// Selezione deterministica di tutte le partite pubblicate nella settimana di riferimento.
// Le giornate numeriche dei diversi campionati possono essere sfalsate.
export type WeeklyFixture = {
  id: string;
  seasonId: string;
  date: string;
  time: string;
  published: boolean;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
};

export function selectAllWeeklyFixtures<T extends WeeklyFixture>({
  matches,
  activeSeasonIds,
  anchorMatches,
}: {
  matches: readonly T[];
  activeSeasonIds: readonly string[];
  anchorMatches: readonly T[];
}): T[] {
  if (!anchorMatches.length) return [];
  const reference = anchorMatches.map((match) => match.date).sort()[0];
  const monday = new Date(`${reference}T12:00:00Z`);
  if (Number.isNaN(monday.getTime())) return [];
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const start = monday.toISOString().slice(0, 10);
  monday.setUTCDate(monday.getUTCDate() + 7);
  const end = monday.toISOString().slice(0, 10);
  const active = new Set(activeSeasonIds);
  const unique = new Map<string, T>();
  for (const match of matches) {
    if (!active.has(match.seasonId) || !match.published || match.status === "cancelled" ||
      match.homeTeamId === "__ludi_bye__" || match.awayTeamId === "__ludi_bye__" ||
      match.date < start || match.date >= end) continue;
    unique.set(match.id, match);
  }
  return [...unique.values()].sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) || a.id.localeCompare(b.id));
}
