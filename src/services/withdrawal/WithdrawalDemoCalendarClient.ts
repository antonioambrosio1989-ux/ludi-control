/**
 * Only a local, explicitly opted-in integration with the 11A demo endpoint.
 * The server endpoint independently verifies emulator environment and admin rights.
 */
import { auth } from '@/src/lib/firebase';
import { getIdToken } from 'firebase/auth';
import { shouldUseDemoAtomicImport, validateDemoCalendarResponse, type DemoCalendarResult } from './WithdrawalDemoCalendarContract';

export type DemoCalendarFixture = {
  homeTeamId: string;
  awayTeamId: string;
  date: string;
  time: string;
  venue: string;
};

export type DemoCalendarPayload = {
  seasonId: string;
  matchweek: number;
  fixtures: DemoCalendarFixture[];
};


export function isDemoAtomicCalendarImportEnabled(): boolean {
  return typeof window !== 'undefined' && shouldUseDemoAtomicImport({
    enabled: process.env.NEXT_PUBLIC_LUDI_WITHDRAWAL_ATOMIC_IMPORT_TEST === 'enabled',
    development: process.env.NODE_ENV === 'development',
    hostname: window.location.hostname,
  });
}

export async function submitDemoAtomicCalendarImport(payload: DemoCalendarPayload): Promise<DemoCalendarResult> {
  if (!isDemoAtomicCalendarImportEnabled()) {
    throw new Error('Importazione atomica demo non abilitata su localhost.');
  }
  const user = auth.currentUser;
  if (!user) throw new Error('Accesso amministratore richiesto.');
  const token = await getIdToken(user);
  const response = await fetch('/api/admin/matches/import-withdrawal-test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = body && typeof body === 'object' &&
      typeof (body as {error?: unknown}).error === 'string'
      ? (body as {error: string}).error : 'Importazione demo non riuscita.';
    throw new Error(reason);
  }
  return validateDemoCalendarResponse(body, payload.fixtures.length);
}
