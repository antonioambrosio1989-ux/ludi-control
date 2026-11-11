import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { activateOfficialFirstLegWithdrawal } from '../src/services/withdrawal/WithdrawalOfficialFirstLeg';
const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
if (!process.env.FIRESTORE_EMULATOR_HOST || !project?.startsWith('demo-'))
  throw new Error('Test consentiti solo con Firestore Emulator e progetto demo-.');
let app: App, db: Firestore, seasonId: string;
const teamId = 'corsari';
const season = () => db.collection('seasons').doc(seasonId);
const match = (week: number) => db.collection('matches').doc(`${seasonId}_week${week}`);
const report = () => db.collection('matchReports').doc(`${seasonId}_week1`);
const registration = () => season().collection('withdrawalRegistrations').doc(teamId);
const ledger = () => season().collection('withdrawalEffectLedgers').doc(teamId);
const audit = () => season().collection('withdrawalActivationCommits').doc(teamId);
const input = () => ({seasonId,teamId,adminUid:'test_admin',expectedMatchweek:2});
const config = {format:'double_round_robin',totalMatchweeks:4,firstReturnMatchweek:3};
beforeAll(() => {app=initializeApp({projectId:project},`firstleg_${randomUUID()}`);db=getFirestore(app);});
afterAll(async()=>{await deleteApp(app);});
beforeEach(async () => {
  seasonId=`firstleg_${randomUUID().replaceAll('-','')}`;
  await Promise.all([
    season().set({status:'active',competitionId:'championship'}),
    season().collection('withdrawalSettings').doc('official').set(config),
    season().collection('teamEntries').doc(teamId).set({status:'active'}),
    registration().set({seasonId,teamId,state:'draft_pending_activation',effectsApplied:false,
      policy:'void_all',phase:'first_leg',effectiveMatchweek:2}),
  ]);
  const writes:Promise<unknown>[]=[];
  for(let week=1;week<=4;week++)writes.push(match(week).set({seasonId,matchweek:week,matchType:'regularSeason',
    homeTeamId:teamId,awayTeamId:'borgo',status:week===1?'played':'scheduled',
    ...(week===1?{homeScore:3,awayScore:2}:{})}));
  writes.push(report().set({seasonId,matchId:match(1).id,status:'published',
    data:{status:'played',homeScore:3,awayScore:2,performances:{p1:{playerId:'p1',teamId, yellowCards:0,directRedCards:0}}}}));
  await Promise.all(writes);
});
describe('11F-23: official first leg void_all, safe subset', () => {
  it('activates atomically while preserving original matches and reports', async()=>{
    const r=await activateOfficialFirstLegWithdrawal(db,input());
    expect(r.status).toBe('applied');
    expect((await registration().get()).data()).toMatchObject({state:'active',effectsApplied:true,activationCommitId:r.commitId});
    expect((await ledger().get()).data()).toMatchObject({policy:'void_all',state:'applied',effectsApplied:true});
    expect((await audit().get()).data()).toMatchObject({policy:'void_all',state:'applied'});
    expect((await match(1).get()).data()?.homeScore).toBe(3);
    expect((await report().get()).data()?.status).toBe('published');
  });
  it('accepts an incomplete future calendar without changing other matches',async()=>{
    await match(4).delete();
    const result = await activateOfficialFirstLegWithdrawal(db,input());
    expect(result.status).toBe('applied');
    expect(result.fixtureCount).toBe(3);
    expect((await registration().get()).data()?.state).toBe('active');
  });
  it('preserves yellow cards from the original published report',async()=>{
    await report().update({'data.performances.p1.yellowCards':1});
    await activateOfficialFirstLegWithdrawal(db,input());
    expect((await report().get()).data()?.data.performances.p1.yellowCards).toBe(1);
    expect((await ledger().get()).data()?.policy).toBe('void_all');
  });
  it('retains existing disciplinary suspensions without rewriting',async()=>{
    const ref=db.collection('disciplinarySuspensions').doc(`${seasonId}_s1`);
    await ref.set({seasonId,playerId:'p1',reason:'directRed',status:'active'});
    await activateOfficialFirstLegWithdrawal(db,input());
    expect((await ref.get()).data()).toMatchObject({reason:'directRed',status:'active'});
    expect((await audit().get()).data()?.preservedSuspensionIds).toContain(ref.id);
  });
  it('retains existing disciplinary records without rewriting',async()=>{
    const ref=db.collection('disciplinaryRecords').doc(`${seasonId}_p1`);
    await ref.set({seasonId,playerId:'p1',seasonYellowCards:3});
    await activateOfficialFirstLegWithdrawal(db,input());
    expect((await ref.get()).data()?.seasonYellowCards).toBe(3);
    expect((await audit().get()).data()?.preservedDisciplinaryRecordIds).toContain(ref.id);
  });
  it('rejects played future match and preserves original draft',async()=>{
    await match(2).update({status:'played',homeScore:1,awayScore:0});
    await expect(activateOfficialFirstLegWithdrawal(db,input())).rejects.toThrow(/futura/i);
    expect((await registration().get()).data()?.effectsApplied).toBe(false);
  });
  it('rejects repeated activation without rewriting ledger',async()=>{
    await activateOfficialFirstLegWithdrawal(db,input());
    await expect(activateOfficialFirstLegWithdrawal(db,input())).rejects.toThrow(/bozza|registro|registri/i);
  });
});
