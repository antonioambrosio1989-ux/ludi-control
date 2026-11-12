import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { prepareWithdrawalTestIntent } from '../src/services/withdrawal/WithdrawalPreparationTransaction';
import { snapshotWithdrawalForReview } from '../src/services/withdrawal/WithdrawalActivationSnapshotTransaction';
import { stageWithdrawalEffectLedger } from '../src/services/withdrawal/WithdrawalEffectLedgerTransaction';
const host=process.env.FIRESTORE_EMULATOR_HOST;
const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
if(!host || !/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host) || !project?.startsWith('demo-')) throw new Error('SOLO Firestore Emulator e progetto demo-.');
let app:App,db:Firestore,seasonId:string;
const teamId='bristol';
const cfg={format:'double_round_robin',totalMatchweeks:22,firstReturnMatchweek:12};
const season=()=>db.collection('seasons').doc(seasonId);
const match=(name:string)=>db.collection('matches').doc(`${seasonId}_${name}`);
const report=()=>db.collection('matchReports').doc(`${seasonId}_r1`);
const registration=()=>season().collection('withdrawalRegistrations').doc(teamId);
const ledger=()=>season().collection('withdrawalEffectLedgers').doc(teamId);
const request=()=>({seasonId,teamId,expectedMatchweek:6,adminUid:'test_admin'});
async function prepare() {
  await prepareWithdrawalTestIntent(db,request());
  await snapshotWithdrawalForReview(db,request());
}
beforeAll(()=>{app=initializeApp({projectId:project},`withdrawal-10b-${randomUUID()}`);db=getFirestore(app);});
beforeEach(async()=>{
  seasonId=`withdrawal_10b_${randomUUID().replaceAll('-','')}`;
  await Promise.all([
    season().set({status:'active'}),
    season().collection('withdrawalSettings').doc('official').set(cfg),
    season().collection('teamEntries').doc(teamId).set({status:'active'}),
    registration().set({seasonId,teamId,effectiveMatchweek:6,phase:'first_leg',policy:'void_all',formatSnapshot:cfg,state:'draft_pending_activation',effectsApplied:false}),
    match('m1').set({seasonId,matchType:'regularSeason',homeTeamId:teamId,awayTeamId:'opponent',status:'played',matchweek:2,homeScore:3,awayScore:1}),
    match('m2').set({seasonId,matchType:'regularSeason',homeTeamId:'opponent2',awayTeamId:teamId,status:'postponed',matchweek:4}),
    match('unrelated').set({seasonId,matchType:'regularSeason',homeTeamId:'other',awayTeamId:'another',status:'played',matchweek:3}),
    report().set({seasonId,matchId:`${seasonId}_m1`,status:'published',data:{homeScore:3,awayScore:1,goals:[{playerId:'p1'}]}}),
  ]);
});
afterAll(async()=>{if(app) await deleteApp(app);});
describe('10B: piano effetti persistente sull emulator (NON attivazione)',()=>{
  it('registra annullamenti e report correlati senza alterare partite, report o bozza',async()=>{
    await prepare();
    const result=await stageWithdrawalEffectLedger(db,request());
    expect(result.state).toBe('created');
    expect(result.entries).toHaveLength(2);
    expect(result.entries.every(e=>e.effect==='void')).toBe(true);
    expect(result.entries.find(e=>e.matchId.endsWith('_m1'))?.reportIds).toEqual([`${seasonId}_r1`]);
    expect((await ledger().get()).data()).toMatchObject({state:'staged_review_only',effectsApplied:false});
    expect((await registration().get()).data()).toMatchObject({state:'draft_pending_activation',effectsApplied:false});
    expect((await match('m1').get()).data()?.homeScore).toBe(3);
    expect((await report().get()).data()?.data.goals).toHaveLength(1);
  });
  it('rimane idempotente su ripetizione identica',async()=>{
    await prepare();
    const a=await stageWithdrawalEffectLedger(db,request());
    const b=await stageWithdrawalEffectLedger(db,request());
    expect(a.state).toBe('created');expect(b.state).toBe('unchanged');
    expect((await season().collection('withdrawalEffectLedgers').get()).size).toBe(1);
  });
  it('rifiuta tabellino cambiato dopo snapshot',async()=>{
    await prepare();await report().update({'data.homeScore':7});
    await expect(stageWithdrawalEffectLedger(db,request())).rejects.toThrow(/obsoleto/i);
    expect((await ledger().get()).exists).toBe(false);
  });
  it('rifiuta gara aggiunta dopo snapshot',async()=>{
    await prepare();await match('new').set({seasonId,homeTeamId:teamId,awayTeamId:'third',matchweek:8,status:'scheduled'});
    await expect(stageWithdrawalEffectLedger(db,request())).rejects.toThrow(/obsoleto/i);
  });
  it('rifiuta snapshot o preparazione mancanti',async()=>{
    await expect(stageWithdrawalEffectLedger(db,request())).rejects.toThrow(/mancante/i);
    expect((await ledger().get()).exists).toBe(false);
  });
  it('rifiuta bozza annullata, senza scritture',async()=>{
    await prepare();await registration().update({state:'cancelled'});
    await expect(stageWithdrawalEffectLedger(db,request())).rejects.toThrow();
    expect((await ledger().get()).exists).toBe(false);
  });
  it('rileva manomissione del registro e non lo sovrascrive',async()=>{
    await prepare();await stageWithdrawalEffectLedger(db,request());
    await ledger().update({signature:'alterata'});
    await expect(stageWithdrawalEffectLedger(db,request())).rejects.toThrow(/conflitto/i);
  });
  it('non interviene su partite di altre squadre e non attribuisce tavolini',async()=>{
    await prepare();const result=await stageWithdrawalEffectLedger(db,request());
    expect(result.entries.some(e=>e.matchId.endsWith('_unrelated'))).toBe(false);
    const unrelated=await match('unrelated').get();
    expect(unrelated.data()?.status).toBe('played');
    expect((await ledger().get()).data()?.state).toBe('staged_review_only');
    expect((await registration().get()).data()?.effectsApplied).toBe(false);
  });
});
