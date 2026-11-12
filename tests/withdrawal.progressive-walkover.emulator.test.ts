import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { initializeApp,deleteApp,type App } from 'firebase-admin/app';
import { getFirestore,type Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { matureWithdrawalWalkoverInEmulator } from '../src/services/withdrawal/WithdrawalProgressiveWalkoverTransaction';
const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
if (!process.env.FIRESTORE_EMULATOR_HOST || !project?.startsWith('demo-')) throw new Error('Demo emulator obbligatorio.');
let app:App,db:Firestore,seasonId:string;
const teamId='bristol',matchId=()=>`${seasonId}_mw14`;
const season=()=>db.collection('seasons').doc(seasonId);
const reg=()=>season().collection('withdrawalRegistrations').doc(teamId);
const ledger=()=>season().collection('withdrawalEffectLedgers').doc(teamId);
const closure=()=>season().collection('officialMatchweekClosures').doc('14');
const fixture=()=>db.collection('matches').doc(matchId());
const award=()=>season().collection('withdrawalWalkoverAwards').doc(matchId());
const req=()=>({seasonId,withdrawnTeamId:teamId,matchId:matchId(),matchweek:14,adminUid:'demo_admin'});
const close=()=>closure().set({seasonId,matchweek:14,state:'officially_closed',closedBy:'demo_admin',closedAt:new Date().toISOString()});
beforeAll(()=>{app=initializeApp({projectId:project},`walk10i_${randomUUID()}`);db=getFirestore(app);});
beforeEach(async()=>{
 seasonId=`walk10i_${randomUUID().replaceAll('-','')}`;
 await Promise.all([
  season().set({status:'active'}),
  reg().set({state:'active',effectsApplied:true,activationCommitId:'commit_demo'}),
  ledger().set({state:'applied',effectsApplied:true,activationCommitId:'commit_demo',operationId:'op_demo',policy:'retain_and_walkover',effectiveMatchweek:12,entries:[{matchId:matchId(),matchweek:14,opponentTeamId:'oxford',effect:'walkover_pending_official_closure',reportIds:[]}]}),
  fixture().set({seasonId,homeTeamId:'oxford',awayTeamId:teamId,matchweek:14,matchType:'regularSeason',status:'scheduled'}),
 ]);
});
afterAll(async()=>{if(app)await deleteApp(app);});
describe('10I: tavolini progressivi - SOLO emulator',()=>{
 it('senza chiusura ufficiale non registra premi e non attribuisce punti',async()=>{
  await expect(matureWithdrawalWalkoverInEmulator(db,req())).rejects.toThrow(/ufficialmente conclusa/i);
  expect((await award().get()).exists).toBe(false);
 });
 it('dopo chiusura ufficiale registra una sola assegnazione 6-0, senza toccare match',async()=>{
  await close(); const result=await matureWithdrawalWalkoverInEmulator(db,req());
  expect(result).toMatchObject({status:'created',winnerTeamId:'oxford',winnerPoints:3});
  expect((await award().get()).data()).toMatchObject({state:'recorded_pending_publication',homeScore:6,awayScore:0});
  expect((await fixture().get()).data()).toMatchObject({status:'scheduled'});
 });
 it('due richieste identiche sono idempotenti',async()=>{
  await close();await matureWithdrawalWalkoverInEmulator(db,req());
  expect((await matureWithdrawalWalkoverInEmulator(db,req())).status).toBe('unchanged');
  expect((await season().collection('withdrawalWalkoverAwards').get()).size).toBe(1);
 });
 it('blocca giornate discordanti e non anticipa i tavolini futuri',async()=>{
  await close();const bad={...req(),matchweek:15};
  await expect(matureWithdrawalWalkoverInEmulator(db,bad)).rejects.toThrow();
  expect((await award().get()).exists).toBe(false);
 });
 it('blocca gare modificate e un registro non attivo',async()=>{
  await close();await fixture().update({status:'played'});
  await expect(matureWithdrawalWalkoverInEmulator(db,req())).rejects.toThrow(/calendario incompatibile/i);
  await fixture().update({status:'scheduled'});await ledger().update({state:'staged_review_only'});
  await expect(matureWithdrawalWalkoverInEmulator(db,req())).rejects.toThrow(/registro effetti/i);
 });
 it('blocca duplicati discordanti senza sovrascrivere audit e assegnazione',async()=>{
  await close();await matureWithdrawalWalkoverInEmulator(db,req());
  await award().update({winnerPoints:7});
  await expect(matureWithdrawalWalkoverInEmulator(db,req())).rejects.toThrow(/discordante/i);
  expect((await award().get()).data()?.winnerPoints).toBe(7);
 });
});
