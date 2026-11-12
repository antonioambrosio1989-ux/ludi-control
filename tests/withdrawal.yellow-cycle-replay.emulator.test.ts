import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {initializeApp,deleteApp,type App} from 'firebase-admin/app';
import {getFirestore,type Firestore} from 'firebase-admin/firestore';
import {randomUUID} from 'node:crypto';
import {prepareWithdrawalTestIntent} from '../src/services/withdrawal/WithdrawalPreparationTransaction';
import {snapshotWithdrawalForReview} from '../src/services/withdrawal/WithdrawalActivationSnapshotTransaction';
import {stageWithdrawalEffectLedger} from '../src/services/withdrawal/WithdrawalEffectLedgerTransaction';
import {activateWithdrawalInEmulator,reverseWithdrawalInEmulator} from '../src/services/withdrawal/WithdrawalEmulatorActivation';
const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
if(!process.env.FIRESTORE_EMULATOR_HOST||!project?.startsWith('demo-'))throw new Error('Emulatore demo obbligatorio.');
let app:App,db:Firestore,seasonId:string;
const teamId='bristol',config={format:'double_round_robin',totalMatchweeks:22,firstReturnMatchweek:12};
const season=()=>db.collection('seasons').doc(seasonId);
const reg=()=>season().collection('withdrawalRegistrations').doc(teamId);
const record=()=>db.collection('disciplinaryRecords').doc(`${seasonId}_record`);
const suspension=()=>db.collection('disciplinarySuspensions').doc(`${seasonId}_suspension`);
const mid=(week:number)=>`${seasonId}_mw${week}`;
const report=(week:number)=>db.collection('matchReports').doc(`${seasonId}_rep${week}`);
const match=(week:number)=>db.collection('matches').doc(mid(week));
const request=()=>({seasonId,teamId,expectedMatchweek:6,adminUid:'admin_demo'});
const stage=async()=>{await prepareWithdrawalTestIntent(db,request());await snapshotWithdrawalForReview(db,request());await stageWithdrawalEffectLedger(db,request());};
beforeAll(()=>{process.env.WITHDRAWAL_ACTIVATION_EMULATOR_ONLY='yes';app=initializeApp({projectId:project},`yellow10h_${randomUUID()}`);db=getFirestore(app);});
beforeEach(async()=>{
 seasonId=`yellow10h_${randomUUID().replaceAll('-','')}`;
 await Promise.all([
  season().set({status:'active'}),
  season().collection('withdrawalSettings').doc('official').set(config),
  season().collection('teamEntries').doc(teamId).set({status:'active'}),
  reg().set({seasonId,teamId,effectiveMatchweek:6,phase:'first_leg',policy:'void_all',formatSnapshot:config,state:'draft_pending_activation',effectsApplied:false}),
  record().set({seasonId,playerId:'p1',playerName:'Demo',teamId:'other',seasonYellowCards:5,currentYellowCycle:0,directRedCards:0,activeSuspensionIds:[],processedSourceMatchIds:[1,2,3,4,5].map(mid)}),
  suspension().set({seasonId,playerId:'p1',reason:'yellowAccumulation',sourceMatchId:mid(5),status:'completed',totalMatches:1,servedMatches:1,remainingMatches:0,servedMatchIds:[mid(6)],servedMatchweeks:[6]}),
  ...[1,2,3,4,5,6].flatMap(week=>[
   match(week).set({seasonId,homeTeamId:week===5?teamId:'other',awayTeamId:week===5?'other':`rival${week}`,matchweek:week,matchType:'regularSeason',status:'played',homeScore:1,awayScore:0}),
   report(week).set({seasonId,matchId:mid(week),status:'published',data:{homeScore:1,awayScore:0,performances:{p1:{playerId:'p1',teamId:'other',yellowCards:week<=5?1:0,directRedCards:0}}}})
  ])
 ]);
});
afterAll(async()=>{if(app)await deleteApp(app);delete process.env.WITHDRAWAL_ACTIVATION_EMULATOR_ONLY;});
describe('10H: replay transazionale della quinta ammonizione già scontata',()=>{
 it('annulla quinta ammonizione e squalifica scontata senza toccare i tabellini',async()=>{
  await stage();expect((await activateWithdrawalInEmulator(db,request())).status).toBe('applied');
  expect((await record().get()).data()).toMatchObject({seasonYellowCards:4,currentYellowCycle:4,processedSourceMatchIds:[1,2,3,4].map(mid)});
  expect((await suspension().get()).data()).toMatchObject({status:'cancelled',servedMatches:0,servedMatchIds:[]});
  expect((await report(5).get()).data()?.status).toBe('published');
  expect((await match(6).get()).data()?.status).toBe('played');
 });
 it('ripristina precisamente i cinque gialli e lo sconto storico',async()=>{
  await stage();await activateWithdrawalInEmulator(db,request());
  expect((await reverseWithdrawalInEmulator(db,request())).status).toBe('reversed');
  expect((await record().get()).data()).toMatchObject({seasonYellowCards:5,currentYellowCycle:0,processedSourceMatchIds:[1,2,3,4,5].map(mid)});
  expect((await suspension().get()).data()).toMatchObject({status:'completed',servedMatches:1,servedMatchIds:[mid(6)],servedMatchweeks:[6]});
 });
 it('ripetizione identica non sottrae due volte',async()=>{
  await stage();await activateWithdrawalInEmulator(db,request());
  expect((await activateWithdrawalInEmulator(db,request())).status).toBe('unchanged');
  expect((await record().get()).data()?.seasonYellowCards).toBe(4);
 });
 it('rifiuta cinque gialli se manca un report storico',async()=>{
  await report(3).delete();await stage();
  await expect(activateWithdrawalInEmulator(db,request())).rejects.toThrow(/cinque ammonizioni/i);
  expect((await reg().get()).data()?.effectsApplied).toBe(false);
 });
 it('blocca una gara di sconto anticipata',async()=>{
  await match(6).update({matchweek:4});await stage();
  await expect(activateWithdrawalInEmulator(db,request())).rejects.toThrow(/gara di sconto gialli/i);
 });
 it('conserva i provvedimenti manuali bloccando il ciclo ambiguo',async()=>{
  await db.collection('disciplinarySuspensions').doc(`${seasonId}_manual`).set({seasonId,playerId:'p1',reason:'sportsJudge',status:'active',totalMatches:1,servedMatches:0,remainingMatches:1});
  await stage();
  await expect(activateWithdrawalInEmulator(db,request())).rejects.toThrow(/replay completo/i);
  expect((await suspension().get()).data()?.status).toBe('completed');
 });
});
