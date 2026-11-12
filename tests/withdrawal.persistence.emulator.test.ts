import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { prepareWithdrawalTestIntent } from '../src/services/withdrawal/WithdrawalPreparationTransaction';

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
if (!HOST || !/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(HOST) || !PROJECT?.startsWith('demo-')) {
  throw new Error('Test 9C consentito solo con Firestore Emulator locale e project demo-.');
}

let app: App;
let db: Firestore;
let seasonId: string;
const teamId = 'team_alpha';
const adminUid = 'test_admin';
const config = { format: 'double_round_robin', totalMatchweeks: 22, firstReturnMatchweek: 12 };
const registration = {
  seasonId: '', teamId, effectiveMatchweek: 6, phase: 'first_leg', policy: 'void_all',
  formatSnapshot: config, state: 'draft_pending_activation', effectsApplied: false,
};
async function seed() {
  const season = db.collection('seasons').doc(seasonId);
  await Promise.all([
    season.set({status: 'active'}),
    season.collection('withdrawalSettings').doc('official').set(config),
    season.collection('teamEntries').doc(teamId).set({status: 'active'}),
    season.collection('withdrawalRegistrations').doc(teamId).set({...registration, seasonId}),
  ]);
  return season;
}
async function prepare(expectedMatchweek = 6) {
  return prepareWithdrawalTestIntent(db, {seasonId, teamId, expectedMatchweek, adminUid});
}

beforeAll(() => {
  app = initializeApp({projectId: PROJECT}, `withdrawal-9c-${randomUUID()}`);
  db = getFirestore(app);
});
beforeEach(async () => {
  seasonId = `withdrawal_9c_${randomUUID().replaceAll('-', '')}`;
  await seed();
});
afterAll(async () => {if (app) await deleteApp(app);});

describe('9C: Firestore Emulator - transazioni reali, nessun effetto sportivo', () => {
  it('prepara un intent atomico senza cambiare squadra, report o registrazione', async () => {
    const result = await prepare();
    expect(result.state).toBe('create');
    expect(result.operationId).toMatch(/^[a-f0-9]{64}$/);
    const season = db.collection('seasons').doc(seasonId);
    const [intent, entry, draft, matches] = await Promise.all([
      season.collection('withdrawalActivationIntents').doc(teamId).get(),
      season.collection('teamEntries').doc(teamId).get(),
      season.collection('withdrawalRegistrations').doc(teamId).get(),
      db.collection('matches').where('seasonId','==',seasonId).get(),
    ]);
    expect(intent.data()).toMatchObject({state:'prepared_test_only', effectsApplied:false, createdBy:adminUid});
    expect(entry.data()?.status).toBe('active');
    expect(draft.data()?.state).toBe('draft_pending_activation');
    expect(matches.empty).toBe(true);
  });
  it('ripetizione idempotente mantiene lo stesso documento e operationId', async () => {
    const first = await prepare();
    const next = await prepare();
    expect(next).toEqual({state:'duplicate',operationId:first.operationId});
    const docs = await db.collection('seasons').doc(seasonId).collection('withdrawalActivationIntents').get();
    expect(docs.size).toBe(1);
  });
  it('rifiuta bozza obsoleta, senza intent', async () => {
    await expect(prepare(7)).rejects.toThrow();
    expect((await db.collection('seasons').doc(seasonId).collection('withdrawalActivationIntents').get()).empty).toBe(true);
  });
  it('rifiuta bozza annullata e squadra inattiva', async () => {
    const s=db.collection('seasons').doc(seasonId);
    await s.collection('withdrawalRegistrations').doc(teamId).update({state:'cancelled'});
    await expect(prepare()).rejects.toThrow();
    await s.collection('withdrawalRegistrations').doc(teamId).update({state:'draft_pending_activation'});
    await s.collection('teamEntries').doc(teamId).update({status:'withdrawn'});
    await expect(prepare()).rejects.toThrow();
  });
  it('rifiuta richiesta discordante dopo una preparazione valida', async () => {
    await prepare();
    const s=db.collection('seasons').doc(seasonId);
    const changed={format:'double_round_robin',totalMatchweeks:24,firstReturnMatchweek:13};
    await s.collection('withdrawalSettings').doc('official').set(changed);
    await s.collection('withdrawalRegistrations').doc(teamId).update({formatSnapshot:changed});
    await expect(prepare()).rejects.toThrow(/incompatibile/i);
    const saved=await s.collection('withdrawalActivationIntents').doc(teamId).get();
    expect(saved.data()?.formatSnapshot).toEqual(config);
  });
});
