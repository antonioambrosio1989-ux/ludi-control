/**
 * Phase 11C: real Firestore Emulator document flow, no production credentials.
 * This is a service-level end-to-end test. HTTP authentication and browser UI
 * are intentionally NOT exercised here and remain separate release gates.
 */
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { createCalendarAndWithdrawalCandidatesInDemo } from '../src/services/withdrawal/WithdrawalAtomicCalendarImport';
import { matureWithdrawalWalkoverInEmulator } from '../src/services/withdrawal/WithdrawalProgressiveWalkoverTransaction';
import { projectMaturedWalkovers, type WalkoverRegistration, type WalkoverLedger, type WalkoverAward, type WalkoverClosure, type WalkoverMatch } from '../src/services/withdrawal/WithdrawalMaturedWalkoverReadModel';
import { buildTopPlayerPoliticalAwards, applyTopPlayerPoliticalAwards } from '../src/services/withdrawal/WithdrawalPostImportAndTopPlayer';

const project = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
if (!process.env.FIRESTORE_EMULATOR_HOST || !project?.startsWith('demo-'))
  throw new Error('11C: obbligatorio Firestore Emulator su progetto demo-.');
let app: App;
let db: Firestore;
let seasonId: string;
const withdrawn = 'bristol';
const adminUid = 'demo_admin';
const fixture = {homeTeamId:'oxford',awayTeamId:withdrawn,date:'2026-12-03',time:'20:30',venue:'Centro Sportivo Ludi'};
const season = () => db.collection('seasons').doc(seasonId);
const registration = () => season().collection('withdrawalRegistrations').doc(withdrawn);
const ledger = () => season().collection('withdrawalEffectLedgers').doc(withdrawn);
const closure = () => season().collection('officialMatchweekClosures').doc('14');
const awards = () => season().collection('withdrawalWalkoverAwards');
const importFixture = (fixtures = [fixture]) => createCalendarAndWithdrawalCandidatesInDemo(db, {seasonId,matchweek:14,fixtures,adminUid});
const mature = (matchId:string) => matureWithdrawalWalkoverInEmulator(db, {seasonId,withdrawnTeamId:withdrawn,matchId,matchweek:14,adminUid});
const closeOfficial = () => closure().set({state:'officially_closed',seasonId,matchweek:14,closedBy:adminUid,closedAt:'2026-12-05T12:00:00+01:00'});

async function activate(): Promise<void> {
  await registration().set({seasonId,teamId:withdrawn,state:'active',policy:'retain_and_walkover',effectsApplied:true,activationCommitId:'commit_demo'});
  await ledger().set({state:'applied',effectsApplied:true,policy:'retain_and_walkover',activationCommitId:'commit_demo',operationId:'op_demo',effectiveMatchweek:12,entries:[]});
}

async function readProjection() {
  const [matchSnaps, regSnap, ledgerSnap, awardSnaps, closeSnap] = await Promise.all([
    db.collection('matches').where('seasonId','==',seasonId).get(), registration().get(), ledger().get(), awards().get(), closure().get(),
  ]);
  const matches = matchSnaps.docs.map(s => ({id:s.id,...s.data()})) as WalkoverMatch[];
  const registrations = regSnap.exists ? [{teamId:withdrawn,...regSnap.data()}] as WalkoverRegistration[] : [];
  const ledgers = ledgerSnap.exists ? [{teamId:withdrawn,...ledgerSnap.data()}] as WalkoverLedger[] : [];
  const storedAwards = awardSnaps.docs.map(s => s.data()) as WalkoverAward[];
  const closures = closeSnap.exists ? [{id:closeSnap.id,...closeSnap.data()}] as WalkoverClosure[] : [];
  return {matches,registrations,ledgers,storedAwards,closures,projected:projectMaturedWalkovers({seasonId,matches,registrations,ledgers,awards:storedAwards,closures,completeSnapshot:true})};
}

beforeAll(() => {app=initializeApp({projectId:project},`e2e_${randomUUID()}`);db=getFirestore(app);});
beforeEach(async () => {seasonId=`e2e_${randomUUID().replaceAll('-','')}`;await season().set({status:'active'});});
afterAll(async () => {if(app) await deleteApp(app);});

describe('11C - flusso integrato su Firestore Emulator (senza HTTP o UI)', () => {
  it('import -> pending -> chiusura -> 6-0 pubblico -> 7 politico, senza mutare gara o tabellino', async () => {
    await activate();
    const imported=await importFixture();
    const matchId=imported.createdMatchIds[0];
    expect(imported).toMatchObject({registeredPendingWalkovers:1,awardedWalkovers:0});
    expect((await awards().get()).empty).toBe(true);
    const before=await readProjection();
    expect(before.projected.maturedMatchIds).toEqual([]);
    expect(before.projected.matches[0].status).toBe('scheduled');
    await expect(mature(matchId)).rejects.toThrow(/ufficialmente conclusa/i);
    expect((await awards().get()).empty).toBe(true);
    await closeOfficial();
    expect(await mature(matchId)).toMatchObject({status:'created',winnerTeamId:'oxford',winnerPoints:3});
    const after=await readProjection();
    expect(after.projected.maturedMatchIds).toEqual([matchId]);
    expect(after.projected.matches[0]).toMatchObject({status:'finished',homeScore:6,awayScore:0});
    // Source fixture stays scheduled; no synthetic reports or player stats persisted.
    expect((await db.collection('matches').doc(matchId).get()).data()).toMatchObject({status:'scheduled'});
    expect((await db.collection('matchReports').doc(matchId).get()).exists).toBe(false);
    const award=buildTopPlayerPoliticalAwards({seasonId,awards:[{seasonId,verified:true,matchId,matchweek:14,homeTeamId:'oxford',awayTeamId:withdrawn,homeScore:6,awayScore:0}],officiallyClosedMatchweeks:[14],memberships:[
      {playerId:'eligible',teamId:'oxford',validFromMatchweek:1},
      {playerId:'transferred',teamId:'oxford',validFromMatchweek:1,validUntilMatchweek:13},
      {playerId:'withdrawn_player',teamId:withdrawn,validFromMatchweek:1},
    ]});
    expect(award.map(a=>a.playerId)).toEqual(['eligible']);
    const once=applyTopPlayerPoliticalAwards([{playerId:'eligible',matchId,points:5}],award);
    expect(once).toEqual([{playerId:'eligible',matchId,points:7}]);
    expect(applyTopPlayerPoliticalAwards(once,award)).toEqual(once);
  });

  it('maturazione ripetuta è idempotente e non produce più di un award', async () => {
    await activate();const {createdMatchIds:[id]}=await importFixture();await closeOfficial();
    expect((await mature(id)).status).toBe('created');
    expect((await mature(id)).status).toBe('unchanged');
    expect((await awards().get()).size).toBe(1);
    expect((await ledger().get()).data()?.entries).toHaveLength(1);
  });

  it('gli incontri estranei non maturano e conservano il loro stato', async () => {
    await activate();const second={homeTeamId:'fulham',awayTeamId:'luton',date:'2026-12-04',time:'21:30',venue:'Centro Sportivo Ludi'};
    const result=await importFixture([fixture,second]);await closeOfficial();
    await mature(result.createdMatchIds[0]);
    const projection=(await readProjection()).projected;
    expect(projection.matches.find(m=>m.id===result.createdMatchIds[1])?.status).toBe('scheduled');
    expect(projection.maturedMatchIds).toEqual([result.createdMatchIds[0]]);
  });

  it('un premio 3-0 alterato blocca la lettura ufficiale', async () => {
    await activate();const {createdMatchIds:[id]}=await importFixture();await closeOfficial();await mature(id);
    await awards().doc(id).update({homeScore:3});
    await expect(readProjection()).rejects.toThrow(/6-0/);
  });

  it('la revoca dello stato active rende impossibile proiettare il 6-0 e maturare nuove gare', async () => {
    await activate();const {createdMatchIds:[id]}=await importFixture();await closeOfficial();await mature(id);
    // Simulate the effect of an independently authorized reversal; this test
    // does NOT invoke the actual withdrawal-reversal transaction.
    await registration().update({state:'reversed'});
    await expect(readProjection()).rejects.toThrow(/ritiro non attivo/i);
    await expect(mature(id)).rejects.toThrow(/ritiro non attivato/i);
    expect((await db.collection('matches').doc(id).get()).data()?.status).toBe('scheduled');
  });

  it('chiusura incoerente impedisce maturazione e non lascia un award parziale', async () => {
    await activate();const {createdMatchIds:[id]}=await importFixture();
    await closure().set({state:'officially_closed',seasonId,matchweek:14,closedBy:adminUid});
    await expect(mature(id)).rejects.toThrow(/ufficialmente conclusa/i);
    expect((await awards().get()).empty).toBe(true);
  });
});
