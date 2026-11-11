/**
 * Pure, read-only bridge between a verified 6-0 walkover and the Top Player
 * weekly political vote, plus the candidate reconciliation for imported fixtures.
 * No Firestore access, no mutation of source matches, reports or roster.
 * This is not a production import listener or the Top Player page integration.
 */
import type { ClientWalkover } from './WithdrawalClientMaturedWalkovers';

export type RosterMembership = {
  playerId: string;
  teamId: string;
  /** The season-roster membership must be independently verified for that matchweek. */
  validFromMatchweek: number;
  validUntilMatchweek?: number;
};
export type OfficialWalkover = ClientWalkover & {
  matchweek: number;
  seasonId: string;
  /** Only records from the server-verified matured read model are eligible. */
  verified: true;
};
export type TopPlayerPoliticalAward = {
  matchId: string;
  matchweek: number;
  playerId: string;
  teamId: string;
  points: 7;
  source: 'withdrawal_matured_walkover';
};
export type TopPlayerAwardInput = {
  seasonId: string;
  awards: readonly OfficialWalkover[];
  memberships: readonly RosterMembership[];
  /** IDs verified independently against the authoritative official closure registry. */
  officiallyClosedMatchweeks: readonly number[];
};
const good = (s: unknown): s is string => typeof s === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(s);
const week = (w: unknown): w is number => typeof w === 'number' && Number.isSafeInteger(w) && w >= 1;

/**
 * Generates virtual 7-point records for ALL season-roster players of the winning
 * team valid in that week (including nonparticipants), never goal/assist/vote data.
 * A downstream Top Player total MUST replace the 5-point absent/SV default for
 * (playerId, matchId), never add 7 to it. Repeated computation is idempotent.
 */
export function buildTopPlayerPoliticalAwards(input: TopPlayerAwardInput): TopPlayerPoliticalAward[] {
  if (!good(input.seasonId)) throw new Error('Stagione non valida.');
  const closed = new Set<number>();
  for (const w of input.officiallyClosedMatchweeks) {
    if (!week(w)) throw new Error('Chiusura ufficiale non valida.');
    closed.add(w);
  }
  const membershipByPlayer = new Map<string, RosterMembership[]>();
  for (const m of input.memberships) {
    if (!good(m.playerId) || !good(m.teamId) || !week(m.validFromMatchweek) ||
        (m.validUntilMatchweek !== undefined && (!week(m.validUntilMatchweek) || m.validUntilMatchweek < m.validFromMatchweek))) {
      throw new Error('Appartenenza rosa non verificabile.');
    }
    const values = membershipByPlayer.get(m.playerId) ?? [];
    values.push(m);
    membershipByPlayer.set(m.playerId, values);
  }
  const seenMatches = new Set<string>();
  const result: TopPlayerPoliticalAward[] = [];
  for (const a of input.awards) {
    if (a.verified !== true || a.seasonId !== input.seasonId || !good(a.matchId) ||
        !good(a.homeTeamId) || !good(a.awayTeamId) || a.homeTeamId === a.awayTeamId ||
        !week(a.matchweek) || !closed.has(a.matchweek) || seenMatches.has(a.matchId) ||
        !((a.homeScore === 6 && a.awayScore === 0) || (a.homeScore === 0 && a.awayScore === 6))) {
      throw new Error('Tavolino Top Player non maturato o incoerente.');
    }
    seenMatches.add(a.matchId);
    const winner = a.homeScore === 6 ? a.homeTeamId : a.awayTeamId;
    for (const [playerId, memberships] of membershipByPlayer) {
      const eligible = memberships.filter(m => m.teamId === winner &&
        m.validFromMatchweek <= a.matchweek &&
        (m.validUntilMatchweek === undefined || m.validUntilMatchweek >= a.matchweek));
      // Overlapping same-team memberships are harmless. Multiple simultaneously
      // valid teams must not silently grant political points to transferred players.
      const concurrentTeams = new Set(memberships.filter(m =>
        m.validFromMatchweek <= a.matchweek &&
        (m.validUntilMatchweek === undefined || m.validUntilMatchweek >= a.matchweek))
        .map(m => m.teamId));
      if (concurrentTeams.size > 1) throw new Error(`Appartenenza squadra ambigua per ${playerId}.`);
      if (eligible.length > 0) result.push({matchId:a.matchId,matchweek:a.matchweek,playerId,
        teamId:winner,points:7,source:'withdrawal_matured_walkover'});
    }
  }
  return result.sort((a,b)=>a.matchweek-b.matchweek||a.matchId.localeCompare(b.matchId)||a.playerId.localeCompare(b.playerId));
}

export type PlayerWeeklyPoint = {playerId:string;matchId:string;points:number};
/** Replace existing 5 default for the winning walkover; no double counting. */
export function applyTopPlayerPoliticalAwards(
  base: readonly PlayerWeeklyPoint[],
  additions: readonly TopPlayerPoliticalAward[],
): PlayerWeeklyPoint[] {
  const points = new Map<string, PlayerWeeklyPoint>();
  const key=(p:PlayerWeeklyPoint)=>JSON.stringify([p.playerId,p.matchId]);
  for (const p of base) {
    if (!good(p.playerId)||!good(p.matchId)||!Number.isFinite(p.points)||points.has(key(p)))
      throw new Error('Righe Top Player duplicate o non valide.');
    points.set(key(p),{...p});
  }
  const seen = new Set<string>();
  for (const a of additions) {
    if (!good(a.playerId)||!good(a.matchId)||a.points!==7||a.source!=='withdrawal_matured_walkover'||seen.has(key(a)))
      throw new Error('Attribuzione politica duplicata o alterata.');
    seen.add(key(a));
    const old=points.get(key(a));
    if (old && old.points !== 5 && old.points !== 7) {
      throw new Error('Voto effettivo presente: richiede revisione manuale.');
    }
    points.set(key(a),{playerId:a.playerId,matchId:a.matchId,points:7});
  }
  return [...points.values()].sort((a,b)=>a.playerId.localeCompare(b.playerId)||a.matchId.localeCompare(b.matchId));
}

export type ImportedScheduledFixture = {id:string;seasonId:string;matchweek:number;
  homeTeamId:string|number;awayTeamId:string|number;status:string;matchType?:string};
export type WalkoverFutureRegistration = {matchId:string;matchweek:number;opponentTeamId:string;
  effect:'walkover_pending_official_closure'};
export type ImportedWalkoverPlan = {newEntries:WalkoverFutureRegistration[];
  alreadyRegisteredMatchIds:string[];unrelatedMatchIds:string[];readyToWrite:false};
/**
 * Read-only reconciliation after the calendar import. An administrator service
 * must review and append candidates transactionally; no points awarded here.
 */
export function planFutureWalkoverRegistrations(input:{seasonId:string;withdrawnTeamId:string;
  effectiveMatchweek:number;fixtures:readonly ImportedScheduledFixture[];
  registeredEntries:readonly WalkoverFutureRegistration[]}):ImportedWalkoverPlan {
  if(!good(input.seasonId)||!good(input.withdrawnTeamId)||!week(input.effectiveMatchweek))
    throw new Error('Ritiro non valido.');
  const existing=new Map<string,WalkoverFutureRegistration>();
  for(const e of input.registeredEntries){
    if(!good(e.matchId)||!good(e.opponentTeamId)||!week(e.matchweek)||e.effect!=='walkover_pending_official_closure'||existing.has(e.matchId))
      throw new Error('Registro importazioni incoerente.');
    existing.set(e.matchId,e);
  }
  const seen=new Map<string,string>();
  const newEntries:WalkoverFutureRegistration[]=[];
  const alreadyRegisteredMatchIds:string[]=[];
  const unrelatedMatchIds:string[]=[];
  for(const f of input.fixtures){
    if(!good(f.id)||f.seasonId!==input.seasonId||!week(f.matchweek)||
      !good(String(f.homeTeamId))||!good(String(f.awayTeamId))||String(f.homeTeamId)===String(f.awayTeamId))
      throw new Error('Nuova gara non valida.');
    const signature=JSON.stringify([f.seasonId,f.matchweek,String(f.homeTeamId),String(f.awayTeamId),f.status,f.matchType??'regularSeason']);
    if(seen.has(f.id)){
      if(seen.get(f.id)!==signature) throw new Error('ID gara riutilizzato con dati discordanti.');
      continue;
    }
    seen.set(f.id,signature);
    if((f.matchType??'regularSeason')!=='regularSeason'||
       (String(f.homeTeamId)!==input.withdrawnTeamId&&String(f.awayTeamId)!==input.withdrawnTeamId)){
      unrelatedMatchIds.push(f.id);continue;
    }
    if(f.matchweek<input.effectiveMatchweek||f.status!=='scheduled')
      throw new Error('Gara del ritiro non programmata o precedente: revisione manuale.');
    const opponentTeamId=String(f.homeTeamId)===input.withdrawnTeamId?String(f.awayTeamId):String(f.homeTeamId);
    const expected:WalkoverFutureRegistration={matchId:f.id,matchweek:f.matchweek,
      opponentTeamId,effect:'walkover_pending_official_closure'};
    const old=existing.get(f.id);
    if(old){
      if(JSON.stringify(old)!==JSON.stringify(expected)) throw new Error('Registro futuro discordante.');
      alreadyRegisteredMatchIds.push(f.id);continue;
    }
    newEntries.push(expected);
  }
  newEntries.sort((a,b)=>a.matchweek-b.matchweek||a.matchId.localeCompare(b.matchId));
  return {newEntries,alreadyRegisteredMatchIds:alreadyRegisteredMatchIds.sort(),
    unrelatedMatchIds:unrelatedMatchIds.sort(),readyToWrite:false};
}
