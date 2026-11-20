import "server-only";
import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { FieldValue, type DocumentReference, type DocumentData } from "firebase-admin/firestore";
import { adminDb } from "@/src/lib/firebaseAdmin";
import { requireAdminApi } from "@/src/lib/requireAdminApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const idPattern = /^[A-Za-z0-9_-]{1,180}$/;
const allowedCollections = new Set([
  "historicalPlayerSeasonStats", "seasonPlayers", "seasonPlayerKeys",
  "matchReports", "hallOfFame", "hallOfChampions",
  "disciplinaryRecords", "players", "playerPrivateProfiles",
]);
function required(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
const respond = (data: object, code = 200) => Response.json(data, {
  status: code, headers: { "Cache-Control": "no-store" },
});
const idOf = (seasonId: string, playerId: string) =>
  "sp_" + Buffer.from(JSON.stringify([seasonId, playerId]), "utf8").toString("base64url");
const sha = (data: unknown) => createHash("sha256").update(JSON.stringify(data)).digest("hex");

// Preserva Timestamp, GeoPoint e altri valori Firestore; non sostituisce sottostringhe.
function rewrite(value: unknown, source: string, target: string): unknown {
  if (value === source) return target;
  if (Array.isArray(value)) return value.map(x => rewrite(x, source, target));
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const newKey = key === source ? target : key;
    if (Object.prototype.hasOwnProperty.call(out, newKey))
      throw new Error("Conflitto nelle prestazioni indicizzate per giocatore. Unione annullata.");
    out[newKey] = rewrite(child, source, target);
  }
  return out;
}
function mentions(value: unknown, id: string): boolean {
  if (value === id) return true;
  if (Array.isArray(value)) return value.some(x => mentions(x, id));
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.entries(value).some(([k, x]) => k === id || mentions(x, id));
}

type Planned = {ref: DocumentReference<DocumentData>; before: DocumentData; after?: DocumentData; remove?: boolean};
function normalizeSeasonMetadata(target: unknown, source: unknown) {
  const list = [...(Array.isArray(target) ? target : [])];
  const known = new Set(list.map((x: {seasonId?: string}) => x?.seasonId).filter(Boolean));
  for (const x of Array.isArray(source) ? source : []) {
    if (!x?.seasonId || known.has(x.seasonId)) continue;
    list.push(x); known.add(x.seasonId);
  }
  return list;
}
function combineProfile(target: DocumentData, source: DocumentData): DocumentData {
  const patch: DocumentData = { ...target };
  for (const field of ["birthYear", "photoUrl", "coverImageUrl", "preferredFoot", "baseRating"])
    if ((patch[field] === undefined || patch[field] === null || patch[field] === "") && source[field] !== undefined && source[field] !== null)
      patch[field] = source[field];
  if ((!patch.nationality || patch.nationality === "IT") && source.nationality && source.nationality !== "IT") patch.nationality = source.nationality;
  patch.historicalImportSources = normalizeSeasonMetadata(target.historicalImportSources, source.historicalImportSources);
  const achievements = new Map<string, unknown>();
  for (const x of [...(Array.isArray(target.achievements) ? target.achievements : []), ...(Array.isArray(source.achievements) ? source.achievements : [])]) {
    if (x?.id && !achievements.has(x.id)) achievements.set(x.id, x);
  }
  if (achievements.size) patch.achievements = [...achievements.values()];
  patch.updatedAt = FieldValue.serverTimestamp();
  return patch;
}

export async function POST(request: NextRequest) {
  try { await requireAdminApi(request); }
  catch { return respond({error: "Autenticazione amministratore richiesta."}, 403); }
  try {
    if (Number(request.headers.get("content-length") || 0) > 4096) return respond({error:"Richiesta troppo grande."},413);
    const raw: unknown = await request.json();
    required(raw && typeof raw === "object" && !Array.isArray(raw), "Richiesta non valida.");
    const input = raw as Record<string, unknown>;
    required(input.action === "preview" || input.action === "apply", "Azione non valida.");
    required(typeof input.targetPlayerId === "string" && idPattern.test(input.targetPlayerId), "ID principale non valido.");
    required(typeof input.sourcePlayerId === "string" && idPattern.test(input.sourcePlayerId), "ID duplicato non valido.");
    const targetId = input.targetPlayerId as string, sourceId = input.sourcePlayerId as string;
    required(targetId !== sourceId, "Selezionare due profili differenti.");
    if (input.action === "apply" && process.env.LUDI_PLAYER_MERGE_ENABLED !== "true")
      return respond({error:"Unione manuale non abilitata sul server. Configurare LUDI_PLAYER_MERGE_ENABLED=true."},403);
    const targetRef=adminDb.doc(`players/${targetId}`), sourceRef=adminDb.doc(`players/${sourceId}`);
    const targetPrivateRef=adminDb.doc(`playerPrivateProfiles/${targetId}`),sourcePrivateRef=adminDb.doc(`playerPrivateProfiles/${sourceId}`);
    const [targetSnap,sourceSnap,targetPrivateSnap,sourcePrivateSnap]=await Promise.all([
      targetRef.get(),sourceRef.get(),targetPrivateRef.get(),sourcePrivateRef.get(),
    ]);
    required(targetSnap.exists && sourceSnap.exists, "Uno dei profili non esiste piÃ¹. Aggiornare l'elenco.");
    const target=targetSnap.data()!,source=sourceSnap.data()!;
    required(target.competitionId === source.competitionId, "Competizioni differenti: unione vietata.");
    const yearA=targetPrivateSnap.get("birthYear") ?? target.birthYear;
    const yearB=sourcePrivateSnap.get("birthYear") ?? source.birthYear;
    if (yearA != null && yearB != null && Number(yearA)!==Number(yearB))
      throw new Error("Anni di nascita differenti: correggere l'identitÃ  prima dell'unione.");

    // Audit completo delle raccolte radice. Variazioni ignote = BLOCCO, mai eliminazione cieca.
    const cols=await adminDb.listCollections();
    const snapshots=await Promise.all(cols.map(async col => ({name:col.id, snap:await col.get()})));
    // La scansione di produzione ha individuato tre famiglie di sottocollezioni
    // che possono contenere playerId: versioni tabellini, snapshot quiz e preferenze.
    // Le versioni e gli snapshot sono archivi: non vengono riscritti o eliminati.
    // Se citano il profilo sorgente, impediamo l'eliminazione per non lasciare
    // riferimenti pendenti in un eventuale ripristino/visualizzazione storica.
    // Le preferenze utente, invece, sono dati attivi e vengono aggiornate.
    const [versionSnapshots, quizSnapshots, settingsSnapshots] = await Promise.all([
      adminDb.collectionGroup("versions").get(),
      adminDb.collectionGroup("questions").get(),
      adminDb.collectionGroup("settings").get(),
    ]);
    const archivalHit = [...versionSnapshots.docs, ...quizSnapshots.docs].find(doc =>
      mentions(doc.data(), sourceId) || doc.id === sourceId || doc.id.includes(sourceId)
    );
    required(!archivalHit,
      `Unione bloccata: il profilo duplicato compare in un archivio (${archivalHit?.ref.path}). ` +
      "Occorre una migrazione dedicata che preservi le versioni dei tabellini e i quiz.");
    const settingsWithSource = settingsSnapshots.docs.filter(doc =>
      mentions(doc.data(), sourceId) || doc.id === sourceId || doc.id.includes(sourceId)
    );
    const planned: Planned[]=[];
    const rosterSource: Planned[]=[];
    const rosterTarget: Planned[]=[];
    const all = snapshots.flatMap(c=>c.snap.docs.map(d=>({collection:c.name,doc:d})));
    const plan = (ref: DocumentReference<DocumentData>, before: DocumentData, after?: DocumentData, remove=false) => {
      if (planned.some(x=>x.ref.path===ref.path)) throw new Error("Pianificazione duplicata: "+ref.path);
      planned.push({ref,before,after,remove});
    };
    const sourceKeys = all.filter(x=>x.collection==="seasonPlayerKeys"&&x.doc.get("playerId")===sourceId);
    const targetKeys = all.filter(x=>x.collection==="seasonPlayerKeys"&&x.doc.get("playerId")===targetId);
    for (const x of all) {
      if (x.collection==="seasonPlayers" && x.doc.get("playerId")===targetId)
        rosterTarget.push({ref:x.doc.ref,before:x.doc.data()});
      if (x.collection==="seasonPlayers" && x.doc.get("playerId")===sourceId)
        rosterSource.push({ref:x.doc.ref,before:x.doc.data()});
    }
    const registryId = (x: Planned) => idOf(x.before.seasonId,x.before.playerId);
    for (const x of [...rosterSource,...rosterTarget]) {
      required(idPattern.test(String(x.before.seasonId||"")), "Stagione rosa non valida.");
      const key=all.find(y=>y.collection==="seasonPlayerKeys"&&y.doc.id===registryId(x));
      required(key && key.doc.get("seasonPlayerId")===x.ref.id && key.doc.get("playerId")===x.before.playerId,
        "Registro univoco incoerente: "+x.ref.path+". Correggere il registro prima dell'unione.");
    }
    required(sourceKeys.length===rosterSource.length && targetKeys.length===rosterTarget.length,
      "Chiavi registro non coerenti con le iscrizioni stagionali.");
    const extraRefs: Array<{collection:string;ref:DocumentReference<DocumentData>;data:DocumentData}> = [];
    for (const x of all) {
      if ((x.collection==="players"||x.collection==="playerPrivateProfiles") && [sourceId,targetId].includes(x.doc.id)) continue;
      if (x.collection==="seasonPlayers" && [sourceId,targetId].includes(x.doc.get("playerId"))) continue;
      if (x.collection==="seasonPlayerKeys" && [sourceId,targetId].includes(x.doc.get("playerId"))) continue;
      if (mentions(x.doc.data(),sourceId) || x.doc.id===sourceId || x.doc.id.includes(sourceId)) {
        required(allowedCollections.has(x.collection),`Riferimento in raccolta non supportata: ${x.collection}/${x.doc.id}. Nessuna modifica eseguita.`);
        extraRefs.push({collection:x.collection,ref:x.doc.ref,data:x.doc.data()});
      }
    }
    for (const doc of settingsWithSource) {
      required(doc.id !== sourceId && !doc.id.includes(sourceId),
        "ID preferenze utente non convertibile: " + doc.ref.path);
      const before = doc.data();
      const after = rewrite(before, sourceId, targetId) as DocumentData;
      required(!mentions(before, targetId),
        "Preferenze con entrambi i profili: " + doc.ref.path + ". Verificare manualmente.");
      required(!isDeepStrictEqual(before, after), "Preferenze non convertibili: " + doc.ref.path);
      plan(doc.ref, before, after);
    }
    for(const x of rosterSource) {
      const other=rosterTarget.find(y=>y.before.seasonId===x.before.seasonId);
      if(other) {
        required(other.before.teamId===x.before.teamId,
          `Conflitto rose ${x.before.seasonId}: squadre differenti. Nessuna modifica eseguita.`);
        required(other.before.role===x.before.role,
          `Ruoli differenti nella stagione ${x.before.seasonId}. Verificare manualmente.`);
        plan(x.ref,x.before,undefined,true);
      } else plan(x.ref,x.before,{...x.before,playerId:targetId,updatedAt:FieldValue.serverTimestamp()});
      const k=sourceKeys.find(y=>y.doc.id===registryId(x));
      required(k,"Chiave di origine assente.");
      plan(k!.doc.ref,k!.doc.data(),undefined,true);
      if(!other){
        const newRef=adminDb.doc(`seasonPlayerKeys/${idOf(x.before.seasonId,targetId)}`);
        required(!all.some(y=>y.collection==="seasonPlayerKeys"&&y.doc.id===newRef.id),
          "Chiave di destinazione giÃ  presente: "+newRef.id);
        // Inserimento separato solo all'interno della transazione.
        planned.push({ref:newRef,before:{__create:true},after:{seasonId:x.before.seasonId,playerId:targetId,seasonPlayerId:x.ref.id}});
      }
    }
    for(const x of extraRefs){
      if(x.collection==="historicalPlayerSeasonStats"){
        required(x.data.playerId===sourceId && typeof x.data.seasonId==="string", "Storico non riconosciuto: "+x.ref.path);
        const newRef=adminDb.doc(`historicalPlayerSeasonStats/${x.data.seasonId}__${targetId}`);
        required(!all.some(y=>y.collection==="historicalPlayerSeasonStats"&&y.doc.id===newRef.id),
          "Storici nella stessa stagione presenti su entrambi i profili: verifica manuale necessaria.");
        plan(x.ref,x.data,undefined,true);
        planned.push({ref:newRef,before:{__create:true},after:{...x.data,playerId:targetId,updatedAt:FieldValue.serverTimestamp()}});
      }else {
        required(!x.ref.id.includes(sourceId),"ID documento contenente il vecchio playerId: "+x.ref.path);
        const converted=rewrite(x.data,sourceId,targetId) as DocumentData;
        required(!isDeepStrictEqual(converted,x.data),"Riferimento non convertibile: "+x.ref.path);
        // Un tabellino che contenga gia' entrambi i profili richiede analisi manuale.
        required(!mentions(x.data,targetId),"Documento con entrambi i profili: "+x.ref.path);
        plan(x.ref,x.data,converted);
      }
    }
    plan(targetRef,target,combineProfile(target,source));
    plan(sourceRef,source,undefined,true);
    if(sourcePrivateSnap.exists){
      if(targetPrivateSnap.exists){
        const merged={...sourcePrivateSnap.data(),...targetPrivateSnap.data()};
        plan(targetPrivateRef,targetPrivateSnap.data()!,merged);
      } else planned.push({ref:targetPrivateRef,before:{__create:true},after:sourcePrivateSnap.data()!});
      plan(sourcePrivateRef,sourcePrivateSnap.data()!,undefined,true);
    }
    required(planned.length<=180,`Troppi documenti (${planned.length}); richiede migrazione dedicata.`);
    const result={targetPlayerId:targetId,sourcePlayerId:sourceId,
      targetPlayerName:`${target.firstName??""} ${target.lastName??""}`.trim(),
      sourcePlayerName:`${source.firstName??""} ${source.lastName??""}`.trim(),
      documentsAffected:planned.length,sourceRosters:rosterSource.length,
      historicalStats:extraRefs.filter(x=>x.collection==="historicalPlayerSeasonStats").length,
      otherReferences:extraRefs.filter(x=>x.collection!=="historicalPlayerSeasonStats").length,
      userPreferences:settingsWithSource.length};
    if(input.action==="preview") return respond({...result,preview:true});
    // Rilettura atomica dei documenti interessati, con controllo anti-variazione.
    const auditRef=adminDb.collection("playerMergeAudits").doc();
    await adminDb.runTransaction(async tx=>{
      const reads=await Promise.all(planned.map(x=>tx.get(x.ref)));
      planned.forEach((x,i)=>{
        const now=reads[i];
        if(x.before.__create) required(!now.exists,"Il documento da creare ora esiste: "+x.ref.path);
        else required(now.exists && sha(now.data())===sha(x.before),
          "Dati modificati durante l'anteprima: "+x.ref.path);
      });
      for(const x of planned) {
        if(x.remove) tx.delete(x.ref);
        else if(x.before.__create) tx.create(x.ref,x.after!);
        else tx.set(x.ref,x.after!);
      }
      tx.create(auditRef,{...result,at:FieldValue.serverTimestamp(),status:"completed",
        affectedPaths:planned.map(x=>x.ref.path)});
    },{maxAttempts:3});
    return respond({...result,completed:true});
  }catch(e){
    const message=e instanceof Error?e.message:"Unione non riuscita.";
    console.error("LUDI PLAYER MERGE:",message);
    return respond({error:message},409);
  }
}
