import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/src/lib/firebaseAdmin';
import { activateOfficialSecondLegWithdrawal, closeAndAwardOfficialWeek } from '@/src/services/withdrawal/WithdrawalOfficialProduction';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const respond=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
const goodId=(x:unknown):x is string=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
async function requireAdmin(req:NextRequest):Promise<string|null>{
  const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if(!token)return null;
  try{
    const uid=(await adminAuth.verifyIdToken(token,true)).uid;
    const doc=await adminDb.collection('admins').doc(uid).get();
    return doc.exists&&doc.data()?.active===true?uid:null;
  }catch{return null;}
}
export async function GET(req:NextRequest){
  const uid=await requireAdmin(req);if(!uid)return respond({error:'Amministratore richiesto.'},403);
  const seasonId=req.nextUrl.searchParams.get('seasonId'),teamId=req.nextUrl.searchParams.get('teamId');
  if(!goodId(seasonId)||!goodId(teamId))return respond({error:'Parametri non validi.'},400);
  const season=adminDb.collection('seasons').doc(seasonId);
  const [reg,ledger,closures,awards]=await Promise.all([
    season.collection('withdrawalRegistrations').doc(teamId).get(),
    season.collection('withdrawalEffectLedgers').doc(teamId).get(),
    season.collection('officialMatchweekClosures').get(),
    season.collection('withdrawalWalkoverAwards').get(),
  ]);
  const r=reg.data(),l=ledger.data();
  return respond({ok:true,state:r?.state??null,effectsApplied:r?.effectsApplied===true,
    policy:r?.policy??null,effectiveMatchweek:r?.effectiveMatchweek??null,
    plannedWeeks:l?.state==='applied'&&l.policy==='retain_and_walkover'&&Array.isArray(l.entries)
      ?[...new Set((l.entries as {matchweek:number;effect:string}[]).filter(x=>x.effect==='walkover_pending_official_closure').map(x=>x.matchweek))].sort((a,b)=>a-b):[],
    closures:closures.docs.filter(d=>d.data().withdrawalMatchId).map(d=>({week:d.data().matchweek,matchId:d.data().withdrawalMatchId})),
    awardedMatchIds:awards.docs.map(d=>d.id),
  });
}
export async function POST(req:NextRequest){
  const uid=await requireAdmin(req);if(!uid)return respond({error:'Amministratore richiesto.'},403);
  let raw:unknown;try{raw=await req.json();}catch{return respond({error:'JSON non valido.'},400);}
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return respond({error:'Richiesta non valida.'},400);
  const data=raw as Record<string,unknown>;
  if(!goodId(data.seasonId)||!goodId(data.teamId)||!Number.isSafeInteger(data.expectedMatchweek)||
      (data.expectedMatchweek as number)<1) return respond({error:'Identificativi non validi.'},400);
  const base={seasonId:data.seasonId,teamId:data.teamId,expectedMatchweek:data.expectedMatchweek as number,adminUid:uid};
  try{
    if(data.action==='activate'){
      if(data.confirmation!==`RITIRA ${base.teamId}`)return respond({error:'Conferma testuale mancante.'},400);
      return respond({ok:true,...await activateOfficialSecondLegWithdrawal(adminDb,base)});
    }
    if(data.action==='close_and_award'){
      if(!Number.isSafeInteger(data.matchweek)||(data.matchweek as number)<1||
        data.confirmation!==`CHIUDI ${data.matchweek}`)return respond({error:'Conferma giornata mancante.'},400);
      return respond({ok:true,...await closeAndAwardOfficialWeek(adminDb,{...base,matchweek:data.matchweek as number})});
    }
    return respond({error:'Operazione non disponibile.'},400);
  }catch(e){console.error('Withdrawal official operation refused:',e);return respond({error:e instanceof Error?e.message:'Operazione negata.'},409);}
}
