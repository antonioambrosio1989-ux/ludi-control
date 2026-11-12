import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { prepareWithdrawalTestIntent } from '../src/services/withdrawal/WithdrawalPreparationTransaction';
import { snapshotWithdrawalForReview } from '../src/services/withdrawal/WithdrawalActivationSnapshotTransaction';

const host = process.env.FIRESTORE_EMULATOR_HOST;
const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
if (!host || !/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host) || !project?.startsWith('demo-')) {
  throw new Error('Test consentiti esclusivamente con Firestore Emulator su progetto demo-.');
}
let app: App;
let db: Firestore;
let seasonId: string;
const teamId = 'bristol';
const config = { format: 'double_round_robin', totalMatchweeks: 22, firstReturnMatchweek: 12 };
const registration = {
  seasonId: '', teamId, effectiveMatchweek: 6, phase: 'first_leg', policy: 'void_all',
  formatSnapshot: config, state: 'draft_pending_activation', effectsApplied: false,
};
const season = () => db.collection('seasons').doc(seasonId);
const snapshot = () => snapshotWithdrawalForReview(db, { seasonId, teamId, expectedMatchweek: 6, adminUid: 'test_admin' });
async function prepare() {
  await prepareWithdrawalTestIntent(db, { seasonId, teamId, expectedMatchweek: 6, adminUid: 'test_admin' });
}
beforeAll(() => {
  app = initializeApp({ projectId: project }, `withdrawal-10a-${randomUUID()}`);
  db = getFirestore(app);
});
beforeEach(async () => {
  seasonId = `withdrawal_10a_${randomUUID().replaceAll('-', '')}`;
  await Promise.all([
    season().set({ status: 'active' }),
    season().collection('withdrawalSettings').doc('official').set(config),
    season().collection('teamEntries').doc(teamId).set({ status: 'active' }),
    season().collection('withdrawalRegistrations').doc(teamId).set({ ...registration, seasonId }),
    db.collection('matches').doc(`${seasonId}_m1`).set({ seasonId, matchType: 'regularSeason', homeTeamId: teamId, awayTeamId: 'team_b', status: 'played', homeScore: 2, awayScore: 1 }),
    db.collection('matches').doc(`${seasonId}_m2`).set({ seasonId, matchType: 'regularSeason', homeTeamId: 'team_c', awayTeamId: teamId, status: 'postponed' }),
    db.collection('matches').doc(`${seasonId}_other`).set({ seasonId, matchType: 'regularSeason', homeTeamId: 'team_d', awayTeamId: 'team_c', status: 'played' }),
    db.collection('matchReports').doc(`${seasonId}_r1`).set({ seasonId, matchId: `${seasonId}_m1`, status: 'published', data: { homeScore: 2, awayScore: 1, goals: [{ playerId: 'p1' }] } }),
  ]);
});
afterAll(async () => { if (app) await deleteApp(app); });
describe('10A: immutabilita snapshot di ritiro sul Firestore Emulator', () => {
  it('crea solo audit e conserva gara, tabellino e bozza', async () => {
    await prepare();
    const r = await snapshot();
    expect(r.state).toBe('created');
    expect(r.affectedMatchIds).toEqual([`${seasonId}_m1`, `${seasonId}_m2`]);
    expect(r.affectedReportIds).toEqual([`${seasonId}_r1`]);
    const [draft, game, report, record] = await Promise.all([
      season().collection('withdrawalRegistrations').doc(teamId).get(),
      db.collection('matches').doc(`${seasonId}_m1`).get(),
      db.collection('matchReports').doc(`${seasonId}_r1`).get(),
      season().collection('withdrawalReviewSnapshots').doc(teamId).get(),
    ]);
    expect(draft.data()?.effectsApplied).toBe(false);
    expect(draft.data()?.state).toBe('draft_pending_activation');
    expect(game.data()?.homeScore).toBe(2);
    expect(report.data()?.data.goals).toHaveLength(1);
    expect(record.data()).toMatchObject({ state: 'review_only', effectsApplied: false, snapshotHash: r.snapshotHash });
  });
  it('una richiesta ripetuta e invariata non duplica nulla', async () => {
    await prepare();
    const r1 = await snapshot();
    const r2 = await snapshot();
    expect(r2.state).toBe('unchanged');
    expect(r2.snapshotHash).toBe(r1.snapshotHash);
    expect((await season().collection('withdrawalReviewSnapshots').get()).size).toBe(1);
  });
  it('un tabellino corretto dopo la fotografia blocca il riutilizzo', async () => {
    await prepare(); await snapshot();
    await db.collection('matchReports').doc(`${seasonId}_r1`).update({ 'data.homeScore': 3 });
    await expect(snapshot()).rejects.toThrow(/obsoleto|conflitto/i);
  });
  it('una partita aggiunta dopo la fotografia blocca il riutilizzo', async () => {
    await prepare(); await snapshot();
    await db.collection('matches').doc(`${seasonId}_m3`).set({ seasonId, matchType: 'regularSeason', homeTeamId: 'team_e', awayTeamId: teamId, status: 'scheduled' });
    await expect(snapshot()).rejects.toThrow(/obsoleto|conflitto/i);
  });
  it('senza preparazione atomica non crea lo snapshot', async () => {
    await expect(snapshot()).rejects.toThrow(/preparazione/i);
    expect((await season().collection('withdrawalReviewSnapshots').get()).empty).toBe(true);
  });
  it('bozza annullata impedisce lo snapshot anche con intent valido', async () => {
    await prepare();
    await season().collection('withdrawalRegistrations').doc(teamId).update({ state: 'cancelled' });
    await expect(snapshot()).rejects.toThrow();
  });
  it('formula cambiata impedisce di riutilizzare intent preparato', async () => {
    await prepare();
    const changed = { format: 'double_round_robin', totalMatchweeks: 24, firstReturnMatchweek: 13 };
    await season().collection('withdrawalSettings').doc('official').set(changed);
    await season().collection('withdrawalRegistrations').doc(teamId).update({ formatSnapshot: changed });
    await expect(snapshot()).rejects.toThrow();
  });
  it('non attribuisce punti o produce modifiche neppure su partite rinviate', async () => {
    await prepare(); await snapshot();
    const m = await db.collection('matches').doc(`${seasonId}_m2`).get();
    expect(m.data()?.status).toBe('postponed');
    expect(m.data()?.homeScore).toBeUndefined();
    const a = await season().collection('withdrawalRegistrations').doc(teamId).get();
    expect(a.data()?.effectsApplied).toBe(false);
  });
});
