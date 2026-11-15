/** Suggerimenti visuali: non sono partite salvabili, non modificano il calendario. */
import { getHistoricalByeCounts } from "./LudiHistoricalByes";
import { LUDI_BYE_TEAM_ID } from "./LudiScheduleOptimizer";

type MatchLike = {
  matchweek: number;
  status: string;
  homeTeamId: string | number;
  awayTeamId: string | number;
  date: string;
  time: string;
};
type DraftLike = { homeTeamId: string; awayTeamId: string; date: string; time: string };
export type MissingFixture = {
  homeTeamId: string;
  awayTeamId: string;
  commonSlots: number;
  isBye: boolean;
};
export type MissingFixturePlan = {
  fixtures: MissingFixture[];
  unresolvedTeamIds: string[];
  complete: boolean;
  byeNotAvailable: boolean;
};

function pairKey(first: string, second: string): string {
  return [first, second].sort().join("|");
}
function normalizedSlots(raw: string[]): Set<string> {
  return new Set(raw.map((value) => value.startsWith("preferred:") ? value.slice("preferred:".length) : value));
}

/**
 * Migliore completamento teorico degli abbinamenti esclusi dalla bozza.
 * NON tenta di inserire queste partite negli slot, che restano da concordare.
 */
export function suggestMissingFixtures(input: {
  activeTeamIds: string[];
  withdrawnTeamIds: string[];
  matches: readonly MatchLike[];
  generated: readonly DraftLike[];
  availability: Record<string, string[]>;
  weekStart: string;
  targetMatchweek: number;
}): MissingFixturePlan {
  const activeTeamIds = [...new Set(input.activeTeamIds.map(String))];
  const activeSet = new Set(activeTeamIds);
  const scheduled = new Set(input.generated.flatMap((m) => [m.homeTeamId, m.awayTeamId]));
  const remaining = activeTeamIds.filter((team) => !scheduled.has(team));
  if (remaining.length === 0) return { fixtures: [], unresolvedTeamIds: [], complete: true, byeNotAvailable: false };

  const playedPairs = new Set(input.matches.filter((m) => m.status !== "cancelled")
    .map((m) => pairKey(String(m.homeTeamId), String(m.awayTeamId))));
  const reserved = new Set(input.generated.filter((m) => m.awayTeamId !== LUDI_BYE_TEAM_ID)
    .map((m) => `${m.date}|${m.time}`));
  const historicalByes = getHistoricalByeCounts({
    matches: input.matches,
    activeTeamIds,
    withdrawnTeamIds: input.withdrawnTeamIds,
    beforeMatchweek: input.targetMatchweek,
  });
  const minimumByes = Math.min(...[...historicalByes.values()]);
  const canBye = (team: string) => activeSet.has(team) && historicalByes.get(team) === minimumByes &&
    !input.generated.some((m) => m.awayTeamId === LUDI_BYE_TEAM_ID);
  const slots = new Map(remaining.map((team) => [team, normalizedSlots(input.availability[team] ?? [])]));
  const intersections = new Map<string, number>();
  for (let i = 0; i < remaining.length; i++) {
    for (let j = i + 1; j < remaining.length; j++) {
      const a = remaining[i], b = remaining[j];
      let count = 0;
      for (const slot of slots.get(a) ?? []) {
        if (!(slots.get(b)?.has(slot))) continue;
        const [index, time] = slot.split("|");
        const [y, m, d] = input.weekStart.split("-").map(Number);
        const date = new Date(y, m - 1, d + Number(index), 12);
        const calendarDate = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
        if (!reserved.has(`${calendarDate}|${time}`)) count++;
      }
      intersections.set(pairKey(a,b), count);
    }
  }

  // Nei casi comuni (fino a 14 squadre escluse), ricerca tutti gli incroci possibili;
  // obiettivo primario: accoppiare piu squadre, poi massimizzare slot comuni.
  type Result = { fixtures: MissingFixture[]; unresolved: string[]; score: number };
  let best: Result = { fixtures: [], unresolved: remaining, score: -1 };
  let visited = 0;
  const limit = 120000;
  function visit(unused: string[], fixtures: MissingFixture[], unresolved: string[], score: number): void {
    if (++visited > limit) return;
    if (unused.length === 0) {
      const count = fixtures.filter((f) => !f.isBye).length;
      const bestCount = best.fixtures.filter((f) => !f.isBye).length;
      const useful = fixtures.filter((f) => f.isBye).length;
      const bestUseful = best.fixtures.filter((f) => f.isBye).length;
      if (count > bestCount || (count === bestCount && useful > bestUseful) ||
        (count === bestCount && useful === bestUseful && unresolved.length < best.unresolved.length) ||
        (count === bestCount && useful === bestUseful && unresolved.length === best.unresolved.length && score > best.score)) {
        best = { fixtures: [...fixtures], unresolved: [...unresolved], score };
      }
      return;
    }
    const first = unused[0];
    const rest = unused.slice(1);
    for (let index = 0; index < rest.length; index++) {
      const second = rest[index];
      if (playedPairs.has(pairKey(first, second))) continue;
      const commonSlots = intersections.get(pairKey(first, second)) ?? 0;
      fixtures.push({ homeTeamId: first, awayTeamId: second, commonSlots, isBye: false });
      visit(rest.filter((_, i) => i !== index), fixtures, unresolved, score + commonSlots);
      fixtures.pop();
    }
    if (activeTeamIds.length % 2 === 1 && canBye(first) && !fixtures.some((f) => f.isBye)) {
      fixtures.push({ homeTeamId: first, awayTeamId: LUDI_BYE_TEAM_ID, commonSlots: 0, isBye: true });
      visit(rest, fixtures, unresolved, score);
      fixtures.pop();
    }
    visit(rest, fixtures, [...unresolved, first], score);
  }
  visit(remaining, [], [], 0);
  return {
    fixtures: best.fixtures,
    unresolvedTeamIds: best.unresolved,
    complete: best.unresolved.length === 0,
    byeNotAvailable: activeTeamIds.length % 2 === 1 && remaining.length % 2 === 1 &&
      !remaining.some(canBye),
  };
}
