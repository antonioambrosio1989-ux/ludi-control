import { getHistoricalByeCounts } from "./LudiHistoricalByes";

/** Generatore calendario Ludi: ricerca globale degli incroci e degli slot. */
export type CalendarFixture = {
  id: string;
  date: string;
  time: string;
  homeTeamId: string;
  awayTeamId: string;
};

type HistoricalMatch = {
  status: string;
  matchweek: number;
  homeTeamId: string | number;
  awayTeamId: string | number;
  date: string;
  time: string;
};

type Input = {
  teamIds: string[];
  withdrawnTeamIds?: string[];
  matches: readonly HistoricalMatch[];
  availability: Record<string, string[]>;
  weekStart: string;
  targetMatchweek: number;
  salt: number;
};

type Candidate = {
  first: string;
  second: string;
  slotIndex: number;
  preference: number;
  orderKey: number;
};

type Slot = { date: string; time: string; key: string };

export type OptimizedCalendar = CalendarFixture[] & {
  searchTruncated: boolean;
};

export const LUDI_BYE_TEAM_ID = "__ludi_bye__";
const TIMES = ["20:30", "21:30", "22:30"] as const;

function hash(value: string, seed: number): number {
  let state = (2166136261 ^ seed) >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    state ^= value.charCodeAt(index);
    state = Math.imul(state, 16777619) >>> 0;
  }
  return state >>> 0;
}

function addDays(dateText: string, days: number): string {
  const values = dateText.split("-").map(Number);
  const date = new Date(values[0], values[1] - 1, values[2] + days, 12);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function keyForPair(a: string, b: string): string {
  return [a, b].sort().join("|");
}

/**
 * Priorita: 1) piu partite 2) slot preferiti 3) meno giorni
 * 4) concentrazione delle gare. Il salt varia la soluzione a parita di criteri.
 * La ricerca e globale sull'intera settimana, non sui sottoinsiemi di giorni.
 */
export function optimizeLudiSchedule(input: Input): OptimizedCalendar {
  const { availability, weekStart, targetMatchweek, salt } = input;
  const teamIds = Array.from(new Set(input.teamIds.map(String)));
  const matches = input.matches.filter((item) => item.status !== "cancelled");
  const old = matches.filter((item) => item.matchweek < targetMatchweek);
  const blockedPairs = new Set(matches.map((item) => keyForPair(String(item.homeTeamId), String(item.awayTeamId))));
  const usedDateTimes = new Set(matches.map((item) => `${item.date}|${item.time}`));
  const slots: Slot[] = [];
  for (let day = 0; day < 5; day += 1) {
    const date = addDays(weekStart, day);
    for (const time of TIMES) {
      if (!usedDateTimes.has(`${date}|${time}`)) slots.push({ date, time, key: `${day}|${time}` });
    }
  }

  // Contiamo anche le partite CONCLUSE contro squadre successivamente ritirate.
  // Nessuna partita storica viene annullata o riscritta.
  const byes = getHistoricalByeCounts({
    matches: input.matches,
    activeTeamIds: teamIds,
    withdrawnTeamIds: input.withdrawnTeamIds ?? [],
    beforeMatchweek: targetMatchweek,
  });
  const leastByes = Math.min(...byes.values());
  const eligibleByeTeams = teamIds.filter((team) => byes.get(team) === leastByes);

  const available = new Map<string, Set<string>>();
  const preferred = new Map<string, Set<string>>();
  for (const team of teamIds) {
    const raw = availability[team] ?? [];
    available.set(team, new Set(raw.map((key) => key.startsWith("preferred:") ? key.slice(10) : key)));
    preferred.set(team, new Set(raw.filter((key) => key.startsWith("preferred:")).map((key) => key.slice(10))));
  }

  const options = new Map(teamIds.map((team) => [team, [] as Candidate[]]));
  for (let firstIndex = 0; firstIndex < teamIds.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < teamIds.length; secondIndex += 1) {
      const first = teamIds[firstIndex];
      const second = teamIds[secondIndex];
      if (blockedPairs.has(keyForPair(first, second))) continue;
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        const key = slots[slotIndex].key;
        if (!available.get(first)?.has(key) || !available.get(second)?.has(key)) continue;
        const preference = Number(preferred.get(first)?.has(key)) + Number(preferred.get(second)?.has(key));
        const candidate = {
          first, second, slotIndex, preference,
          orderKey: hash(`${keyForPair(first, second)}|${key}`, salt),
        };
        options.get(first)!.push(candidate);
        options.get(second)!.push(candidate);
      }
    }
  }
  for (const choices of options.values()) {
    choices.sort((a, b) => b.preference - a.preference || a.orderKey - b.orderKey);
  }

  // Determina casa/trasferta dall'ultima giornata in cui entrambi hanno giocato;
  // in assenza di precedente usa un criterio stabile per la rigenerazione.
  const previousWeeks = [...new Set(old.map((match) => match.matchweek))].sort((a, b) => b - a);
  function homeTeam(a: string, b: string): string {
    for (const week of previousWeeks) {
      const first = old.find((item) => item.matchweek === week && [String(item.homeTeamId), String(item.awayTeamId)].includes(a));
      const second = old.find((item) => item.matchweek === week && [String(item.homeTeamId), String(item.awayTeamId)].includes(b));
      if (!first || !second) continue;
      const aHome = String(first.homeTeamId) === a;
      const bHome = String(second.homeTeamId) === b;
      if (aHome !== bHome) return aHome ? b : a;
    }
    return hash(`${a}|${b}|${targetMatchweek}`, salt) % 2 === 0 ? a : b;
  }

  // LUDI_GLOBAL_SOLVER_V15: prima accoppia squadre, poi trova l'assegnazione
  // degli slot con un matching bipartito. Le permutazioni di orari non
  // consumano il budget della ricerca degli incroci.
  const target = Math.floor(teamIds.length / 2);
  const MAX_PAIR_NODES = 500_000;
  let visited = 0;
  let searchTruncated = false;
  let winner: Candidate[] = [];
  let winnerScore = -1;
  let winnerTie = Number.POSITIVE_INFINITY;

  type PairChoice = { a: string; b: string; choices: Candidate[] };
  const pairChoices = new Map<string, PairChoice>();
  const partnerChoices = new Map(teamIds.map(team => [team, [] as PairChoice[]]));
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const a = teamIds[i], b = teamIds[j];
      const candidates = (options.get(a) ?? []).filter(c =>
        (c.first === a && c.second === b) || (c.first === b && c.second === a));
      if (candidates.length === 0) continue;
      const pair = { a, b, choices: candidates };
      pairChoices.set(keyForPair(a, b), pair);
      partnerChoices.get(a)!.push(pair);
      partnerChoices.get(b)!.push(pair);
    }
  }

  // Verifica se gli incroci scelti possono essere collocati in slot distinti.
  // L'algoritmo di cammini aumentanti può riassegnare gli orari delle partite
  // già scelte, anziché congelarli al primo posto disponibile.
  function assignSlots(pairs: PairChoice[]): Candidate[] | null {
    const ownerBySlot = new Map<number, number>();
    const candidateByPair: Array<Candidate | undefined> = new Array(pairs.length);
    const order = pairs.map((_, index) => index)
      .sort((a, b) => pairs[a].choices.length - pairs[b].choices.length);

    function augment(pairIndex: number, seen: Set<number>): boolean {
      for (const candidate of pairs[pairIndex].choices) {
        if (seen.has(candidate.slotIndex)) continue;
        seen.add(candidate.slotIndex);
        const previous = ownerBySlot.get(candidate.slotIndex);
        if (previous === undefined || augment(previous, seen)) {
          ownerBySlot.set(candidate.slotIndex, pairIndex);
          candidateByPair[pairIndex] = candidate;
          return true;
        }
      }
      return false;
    }
    for (const index of order) {
      if (!augment(index, new Set<number>())) return null;
    }
    return candidateByPair.every(Boolean) ? candidateByPair as Candidate[] : null;
  }

  function remember(assigned: Candidate[]) {
    const score = assigned.reduce((total, c) => total + c.preference, 0);
    const signature = assigned.map(c => `${c.first}|${c.second}|${c.slotIndex}`).sort().join('#');
    const tie = hash(signature, salt);
    if (assigned.length > winner.length ||
      (assigned.length === winner.length &&
        (score > winnerScore || (score === winnerScore && tie < winnerTie)))) {
      winner = assigned.slice();
      winnerScore = score;
      winnerTie = tie;
    }
  }

  function search(remaining: string[], selected: PairChoice[], allowSkip: boolean): boolean {
    visited++;
    if (visited > MAX_PAIR_NODES) {
      searchTruncated = true;
      return false;
    }
    const assigned = assignSlots(selected);
    if (assigned === null) return false;
    remember(assigned);
    if (selected.length === target) return true;
    if (remaining.length < 2 ||
        selected.length + Math.floor(remaining.length / 2) < winner.length) return false;

    const remainingSet = new Set(remaining);
    let chosen = remaining[0];
    let chosenPairs: PairChoice[] = [];
    let minimumPartners = Number.POSITIVE_INFINITY;
    for (const team of remaining) {
      const valid = (partnerChoices.get(team) ?? []).filter(pair =>
        remainingSet.has(pair.a) && remainingSet.has(pair.b));
      if (valid.length < minimumPartners) {
        chosen = team;
        chosenPairs = valid;
        minimumPartners = valid.length;
      }
    }
    chosenPairs.sort((a, b) =>
      a.choices.length - b.choices.length ||
      hash(`${a.a}|${a.b}`, salt) - hash(`${b.a}|${b.b}`, salt));
    for (const pair of chosenPairs) {
      const partner = pair.a === chosen ? pair.b : pair.a;
      selected.push(pair);
      if (search(remaining.filter(t => t !== chosen && t !== partner), selected, allowSkip)) return true;
      selected.pop();
      if (searchTruncated) return false;
    }
    if (allowSkip && !searchTruncated &&
      selected.length + Math.floor((remaining.length - 1) / 2) >= winner.length) {
      if (search(remaining.filter(t => t !== chosen), selected, true)) return true;
    }
    return false;
  }

  if (target > 0) {
    if (teamIds.length % 2 === 1) {
      for (const bye of eligibleByeTeams.slice().sort((a,b) => hash(a,salt) - hash(b,salt))) {
        if (searchTruncated || winner.length === target) break;
        search(teamIds.filter(t => t !== bye), [], false);
      }
    } else {
      search(teamIds, [], false);
    }
    if (winner.length < target && !searchTruncated) {
      search(teamIds, [], true);
    }
  }
  const output = winner.map((item, index) => {
    const slot = slots[item.slotIndex];
    const home = homeTeam(item.first, item.second);
    return {
      id: `generated-${item.first}-${item.second}-${slot.date}-${slot.time}-${index}`,
      date: slot.date,
      time: slot.time,
      homeTeamId: home,
      awayTeamId: home === item.first ? item.second : item.first,
    };
  }).sort((a, b) => `${a.date}|${a.time}`.localeCompare(`${b.date}|${b.time}`));
  // A giornata completa e numero dispari, esplicitiamo il riposo nel calendario.
  // Una gara fittizia non prenota nessun giorno/orario del centro sportivo.
  if (teamIds.length % 2 === 1 && winner.length === target) {
    const participants = new Set(output.flatMap((match) => [match.homeTeamId, match.awayTeamId]));
    const idle = teamIds.filter((team) => !participants.has(team));
    if (idle.length === 1 && eligibleByeTeams.includes(idle[0])) {
      output.push({
        id: `generated-bye-${targetMatchweek}-${idle[0]}`,
        date: weekStart,
        time: "00:00",
        homeTeamId: idle[0],
        awayTeamId: LUDI_BYE_TEAM_ID,
      });
    }
  }
  return Object.assign(output, { searchTruncated });
}
