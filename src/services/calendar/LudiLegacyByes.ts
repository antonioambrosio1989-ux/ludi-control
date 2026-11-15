/**
 * Overlay SOLO DI LETTURA per la sostituzione di Bristol City con RIPOSO
 * nella Championship 2026/27. Non altera partite, risultati, statistiche,
 * pubblicazioni o documenti Firestore.
 *
 * MW1–MW6: ogni incrocio registrato contro Bristol vale come incrocio storico
 * con RIPOSO soltanto nel tabellone e nella futura rotazione. Le gare reali
 * restano inalterate.
 * MW7–MW8: le coppie già stabilite West Ham e Wolves vengono visualizzate
 * come RIPOSO anche se la giornata salvata contiene altri incontri mancanti.
 */
export const LEGACY_BYE_ID = "__ludi_bye__";

export type LegacyCalendarMatch = {
  id: string;
  seasonId: string;
  matchweek: number;
  matchweekId: string;
  matchType: "regularSeason";
  homeTeamId: string;
  awayTeamId: string;
  date: string;
  time: string;
  venue: string;
  status: "cancelled";
  published: false;
};

type TeamLike = { id: string | number; name: string; aliasName?: string };
type MatchLike = {
  matchweek: number;
  homeTeamId: string | number;
  awayTeamId: string | number;
  status?: string;
};

export function buildLegacyByeOverlay(input: {
  seasonId: string;
  seasonStartYear?: number;
  seasonEndYear?: number;
  competitionName?: string;
  teams: readonly TeamLike[];
  allTeams?: readonly TeamLike[];
  withdrawnTeamIds?: readonly string[];
  matches: readonly MatchLike[];
}): LegacyCalendarMatch[] {
  if (
    input.seasonStartYear !== 2026 ||
    input.seasonEndYear !== 2027 ||
    !/championship/i.test(input.competitionName ?? "") ||
    input.teams.length % 2 !== 1
  ) return [];

  const normalize = (value: string) => value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const active = new Set(input.teams.map((team) => String(team.id)));
  const withdrawn = new Set((input.withdrawnTeamIds ?? []).map(String));
  const findNamed = (names: readonly string[], source: readonly TeamLike[]) =>
    source.find((team) => [team.name, team.aliasName].some((name) =>
      name && names.some((candidate) => normalize(name) === normalize(candidate))));

  // L'overlay è valido solo se Bristol è realmente registrata come ritirata.
  // Mai applicare il recupero a una Championship con squadre omonime.
  const bristol = findNamed(["Bristol City"], input.allTeams ?? input.teams);
  if (!bristol || !withdrawn.has(String(bristol.id))) return [];
  const bristolId = String(bristol.id);

  const byKey = new Map<string, LegacyCalendarMatch>();
  const hasExplicitBye = (teamId: string, week: number) => input.matches.some((match) =>
    match.matchweek === week &&
    String(match.homeTeamId) === teamId &&
    String(match.awayTeamId) === LEGACY_BYE_ID &&
    match.status === "cancelled");
  const hasOtherMatch = (teamId: string, week: number) => input.matches.some((match) =>
    match.matchweek === week && match.status !== "cancelled" &&
    (String(match.homeTeamId) === teamId || String(match.awayTeamId) === teamId));

  function record(teamId: string, week: number) {
    if (!active.has(teamId) || hasExplicitBye(teamId, week)) return;
    const key = `${week}|${teamId}`;
    if (byKey.has(key)) return;
    byKey.set(key, {
      id: `legacy-bye-view-${input.seasonId}-${week}-${teamId}`,
      seasonId: input.seasonId,
      matchweek: week,
      matchweekId: `mw${week}`,
      matchType: "regularSeason",
      homeTeamId: teamId,
      awayTeamId: LEGACY_BYE_ID,
      date: "",
      time: "00:00",
      venue: "RIPOSO storico (virtuale, solo lettura)",
      status: "cancelled",
      published: false,
    });
  }

  // Partite già presenti contro Bristol: il loro punteggio e il loro tabellino
  // rimangono esattamente come sono. Non attribuiamo un +6 retroattivo.
  for (const match of input.matches) {
    if (match.matchweek < 1 || match.matchweek > 6 || match.status === "cancelled") continue;
    const home = String(match.homeTeamId);
    const away = String(match.awayTeamId);
    if (home === bristolId) record(away, match.matchweek);
    if (away === bristolId) record(home, match.matchweek);
  }

  const predetermined = [
    { week: 7, names: ["West Ham", "West Ham United"] },
    { week: 8, names: ["Wolves", "Wolverhampton Wanderers"] },
  ];
  for (const item of predetermined) {
    const team = findNamed(item.names, input.teams);
    if (!team) continue;
    const teamId = String(team.id);
    // Non inventiamo una giornata: deve essere già stata creata.
    if (!input.matches.some((match) => match.matchweek === item.week &&
      match.status !== "cancelled")) continue;
    // Se l'incontro esiste già, il riposo non viene aggiunto.
    if (hasOtherMatch(teamId, item.week)) continue;
    record(teamId, item.week);
  }

  return [...byKey.values()].sort((a, b) =>
    a.matchweek - b.matchweek || a.homeTeamId.localeCompare(b.homeTeamId));
}
