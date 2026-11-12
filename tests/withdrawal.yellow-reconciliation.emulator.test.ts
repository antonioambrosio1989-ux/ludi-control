import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { prepareWithdrawalTestIntent } from '../src/services/withdrawal/WithdrawalPreparationTransaction';
import { snapshotWithdrawalForReview } from '../src/services/withdrawal/WithdrawalActivationSnapshotTransaction';
import { stageWithdrawalEffectLedger } from '../src/services/withdrawal/WithdrawalEffectLedgerTransaction';
import { activateWithdrawalInEmulator, reverseWithdrawalInEmulator } from '../src/services/withdrawal/WithdrawalEmulatorActivation';
const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
if (!process.env.FIRESTORE_EMULATOR_HOST || !project?.startsWith('demo-')) throw new Error('Solo emulatore demo.');
let app:App,db:Firestore,seasonId:string;
const teamId='bristol';
const config={format:'double_round_robin',totalMatchweeks:22,firstReturnMatchweek:12};
const season=()=>db.collection('seasons').doc(seasonId);
const reg=()=>season().collection('withdrawalRegistrations').doc(teamId);
const match=()=>db.collection('matches').doc(`${seasonId}_m1`);
const report=()=>db.collection('matchReports').doc(`${seasonId}_report`);
const discipline=()=>db.collection('disciplinaryRecords').doc(`${seasonId}_p1`);
const req=()=>({seasonId,teamId,expectedMatchweek:6,adminUid:'admin_demo'});
const stage=async()=>{await prepareWithdrawalTestIntent(db,req());await snapshotWithdrawalForReview(db,req());await stageWithdrawalEffectLedger(db,req());};
beforeAll(()=>{process.env.WITHDRAWAL_ACTIVATION_EMULATOR_ONLY='yes';app=initializeApp({projectId:project},`yellow10e_${randomUUID()}`);db=getFirestore(app);});
beforeEach(async()=>{
 seasonId=`yellow10e_${randomUUID().replaceAll('-','')}`;
 await Promise.all([
   season().set({status:'active'}),season().collection('withdrawalSettings').doc('official').set(config),
   season().collection('teamEntries').doc(teamId).set({status:'active'}),
   reg().set({seasonId,teamId,effectiveMatchweek:6,phase:'first_leg',policy:'void_all',formatSnapshot:config,state:'draft_pending_activation',effectsApplied:false}),
   match().set({seasonId,homeTeamId:teamId,awayTeamId:'other',matchweek:2,matchType:'regularSeason',status:'played',homeScore:1,awayScore:0}),
   report().set({seasonId,matchId:`${seasonId}_m1`,status:'published',data:{homeScore:1,awayScore:0,performances:{p1:{playerId:'p1',teamId,yellowCards:2,directRedCards:0}}}}),
   discipline().set({seasonId,playerId:'p1',seasonYellowCards:2,currentYellowCycle:2,directRedCards:0,activeSuspensionIds:[],processedSourceMatchIds:[`${seasonId}_m1`],playerName:'Demo',teamId}),
 ]);
});
afterAll(async()=>{if(app)await deleteApp(app);delete process.env.WITHDRAWAL_ACTIVATION_EMULATOR_ONLY;});
describe('10E: riconciliazione reale e reversibile gialli (solo emulatore)',()=>{
 it('attiva e sottrae conteggi, conservando report e audit',async()=>{
  await stage();expect((await activateWithdrawalInEmulator(db,req())).status).toBe('applied');
  const record=(await discipline().get()).data()!;
  expect(record.seasonYellowCards).toBe(0);expect(record.currentYellowCycle).toBe(0);
  expect(record.processedSourceMatchIds).toEqual([]);
  expect((await report().get()).data()?.data.performances.p1.yellowCards).toBe(2);
  expect((await reg().get()).data()?.effectsApplied).toBe(true);
  const audit=(await season().collection('withdrawalActivationCommits').doc(teamId).get()).data()!;
  expect(audit.disciplineChanges).toHaveLength(1);
 });
 it('ripristina esattamente i conteggi originali',async()=>{
  await stage();await activateWithdrawalInEmulator(db,req());
  expect((await reverseWithdrawalInEmulator(db,req())).status).toBe('reversed');
  const record=(await discipline().get()).data()!;
  expect(record.seasonYellowCards).toBe(2);expect(record.currentYellowCycle).toBe(2);
  expect(record.processedSourceMatchIds).toEqual([`${seasonId}_m1`]);
  expect((await reg().get()).data()?.effectsApplied).toBe(false);
 });
 it('impedisce ripristino se il record viene cambiato dopo attivazione',async()=>{
  await stage();await activateWithdrawalInEmulator(db,req());
  await discipline().update({currentYellowCycle:1});
  await expect(reverseWithdrawalInEmulator(db,req())).rejects.toThrow(/modificato/i);
  expect((await reg().get()).data()?.effectsApplied).toBe(true);
 });
 it('non attiva se il ciclo precedente non coincide coi report',async()=>{
  await discipline().update({seasonYellowCards:3,currentYellowCycle:3});await stage();
  await expect(activateWithdrawalInEmulator(db,req())).rejects.toThrow(/riconciliabile/i);
  expect((await discipline().get()).data()?.seasonYellowCards).toBe(3);
  expect((await reg().get()).data()?.effectsApplied).toBe(false);
 });
 it('non attiva con squalifica automatica preesistente',async()=>{
  await db.collection('disciplinarySuspensions').doc(`${seasonId}_s1`).set({seasonId,playerId:'p1',reason:'yellowAccumulation',status:'active',remainingMatches:1});
  await stage();await expect(activateWithdrawalInEmulator(db,req())).rejects.toThrow(/squalifiche/i);
  expect((await discipline().get()).data()?.seasonYellowCards).toBe(2);
 });
 it('è idempotente anche con conteggi già azzerati',async()=>{
  await stage();await activateWithdrawalInEmulator(db,req());
  expect((await activateWithdrawalInEmulator(db,req())).status).toBe('unchanged');
  expect((await discipline().get()).data()?.seasonYellowCards).toBe(0);
 });
});
