/** 10F: unserved automatic direct-red suspension from voided fixture only.
 * Deliberately refuses multi-match histories, served suspensions and manual sanctions.
 */
export type DisciplinePatch = {
  id: string;
  before: { seasonYellowCards:number; currentYellowCycle:number; directRedCards:number; processedSourceMatchIds:string[]; activeSuspensionIds:string[] };
  after: { seasonYellowCards:number; currentYellowCycle:number; directRedCards:number; processedSourceMatchIds:string[]; activeSuspensionIds:string[] };
};
export type SuspensionPatch = {
  id:string;
  before: {status:'active'; servedMatches:number; remainingMatches:number; servedMatchIds:string[]; servedMatchweeks:number[]};
  after: {status:'cancelled'; servedMatches:number; remainingMatches:number; servedMatchIds:string[]; servedMatchweeks:number[]};
};
const cleanId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(v);
const integer=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
export function reconcileUnservedDirectReds(input:{
 seasonId:string;
 affectedMatchIds:string[];
 affectedReports:Array<{matchId:string;status?:unknown;data?:unknown}>;
 records:Array<{id:string;data:Record<string,unknown>}>;
 suspensions:Array<{id:string;data:Record<string,unknown>}>;
}):{records:DisciplinePatch[];suspensions:SuspensionPatch[]}{
 const excluded=new Set(input.affectedMatchIds);
 const directRedEvents=new Map<string,{matchId:string; count:number}>();
 for(const report of input.affectedReports){
  if(report.status!=='published') continue;
  if(!excluded.has(report.matchId))throw new Error('Report non compreso nel ritiro.');
  const data=report.data as Record<string,unknown>|undefined;
  const performances=data?.performances;
  if(!performances||typeof performances!=='object'||Array.isArray(performances))throw new Error('Prestazioni mancanti o illeggibili.');
  for(const value of Object.values(performances)){
   if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Prestazione illeggibile.');
   const perf=value as Record<string,unknown>;
   if(!cleanId(perf.playerId))throw new Error('Giocatore illeggibile.');
   const yellow=perf.yellowCards??0, red=perf.directRedCards??0,statRed=perf.redCards??0;
   if(!integer(yellow)||!integer(red)||!integer(statRed))throw new Error('Cartellini illeggibili.');
   if(yellow||statRed)throw new Error('Riconciliazione completa necessaria: eventi misti.');
   if(red){
    if(red!==1||directRedEvents.has(perf.playerId))throw new Error('Rossi multipli: replay cronologico necessario.');
    directRedEvents.set(perf.playerId,{matchId:report.matchId,count:red});
   }
  }
 }
 if(directRedEvents.size===0)throw new Error('Nessuna espulsione diretta riconciliabile.');
 if(input.records.length!==directRedEvents.size||input.suspensions.length!==directRedEvents.size)
   throw new Error('Storico disciplinare aggiuntivo: replay completo necessario.');
 const recordByPlayer=new Map<string,{id:string;data:Record<string,unknown>}>();
 for(const item of input.records){
  if(!cleanId(item.id)||!cleanId(item.data.playerId)||item.data.seasonId!==input.seasonId||recordByPlayer.has(item.data.playerId))throw new Error('Record disciplinare incoerente.');
  recordByPlayer.set(item.data.playerId,item);
 }
 const suspensionByPlayer=new Map<string,{id:string;data:Record<string,unknown>}>();
 for(const item of input.suspensions){
  if(!cleanId(item.id)||!cleanId(item.data.playerId)||item.data.seasonId!==input.seasonId||suspensionByPlayer.has(item.data.playerId))throw new Error('Squalifica incoerente.');
  suspensionByPlayer.set(item.data.playerId,item);
 }
 const records:DisciplinePatch[]=[],suspensions:SuspensionPatch[]=[];
 for(const [playerId,event] of directRedEvents){
  const r=recordByPlayer.get(playerId),s=suspensionByPlayer.get(playerId);
  if(!r||!s)throw new Error('Record o squalifica per rosso mancanti.');
  const rd=r.data,sd=s.data;
  if(rd.seasonYellowCards!==0||rd.currentYellowCycle!==0||rd.directRedCards!==1||
    !Array.isArray(rd.processedSourceMatchIds)||rd.processedSourceMatchIds.length!==1||rd.processedSourceMatchIds[0]!==event.matchId||
    !Array.isArray(rd.activeSuspensionIds)||rd.activeSuspensionIds.length!==1||rd.activeSuspensionIds[0]!==s.id)
    throw new Error('Record con storico non ricostruibile.');
  if(sd.reason!=='directRed'||sd.status!=='active'||sd.sourceMatchId!==event.matchId||
    sd.totalMatches!==1||sd.servedMatches!==0||sd.remainingMatches!==1||
    (sd.servedMatchIds!==undefined&&(!Array.isArray(sd.servedMatchIds)||sd.servedMatchIds.length!==0))||
    (sd.servedMatchweeks!==undefined&&(!Array.isArray(sd.servedMatchweeks)||sd.servedMatchweeks.length!==0)))
    throw new Error('Squalifica già scontata o modificata: replay completo necessario.');
  records.push({id:r.id,before:{seasonYellowCards:0,currentYellowCycle:0,directRedCards:1,processedSourceMatchIds:[event.matchId],activeSuspensionIds:[s.id]},after:{seasonYellowCards:0,currentYellowCycle:0,directRedCards:0,processedSourceMatchIds:[],activeSuspensionIds:[]}});
  suspensions.push({id:s.id,before:{status:'active',servedMatches:0,remainingMatches:1,servedMatchIds:[],servedMatchweeks:[]},after:{status:'cancelled',servedMatches:0,remainingMatches:1,servedMatchIds:[],servedMatchweeks:[]}});
 }
 return{records:records.sort((a,b)=>a.id.localeCompare(b.id)),suspensions:suspensions.sort((a,b)=>a.id.localeCompare(b.id))};
}
