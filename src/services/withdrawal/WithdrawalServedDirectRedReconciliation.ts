/** 10G - Replay strictly verified for one already-served direct-red suspension.
 * No retroactive rewrite of match reports; all changes are auditable and reversible.
 * Any ambiguity must fail closed. Emulator activation only.
 */
import type { DisciplinePatch } from './WithdrawalDirectRedReconciliation';

export type ServedSuspensionPatch = {
  id: string;
  before: { status:'completed'; servedMatches:1; remainingMatches:0; servedMatchIds:string[]; servedMatchweeks:number[] };
  after: { status:'cancelled'; servedMatches:0; remainingMatches:1; servedMatchIds:string[]; servedMatchweeks:number[] };
};
type Document = {id:string;data:Record<string,unknown>};
type ReportDocument = {id:string;data:Record<string,unknown>};
const id=(v:unknown):v is string=> typeof v==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const norm=(v:unknown)=>String(v??'').trim();
function performanceValues(doc:ReportDocument):Record<string,unknown>[] {
  const root=doc.data.data;
  if(!root||typeof root!=='object'||Array.isArray(root))throw new Error('Report disciplinare non leggibile.');
  const perfs=(root as Record<string,unknown>).performances;
  if(!perfs||typeof perfs!=='object'||Array.isArray(perfs))throw new Error('Prestazioni mancanti.');
  return Object.values(perfs as Record<string,unknown>).map(item=>{
    if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('Prestazione illeggibile.');
    return item as Record<string,unknown>;
  });
}
function nonnegative(v:unknown):boolean{return typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;}
export function reconcileServedDirectRed(input:{
 seasonId:string; affectedMatchIds:string[];
 affectedReports:ReportDocument[]; matches:Document[]; allReports:ReportDocument[];
 records:Document[]; suspensions:Document[];
}):{records:DisciplinePatch[];suspensions:ServedSuspensionPatch[]}{
 const affected=new Set(input.affectedMatchIds);
 const matchById=new Map(input.matches.map(m=>[m.id,m]));
 if(matchById.size!==input.matches.length)throw new Error('Partite duplicate nel replay.');
 const reportByMatch=new Map<string,ReportDocument>();
 for(const r of input.allReports){
   const matchId=norm(r.data.matchId);
   if(reportByMatch.has(matchId))throw new Error('Report duplicati: replay bloccato.');
   reportByMatch.set(matchId,r);
 }
 const events=new Map<string,{sourceId:string;teamId:string}>();
 for(const report of input.affectedReports){
   if(report.data.status!=='published')continue;
   const sourceId=norm(report.data.matchId);
   if(!affected.has(sourceId))throw new Error('Sorgente non annullata.');
   const match=matchById.get(sourceId);
   if(!match)throw new Error('Partita sorgente mancante.');
   for(const p of performanceValues(report)){
     if(!id(p.playerId)||!id(norm(p.teamId)))throw new Error('Giocatore non valido.');
     const yellow=p.yellowCards??0,red=p.directRedCards??0,other=p.redCards??0;
     if(!nonnegative(yellow)||!nonnegative(red)||!nonnegative(other))throw new Error('Cartellini non validi.');
     if(yellow!==0||other!==0)throw new Error('Eventi disciplinari misti: replay completo necessario.');
     if(red!==0){
       if(red!==1||events.has(p.playerId))throw new Error('Rossi multipli: replay completo necessario.');
       if(![norm(match.data.homeTeamId),norm(match.data.awayTeamId)].includes(norm(p.teamId)))throw new Error('Squadra sorgente incoerente.');
       events.set(p.playerId,{sourceId,teamId:norm(p.teamId)});
     }
   }
 }
 if(!events.size||input.records.length!==events.size||input.suspensions.length!==events.size)
   throw new Error('Storico disciplinare aggiuntivo: replay completo necessario.');
 const records:DisciplinePatch[]=[],suspensions:ServedSuspensionPatch[]=[];
 for(const [playerId,event] of events){
   const rs=input.records.filter(r=>r.data.playerId===playerId);
   const ss=input.suspensions.filter(s=>s.data.playerId===playerId);
   if(rs.length!==1||ss.length!==1)throw new Error('Record o squalifica ambigui.');
   const r=rs[0],s=ss[0],rd=r.data,sd=s.data;
   if(!id(r.id)||!id(s.id)||rd.seasonId!==input.seasonId||sd.seasonId!==input.seasonId||
      norm(rd.teamId)!==event.teamId||rd.seasonYellowCards!==0||rd.currentYellowCycle!==0||rd.directRedCards!==1||
      !Array.isArray(rd.processedSourceMatchIds)||rd.processedSourceMatchIds.length!==1||rd.processedSourceMatchIds[0]!==event.sourceId||
      !Array.isArray(rd.activeSuspensionIds)||!rd.activeSuspensionIds.every(x=>x===s.id)||rd.activeSuspensionIds.length>1)
      throw new Error('Record con altri eventi disciplinari: replay bloccato.');
   if(sd.reason!=='directRed'||sd.sourceMatchId!==event.sourceId||sd.status!=='completed'||
      sd.totalMatches!==1||sd.servedMatches!==1||sd.remainingMatches!==0||
      !Array.isArray(sd.servedMatchIds)||sd.servedMatchIds.length!==1||!id(sd.servedMatchIds[0]))
      throw new Error('Squalifica non riconciliabile come scontata singola.');
   const servedId=sd.servedMatchIds[0];
   if(affected.has(servedId))throw new Error('Squalifica scontata in gara annullata: revisione necessaria.');
   const sourceMatch=matchById.get(event.sourceId),servedMatch=matchById.get(servedId);
   if(!sourceMatch||!servedMatch||!Number.isSafeInteger(sourceMatch.data.matchweek)||!Number.isSafeInteger(servedMatch.data.matchweek)||
      Number(servedMatch.data.matchweek)<=Number(sourceMatch.data.matchweek)||
      ![norm(servedMatch.data.homeTeamId),norm(servedMatch.data.awayTeamId)].includes(event.teamId)||
      (servedMatch.data.matchType!==undefined&&servedMatch.data.matchType!=='regularSeason')||
      !['played','finished'].includes(norm(servedMatch.data.status)))
       throw new Error('Gara di sconto non verificabile cronologicamente.');
   const servedReport=reportByMatch.get(servedId);
   if(!servedReport||servedReport.data.status!=='published')throw new Error('Report gara di sconto non pubblicato.');
   // The served match may include other players' events, but not disciplinary
   // events for this player (otherwise recorded player history is incomplete).
   for(const p of performanceValues(servedReport)){
     if(p.playerId!==playerId)continue;
     if(!nonnegative(p.yellowCards??0)||!nonnegative(p.directRedCards??0)||!nonnegative(p.redCards??0)||
        (p.yellowCards??0)!==0||(p.directRedCards??0)!==0||(p.redCards??0)!==0)
       throw new Error('Nuovi eventi del giocatore nella gara di sconto: replay bloccato.');
   }
   const originalWeeks=sd.servedMatchweeks===undefined?[]:sd.servedMatchweeks;
   if(!Array.isArray(originalWeeks)||originalWeeks.length>1||
      (originalWeeks.length===1&&originalWeeks[0]!==servedMatch.data.matchweek))
      throw new Error('Giornate di sconto incoerenti.');
   records.push({id:r.id,before:{seasonYellowCards:0,currentYellowCycle:0,directRedCards:1,
     processedSourceMatchIds:[event.sourceId],activeSuspensionIds:[...rd.activeSuspensionIds as string[]]},
     after:{seasonYellowCards:0,currentYellowCycle:0,directRedCards:0,processedSourceMatchIds:[],activeSuspensionIds:[]}});
   suspensions.push({id:s.id,before:{status:'completed',servedMatches:1,remainingMatches:0,servedMatchIds:[servedId],servedMatchweeks:[...originalWeeks]},
     after:{status:'cancelled',servedMatches:0,remainingMatches:1,servedMatchIds:[],servedMatchweeks:[]}});
 }
 return{records:records.sort((a,b)=>a.id.localeCompare(b.id)),suspensions:suspensions.sort((a,b)=>a.id.localeCompare(b.id))};
}
