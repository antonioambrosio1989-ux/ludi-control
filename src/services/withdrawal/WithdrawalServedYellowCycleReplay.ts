/** 10H - One closed, chronological five-yellow cycle, with one served match.
 * Emulator-only activation. Refuse all additional automatic or manual sanctions.
 * No report or match is edited; every changed field is captured for reversal.
 */
import type { DisciplinePatch } from './WithdrawalDirectRedReconciliation';
import type { ServedSuspensionPatch } from './WithdrawalServedDirectRedReconciliation';

type Document = {id:string;data:Record<string,unknown>};
const str=(v:unknown)=>String(v??'').trim();
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const card=(v:unknown)=>v===undefined||v===null?0:typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:NaN;
function performances(report:Document):Record<string,unknown>[] {
 const body=report.data.data;
 if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Report cronologico non leggibile.');
 const list=(body as Record<string,unknown>).performances;
 if(!list||typeof list!=='object'||Array.isArray(list))throw new Error('Prestazioni cronologiche mancanti.');
 return Object.values(list as Record<string,unknown>).map(p=>{
   if(!p||typeof p!=='object'||Array.isArray(p))throw new Error('Prestazione cronologica non leggibile.');
   return p as Record<string,unknown>;
 });
}
export function reconcileOneServedYellowCycle(input:{
 seasonId:string;affectedMatchIds:string[];affectedReports:Document[];
 matches:Document[];allReports:Document[];records:Document[];suspensions:Document[];
}):{records:DisciplinePatch[];suspensions:ServedSuspensionPatch[]}{
 const affected=new Set(input.affectedMatchIds);
 const matchById=new Map(input.matches.map(m=>[m.id,m]));
 if(matchById.size!==input.matches.length)throw new Error('Partite duplicate nel replay gialli.');
 const reportsByMatch=new Map<string,Document>();
 for(const r of input.allReports){
  const mid=str(r.data.matchId);
  if(!id(mid)||reportsByMatch.has(mid))throw new Error('Report duplicati nel replay gialli.');
  reportsByMatch.set(mid,r);
 }
 // Avoid silently ignoring another player's yellow/red in a voided report.
 const voidEvents:{playerId:string;teamId:string;matchId:string;week:number}[]=[];
 for(const report of input.affectedReports){
  if(report.data.status!=='published')continue;
  const mid=str(report.data.matchId),match=matchById.get(mid);
  if(!affected.has(mid)||!match)throw new Error('Report annullato senza gara.');
  for(const p of performances(report)){
   const y=card(p.yellowCards),r=card(p.directRedCards),other=card(p.redCards);
   if(![y,r,other].every(Number.isFinite))throw new Error('Cartellini non validi.');
   if(!y&&!r&&!other)continue;
   if(!id(p.playerId)||!id(p.teamId)||y!==1||r!==0||other!==0||
      ![str(match.data.homeTeamId),str(match.data.awayTeamId)].includes(str(p.teamId))||
      !Number.isSafeInteger(match.data.matchweek))
      throw new Error('Eventi disciplinari misti: replay gialli non sicuro.');
   voidEvents.push({playerId:p.playerId,teamId:p.teamId,matchId:mid,week:Number(match.data.matchweek)});
  }
 }
 if(voidEvents.length!==1||input.records.length!==1||input.suspensions.length!==1)
  throw new Error('Ciclo gialli complesso: replay completo necessario.');
 const ev=voidEvents[0],rec=input.records[0],sus=input.suspensions[0];
 const rd=rec.data,sd=sus.data;
 if(!id(rec.id)||!id(sus.id)||rd.seasonId!==input.seasonId||sd.seasonId!==input.seasonId||
    rd.playerId!==ev.playerId||sd.playerId!==ev.playerId||str(rd.teamId)!==ev.teamId||
    rd.seasonYellowCards!==5||rd.currentYellowCycle!==0||rd.directRedCards!==0||
    !Array.isArray(rd.activeSuspensionIds)||rd.activeSuspensionIds.length!==0||
    !Array.isArray(rd.processedSourceMatchIds)||rd.processedSourceMatchIds.length!==5||
    new Set(rd.processedSourceMatchIds).size!==5)
    throw new Error('Record gialli non riconciliabile.');
 if(sd.reason!=='yellowAccumulation'||sd.sourceMatchId!==ev.matchId||
    sd.status!=='completed'||sd.totalMatches!==1||sd.servedMatches!==1||sd.remainingMatches!==0||
    !Array.isArray(sd.servedMatchIds)||sd.servedMatchIds.length!==1||!id(sd.servedMatchIds[0]))
    throw new Error('Squalifica gialli non riconciliabile.');
 const sourceIds=new Set(rd.processedSourceMatchIds as string[]);
 if(!sourceIds.has(ev.matchId))throw new Error('Quinta ammonizione non registrata.');
 const seen=new Set<string>();let previous=0;
 for(const [mid,rep] of reportsByMatch){
  if(rep.data.status!=='published')continue;
  for(const p of performances(rep)){
   if(p.playerId!==ev.playerId)continue;
   const yellow=card(p.yellowCards),red=card(p.directRedCards),other=card(p.redCards);
   if(![yellow,red,other].every(Number.isFinite)||red!==0||other!==0)
      throw new Error('Eventi del giocatore incompatibili con il ciclo gialli.');
   if(!yellow)continue;
   if(yellow!==1||!sourceIds.has(mid)||seen.has(mid))
      throw new Error('Ammonizioni e registro non coincidono.');
   seen.add(mid);
   const match=matchById.get(mid);
   if(!match||str(match.data.seasonId)!==input.seasonId||
     (match.data.matchType!==undefined&&match.data.matchType!=='regularSeason')||
     !['played','finished'].includes(str(match.data.status))||
     ![str(match.data.homeTeamId),str(match.data.awayTeamId)].includes(ev.teamId)||
     !Number.isSafeInteger(match.data.matchweek))throw new Error('Gara ammonizione non verificabile.');
   const week=Number(match.data.matchweek);
   if(mid===ev.matchId){if(week!==ev.week)throw new Error('Giornata quinta ammonizione incoerente.');}
   else {
    if(affected.has(mid)||week>=ev.week)throw new Error('Ordine del ciclo gialli non verificabile.');
    previous++;
   }
  }
 }
 if(seen.size!==5||previous!==4||sourceIds.size!==5)throw new Error('Cinque ammonizioni non verificabili.');
 const servedId=sd.servedMatchIds[0] as string,served=matchById.get(servedId);
 if(!served||affected.has(servedId)||str(served.data.seasonId)!==input.seasonId||
   (served.data.matchType!==undefined&&served.data.matchType!=='regularSeason')||
   !['played','finished'].includes(str(served.data.status))||
   ![str(served.data.homeTeamId),str(served.data.awayTeamId)].includes(ev.teamId)||
   !Number.isSafeInteger(served.data.matchweek)||Number(served.data.matchweek)<=ev.week||
   reportsByMatch.get(servedId)?.data.status!=='published')
   throw new Error('Gara di sconto gialli non verificabile cronologicamente.');
 const weeks=sd.servedMatchweeks===undefined?[]:sd.servedMatchweeks;
 if(!Array.isArray(weeks)||weeks.length>1||(weeks.length===1&&weeks[0]!==served.data.matchweek))
  throw new Error('Giornate sconto gialli incoerenti.');
 const beforeIds=[...rd.processedSourceMatchIds as string[]];
 return {
  records:[{id:rec.id,before:{seasonYellowCards:5,currentYellowCycle:0,directRedCards:0,
    processedSourceMatchIds:beforeIds,activeSuspensionIds:[]},
   after:{seasonYellowCards:4,currentYellowCycle:4,directRedCards:0,
    processedSourceMatchIds:beforeIds.filter(x=>x!==ev.matchId),activeSuspensionIds:[]}}],
  suspensions:[{id:sus.id,before:{status:'completed',servedMatches:1,remainingMatches:0,
    servedMatchIds:[servedId],servedMatchweeks:[...weeks]},
   after:{status:'cancelled',servedMatches:0,remainingMatches:1,
    servedMatchIds:[],servedMatchweeks:[]}}],
 };
}
