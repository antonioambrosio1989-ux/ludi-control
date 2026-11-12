/**
 * Fase 11D: test del vero handler HTTP, con admin auth e Firestore mockati.
 * Nessun accesso a Firebase, nessun effetto persistente.
 * Non sostituisce un test browser con Firebase Auth Emulator.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  atomicImport: vi.fn(),
}));
vi.mock('@/src/lib/firebaseAdmin', () => ({ adminDb: { __testOnly: true } }));
vi.mock('@/src/lib/requireAdminApi', () => ({ requireAdminApi: mocks.auth }));
vi.mock('@/src/services/withdrawal/WithdrawalAtomicCalendarImport', () => ({
  createCalendarAndWithdrawalCandidatesInDemo: mocks.atomicImport,
}));
import { POST } from '@/app/api/admin/matches/import-withdrawal-test/route';

const oldEnv = {
  flag: process.env.LUDI_WITHDRAWAL_ATOMIC_IMPORT_TEST,
  project: process.env.GCLOUD_PROJECT,
  alternateProject: process.env.GOOGLE_CLOUD_PROJECT,
  host: process.env.FIRESTORE_EMULATOR_HOST,
};
const fixture = { homeTeamId: 'home-1', awayTeamId: 'away-1', date: '2026-11-10', time: '20:30', venue: 'Centro Sportivo Ludi' };
const requestBody = { seasonId: 'demo-season', matchweek: 14, fixtures: [fixture], adminUid: 'attacker-supplied-uid' };
const request = (body: unknown = requestBody): NextRequest =>
  new Request('http://localhost:3000/api/admin/matches/import-withdrawal-test', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer demo-test-token' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.LUDI_WITHDRAWAL_ATOMIC_IMPORT_TEST = 'enabled';
  process.env.GCLOUD_PROJECT = 'demo-ludi-withdrawal-11d';
  delete process.env.GOOGLE_CLOUD_PROJECT;
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  mocks.auth.mockResolvedValue({ uid: 'trusted-admin-uid' });
  mocks.atomicImport.mockResolvedValue({ createdMatchIds: ['fixture-001'], registeredPendingWalkovers: 1, awardedWalkovers: 0 });
});
afterEach(() => {
  for (const [key, value] of Object.entries({
    LUDI_WITHDRAWAL_ATOMIC_IMPORT_TEST: oldEnv.flag,
    GCLOUD_PROJECT: oldEnv.project,
    GOOGLE_CLOUD_PROJECT: oldEnv.alternateProject,
    FIRESTORE_EMULATOR_HOST: oldEnv.host,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('11D route HTTP amministrativa demo (dipendenze isolate)', () => {
  it('risponde 404 con flag spento e non consulta neppure admin auth', async () => {
    delete process.env.LUDI_WITHDRAWAL_ATOMIC_IMPORT_TEST;
    const res = await POST(request());
    expect(res.status).toBe(404);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.atomicImport).not.toHaveBeenCalled();
  });
  it('risponde 404 su progetto non demo', async () => {
    process.env.GCLOUD_PROJECT = 'real-project';
    const res = await POST(request());
    expect(res.status).toBe(404);
    expect(mocks.atomicImport).not.toHaveBeenCalled();
  });
  it('risponde 404 con emulator host remoto', async () => {
    process.env.FIRESTORE_EMULATOR_HOST = 'example.com:8080';
    const res = await POST(request());
    expect(res.status).toBe(404);
    expect(mocks.atomicImport).not.toHaveBeenCalled();
  });
  it('risponde 404 senza Firestore Emulator configurato', async () => {
    delete process.env.FIRESTORE_EMULATOR_HOST;
    const res = await POST(request());
    expect(res.status).toBe(404);
    expect(mocks.atomicImport).not.toHaveBeenCalled();
  });
  it('risponde 403 con admin auth respinta, senza scrivere', async () => {
    mocks.auth.mockRejectedValueOnce(new Error('Unauthorized'));
    const res = await POST(request());
    expect(res.status).toBe(403);
    expect(mocks.atomicImport).not.toHaveBeenCalled();
  });
  it('usa sempre uid verificato e non quello del body', async () => {
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, createdMatchIds: ['fixture-001'], registeredPendingWalkovers: 1, awardedWalkovers: 0 });
    expect(mocks.auth).toHaveBeenCalledTimes(1);
    expect(mocks.atomicImport).toHaveBeenCalledTimes(1);
    const [db, args] = mocks.atomicImport.mock.calls[0];
    expect(db).toEqual({ __testOnly: true });
    expect(args).toEqual({ seasonId: 'demo-season', matchweek: 14, fixtures: [fixture], adminUid: 'trusted-admin-uid' });
  });
  it('ritorna 409 su rifiuto transazionale, senza ripiegare su createMany', async () => {
    mocks.atomicImport.mockRejectedValueOnce(new Error('Giornata già conclusa ufficialmente.'));
    const res = await POST(request());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Giornata già conclusa ufficialmente.' });
    expect(mocks.atomicImport).toHaveBeenCalledTimes(1);
  });
  it('rifiuta JSON illeggibile senza invocare la transazione', async () => {
    const bad = new Request('http://localhost:3000/api/admin/matches/import-withdrawal-test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad-json',
    }) as unknown as NextRequest;
    const res = await POST(bad);
    expect(res.status).toBe(409);
    expect(mocks.atomicImport).not.toHaveBeenCalled();
  });
});
