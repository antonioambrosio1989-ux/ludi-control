import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/src/lib/firebaseAdmin';
import { allowEmulatorWithdrawalPreparation, validWithdrawalId } from '@/src/services/withdrawal/WithdrawalPersistenceContract';
import { prepareWithdrawalTestIntent } from '@/src/services/withdrawal/WithdrawalPreparationTransaction';

export const runtime = 'nodejs';
const respond = (body:object,status=200) => NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
/** Route non utilizzabile in produzione. Crea soltanto un intent di test, non attiva il ritiro. */
export async function POST(request:NextRequest) {
  if (!allowEmulatorWithdrawalPreparation(process.env)) return respond({error:'Endpoint disponibile soltanto con emulatori Firebase locali.'},404);
  const bearer=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!bearer) return respond({error:'Autenticazione richiesta.'},401);
  let uid:string;
  try { uid=(await adminAuth.verifyIdToken(bearer,true)).uid; }
  catch { return respond({error:'Token non valido.'},401); }
  const admin=await adminDb.collection('admins').doc(uid).get();
  if (!admin.exists || admin.data()?.active !== true) return respond({error:'Permessi amministrativi insufficienti.'},403);
  let body:unknown;
  try { body=await request.json(); }
  catch {return respond({error:'JSON non valido.'},400);}
  if (!body || typeof body!=='object' || Array.isArray(body)) return respond({error:'Dati non validi.'},400);
  const {seasonId,teamId,expectedMatchweek,confirmTestOnly} = body as Record<string,unknown>;
  if (confirmTestOnly !== true || !validWithdrawalId(seasonId) || !validWithdrawalId(teamId) || !Number.isSafeInteger(expectedMatchweek)) {
    return respond({error:'Richiesta di test non valida.'},400);
  }
  try {
    const result = await prepareWithdrawalTestIntent(adminDb, {
      seasonId, teamId, expectedMatchweek: expectedMatchweek as number, adminUid: uid,
    });
    return respond({ok:true,mode:'emulator_test_only',...result,effectsApplied:false,activationEnabled:false});
  } catch(error) {
    return respond({error:error instanceof Error ? error.message : 'Preparazione non riuscita.'},409);
  }
}
