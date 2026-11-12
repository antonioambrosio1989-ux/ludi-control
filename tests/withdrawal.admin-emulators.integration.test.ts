/**
 * 11E: real route handler, real Firebase Auth Emulator-issued ID token,
 * real admins/{uid} read and Firestore transaction in demo emulators.
 * NO mock of authentication, adminDb or withdrawal transaction.
 * This is NOT an end-to-end browser/network test.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { NextRequest } from 'next/server';

const project = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? '';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '';
if (!/^demo-[a-z0-9-]+$/.test(project) ||
    !/^(localhost|127\.0\.0\.1):\d+$/.test(firestoreHost) ||
    !/^(localhost|127\.0\.0\.1):\d+$/.test(authHost)) {
  throw new Error('11E richiede progetto demo-* e Auth + Firestore Emulator locali.');
}
// The guard is additionally enforced by the route/service.
process.env.LUDI_WITHDRAWAL_ATOMIC_IMPORT_TEST = 'enabled';

vi.mock('server-only', () => ({}));
vi.mock('@/src/lib/firebaseAdmin', async () => {
  const { initializeApp } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = initializeApp({ projectId: process.env.GCLOUD_PROJECT! }, 'withdrawal11e_admin_handler');
  return { adminAuth: getAuth(app), adminDb: getFirestore(app) };
});

import { POST } from '@/app/api/admin/matches/import-withdrawal-test/route';
let app: App;
let db: Firestore;
let auth: Auth;
let seasonId: string;
const withdrawn = 'withdrawn_demo_team';
const fixture = () => ({
  homeTeamId: 'home_demo_team', awayTeamId: withdrawn,
  date: '2026-12-08', time: '20:30', venue: 'Centro Sportivo Ludi',
});
const payload = () => ({ seasonId, matchweek: 14, fixtures: [fixture()], adminUid: 'forged_user' });
function makeRequest(token?: string, body: unknown = payload()): NextRequest {
  return new Request('http://localhost:3000/api/admin/matches/import-withdrawal-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}
async function userToken(): Promise<{uid: string; token: string}> {
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!response.ok) throw new Error(`Auth Emulator signUp failed ${response.status}: ${await response.text()}`);
  const json = await response.json() as { localId?: string; idToken?: string };
  if (!json.localId || !json.idToken) throw new Error('Auth Emulator did not issue an ID token.');
  return {uid: json.localId, token: json.idToken};
}
async function activeWithdrawal() {
  const season = db.collection('seasons').doc(seasonId);
  await season.collection('withdrawalRegistrations').doc(withdrawn).set({
    state: 'active', effectsApplied: true, activationCommitId: 'commit_demo',
  });
  await season.collection('withdrawalEffectLedgers').doc(withdrawn).set({
    state: 'applied', effectsApplied: true, policy: 'retain_and_walkover',
    activationCommitId: 'commit_demo', operationId: 'op_demo',
    effectiveMatchweek: 12, entries: [],
  });
}
const seasonMatches = () => db.collection('matches').where('seasonId','==',seasonId).get();

beforeAll(() => {
  app = initializeApp({projectId:project}, `withdrawal_11e_check_${randomUUID()}`);
  db = getFirestore(app);
  auth = getAuth(app);
});
beforeEach(async () => {
  seasonId = `e11_${randomUUID().replaceAll('-','')}`;
  await db.collection('seasons').doc(seasonId).set({status:'active'});
});
afterAll(async () => { if (app) await deleteApp(app); });

describe('11E: route admin con Auth e Firestore emulator REALI', () => {
  it('403 senza Bearer token e nessuna partita scritta', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    expect((await seasonMatches()).empty).toBe(true);
  });
  it('403 con token Auth valido ma utente non registrato come admin', async () => {
    const user = await userToken();
    const decoded = await auth.verifyIdToken(user.token);
    expect(decoded.uid).toBe(user.uid);
    const res = await POST(makeRequest(user.token));
    expect(res.status).toBe(403);
    expect((await seasonMatches()).empty).toBe(true);
  });
  it('403 con documento admin disattivato', async () => {
    const user = await userToken();
    await db.collection('admins').doc(user.uid).set({active:false});
    const res = await POST(makeRequest(user.token));
    expect(res.status).toBe(403);
    expect((await seasonMatches()).empty).toBe(true);
  });
  it('200 con vero token admin, commit unico e nessun premio anticipato', async () => {
    const user = await userToken();
    await db.collection('admins').doc(user.uid).set({active:true});
    await activeWithdrawal();
    const res = await POST(makeRequest(user.token));
    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok:boolean; createdMatchIds:string[];
      registeredPendingWalkovers:number;awardedWalkovers:number;
    };
    expect(body).toMatchObject({ok:true,registeredPendingWalkovers:1,awardedWalkovers:0});
    expect(body.createdMatchIds).toHaveLength(1);
    const matches = await seasonMatches();
    expect(matches.size).toBe(1);
    expect(matches.docs[0].id).toBe(body.createdMatchIds[0]);
    expect(matches.docs[0].data()).toMatchObject({status:'scheduled',published:false});
    const effect = (await db.collection('seasons').doc(seasonId)
      .collection('withdrawalEffectLedgers').doc(withdrawn).get()).data();
    expect(effect?.entries).toMatchObject([{
      matchId:body.createdMatchIds[0], effect:'walkover_pending_official_closure',
    }]);
    const awards = await db.collection('seasons').doc(seasonId).collection('withdrawalWalkoverAwards').get();
    expect(awards.empty).toBe(true);
  });
  it('409 dopo seconda importazione senza duplicare il registro', async () => {
    const user = await userToken();
    await db.collection('admins').doc(user.uid).set({active:true});
    await activeWithdrawal();
    expect((await POST(makeRequest(user.token))).status).toBe(200);
    expect((await POST(makeRequest(user.token))).status).toBe(409);
    expect((await seasonMatches()).size).toBe(1);
    const ledger = (await db.collection('seasons').doc(seasonId)
      .collection('withdrawalEffectLedgers').doc(withdrawn).get()).data();
    expect(ledger?.entries).toHaveLength(1);
  });
  it('409 con registro incoerente e zero modifiche', async () => {
    const user = await userToken();
    await db.collection('admins').doc(user.uid).set({active:true});
    await activeWithdrawal();
    await db.collection('seasons').doc(seasonId)
      .collection('withdrawalEffectLedgers').doc(withdrawn).update({activationCommitId:'wrong'});
    const res = await POST(makeRequest(user.token));
    expect(res.status).toBe(409);
    expect((await seasonMatches()).empty).toBe(true);
  });
});
