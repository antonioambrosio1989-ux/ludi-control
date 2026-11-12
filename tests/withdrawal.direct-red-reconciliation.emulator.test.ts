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
beforeAll(()=>{process.env.WITHDRAWAL_ACTIVATION_EMULATOR_ONLY='yes';app=initializeApp({projectId:project},`red10f_${randomUUID()}`);db=getFirestore(app);});
beforeEach(async()=>{
 seasonId=`red10f_${randomUUID().replaceAll('-','')}`;
 await Promise.all([
  season().set({status:'active'}),
  season().collection('withdrawalSettings').doc('official').set(config),
  season().collection('teamEntries').doc(teamId).set({status:'active'}),
  registration().set({seasonId,teamId,effectiveMatchweek:6,phase:'first_leg',policy:'void_all',formatSnapshot:config,state:'draft_pending_activation',effectsApplied:false}),
  db.collection('matches').doc(matchId()).set({seasonId,homeTeamId:teamId,awayTeamId:'other',matchweek:2,matchType:'regularSeason',status:'played',homeScore:1,awayScore:0}),
  db.collection('matchReports').doc(`${seasonId}_report`).set({seasonId,matchId:matchId(),status:'published',data:{homeScore:1,awayScore:0,performances:{p1:{playerId:'p1',teamId,directRedCards:1,yellowCards:0}}}}),
  record().set({seasonId,playerId:'p1',playerName:'Demo',teamId,seasonYellowCards:0,currentYellowCycle:0,directRedCards:1,activeSuspensionIds:[`${seasonId}_s1`],processedSourceMatchIds:[matchId()]}),
  suspension().set({seasonId,playerId:'p1',reason:'directRed',sourceMatchId:matchId(),status:'active',totalMatches:1,servedMatches:0,remainingMatches:1,servedMatchIds:[],servedMatchweeks:[]})
 ]);
});
afterAll(async()=>{if(app)await deleteApp(app);delete process.env.WITHDRAWAL_ACTIVATION_EMULATOR_ONLY;});
describe('10F: annullamento reversibile di rosso non scontato (solo emulatore)',()=>{
 it('annulla rosso e squalifica in un commit e non altera il tabellino',async()=>{
  await stage();expect((await activateWithdrawalInEmulator(db,request())).status).toBe('applied');
  expect((await record().get()).data()?.directRedCards).toBe(0);
  expect((await suspension().get()).data()?.status).toBe('cancelled');
  expect((await db.collection('matchReports').doc(`${seasonId}_report`).get()).data()?.data.performances.p1.directRedCards).toBe(1);
  const audit=(await season().collection('withdrawalActivationCommits').doc(teamId).get()).data()!;
  expect(audit.suspensionChanges).toHaveLength(1);
 });
 it('ripristina esattamente record e squalifica e mantiene audit',async()=>{
  await stage();await activateWithdrawalInEmulator(db,request());
  expect((await reverseWithdrawalInEmulator(db,request())).status).toBe('reversed');
  expect((await record().get()).data()?.directRedCards).toBe(1);
  expect((await record().get()).data()?.activeSuspensionIds).toEqual([`${seasonId}_s1`]);
  expect((await suspension().get()).data()?.status).toBe('active');
 });
 it('blocca ripristino se la squalifica viene modificata dopo attivazione',async()=>{
  await stage();await activateWithdrawalInEmulator(db,request());
  await suspension().update({remainingMatches:0});
  await expect(reverseWithdrawalInEmulator(db,request())).rejects.toThrow(/squalifica modificata/i);
  expect((await registration().get()).data()?.state).toBe('active');
 });
 it('blocca un rosso già scontato senza cambiare documenti',async()=>{
  await suspension().update({status:'completed',servedMatches:1,remainingMatches:0,servedMatchIds:['m2']});await stage();
  await expect(activateWithdrawalInEmulator(db,request())).rejects.toThrow(/gara di sconto non verificabile cronologicamente/i);
  expect((await registration().get()).data()?.effectsApplied).toBe(false);
 });
 it('preserva le sanzioni manuali bloccando il replay ambiguo',async()=>{
  await db.collection('disciplinarySuspensions').doc(`${seasonId}_manual`).set({seasonId,playerId:'p1',reason:'sportsJudge',status:'active',totalMatches:1,servedMatches:0,remainingMatches:1});
  await stage();await expect(activateWithdrawalInEmulator(db,request())).rejects.toThrow(/replay completo/i);
  expect((await suspension().get()).data()?.status).toBe('active');
 });
 it('seconda attivazione identica resta idempotente',async()=>{
  await stage();await activateWithdrawalInEmulator(db,request());
  expect((await activateWithdrawalInEmulator(db,request())).status).toBe('unchanged');
 });
});
