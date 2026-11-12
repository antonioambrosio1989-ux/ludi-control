import {describe,it,expect,beforeAll,beforeEach,afterAll} from 'vitest';
import {initializeApp,deleteApp,type App} from 'firebase-admin/app';
import {getFirestore,type Firestore} from 'firebase-admin/firestore';
import {randomUUID} from 'node:crypto';
import {registerPostImportWalkoversInEmulator} from '../src/services/withdrawal/WithdrawalPostImportRegistrationEmulator';
const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
if(!process.env.FIRESTORE_EMULATOR_HOST||!project?.startsWith('demo-')) throw new Error('Demo emulator obbligatorio.');
let app:App,db:Firestore,seasonId:string;
const team='bristol';
const season=()=>db.collection('seasons').doc(seasonId);
const reg=()=>season().collection('withdrawalRegistrations').doc(team);
const ledger=()=>season().collection('withdrawalEffectLedgers').doc(team);
const matches=(id:string)=>db.collection('matches').doc(`${seasonId}_${id}`);
const req=(...ids:string[])=>({seasonId,withdrawnTeamId:team,matchIds:ids.map(id=>`${seasonId}_${id}`),adminUid:'demo_admin'});
const seed=async(id:string,home='oxford',away=team,week=14)=>matches(id).set({seasonId,matchweek:week,homeTeamId:home,awayTeamId:away,matchType:'regularSeason',status:'scheduled'});
beforeAll(()=>{app=initializeApp({projectId:project},`postimport_${randomUUID()}`);db=getFirestore(app);});
beforeEach(async()=>{
 seasonId=`postimport_${randomUUID().replaceAll('-','')}`;
 await Promise.all([season().set({status:'active'}),reg().set({state:'active',effectsApplied:true,activationCommitId:'commit_demo'}),ledger().set({state:'applied',effectsApplied:true,policy:'retain_and_walkover',activationCommitId:'commit_demo',operationId:'op_demo',effectiveMatchweek:12,entries:[]})]);
 await seed('mw14');
});
afterAll(async()=>{if(app)await deleteApp(app);});
describe('10O registrazione post import — solo Firestore emulator',()=>{
 it('aggiunge una candidatura senza attribuire punti, modificare gara o creare premi',async()=>{
  expect(await registerPostImportWalkoversInEmulator(db,req('mw14'))).toEqual({added:1,unchanged:0,unrelated:0,pendingAwardCount:0});
  expect((await ledger().get()).data()?.entries).toMatchObject([{matchId:`${seasonId}_mw14`,matchweek:14,opponentTeamId:'oxford',effect:'walkover_pending_official_closure'}]);
  expect((await matches('mw14').get()).data()).toMatchObject({status:'scheduled'});
  expect((await season().collection('withdrawalWalkoverAwards').get()).empty).toBe(true);
 });
 it('riesecuzione idempotente',async()=>{
  await registerPostImportWalkoversInEmulator(db,req('mw14'));
  expect(await registerPostImportWalkoversInEmulator(db,req('mw14'))).toMatchObject({added:0,unchanged:1});
  expect((await ledger().get()).data()?.entries).toHaveLength(1);
 });
 it('aggiunge solo nuove gare, ignorando quelle estranee',async()=>{
  await seed('other','luton','fulham',15);await seed('mw15',team,'liverpool',15);
  await registerPostImportWalkoversInEmulator(db,req('mw14'));
  expect(await registerPostImportWalkoversInEmulator(db,req('mw14','mw15','other'))).toMatchObject({added:1,unchanged:1,unrelated:1});
  expect((await ledger().get()).data()?.entries).toHaveLength(2);
 });
 it('rifiuta giornata ufficialmente chiusa senza modificare registro',async()=>{
  await season().collection('officialMatchweekClosures').doc('14').set({state:'officially_closed'});
  await expect(registerPostImportWalkoversInEmulator(db,req('mw14'))).rejects.toThrow(/già chiusa/i);
  expect((await ledger().get()).data()?.entries).toEqual([]);
 });
 it('rifiuta gara già giocata e registro alterato',async()=>{
  await matches('mw14').update({status:'played'});
  await expect(registerPostImportWalkoversInEmulator(db,req('mw14'))).rejects.toThrow();
  await matches('mw14').update({status:'scheduled'});
  await ledger().update({activationCommitId:'wrong'});
  await expect(registerPostImportWalkoversInEmulator(db,req('mw14'))).rejects.toThrow(/registro incompatibile/i);
 });
 it('rifiuta ingresso di altra stagione e gara inesistente',async()=>{
  await matches('mw14').update({seasonId:'other'});
  await expect(registerPostImportWalkoversInEmulator(db,req('mw14'))).rejects.toThrow();
  await expect(registerPostImportWalkoversInEmulator(db,req('missing'))).rejects.toThrow(/mancante/i);
 });
 it('blocca duplicati discordanti in registro',async()=>{
  await ledger().update({entries:[{matchId:`${seasonId}_mw14`,matchweek:14,opponentTeamId:'wrong',effect:'walkover_pending_official_closure'}]});
  await expect(registerPostImportWalkoversInEmulator(db,req('mw14'))).rejects.toThrow(/discordante/i);
 });
 it('blocca input duplicati e richieste senza emulator valido',async()=>{
  await expect(registerPostImportWalkoversInEmulator(db,req('mw14','mw14'))).rejects.toThrow(/non valida/i);
 });
});
