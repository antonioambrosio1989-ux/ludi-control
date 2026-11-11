import {beforeAll,afterAll,beforeEach,describe,it,expect} from 'vitest';
import {initializeApp,deleteApp,type App} from 'firebase-admin/app';
import {getFirestore,type Firestore} from 'firebase-admin/firestore';
import {randomUUID} from 'node:crypto';
import {activateOfficialSecondLegWithdrawal,closeAndAwardOfficialWeek} from '../src/services/withdrawal/WithdrawalOfficialProduction';
const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
if(!process.env.FIRESTORE_EMULATOR_HOST||!project?.startsWith('demo-'))throw new Error('Questi test richiedono solo un emulatore e progetto demo-.');
let app:App,db:Firestore,seasonId:string;
const teamId='corsari';
const cfg={format:'double_round_robin',totalMatchweeks:4,firstReturnMatchweek:3};
const season=()=>db.collection('seasons').doc(seasonId);
const doc=(week:number,type:'target'|'normal')=>db.collection('matches').doc(`${seasonId}_${week}_${type}`);
const report=(week:number,type:'target'|'normal')=>db.collection('matchReports').doc(`${seasonId}_${week}_${type}`);
const reg=()=>season().collection('withdrawalRegistrations').doc(teamId);
const ledger=()=>season().collection('withdrawalEffectLedgers').doc(teamId);
const audit=()=>season().collection('withdrawalActivationCommits').doc(teamId);
const closure=(week:number)=>season().collection('officialMatchweekClosures').doc(String(week));
const award=(week:number)=>season().collection('withdrawalWalkoverAwards').doc(doc(week,'target').id);
const req=()=>({seasonId,teamId,adminUid:'test_admin',expectedMatchweek:3});
beforeAll(()=>{app=initializeApp({projectId:project},`prod11f_${randomUUID()}`);db=getFirestore(app);});
afterAll(async()=>{await deleteApp(app);});
beforeEach(async()=>{
 seasonId=`prod11f_${randomUUID().replaceAll('-','')}`;
 await Promise.all([
  season().set({status:'active',competitionId:'championship'}),
  season().collection('withdrawalSettings').doc('official').set(cfg),
  season().collection('teamEntries').doc(teamId).set({status:'active'}),
  reg().set({seasonId,teamId,effectiveMatchweek:3,phase:'second_leg',policy:'retain_and_walkover',
    state:'draft_pending_activation',effectsApplied:false,formatSnapshot:cfg}),
 ]);
 const writes:Promise<unknown>[]=[];
 for(let week=1;week<=4;week++){
  const past=week<3;
  for(const type of ['target','normal'] as const){
   const home=type==='target'?teamId:'aquila';const away=type==='target'?'borgo':'delfini';
   const completed=past;
   writes.push(doc(week,type).set({seasonId,matchweek:week,matchType:'regularSeason',homeTeamId:home,awayTeamId:away,
     status:completed?'played':'scheduled',...(completed?{homeScore:3,awayScore:2}:{})}));
   if(completed)writes.push(report(week,type).set({seasonId,matchId:doc(week,type).id,status:'published',
     data:{status:'played',homeScore:3,awayScore:2}}));
  }
 }
 await Promise.all(writes);
});
describe('11F-19: withdrawal official production operations on emulator',()=>{
 it('activates valid second leg atomically without rewriting matches or reports',async()=>{
  const result=await activateOfficialSecondLegWithdrawal(db,req());
  expect(result.status).toBe('applied');
  expect((await reg().get()).data()).toMatchObject({state:'active',effectsApplied:true,activationCommitId:result.commitId});
  expect((await ledger().get()).data()).toMatchObject({state:'applied',effectsApplied:true,policy:'retain_and_walkover'});
  expect((await audit().get()).data()).toMatchObject({state:'applied'});
  expect((await doc(3,'target').get()).data()).toMatchObject({status:'scheduled'});
  expect((await report(3,'target').get()).exists).toBe(false);
 });
 it('rejects incomplete future schedule without applying withdrawal',async()=>{
  await doc(4,'target').delete();
  await expect(activateOfficialSecondLegWithdrawal(db,req())).rejects.toThrow(/calendario/i);
  expect((await reg().get()).data()?.state).toBe('draft_pending_activation');
 });
 it('rejects future match with a score',async()=>{
  await doc(3,'target').update({homeScore:2});
  await expect(activateOfficialSecondLegWithdrawal(db,req())).rejects.toThrow(/futura/i);
 });
 it('prevents walkovers before normal match report is published',async()=>{
  await activateOfficialSecondLegWithdrawal(db,req());
  await expect(closeAndAwardOfficialWeek(db,{...req(),matchweek:3})).rejects.toThrow(/tabellino/i);
  expect((await award(3).get()).exists).toBe(false);
  expect((await closure(3).get()).exists).toBe(false);
 });
 it('closes the round and awards exactly one 6-0, preserving individual statistics',async()=>{
  await activateOfficialSecondLegWithdrawal(db,req());
  await doc(3,'normal').update({status:'finished',homeScore:4,awayScore:3});
  await report(3,'normal').set({seasonId,matchId:doc(3,'normal').id,status:'published',data:{status:'played',homeScore:4,awayScore:3}});
  const first=await closeAndAwardOfficialWeek(db,{...req(),matchweek:3});
  expect(first.status).toBe('created');
  const second=await closeAndAwardOfficialWeek(db,{...req(),matchweek:3});
  expect(second.status).toBe('unchanged');
  expect((await closure(3).get()).data()).toMatchObject({state:'officially_closed',matchweek:3});
  expect((await award(3).get()).data()).toMatchObject({state:'recorded_pending_publication',homeScore:0,awayScore:6,winnerPoints:3});
  expect((await doc(3,'target').get()).data()?.status).toBe('scheduled');
  expect((await report(3,'target').get()).exists).toBe(false);
  expect((await season().collection('withdrawalWalkoverAwards').get()).size).toBe(1);
 });
 it('refuses the following round until previous closure and normal game publication',async()=>{
  await activateOfficialSecondLegWithdrawal(db,req());
  await expect(closeAndAwardOfficialWeek(db,{...req(),matchweek:4})).rejects.toThrow(/precedente/i);
 });
 it('rejects first-leg void_all: disciplinary replay is not enabled',async()=>{
  await reg().update({effectiveMatchweek:2,policy:'void_all',phase:'first_leg'});
  await expect(activateOfficialSecondLegWithdrawal(db,{...req(),expectedMatchweek:2})).rejects.toThrow(/andata/i);
 });
});
