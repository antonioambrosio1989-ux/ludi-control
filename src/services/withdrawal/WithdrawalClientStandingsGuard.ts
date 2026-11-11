import type { OfficialMatchReference, OfficialReportReference } from './WithdrawalOfficialReadFilter';

/** Public-safe projection from a fully validated server snapshot. No Firebase writes. */
export function guardWithdrawalStandings<M extends OfficialMatchReference, R extends OfficialReportReference>(input: {
  seasonId: string;
  matches: readonly M[];
  reports: readonly R[];
  cancelledTeamIds: readonly string[];
}): { matches: M[]; reports: R[]; excludedMatchIds: string[] } {
  const seasonId = input.seasonId.trim();
  if (!seasonId) throw new Error('Stagione mancante.');
  const cancelled = new Set<string>();
  for (const value of input.cancelledTeamIds) {
    if (typeof value !== 'string' || !value.trim() || cancelled.has(value.trim())) {
      throw new Error('Registro ritiri client non valido.');
    }
    cancelled.add(value.trim());
  }
  const excluded = new Set<string>();
  const seen = new Set<string>();
  const matches: M[] = [];
  for (const match of input.matches) {
    if (String(match.seasonId) !== seasonId) throw new Error('Partita di un’altra stagione.');
    const id = String(match.id).trim();
    if (!id || seen.has(id)) throw new Error('ID partita mancante o duplicato.');
    seen.add(id);
    if ((match.matchType ?? 'regularSeason') === 'regularSeason' &&
      (cancelled.has(String(match.homeTeamId)) || cancelled.has(String(match.awayTeamId)))) {
      excluded.add(id);
    } else matches.push(match);
  }
  return {
    matches,
    reports: input.reports.filter(report => !excluded.has(String(report.matchId))),
    excludedMatchIds: [...excluded].sort(),
  };
}

/** Reject malformed/unvalidated responses before they enter any calculator. */
export function parseWithdrawalStateResponse(value: unknown, seasonId: string): string[] {
  if (!value || typeof value !== 'object') throw new Error('Risposta registro ritiri mancante.');
  const obj = value as Record<string, unknown>;
  if (obj.seasonId !== seasonId || !Array.isArray(obj.cancelledTeamIds) || obj.verified !== true) {
    throw new Error('Registro ritiri non verificato.');
  }
  const ids = obj.cancelledTeamIds;
  if (!ids.every(id => typeof id === 'string' && /^[\w-]{1,128}$/.test(id)) ||
      new Set(ids).size !== ids.length) throw new Error('Squadre ritirate non valide.');
  return ids as string[];
}
