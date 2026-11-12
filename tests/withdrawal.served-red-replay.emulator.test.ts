import { beforeAll,beforeEach,afterAll,describe,it,expect } from 'vitest';
import { initializeApp,deleteApp,type App } from 'firebase-admin/app';
import { getFirestore,type Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { prepareWithdrawalTestIntent } from '../src/services/withdrawal/WithdrawalPreparationTransaction';
import { snapshotWithdrawalForReview } from '../src/services/withdrawal/WithdrawalActivationSnapshotTransaction';
import { stageWithdrawalEffectLedger } from '../src/services/withdrawal/WithdrawalEffectLedgerTransaction';
import { activateWithdrawalInEmulator,reverseWithdrawalInEmulator } from '../src/services/withdrawal/WithdrawalEmulatorActivation';
const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
if(!process.env.FIRESTORE_EMULATOR_HOST||!project?.startsWith('demo-'))throw new Error('Eseguire esclusivamente su Firebase Emulator demo.');
let app:App, db:Firestore,seasonId:string;
const teamId='bristol';
const config={format:'double_round_robin',totalMatchweeks:22,firstReturnMatchweek:12};
const season=()=>db.collection('seasons').doc(seasonId);
const registration=()=>season().collection('withdrawalRegistrations').doc(teamId);
const record=()=>db.collection('disciplinaryRecords').doc(`${seasonId}_p1`);
const suspension=()=>db.collection('disciplinarySuspensions').doc(`${seasonId}_s1`);
const matchId=()=>`${seasonId}_m1`;
const request=()=>({seasonId,teamId,expectedMatchweek:6,adminUid:'admin_demo'});
const stage=async()=>{await prepareWithdrawalTestIntent(db,request());await snapshotWithdrawalForReview(db,request());await stageWithdrawalEffectLedger(db,request());};
beforeAll(()=>{process.env.WITHDRAWAL_ACTIVATION_EMULATOR_ONLY='yes';app=initializeApp({projectId:project},`red10g_${randomUUID()}`);db=getFirestore(app);});
beforeEach(async()=>{
 seasonId=`red10g_${randomUUID().replaceAll('-','')}`;
 await Promise.all([
  season().set({status:'active'}),
  season().collection('withdrawalSettings').doc('official').set(config),
  season().collection('teamEntries').doc(teamId).set({status:'active'}),
  registration().set({seasonId,teamId,effectiveMatchweek:6,phase:'first_leg',policy:'void_all',formatSnapshot:config,state:'draft_pending_activation',effectsApplied:false}),
  db.collection('matches').doc(matchId()).set({seasonId,homeTeamId:teamId,awayTeamId:'other',matchweek:2,matchType:'regularSeason',status:'played',homeScore:1,awayScore:0}),
  db.collection('matchReports').doc(`${seasonId}_report`).set({seasonId,matchId:matchId(),status:'published',data:{homeScore:1,awayScore:0,performances:{p1:{playerId:'p1',teamId:'other',directRedCards:1,yellowCards:0}}}}),
  record().set({seasonId,playerId:'p1',playerName:'Demo',teamId:'other',seasonYellowCards:0,currentYellowCycle:0,directRedCards:1,activeSuspensionIds:[`${seasonId}_s1`],processedSourceMatchIds:[matchId()]}),
  suspension().set({seasonId,playerId:'p1',reason:'directRed',sourceMatchId:matchId(),status:'active',totalMatches:1,servedMatches:0,remainingMatches:1,servedMatchIds:[],servedMatchweeks:[]})
 ]);
});
afterAll(async()=>{if(app)await deleteApp(app);delete process.env.WITHDRAWAL_ACTIVATION_EMULATOR_ONLY;});
const servedMatchId=()=>`${seasonId}_m2`;
const servedReportId=()=>`${seasonId}_report2`;
async function seedServed(){
 await Promise.all([
  db.collection('matches').doc(servedMatchId()).set({seasonId,homeTeamId:'other',awayTeamId:'opponent2',matchweek:3,matchType:'regularSeason',status:'played',homeScore:2,awayScore:1}),
  db.collection('matchReports').doc(servedReportId()).set({seasonId,matchId:servedMatchId(),status:'published',data:{homeScore:2,awayScore:1,performances:{p1:{playerId:'p1',teamId:'other',directRedCards:0,yellowCards:0}}}}),
  suspension().update({status:'completed',servedMatches:1,remainingMatches:0,servedMatchIds:[servedMatchId()],servedMatchweeks:[3]}),
  record().update({activeSuspensionIds:[]}),
 ]);
}
describe('10G: rosso già scontato - replay cronologico strettamente verificato',()=>{
 it('annulla rosso storico e squalifica già scontata, conservando tutte le partite',async()=>{
  await seedServed();await stage();
  expect((await activateWithdrawalInEmulator(db,request())).status).toBe('applied');
  expect((await record().get()).data()?.directRedCards).toBe(0);
  const sd=(await suspension().get()).data()!;
  expect(sd.status).toBe('cancelled');expect(sd.servedMatchIds).toEqual([]);
  expect((await db.collection('matches').doc(servedMatchId()).get()).data()?.status).toBe('played');
  expect((await db.collection('matchReports').doc(servedReportId()).get()).data()?.status).toBe('published');
 });
 it('ripristina fedelmente storico di sconto e rosso',async()=>{
  await seedServed();await stage();await activateWithdrawalInEmulator(db,request());
  expect((await reverseWithdrawalInEmulator(db,request())).status).toBe('reversed');
  expect((await record().get()).data()?.directRedCards).toBe(1);
  const sd=(await suspension().get()).data()!;
  expect(sd.status).toBe('completed');expect(sd.servedMatchIds).toEqual([servedMatchId()]);
  expect(sd.servedMatchweeks).toEqual([3]);expect(sd.servedMatches).toBe(1);
 });
 it('blocca gara scontata non valida o mancante',async()=>{
  await seedServed();await suspension().update({servedMatchIds:['untracked_match']});await stage();
  await expect(activateWithdrawalInEmulator(db,request())).rejects.toThrow(/gara di sconto/i);
  expect((await registration().get()).data()?.effectsApplied).toBe(false);
 });
 it('blocca sconto anticipato rispetto al rosso',async()=>{
  await seedServed();await db.collection('matches').doc(servedMatchId()).update({matchweek:1});await stage();
  await expect(activateWithdrawalInEmulator(db,request())).rejects.toThrow(/cronologicamente/i);
 });
 it('blocca sanzione manuale aggiuntiva senza modifiche',async()=>{
  await seedServed();await db.collection('disciplinarySuspensions').doc(`${seasonId}_manual`).set({seasonId,playerId:'p1',reason:'sportsJudge',status:'active',totalMatches:1,servedMatches:0,remainingMatches:1});await stage();
  await expect(activateWithdrawalInEmulator(db,request())).rejects.toThrow(/replay completo/i);
  expect((await suspension().get()).data()?.status).toBe('completed');
 });
 it('blocca modifiche post attivazione prima del ripristino',async()=>{
  await seedServed();await stage();await activateWithdrawalInEmulator(db,request());
  await suspension().update({servedMatchIds:['tampered']});
  await expect(reverseWithdrawalInEmulator(db,request())).rejects.toThrow(/squalifica modificata/i);
 });
});
