import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { prepareWithdrawalTestIntent } from '../src/services/withdrawal/WithdrawalPreparationTransaction';
import { snapshotWithdrawalForReview } from '../src/services/withdrawal/WithdrawalActivationSnapshotTransaction';
import { stageWithdrawalEffectLedger } from '../src/services/withdrawal/WithdrawalEffectLedgerTransaction';
import { activateWithdrawalInEmulator, reverseWithdrawalInEmulator } from '../src/services/withdrawal/WithdrawalEmulatorActivation';
const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
if (!process.env.FIRESTORE_EMULATOR_HOST || !project?.startsWith('demo-')) throw new Error('Solo Firestore Emulator demo-.');
let app: App, db: Firestore, seasonId: string;
const teamId = 'bristol';
const config = { format:'double_round_robin', totalMatchweeks:22, firstReturnMatchweek:12 };
const season = () => db.collection('seasons').doc(seasonId);
const reg = () => season().collection('withdrawalRegistrations').doc(teamId);
const ledger = () => season().collection('withdrawalEffectLedgers').doc(teamId);
const match = () => db.collection('matches').doc(`${seasonId}_m1`);
const report = () => db.collection('matchReports').doc(`${seasonId}_report`);
const req = () => ({ seasonId, teamId, expectedMatchweek:6, adminUid:'admin_demo' });
const stage = async () => { await prepareWithdrawalTestIntent(db,req()); await snapshotWithdrawalForReview(db,req()); await stageWithdrawalEffectLedger(db,req()); };
beforeAll(() => { process.env.WITHDRAWAL_ACTIVATION_EMULATOR_ONLY='yes'; app=initializeApp({projectId:project},`discipline10d_${randomUUID()}`); db=getFirestore(app); });
beforeEach(async () => {
 seasonId=`discipline10d_${randomUUID().replaceAll('-','')}`;
 await Promise.all([
   season().set({status:'active'}), season().collection('withdrawalSettings').doc('official').set(config),
   season().collection('teamEntries').doc(teamId).set({status:'active'}),
   reg().set({seasonId,teamId,effectiveMatchweek:6,phase:'first_leg',policy:'void_all',formatSnapshot:config,state:'draft_pending_activation',effectsApplied:false}),
   match().set({seasonId,homeTeamId:teamId,awayTeamId:'other',matchweek:2,matchType:'regularSeason',status:'played',homeScore:1,awayScore:0}),
   report().set({seasonId,matchId:`${seasonId}_m1`,status:'published',data:{homeScore:1,awayScore:0,performances:{p1:{playerId:'p1',teamId:teamId,yellowCards:0,directRedCards:0}}}}),
 ]);
});
afterAll(async () => { if(app)await deleteApp(app); delete process.env.WITHDRAWAL_ACTIVATION_EMULATOR_ONLY; });
describe('10D: guardia disciplinare transazionale (solo demo emulator)', () => {
 it('attiva e ripristina solo senza effetti disciplinari',async () => {
   await stage(); const result=await activateWithdrawalInEmulator(db,req());
   expect(result.status).toBe('applied');
   expect((await reg().get()).data()?.effectsApplied).toBe(true);
   expect(await reverseWithdrawalInEmulator(db,req())).toEqual({status:'reversed'});
   expect((await report().get()).data()?.data.performances.p1.yellowCards).toBe(0);
 });
 it('blocca cartellini gialli della gara annullata prima di ogni scrittura',async () => {
   await report().update({'data.performances.p1.yellowCards':1}); await stage();
   await expect(activateWithdrawalInEmulator(db,req())).rejects.toThrow(/riconciliazione disciplinare/i);
   expect((await reg().get()).data()?.state).toBe('draft_pending_activation');
   expect((await ledger().get()).data()?.state).toBe('staged_review_only');
 });
 it('blocca un rosso diretto nella gara annullata',async () => {
   await report().update({'data.performances.p1.directRedCards':1});await stage();
   await expect(activateWithdrawalInEmulator(db,req())).rejects.toThrow(/espulsione richiede replay disciplinare completo/i);
   expect((await reg().get()).data()?.effectsApplied).toBe(false);
 });
 it('blocca registrazioni disciplinari persistenti anche di altre gare',async () => {
   await stage(); const ref=db.collection('disciplinaryRecords').doc(`${seasonId}_p1`);
   await ref.set({seasonId,playerId:'p1',seasonYellowCards:2,currentYellowCycle:2});
   await expect(activateWithdrawalInEmulator(db,req())).rejects.toThrow(/riconciliazione disciplinare/i);
   expect((await ref.get()).data()?.currentYellowCycle).toBe(2);
   expect((await reg().get()).data()?.state).toBe('draft_pending_activation');
 });
 it('preserva anche provvedimenti manuali del giudice sportivo',async () => {
   await stage(); const ref=db.collection('disciplinarySuspensions').doc(`${seasonId}_manual`);
   await ref.set({seasonId,playerId:'p2',reason:'sportsJudge',status:'active',remainingMatches:1});
   await expect(activateWithdrawalInEmulator(db,req())).rejects.toThrow(/riconciliazione disciplinare/i);
   expect((await ref.get()).data()?.reason).toBe('sportsJudge');
   expect((await reg().get()).data()?.state).toBe('draft_pending_activation');
 });
 it('blocca valori disciplinari illeggibili',async () => {
   await report().update({'data.performances.p1.yellowCards':'unknown'});await stage();
   await expect(activateWithdrawalInEmulator(db,req())).rejects.toThrow(/cartellini non validi/i);
   expect((await reg().get()).data()?.effectsApplied).toBe(false);
 });
});
