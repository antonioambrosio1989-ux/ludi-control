import {initializeApp,getApps} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {onCall,HttpsError} from "firebase-functions/v2/https";
import {setGlobalOptions} from "firebase-functions/v2";
import {assertMarketOpen,romeToday} from "./marketPolicy";
export {confirmChampionshipTransfer} from "./confirm";
setGlobalOptions({maxInstances:10,region:"europe-west1"});
if(getApps().length===0) initializeApp();
const required=(v:unknown,n:string)=>{if(typeof v!=="string" || !v.trim() || v.includes("/") || v.length>250) throw new HttpsError("invalid-argument",n+" non valido.");return v.trim();};
/** Nome callable legacy conservato per compatibilita client; opera su ogni stagione A/R. */
export const previewChampionshipTransfer=onCall({enforceAppCheck:false,maxInstances:10},async(request)=>{
 const uid=request.auth?.uid;if(!uid) throw new HttpsError("unauthenticated","Accesso richiesto.");
 const db=getFirestore();const admin=await db.doc(`admins/${uid}`).get();
 if(!admin.exists || admin.get("active")!==true) throw new HttpsError("permission-denied","Amministratore non autorizzato.");
 const data=request.data as Record<string,unknown>|null;
 const seasonId=required(data?.seasonId,"seasonId"),seasonPlayerId=required(data?.seasonPlayerId,"seasonPlayerId"),toTeamId=required(data?.toTeamId,"toTeamId");
 const [season,player]=await Promise.all([db.doc(`seasons/${seasonId}`).get(),db.doc(`seasonPlayers/${seasonPlayerId}`).get()]);
 if(!season.exists || !player.exists) throw new HttpsError("not-found","Stagione o iscrizione assente.");
 if(player.get("seasonId")!==seasonId || player.get("status")!=="active") throw new HttpsError("failed-precondition","Iscrizione non attiva.");
 const effectiveDate=typeof data?.effectiveDate==="string"?data.effectiveDate:romeToday();
 try {assertMarketOpen(season.data()??{},effectiveDate,romeToday());} catch(e){throw new HttpsError("failed-precondition",e instanceof Error?e.message:"Mercato non disponibile.");}
 const competitionId=required(season.get("competitionId"),"competitionId");
 const [competition,teams]=await Promise.all([db.doc(`competitions/${competitionId}`).get(),db.collection(`seasons/${seasonId}/teamEntries`).get()]);
 if(!competition.exists) throw new HttpsError("failed-precondition","Competizione non trovata.");
 const fromTeamId=required(player.get("teamId"),"teamId");
 const entries=teams.docs.map(d=>({id:String(d.get("teamId")??d.id),status:d.get("status")}));
 if(fromTeamId===toTeamId || !entries.some(x=>x.id===fromTeamId&&x.status==="active") || !entries.some(x=>x.id===toTeamId&&x.status==="active")) throw new HttpsError("failed-precondition","Squadre non valide.");
 return {allowedToWrite:false,reason:"Solo anteprima: scritture disabilitate in produzione.",seasonId,seasonPlayerId,playerId:String(player.get("playerId")??""),fromTeamId,toTeamId,effectiveDate};
});
