import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {randomUUID} from 'node:crypto';
import {prepareWithdrawalTestIntent} from '../src/services/withdrawal/WithdrawalPreparationTransaction';
import {snapshotWithdrawalForReview} from '../src/services/withdrawal/WithdrawalActivationSnapshotTransaction';
import {stageWithdrawalEffectLedger} from '../src/services/withdrawal/WithdrawalEffectLedgerTransaction';
import {activateWithdrawalInEmulator,reverseWithdrawalInEmulator} from '../src/services/withdrawal/WithdrawalEmulatorActivation';
const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
if(!process.env.FIRESTORE_EMULATOR_HOST||!project?.startsWith('demo-'))throw new Error('Eseguire solo con Firebase Emulator e progetto demo-.');
let app:App,db:Firestore,seasonId:string;
const teamId='bristol';
const cfg={format:'double_round_robin',totalMatchweeks:22,firstReturnMatchweek:12};
const season=()=>db.collection('seasons').doc(seasonId);
const reg=()=>season().collection('withdrawalRegistrations').doc(teamId);
const audit=()=>season().collection('withdrawalActivationCommits').doc(teamId);
const ledger=()=>season().collection('withdrawalEffectLedgers').doc(teamId);
const match=(suffix:string)=>db.collection('matches').doc(`${seasonId}_${suffix}`);
const report=()=>db.collection('matchReports').doc(`${seasonId}_r1`);
const request=()=>({seasonId,teamId,expectedMatchweek:6,adminUid:'admin_test'});
async function stage(){await prepareWithdrawalTestIntent(db,request());await snapshotWithdrawalForReview(db,request());await stageWithdrawalEffectLedger(db,request());}
beforeAll(()=>{process.env.WITHDRAWAL_ACTIVATION_EMULATOR_ONLY='yes';app=initializeApp({projectId:project},`activation10c_${randomUUID()}`);db=getFirestore(app);});
beforeEach(async()=>{
 seasonId=`withdrawal_10c_${randomUUID().replaceAll('-','')}`;
 await Promise.all([
  season().set({status:'active'}),season().collection('withdrawalSettings').doc('official').set(cfg),
  season().collection('teamEntries').doc(teamId).set({status:'active'}),
  reg().set({seasonId,teamId,effectiveMatchweek:6,phase:'first_leg',policy:'void_all',formatSnapshot:cfg,state:'draft_pending_activation',effectsApplied:false}),
  match('m1').set({seasonId,matchType:'regularSeason',homeTeamId:teamId,awayTeamId:'opponent',status:'played',matchweek:2,homeScore:3,awayScore:1}),
  match('m2').set({seasonId,matchType:'regularSeason',homeTeamId:'opponent2',awayTeamId:teamId,status:'postponed',matchweek:4}),
  match('other').set({seasonId,matchType:'regularSeason',homeTeamId:'other',awayTeamId:'another',status:'played',matchweek:3}),
  report().set({seasonId,matchId:`${seasonId}_m1`,status:'published',data:{homeScore:3,awayScore:1,goals:[{playerId:'p1'}]}}),
 ]);
});
afterAll(async()=>{if(app)await deleteApp(app);delete process.env.WITHDRAWAL_ACTIVATION_EMULATOR_ONLY;});
describe('10C applicazione e reversibilita solo nell emulatore',()=>{
 it('attiva registrazione e registro atomici, senza cancellare partite o report',async()=>{
  await stage();const a=await activateWithdrawalInEmulator(db,request());
  expect(a.status).toBe('applied');
  expect((await reg().get()).data()).toMatchObject({state:'active',effectsApplied:true,activationCommitId:a.commitId});
  expect((await ledger().get()).data()).toMatchObject({state:'applied',effectsApplied:true});
  expect((await audit().get()).data()).toMatchObject({state:'applied',policy:'void_all'});
  expect((await match('m1').get()).data()?.homeScore).toBe(3);
  expect((await report().get()).data()?.data.goals).toHaveLength(1);
  expect((await match('other').get()).data()?.status).toBe('played');
 });
 it('doppia attivazione idempotente',async()=>{await stage();const a=await activateWithdrawalInEmulator(db,request());const b=await activateWithdrawalInEmulator(db,request());expect(b).toEqual({status:'unchanged',commitId:a.commitId});});
 it('rifiuta report cambiato dopo la revisione',async()=>{await stage();await report().update({'data.homeScore':9});await expect(activateWithdrawalInEmulator(db,request())).rejects.toThrow(/obsoleto/i);expect((await reg().get()).data()?.state).toBe('draft_pending_activation');});
 it('rifiuta nuovo match dopo lo snapshot',async()=>{await stage();await match('new').set({seasonId,homeTeamId:teamId,awayTeamId:'third',matchweek:8,status:'scheduled'});await expect(activateWithdrawalInEmulator(db,request())).rejects.toThrow(/obsoleto/i);});
 it('ripristina stato originale senza modificare tabellini e mantiene audit',async()=>{await stage();await activateWithdrawalInEmulator(db,request());expect(await reverseWithdrawalInEmulator(db,request())).toEqual({status:'reversed'});expect(await reverseWithdrawalInEmulator(db,request())).toEqual({status:'unchanged'});expect((await reg().get()).data()).toMatchObject({state:'draft_pending_activation',effectsApplied:false});expect((await audit().get()).data()?.state).toBe('reversed');expect((await report().get()).data()?.data.homeScore).toBe(3);});
 it('blocca riattivazione dopo un ripristino senza nuova revisione',async()=>{await stage();await activateWithdrawalInEmulator(db,request());await reverseWithdrawalInEmulator(db,request());await expect(activateWithdrawalInEmulator(db,request())).rejects.toThrow(/precedente/i);});
 it('rifiuta riattivazione con registro manomesso',async()=>{await stage();await ledger().update({signature:'tampered'});await expect(activateWithdrawalInEmulator(db,request())).rejects.toThrow(/manomesso/i);});
 it('rifiuta se manca la preparazione',async()=>{await expect(activateWithdrawalInEmulator(db,request())).rejects.toThrow(/incompleta/i);});
});
