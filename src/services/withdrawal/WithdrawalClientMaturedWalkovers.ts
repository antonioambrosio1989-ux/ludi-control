/** Client-side integrity gate for server-verified virtual 6-0 results.
 * A response is not an authorization to alter Firestore, and never changes the source inputs.
 */
export type ClientWalkover = {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
};
type MatchLike = {
  id: string;
  homeTeamId: string | number;
  awayTeamId: string | number;
  status: string;
  homeScore?: number;
  awayScore?: number;
};
type ReportLike = { matchId: string | number; status?: string };
const validId = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,128}$/.test(value);
export function parseClientWalkovers(value: unknown, seasonId: string): ClientWalkover[] {
  if (!value || typeof value !== 'object') throw new Error('Registro tavolini non disponibile.');
  const data = value as Record<string, unknown>;
  if (data.verified !== true || data.seasonId !== seasonId || !Array.isArray(data.maturedWalkovers)) {
    throw new Error('Registro tavolini non verificato.');
  }
  const seen = new Set<string>();
  return data.maturedWalkovers.map(raw => {
    if (!raw || typeof raw !== 'object') throw new Error('Tavolino non valido.');
    const v = raw as Record<string, unknown>;
    if (!validId(v.matchId) || !validId(v.homeTeamId) || !validId(v.awayTeamId) ||
        v.homeTeamId === v.awayTeamId || seen.has(v.matchId) ||
        !((v.homeScore === 6 && v.awayScore === 0) || (v.homeScore === 0 && v.awayScore === 6))) {
      throw new Error('Tavolino duplicato o incoerente.');
    }
    seen.add(v.matchId);
    return {
      matchId: v.matchId,
      homeTeamId: v.homeTeamId,
      awayTeamId: v.awayTeamId,
      homeScore: v.homeScore as number,
      awayScore: v.awayScore as number,
    };
  });
}
export function applyClientWalkovers<M extends MatchLike, R extends ReportLike>(input: {
  matches: readonly M[];
  reports: readonly R[];
  walkovers: readonly ClientWalkover[];
}): M[] {
  const result = new Map<string, M>();
  for (const m of input.matches) {
    const id = String(m.id);
    if (result.has(id)) throw new Error('Partite duplicate nel client.');
    result.set(id, m);
  }
  const reportIds = new Set(input.reports.map(r => String(r.matchId)));
  const ids = new Set<string>();
  for (const w of input.walkovers) {
    if (ids.has(w.matchId)) throw new Error('Tavolino duplicato.');
    ids.add(w.matchId);
    const m = result.get(w.matchId);
    // A fixture not downloaded yet must not create a synthetic match in the client.
    if (!m) continue;
    if (String(m.homeTeamId) !== w.homeTeamId || String(m.awayTeamId) !== w.awayTeamId ||
        m.status !== 'scheduled' || reportIds.has(w.matchId) ||
        m.homeScore !== undefined || m.awayScore !== undefined) {
      throw new Error('Tavolino incompatibile con la partita locale.');
    }
    result.set(w.matchId, { ...m, status: 'finished', homeScore: w.homeScore, awayScore: w.awayScore });
  }
  return input.matches.map(m => result.get(String(m.id))!);
}
