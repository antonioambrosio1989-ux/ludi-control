/**
 * 10E: conservative transactional yellow-card reconciliation.
 * No invented disciplinary history: accept only closed histories represented
 * exclusively by voided published reports, without any existing suspension.
 * The caller MUST check suspensions separately within the same transaction.
 */
export type YellowChange = {
  id: string;
  before: { seasonYellowCards:number; currentYellowCycle:number; processedSourceMatchIds:string[] };
  after: { seasonYellowCards:number; currentYellowCycle:number; processedSourceMatchIds:string[] };
};
type Report = {matchId:string;status?:unknown;data?:unknown};
type RecordEntry = {id:string;data:Record<string,unknown>};
const id=(x:unknown)=>typeof x==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(x);
const count=(x:unknown)=>x===undefined||x===null?0:typeof x==='number' && Number.isSafeInteger(x) && x>=0?x:NaN;
export function calculateSafeYellowReconciliation(input:{
  seasonId:string; affectedMatchIds:string[]; affectedReports:Report[]; records:RecordEntry[];
}):YellowChange[]{
  const ids=new Set(input.affectedMatchIds);
  const yellows=new Map<string,number>();
  const sources=new Map<string,Set<string>>();
  for(const report of input.affectedReports){
    if(report.status!=='published')continue;
    if(!ids.has(report.matchId))throw new Error('Report fuori dal registro annullamenti.');
    const payload=report.data as Record<string,unknown>|undefined;
    const performances=payload?.performances;
    if(performances!==undefined && (performances===null||typeof performances!=='object'||Array.isArray(performances)))
      throw new Error('Prestazioni non leggibili.');
    for(const perf of Object.values((performances??{}) as Record<string,unknown>)){
      if(!perf||typeof perf!=='object'||Array.isArray(perf))throw new Error('Prestazione non leggibile.');
      const p=perf as Record<string,unknown>;
      if(!id(p.playerId))throw new Error('Giocatore non valido.');
      const playerId=p.playerId as string;
      const yellow=count(p.yellowCards),red=count(p.directRedCards),statRed=count(p.redCards);
      if([yellow,red,statRed].some(n=>!Number.isFinite(n)))throw new Error('Cartellini non validi.');
      if(red||statRed)throw new Error('Cartellini: espulsione richiede replay disciplinare completo.');
      if(yellow){
        const set=sources.get(playerId)??new Set<string>();
        // One performance per player/match required; no ambiguous duplicates.
        if(set.has(report.matchId))throw new Error('Prestazioni duplicate per giocatore.');
        set.add(report.matchId);sources.set(playerId,set);
        yellows.set(playerId,(yellows.get(playerId)??0)+yellow);
      }
    }
  }
  const byPlayer=new Map<string,RecordEntry>();
  for(const record of input.records){
    const player=record.data.playerId;
    if(!id(player)||!id(record.id)||record.data.seasonId!==input.seasonId||byPlayer.has(player as string))
      throw new Error('Registro disciplinare incoerente.');
    byPlayer.set(player as string,record);
  }
  // A record not matching the excluded games could depend on an earlier cycle,
  // legacy serving state or transfers. Refuse instead of guessing.
  if(byPlayer.size!==yellows.size)throw new Error('Riconciliazione disciplinare necessaria: record non riconciliabili automaticamente.');
  const changes:YellowChange[]=[];
  for(const [playerId,amount] of yellows){
    const record=byPlayer.get(playerId);
    if(!record)throw new Error('Cartellini in gara annullata: record disciplinare mancante.');
    const d=record.data;
    const beforeIds=d.processedSourceMatchIds;
    const expected=sources.get(playerId)!;
    if(!Array.isArray(beforeIds)||beforeIds.length!==expected.size||beforeIds.some(x=>!id(x)||!expected.has(x))||
       (typeof d.seasonYellowCards!=='number'||!Number.isSafeInteger(d.seasonYellowCards))||d.seasonYellowCards!==amount||
       (typeof d.currentYellowCycle!=='number'||!Number.isSafeInteger(d.currentYellowCycle))||d.currentYellowCycle!==amount||amount>=5||
       d.directRedCards!==0||!Array.isArray(d.activeSuspensionIds)||d.activeSuspensionIds.length!==0)
      throw new Error('Storico del giocatore non completamente riconciliabile.');
    changes.push({id:record.id,
      before:{seasonYellowCards:amount,currentYellowCycle:amount,processedSourceMatchIds:[...beforeIds]},
      after:{seasonYellowCards:0,currentYellowCycle:0,processedSourceMatchIds:[]}});
  }
  return changes.sort((a,b)=>a.id.localeCompare(b.id));
}
