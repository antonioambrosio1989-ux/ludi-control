/** 10C: activation/reversal for DEMO FIRESTORE EMULATOR only.
 * No match/report/disciplinary document is rewritten: the official-read filter
 * removes voided results when registration becomes active. An audit is retained.
 */
import { createHash } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { buildWithdrawalPreparation, preparationFingerprint, comparePreparedWithdrawal, validWithdrawalId } from './WithdrawalPersistenceContract';
import type { EffectEntry } from './WithdrawalEffectLedgerTransaction';
import { calculateSafeYellowReconciliation } from './WithdrawalYellowReconciliation';
import { reconcileUnservedDirectReds } from './WithdrawalDirectRedReconciliation';
import { reconcileServedDirectRed } from './WithdrawalServedDirectRedReconciliation';
import { reconcileOneServedYellowCycle } from './WithdrawalServedYellowCycleReplay';

const str=(v:unknown)=>String(v??'').trim();
function canonical(v:unknown):string {
  if(v===null||typeof v!=='object') return JSON.stringify(v)??'null';
  if(v instanceof Date)return JSON.stringify(v.toISOString());
  if(Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const o=v as Record<string,unknown>;
  return `{${Object.keys(o).sort().filter(k=>o[k]!==undefined).map(k=>`${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
}
const hash=(v:unknown)=>createHash('sha256').update(canonical(v)).digest('hex');
const sameDiscipline=(current:Record<string,unknown>|undefined, expected:Record<string,unknown>)=>
  Object.keys(expected).every(key=>canonical(current?.[key])===canonical(expected[key]));
function guard(){
  if(!/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST??'')||
     !str(process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT).startsWith('demo-')||
     process.env.WITHDRAWAL_ACTIVATION_EMULATOR_ONLY!=='yes') {
    throw new Error('Attivazione consentita soltanto con emulatore demo e opt-in esplicito.');
  }
}
type Request={seasonId:string;teamId:string;expectedMatchweek:number;adminUid:string};
const validate=(r:Request)=>{
 guard();
 if(![r.seasonId,r.teamId,r.adminUid].every(validWithdrawalId)||!Number.isSafeInteger(r.expectedMatchweek)||r.expectedMatchweek<1)
   throw new Error('Richiesta non valida.');
};
export async function activateWithdrawalInEmulator(db:Firestore,r:Request){
 validate(r);
 const seasonRef=db.collection('seasons').doc(r.seasonId);
 const regRef=seasonRef.collection('withdrawalRegistrations').doc(r.teamId);
 const ledgerRef=seasonRef.collection('withdrawalEffectLedgers').doc(r.teamId);
 const auditRef=seasonRef.collection('withdrawalActivationCommits').doc(r.teamId);
 return db.runTransaction(async tx=>{
   const [season,config,team,registration,intent,snapshot,ledger,audit,matches,reports,disciplinaryRecords,disciplinarySuspensions]=await Promise.all([
     tx.get(seasonRef),tx.get(seasonRef.collection('withdrawalSettings').doc('official')),
     tx.get(seasonRef.collection('teamEntries').doc(r.teamId)),tx.get(regRef),
     tx.get(seasonRef.collection('withdrawalActivationIntents').doc(r.teamId)),
     tx.get(seasonRef.collection('withdrawalReviewSnapshots').doc(r.teamId)),
     tx.get(ledgerRef),tx.get(auditRef),
     tx.get(db.collection('matches').where('seasonId','==',r.seasonId)),
     tx.get(db.collection('matchReports').where('seasonId','==',r.seasonId)),
     tx.get(db.collection('disciplinaryRecords').where('seasonId','==',r.seasonId)),
     tx.get(db.collection('disciplinarySuspensions').where('seasonId','==',r.seasonId)),
   ]);
   if(!season.exists||season.data()?.status!=='active'||!team.exists||team.data()?.status!=='active')throw new Error('Stagione o squadra non attiva.');
   if(!config.exists||!registration.exists||!intent.exists||!snapshot.exists||!ledger.exists)throw new Error('Preparazione incompleta.');
   const draft=registration.data()!;
   if(draft.state==='active' && draft.effectsApplied===true && audit.exists && audit.data()?.state==='applied' &&
      draft.activationCommitId===audit.data()?.commitId && ledger.data()?.state==='applied') return {status:'unchanged' as const,commitId:str(draft.activationCommitId)};
   const candidate=buildWithdrawalPreparation({seasonId:r.seasonId,teamId:r.teamId,expectedMatchweek:r.expectedMatchweek,config:config.data(),registration:draft});
   if(candidate.policy!=='void_all')throw new Error('Ritorno non ancora supportato: richiede maturazione progressiva.');
   const operationId=createHash('sha256').update(preparationFingerprint(candidate)).digest('hex');
   comparePreparedWithdrawal(intent.data(),{...candidate,operationId});
   const affectedMatches=matches.docs.filter(d=>{
     const v=d.data();return(v.matchType===undefined||v.matchType==='regularSeason')&&(str(v.homeTeamId)===r.teamId||str(v.awayTeamId)===r.teamId);
   }).map(d=>({id:d.id,data:d.data()})).sort((a,b)=>a.id.localeCompare(b.id));
   if(!affectedMatches.length)throw new Error('Nessuna gara coinvolta.');
   const affectedIds=new Set(affectedMatches.map(m=>m.id));
   const affectedReports=reports.docs.filter(d=>affectedIds.has(str(d.data().matchId))).map(d=>({id:d.id,data:d.data()})).sort((a,b)=>a.id.localeCompare(b.id));
   const snapshotHash=hash({operationId,affectedMatches,affectedReports});
   const saved=snapshot.data()!;
   if(saved.state!=='review_only'||saved.effectsApplied!==false||saved.operationId!==operationId||saved.snapshotHash!==snapshotHash||
      canonical(saved.affectedMatchIds)!==canonical(affectedMatches.map(m=>m.id))||
      canonical(saved.affectedReportIds)!==canonical(affectedReports.map(m=>m.id)))throw new Error('Snapshot obsoleto.');
   const reportMap=new Map<string,string[]>();
   for(const report of affectedReports){const key=str(report.data.matchId);reportMap.set(key,[...(reportMap.get(key)??[]),report.id]);}
   const expectedEntries:EffectEntry[]=affectedMatches.map(m=>{
     const week=Number(m.data.matchweek);
     const matchweek=Number.isSafeInteger(week)&&week>0?week:null;
     return{matchId:m.id,matchweek,opponentTeamId:str(m.data.homeTeamId)===r.teamId?str(m.data.awayTeamId):str(m.data.homeTeamId),effect:'void',reportIds:reportMap.get(m.id)??[]};
   });
   const signature=hash({seasonId:r.seasonId,teamId:r.teamId,operationId,snapshotHash,entries:expectedEntries});
   const ld=ledger.data()!;
   if(ld.state!=='staged_review_only'||ld.effectsApplied!==false||ld.policy!=='void_all'||ld.signature!==signature||ld.snapshotHash!==snapshotHash||
      canonical(ld.entries)!==canonical(expectedEntries))throw new Error('Registro effetti obsoleto o manomesso.');
   // 10E: deterministic, conservative disciplinary reconciliation.
   // Supports ONLY players whose entire recorded discipline comes from the
   // voided published games. Other histories require full chronological replay.
   // 10F: allow only the uniquely provable, unserved direct-red case.
   // All other historical suspensions still fail closed.
   const rawDiscipline = {
     seasonId:r.seasonId,
     affectedMatchIds:affectedMatches.map(m=>m.id),
     affectedReports:affectedReports.map(item=>({matchId:str(item.data.matchId),status:item.data.status,data:item.data.data})),
     records:disciplinaryRecords.docs.map(doc=>({id:doc.id,data:doc.data()})),
   };
   const hasExcludedDirectRed = rawDiscipline.affectedReports.some(report=>{
     if(report.status!=='published'||!report.data||typeof report.data!=='object')return false;
     const performances=(report.data as Record<string,unknown>).performances;
     return !!performances && typeof performances==='object' && Object.values(performances as Record<string,unknown>).some(value=>
       !!value && typeof value==='object' && Number((value as Record<string,unknown>).directRedCards ?? 0)>0);
   });
   const suspensionDocs=disciplinarySuspensions.docs.map(doc=>({id:doc.id,data:doc.data()}));
   const allCompletedYellows=suspensionDocs.length>0 && suspensionDocs.every(doc=>doc.data.reason==='yellowAccumulation' && doc.data.status==='completed');
   if(!disciplinarySuspensions.empty && !hasExcludedDirectRed && !allCompletedYellows)
     throw new Error('Riconciliazione disciplinare: squalifiche presenti, replay completo necessario. Attivazione bloccata.');
   const replayInput = {
     ...rawDiscipline,
     affectedReports:affectedReports.map(doc=>({id:doc.id,data:doc.data})),
     matches:matches.docs.map(doc=>({id:doc.id,data:doc.data()})),
     allReports:reports.docs.map(doc=>({id:doc.id,data:doc.data()})),
     suspensions:suspensionDocs,
   };
   const allCompletedReds=suspensionDocs.length>0 && suspensionDocs.every(doc=>doc.data.reason==='directRed' && doc.data.status==='completed');
   const directRed = disciplinarySuspensions.empty || allCompletedYellows ? null : allCompletedReds
     ? reconcileServedDirectRed(replayInput)
     : reconcileUnservedDirectReds({ ...rawDiscipline,suspensions:suspensionDocs });
   const yellowReplay = allCompletedYellows ? reconcileOneServedYellowCycle(replayInput) : null;
   const disciplineChanges = yellowReplay ? yellowReplay.records : directRed ? directRed.records : calculateSafeYellowReconciliation(rawDiscipline);
   const suspensionChanges = yellowReplay ? yellowReplay.suspensions : directRed?.suspensions ?? [];
   if(audit.exists)throw new Error('Attivazione precedente presente: ripristino manuale necessario.');
   const commitId=hash({seasonId:r.seasonId,teamId:r.teamId,operationId,snapshotHash,signature});
   // Counts and activation are committed atomically, never independently.
   for (const change of disciplineChanges) {
     tx.update(db.collection('disciplinaryRecords').doc(change.id),change.after);
   }
   for (const change of suspensionChanges) {
     tx.update(db.collection('disciplinarySuspensions').doc(change.id),change.after);
   }
   // Atomic publication: registration drives all verified read filters.
   tx.update(regRef,{state:'active',effectsApplied:true,activationCommitId:commitId,updatedAt:FieldValue.serverTimestamp()});
   tx.update(ledgerRef,{state:'applied',effectsApplied:true,activationCommitId:commitId,appliedAt:FieldValue.serverTimestamp()});
   tx.create(auditRef,{schemaVersion:1,state:'applied',seasonId:r.seasonId,teamId:r.teamId,operationId,commitId,snapshotHash,signature,
      policy:'void_all',affectedMatchIds:affectedMatches.map(m=>m.id),affectedReportIds:affectedReports.map(m=>m.id),
      originalRegistration:{state:draft.state,effectsApplied:draft.effectsApplied},disciplineChanges,suspensionChanges,createdBy:r.adminUid,createdAt:FieldValue.serverTimestamp()});
   return{status:'applied' as const,commitId};
 });
}
export async function reverseWithdrawalInEmulator(db:Firestore,r:Request){
 validate(r);
 const seasonRef=db.collection('seasons').doc(r.seasonId);
 const regRef=seasonRef.collection('withdrawalRegistrations').doc(r.teamId);
 const ledgerRef=seasonRef.collection('withdrawalEffectLedgers').doc(r.teamId);
 const auditRef=seasonRef.collection('withdrawalActivationCommits').doc(r.teamId);
 return db.runTransaction(async tx=>{
   const [reg,ledger,audit]=await Promise.all([tx.get(regRef),tx.get(ledgerRef),tx.get(auditRef)]);
   if(!reg.exists||!ledger.exists||!audit.exists)throw new Error('Attivazione non trovata.');
   const a=audit.data()!,rdata=reg.data()!,l=ledger.data()!;
   if(a.state==='reversed'&&rdata.state==='draft_pending_activation'&&rdata.effectsApplied===false&&l.state==='staged_review_only')return{status:'unchanged' as const};
   if(a.state!=='applied'||rdata.state!=='active'||rdata.effectsApplied!==true||rdata.activationCommitId!==a.commitId||
      l.state!=='applied'||l.effectsApplied!==true||l.activationCommitId!==a.commitId||a.policy!=='void_all')throw new Error('Stato incongruente: ripristino negato.');
   if(r.expectedMatchweek!==rdata.effectiveMatchweek)throw new Error('Giornata incoerente.');
   const changes = a.disciplineChanges ?? [];
   if(!Array.isArray(changes)) throw new Error('Audit disciplinare non valido.');
   const docs = await Promise.all(changes.map((change: {id:string}) => {
     if(!validWithdrawalId(change.id)) throw new Error('ID disciplinare non valido.');
     return tx.get(db.collection('disciplinaryRecords').doc(change.id));
   }));
   const suspensionChanges = a.suspensionChanges ?? [];
   if(!Array.isArray(suspensionChanges))throw new Error('Audit squalifiche non valido.');
   const suspensionDocs = await Promise.all(suspensionChanges.map((change:{id:string})=>{
     if(!validWithdrawalId(change.id))throw new Error('ID squalifica non valido.');
     return tx.get(db.collection('disciplinarySuspensions').doc(change.id));
   }));
   for(let i=0;i<changes.length;i++) {
     const change=changes[i];
     if(!docs[i].exists || !sameDiscipline(docs[i].data(),change.after))
       throw new Error('Record disciplinare modificato dopo attivazione: ripristino bloccato.');
   }
   for(let i=0;i<suspensionChanges.length;i++) {
     if(!suspensionDocs[i].exists || !sameDiscipline(suspensionDocs[i].data(),suspensionChanges[i].after))
       throw new Error('Squalifica modificata dopo attivazione: ripristino bloccato.');
   }
   for(const change of changes) tx.update(db.collection('disciplinaryRecords').doc(change.id),change.before);
   for(const change of suspensionChanges)tx.update(db.collection('disciplinarySuspensions').doc(change.id),change.before);
   tx.update(regRef,{state:'draft_pending_activation',effectsApplied:false,activationCommitId:FieldValue.delete(),updatedAt:FieldValue.serverTimestamp()});
   tx.update(ledgerRef,{state:'staged_review_only',effectsApplied:false,activationCommitId:FieldValue.delete(),reversedAt:FieldValue.serverTimestamp()});
   tx.update(auditRef,{state:'reversed',reversedBy:r.adminUid,reversedAt:FieldValue.serverTimestamp()});
   return{status:'reversed' as const};
 });
}
