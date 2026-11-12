import {onCall,HttpsError} from "firebase-functions/v2/https";
import {getFirestore,FieldValue} from "firebase-admin/firestore";
import {assertMarketOpen,isDate,romeToday} from "./marketPolicy";
import {marketWritesAllowed} from "./marketWriteGate";

/** Fase 6B: gate esplicito, fail-closed. Nessuna scrittura abilitata per default. */
const writesAllowed = marketWritesAllowed(process.env);
const id=(v:unknown,label:string):string=>{
 if(typeof v!=="string" || !v.trim() || v.length>250 || v.includes("/")) throw new HttpsError("invalid-argument",label+" non valido.");
 return v.trim();
};
const precondition=(e:unknown):never=>{throw new HttpsError("failed-precondition",e instanceof Error?e.message:"Configurazione non valida.");};

export const confirmChampionshipTransfer=onCall({region:"europe-west1",maxInstances:10,enforceAppCheck:false},async(request)=>{
 const uid=request.auth?.uid;if(!uid) throw new HttpsError("unauthenticated","Accesso richiesto.");
 const data=request.data as Record<string,unknown>|null;
 const seasonId=id(data?.seasonId,"seasonId");const seasonPlayerId=id(data?.seasonPlayerId,"seasonPlayerId");
 const toTeamId=id(data?.toTeamId,"toTeamId");const effectiveDate=data?.effectiveDate;
 if(!isDate(effectiveDate)) throw new HttpsError("invalid-argument","Data effettiva non valida.");
 const db=getFirestore();const adminRef=db.doc(`admins/${uid}`),seasonRef=db.doc(`seasons/${seasonId}`),rosterRef=db.doc(`seasonPlayers/${seasonPlayerId}`);
 // Fail closed in production. Never infer successful write from a preview.
 if(!writesAllowed){return {saved:false,reason:"Conferma disabilitata: collaudo non completato."};}
 const transferRef=db.collection("seasonTransfers").doc();
 return db.runTransaction(async(tx)=>{
  const [admin,season,roster]=await Promise.all([tx.get(adminRef),tx.get(seasonRef),tx.get(rosterRef)]);
  if(!admin.exists || admin.get("active")!==true) throw new HttpsError("permission-denied","Amministratore non autorizzato.");
  if(!season.exists || !roster.exists) throw new HttpsError("not-found","Stagione o iscrizione non trovata.");
  if(roster.get("seasonId")!==seasonId || roster.get("status")!=="active") throw new HttpsError("failed-precondition","Iscrizione non attiva.");
  try {assertMarketOpen(season.data()??{},effectiveDate,romeToday());}catch(e){precondition(e);}
  const competitionId=id(season.get("competitionId"),"competitionId");
  const fromTeamId=id(roster.get("teamId"),"fromTeamId"),playerId=id(roster.get("playerId"),"playerId");
  if(fromTeamId===toTeamId) throw new HttpsError("failed-precondition","Squadre uguali.");
  const competitionRef=db.doc(`competitions/${competitionId}`),fromRef=db.doc(`seasons/${seasonId}/teamEntries/${fromTeamId}`),toRef=db.doc(`seasons/${seasonId}/teamEntries/${toTeamId}`);
  const keyId="sp_"+Buffer.from(JSON.stringify([seasonId,playerId]),"utf8").toString("base64url");
  const registryRef=db.collection("seasonPlayerKeys").doc(keyId);
  const [competition,from,to,registry]=await Promise.all([tx.get(competitionRef),tx.get(fromRef),tx.get(toRef),tx.get(registryRef)]);
  if(!competition.exists || !from.exists || !to.exists || from.get("status")!=="active" || to.get("status")!=="active") throw new HttpsError("failed-precondition","Competizione o squadre non attive.");
  if(!registry.exists || registry.get("seasonId")!==seasonId || registry.get("playerId")!==playerId || registry.get("seasonPlayerId")!==seasonPlayerId) throw new HttpsError("failed-precondition","Registro seasonPlayerKeys incoerente.");
  const rawHistory=roster.get("transferHistory")??[];
  if(!Array.isArray(rawHistory)) throw new HttpsError("failed-precondition","Storico non valido.");
  const initialTeamId=id(roster.get("initialTeamId")??fromTeamId,"initialTeamId");let current=initialTeamId;
  let previous=`${season.get("startYear")}-01-01`;const used=new Set<string>();
  for(const item of rawHistory){
   const t=item as Record<string,unknown>;
   if(!t || typeof t!=="object" || typeof t.id!=="string" || !t.id || used.has(t.id) || t.playerId!==playerId || t.seasonId!==seasonId ||
     (t.competitionId!==undefined && t.competitionId!==competitionId) || (t.competitionSlug!==undefined && typeof t.competitionSlug!=="string") ||
     !isDate(t.effectiveDate) || t.effectiveDate<=previous || t.fromTeamId!==current || typeof t.toTeamId!=="string" || !t.toTeamId.trim() )
      throw new HttpsError("failed-precondition","Catena storica incoerente.");
   used.add(t.id);current=t.toTeamId;previous=t.effectiveDate;
  }
  if(current!==fromTeamId || effectiveDate<=previous) throw new HttpsError("failed-precondition","Storico non allineato.");
  const record={id:transferRef.id,seasonId,playerId,competitionId,fromTeamId,toTeamId,effectiveDate};
  tx.update(rosterRef,{teamId:toTeamId,initialTeamId,transferHistory:[...rawHistory,record],updatedAt:FieldValue.serverTimestamp()});
  tx.create(transferRef,{...record,seasonPlayerId,createdAt:FieldValue.serverTimestamp()});
  return {saved:true,transferId:transferRef.id};
 });
});
