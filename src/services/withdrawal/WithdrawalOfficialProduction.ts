/** Official, production-capable, fail-closed withdrawal transactions.
 * No Firebase emulator shortcuts, no fabricated matchReports, no score writes.
 * Scope: second-leg retain-and-walkover ONLY, with full-season schedule already imported.
 * First-leg void_all requires chronological disciplinary replay and is blocked.
 */
import { createHash } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { calculateWithdrawalPolicy, validateWithdrawalConfig } from './WithdrawalRegistryRules';

const goodId = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(x);
const sid = (x: unknown): string => String(x ?? '').trim();
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const goodWeek = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) > 0;
const rs = (m: Record<string,unknown>) => m.matchType === undefined || m.matchType === 'regularSeason';

type Input = { seasonId: string; teamId: string; adminUid: string; expectedMatchweek: number };
type MatchRecord = {id:string; data:Record<string,unknown>};
function validate(input: Input) {
  if (![input.seasonId,input.teamId,input.adminUid].every(goodId) || !goodWeek(input.expectedMatchweek))
    throw new Error('Identificativi o giornata non validi.');
}
function signaturePart(entries: Array<{matchId:string;matchweek:number;opponentTeamId:string;effect:string;reportIds:string[]}>) {
  return hash(JSON.stringify(entries));
}
function allFixturesForTeam(matches: MatchRecord[],teamId:string,seasonId:string) {
  return matches.filter(({data:m})=>m.seasonId===seasonId && rs(m) &&
    (sid(m.homeTeamId)===teamId || sid(m.awayTeamId)===teamId)).sort((a,b)=>Number(a.data.matchweek)-Number(b.data.matchweek));
}
function officialReports(reports: MatchRecord[],matchId:string) {
  return reports.filter(r=>sid(r.data.matchId)===matchId);
}
function validateSeasonSchedule(matches: MatchRecord[], teamId:string,seasonId:string,total:number) {
  const relevant=allFixturesForTeam(matches,teamId,seasonId);
  if (relevant.length!==total) throw new Error('Calendario non integralmente importato: serve una gara per ogni giornata prima di attivare il ritiro.');
  for(let week=1;week<=total;week++) {
    const found=relevant.filter(m=>m.data.matchweek===week);
    if(found.length!==1 || sid(found[0].data.homeTeamId)===sid(found[0].data.awayTeamId))
      throw new Error(`Calendario incompleto, duplicato o incoerente alla giornata ${week}.`);
  }
  return relevant;
}
/** One Firestore transaction: verifies full calendar and creates the official registration, ledger and audit together. */
export async function activateOfficialSecondLegWithdrawal(db:Firestore, input:Input) {
  validate(input);
  const season=db.collection('seasons').doc(input.seasonId);
  const regRef=season.collection('withdrawalRegistrations').doc(input.teamId);
  const ledgerRef=season.collection('withdrawalEffectLedgers').doc(input.teamId);
  const auditRef=season.collection('withdrawalActivationCommits').doc(input.teamId);
  const matchesQ=db.collection('matches').where('seasonId','==',input.seasonId);
  const reportsQ=db.collection('matchReports').where('seasonId','==',input.seasonId);
  return db.runTransaction(async tx=>{
    const [seasonDoc,settings,team,reg,ledger,audit,registrations,awardDocs,closureDocs,matches,reports]=await Promise.all([
      tx.get(season),tx.get(season.collection('withdrawalSettings').doc('official')),
      tx.get(season.collection('teamEntries').doc(input.teamId)),tx.get(regRef),tx.get(ledgerRef),tx.get(auditRef),
      tx.get(season.collection('withdrawalRegistrations')),
      tx.get(season.collection('withdrawalWalkoverAwards')),
      tx.get(season.collection('officialMatchweekClosures')),
      tx.get(matchesQ),tx.get(reportsQ),
    ]);
    if(!seasonDoc.exists || seasonDoc.data()?.status!=='active'||!team.exists||team.data()?.status!=='active') throw new Error('Stagione o squadra non attive.');
    if(!settings.exists||!reg.exists)throw new Error('Impostazioni o bozza mancanti.');
    const config=validateWithdrawalConfig(settings.data());
    const policy=calculateWithdrawalPolicy(config,input.expectedMatchweek);
    if(policy.policy!=='retain_and_walkover') throw new Error('Ritiro di andata non attivabile: serve riconciliazione disciplinare cronologica.');
    const draft=reg.data()!;
    if(draft.state!=='draft_pending_activation'||draft.effectsApplied!==false||
      draft.seasonId!==input.seasonId||draft.teamId!==input.teamId||draft.effectiveMatchweek!==input.expectedMatchweek||
      draft.policy!==policy.policy)throw new Error('Bozza obsoleta o incongruente.');
    if(ledger.exists||audit.exists||!awardDocs.empty||!closureDocs.empty)
      throw new Error('Registri, chiusure o assegnazioni già presenti: revisione obbligatoria.');
    for(const other of registrations.docs) if(other.id!==input.teamId && other.data().state==='active')
      throw new Error('Ritiri multipli nella stessa stagione richiedono un piano dedicato.');
    const all=matches.docs.map(doc=>({id:doc.id,data:doc.data()}));
    const recs=reports.docs.map(doc=>({id:doc.id,data:doc.data()}));
    const fixtures=validateSeasonSchedule(all,input.teamId,input.seasonId,config.totalMatchweeks);
    const entries=fixtures.map(({id:matchId,data:m})=>{
      const week=Number(m.matchweek);const before=week<input.expectedMatchweek;
      const reportsFor=officialReports(recs,matchId);
      const opponent=sid(m.homeTeamId)===input.teamId?sid(m.awayTeamId):sid(m.homeTeamId);
      if(!goodId(opponent))throw new Error('Avversario non valido.');
      if(before){
        if(!['played','finished'].includes(sid(m.status))||reportsFor.length!==1||reportsFor[0].data.status!=='published')
          throw new Error(`Giornata ${week}: risultato precedente non pubblicato o non verificabile.`);
      }else{
        if(m.status!=='scheduled'||m.homeScore!=null||m.awayScore!=null||reportsFor.length!==0)
          throw new Error(`Giornata ${week}: gara futura già modificata o con tabellino.`);
      }
      return {matchId,matchweek:week,opponentTeamId:opponent,
        effect:before?'retain':'walkover_pending_official_closure',reportIds:reportsFor.map(r=>r.id)};
    });
    if(!entries.some(e=>e.effect==='retain')||!entries.some(e=>e.effect==='walkover_pending_official_closure'))
      throw new Error('Ritiro di ritorno senza storico e futuro validi.');
    const operationId=hash(`${input.seasonId}|${input.teamId}|${input.expectedMatchweek}|${signaturePart(entries)}`);
    const snapshotHash=hash(JSON.stringify(fixtures.map(f=>({id:f.id,data:f.data}))));
    const commitId=hash(`${operationId}|${snapshotHash}|official-v1`);
    const signature=hash(`${operationId}|${snapshotHash}|${signaturePart(entries)}`);
    const now=FieldValue.serverTimestamp();
    tx.update(regRef,{state:'active',effectsApplied:true,activationCommitId:commitId,updatedBy:input.adminUid,updatedAt:now});
    tx.create(ledgerRef,{schemaVersion:1,seasonId:input.seasonId,teamId:input.teamId,operationId,snapshotHash,signature,
      policy:'retain_and_walkover',effectiveMatchweek:input.expectedMatchweek,state:'applied',effectsApplied:true,
      activationCommitId:commitId,entries,createdBy:input.adminUid,appliedAt:now});
    tx.create(auditRef,{schemaVersion:1,state:'applied',seasonId:input.seasonId,teamId:input.teamId,
      operationId,snapshotHash,signature,commitId,policy:'retain_and_walkover',
      affectedMatchIds:fixtures.map(f=>f.id),affectedReportIds:entries.flatMap(e=>e.reportIds),
      originalRegistration:{state:draft.state,effectsApplied:draft.effectsApplied},
      disciplineChanges:[],suspensionChanges:[],createdBy:input.adminUid,createdAt:now});
    return {status:'applied' as const,commitId,fixtureCount:entries.length};
  });
}

/** Atomically closes the official week and records its 6-0 award. All other fixtures in the week must have valid published reports. */
export async function closeAndAwardOfficialWeek(db:Firestore,input: Input & {matchweek:number}) {
  validate(input);
  if(!goodWeek(input.matchweek)||input.matchweek<input.expectedMatchweek)throw new Error('Giornata non valida o precedente al ritiro.');
  const season=db.collection('seasons').doc(input.seasonId);
  const regRef=season.collection('withdrawalRegistrations').doc(input.teamId);
  const ledgerRef=season.collection('withdrawalEffectLedgers').doc(input.teamId);
  const closureRef=season.collection('officialMatchweekClosures').doc(String(input.matchweek));
  const priorRef=input.matchweek>input.expectedMatchweek?season.collection('officialMatchweekClosures').doc(String(input.matchweek-1)):null;
  return db.runTransaction(async tx=>{
    const [s,reg,ledger,closure,previous,matches,reports,registrations]=await Promise.all([
      tx.get(season),tx.get(regRef),tx.get(ledgerRef),tx.get(closureRef),
      priorRef?tx.get(priorRef):Promise.resolve(null),
      tx.get(db.collection('matches').where('seasonId','==',input.seasonId)),
      tx.get(db.collection('matchReports').where('seasonId','==',input.seasonId)),
      tx.get(season.collection('withdrawalRegistrations')),
    ]);
    if(!s.exists||s.data()?.status!=='active')throw new Error('Stagione non attiva.');
    const r=reg.data(),l=ledger.data();
    if(!reg.exists||r?.state!=='active'||r.effectsApplied!==true||r.effectiveMatchweek!==input.expectedMatchweek||
      !goodId(r.activationCommitId)||!ledger.exists||l?.state!=='applied'||l.effectsApplied!==true||
      l.policy!=='retain_and_walkover'||l.activationCommitId!==r.activationCommitId||!goodId(l.operationId))
      throw new Error('Ritiro o registro effetti non validi.');
    for(const other of registrations.docs)if(other.id!==input.teamId&&other.data().state==='active')
      throw new Error('Gestione ritiri multipli non ancora supportata.');
    if(priorRef&&(!previous?.exists||previous.data()?.state!=='officially_closed'))
      throw new Error('Chiudere prima la giornata precedente.');
    const ms=matches.docs.filter(d=>d.data().matchweek===input.matchweek && rs(d.data()))
      .map(d=>({id:d.id,data:d.data()}));
    if(!ms.length)throw new Error('Calendario della giornata non presente.');
    const planned=Array.isArray(l.entries)?l.entries.filter((e:{matchweek:number;effect:string})=>
      e.matchweek===input.matchweek&&e.effect==='walkover_pending_official_closure'):[];
    if(planned.length!==1)throw new Error('Tavolino non univoco per la giornata.');
    const target=ms.find(m=>m.id===planned[0].matchId);
    if(!target || target.data.status!=='scheduled'||target.data.homeScore!=null||target.data.awayScore!=null||
      (sid(target.data.homeTeamId)!==input.teamId&&sid(target.data.awayTeamId)!==input.teamId))
      throw new Error('Gara ritirata non più compatibile con tavolino.');
    const others=ms.filter(m=>m.id!==target.id);
    const recs=reports.docs.map(d=>({id:d.id,data:d.data()}));
    if(officialReports(recs,target.id).length!==0)throw new Error('Gara ritirata con tabellino: tavolino negato.');
    for(const normal of others){
      const report=officialReports(recs,normal.id);
      if(!['played','finished'].includes(sid(normal.data.status))||!Number.isSafeInteger(normal.data.homeScore)||
        !Number.isSafeInteger(normal.data.awayScore)||Number(normal.data.homeScore)<0||Number(normal.data.awayScore)<0||
        report.length!==1||report[0].data.status!=='published'||
        (report[0].data.data as Record<string,unknown>|undefined)?.homeScore!==normal.data.homeScore||
        (report[0].data.data as Record<string,unknown>|undefined)?.awayScore!==normal.data.awayScore)
        throw new Error(`Gara ${normal.id} ancora priva di risultato e tabellino coerenti.`);
    }
    const winner=sid(target.data.homeTeamId)===input.teamId?sid(target.data.awayTeamId):sid(target.data.homeTeamId);
    if(!goodId(winner)||planned[0].opponentTeamId!==winner)throw new Error('Avversario discordante.');
    const awardRef=season.collection('withdrawalWalkoverAwards').doc(target.id);
    const award=await tx.get(awardRef);
    if(closure.exists||award.exists){
      if(!closure.exists||!award.exists||closure.data()?.state!=='officially_closed'||
        closure.data()?.withdrawalMatchId!==target.id||award.data()?.state!=='recorded_pending_publication'||
        award.data()?.winnerTeamId!==winner||award.data()?.activationCommitId!==r.activationCommitId)
        throw new Error('Chiusura preesistente non coerente.');
      return {status:'unchanged' as const,matchId:target.id,matchweek:input.matchweek};
    }
    const home=sid(target.data.homeTeamId);
    const now=FieldValue.serverTimestamp();
    tx.create(closureRef,{seasonId:input.seasonId,matchweek:input.matchweek,state:'officially_closed',
      closedBy:input.adminUid,closedAt:now,withdrawalMatchId:target.id,
      validatedNormalMatchIds:others.map(m=>m.id),mode:'official'});
    tx.create(awardRef,{seasonId:input.seasonId,withdrawnTeamId:input.teamId,matchId:target.id,matchweek:input.matchweek,
      winnerTeamId:winner,loserTeamId:input.teamId,winnerPoints:3,homeScore:home===winner?6:0,
      awayScore:home===winner?0:6,state:'recorded_pending_publication',activationCommitId:r.activationCommitId,
      operationId:l.operationId,closureId:String(input.matchweek),createdBy:input.adminUid,createdAt:now});
    return {status:'created' as const,matchId:target.id,matchweek:input.matchweek};
  });
}
