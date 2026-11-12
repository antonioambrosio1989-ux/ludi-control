import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/src/lib/firebaseAdmin';
import { requireAdminApi } from '@/src/lib/requireAdminApi';
import {
  createCalendarAndWithdrawalCandidatesInDemo,
  type AtomicCalendarImportRequest,
} from '@/src/services/withdrawal/WithdrawalAtomicCalendarImport';

export const runtime = 'nodejs';

/**
 * Disabled by default. Never use this route for ordinary calendar imports.
 * This is an authenticated, explicitly gated DEMO FIRESTORE EMULATOR endpoint.
 * A production endpoint needs a separate security/release review.
 */
export async function POST(request: NextRequest) {
  if (process.env.LUDI_WITHDRAWAL_ATOMIC_IMPORT_TEST !== 'enabled' ||
      !(process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? '').startsWith('demo-') ||
      !/^(?:localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')) {
    return NextResponse.json({error:'Test importazione disabilitato.'},{status:404});
  }
  let admin: {uid:string};
  try {
    admin = await requireAdminApi(request);
  } catch {
    return NextResponse.json({error:'Accesso amministrativo non autorizzato.'},{status:403});
  }
  try {
    const body = (await request.json()) as Partial<AtomicCalendarImportRequest>;
    const result = await createCalendarAndWithdrawalCandidatesInDemo(adminDb,{
      seasonId:body.seasonId as string,
      matchweek:body.matchweek as number,
      fixtures:body.fixtures as AtomicCalendarImportRequest['fixtures'],
      adminUid:admin.uid, // Never accept a caller-supplied adminUid.
    });
    return NextResponse.json({ok:true,...result});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error?error.message:'Importazione rifiutata.'},{status:409});
  }
}
