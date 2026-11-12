import {describe,it,expect,beforeAll,beforeEach,afterAll} from 'vitest';
import {initializeApp,deleteApp,type App} from 'firebase-admin/app';
import {getFirestore,type Firestore} from 'firebase-admin/firestore';
import {randomUUID} from 'node:crypto';
import {createCalendarAndWithdrawalCandidatesInDemo} from '../src/services/withdrawal/WithdrawalAtomicCalendarImport';

const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
if (!process.env.FIRESTORE_EMULATOR_HOST || !project?.startsWith('demo-'))
  throw new Error('Emulatore Firestore demo- obbligatorio.');
let app:App,db:Firestore,seasonId:string;
const season=()=>db.collection('seasons').doc(seasonId);
const team='bristol';
const ledger=()=>season().collection('withdrawalEffectLedgers').doc(team);
const registration=()=>season().collection('withdrawalRegistrations').doc(team);
const f=(homeTeamId='oxford',awayTeamId=team,date='2026-12-03',time='20:30')=>({homeTeamId,awayTeamId,date,time,venue:'Centro Sportivo Ludi'});
const req=(fixtures=[f()],matchweek=14)=>({seasonId,matchweek,fixtures,adminUid:'demo_admin'});
const matchDocs=()=>db.collection('matches').where('seasonId','==',seasonId).get();
const activate=async()=>{
 await registration().set({state:'active',effectsApplied:true,activationCommitId:'commit_demo'});
 await ledger().set({state:'applied',effectsApplied:true,policy:'retain_and_walkover',activationCommitId:'commit_demo',operationId:'op_demo',effectiveMatchweek:12,entries:[]});
};
beforeAll(()=>{app=initializeApp({projectId:project},`atomic_${randomUUID()}`);db=getFirestore(app);});
beforeEach(async()=>{seasonId=`atomic_${randomUUID().replaceAll('-','')}`;await season().set({status:'active'});});
afterAll(async()=>{if(app)await deleteApp(app);});
describe('11A - calendario e registro nel medesimo commit (solo emulator)',()=>{
 it('crea una gara e registra il tavolino pending, senza creare premi',async()=>{
  await activate();
  const result=await createCalendarAndWithdrawalCandidatesInDemo(db,req());
  expect(result).toMatchObject({registeredPendingWalkovers:1,awardedWalkovers:0});
  expect(result.createdMatchIds).toHaveLength(1);
  expect((await matchDocs()).size).toBe(1);
  expect((await ledger().get()).data()?.entries).toMatchObject([{
   matchId:result.createdMatchIds[0],matchweek:14,opponentTeamId:'oxford',effect:'walkover_pending_official_closure',reportIds:[],
  }]);
  expect((await season().collection('withdrawalWalkoverAwards').get()).empty).toBe(true);
 });
 it('importa due partite ma registra solo quella con la ritirata',async()=>{
  await activate();const result=await createCalendarAndWithdrawalCandidatesInDemo(db,req([f(),f('fulham','luton','2026-12-04','21:30')]));
  expect(result).toMatchObject({registeredPendingWalkovers:1,awardedWalkovers:0});
  expect((await matchDocs()).size).toBe(2);
  expect((await ledger().get()).data()?.entries).toHaveLength(1);
 });
 it('gestisce anche una stagione senza ritiri attivi',async()=>{
  const result=await createCalendarAndWithdrawalCandidatesInDemo(db,req());
  expect(result.registeredPendingWalkovers).toBe(0);
  expect((await matchDocs()).size).toBe(1);
 });
 it('non salva nulla se registro del ritiro e attivazione sono discordanti',async()=>{
  await activate();await ledger().update({activationCommitId:'wrong'});
  await expect(createCalendarAndWithdrawalCandidatesInDemo(db,req())).rejects.toThrow(/compatibile/i);
  expect((await matchDocs()).empty).toBe(true);
 });
 it('non salva nulla se la giornata risulta ufficialmente chiusa',async()=>{
  await activate();await season().collection('officialMatchweekClosures').doc('14').set({state:'officially_closed'});
  await expect(createCalendarAndWithdrawalCandidatesInDemo(db,req())).rejects.toThrow(/conclusa/i);
  expect((await matchDocs()).empty).toBe(true);
  expect((await ledger().get()).data()?.entries).toEqual([]);
 });
 it('blocca import ripetuti e non aggiunge effetti duplicati',async()=>{
  await activate();await createCalendarAndWithdrawalCandidatesInDemo(db,req());
  await expect(createCalendarAndWithdrawalCandidatesInDemo(db,req())).rejects.toThrow(/presente/i);
  expect((await matchDocs()).size).toBe(1);
  expect((await ledger().get()).data()?.entries).toHaveLength(1);
 });
 it('blocca squadra duplicata nell input senza salvare gare',async()=>{
  await activate();
  await expect(createCalendarAndWithdrawalCandidatesInDemo(db,req([f(),f('oxford','fulham','2026-12-04','21:30')]))).rejects.toThrow(/duplicato/i);
  expect((await matchDocs()).empty).toBe(true);
 });
 it('blocca ritiro nel girone di andata non supportato da questa transazione',async()=>{
  await registration().set({state:'active',effectsApplied:true,activationCommitId:'commit_demo'});
  await ledger().set({state:'applied',effectsApplied:true,policy:'void_all',activationCommitId:'commit_demo',operationId:'op_demo',effectiveMatchweek:6,entries:[]});
  await expect(createCalendarAndWithdrawalCandidatesInDemo(db,req())).rejects.toThrow(/compatibile/i);
  expect((await matchDocs()).empty).toBe(true);
 });
});
