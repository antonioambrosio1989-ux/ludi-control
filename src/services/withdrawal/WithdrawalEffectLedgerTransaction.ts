/**
 * Fase 10B. Persistenza transazionale del PIANO degli effetti, solo Emulatore.
 * Non attiva la squadra, non cancella le partite, non modifica i tabellini,
 * non assegna punti e non modifica le squalifiche.
 */
import { createHash } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { buildWithdrawalPreparation, comparePreparedWithdrawal, preparationFingerprint, validWithdrawalId } from './WithdrawalPersistenceContract';

export type EffectEntry = {
  matchId: string;
  matchweek: number | null;
  opponentTeamId: string;
  effect: 'void' | 'retain' | 'walkover_pending_official_closure';
  reportIds: string[];
};
export type EffectLedgerResult = {
  state: 'created' | 'unchanged';
  operationId: string;
  snapshotHash: string;
  entries: EffectEntry[];
};
function id(v: unknown): string { return String(v ?? '').trim(); }
function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const record = v as Record<string, unknown>;
  return `{${Object.keys(record).sort().filter(k => record[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonical(record[k])}`).join(',')}}`;
}
function hash(v: unknown): string { return createHash('sha256').update(canonical(v)).digest('hex'); }
function isRS(data: Record<string,unknown>): boolean { return data.matchType === undefined || data.matchType === 'regularSeason'; }
function emulatorOnly() {
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '') ||
      !id(process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT).startsWith('demo-')) {
    throw new Error('Registro effetti consentito solo su Firestore Emulator con progetto demo-.');
  }
}

export async function stageWithdrawalEffectLedger(db: Firestore, request: {
  seasonId: string; teamId: string; expectedMatchweek: number; adminUid: string;
}): Promise<EffectLedgerResult> {
  emulatorOnly();
  const { seasonId, teamId, expectedMatchweek, adminUid } = request;
  if (![seasonId, teamId, adminUid].every(validWithdrawalId) ||
      !Number.isSafeInteger(expectedMatchweek) || expectedMatchweek < 1) throw new Error('Richiesta non valida.');
  const seasonRef = db.collection('seasons').doc(seasonId);
  const matchQuery = db.collection('matches').where('seasonId', '==', seasonId);
  const reportQuery = db.collection('matchReports').where('seasonId', '==', seasonId);
  const ledgerRef = seasonRef.collection('withdrawalEffectLedgers').doc(teamId);
  return db.runTransaction(async tx => {
    const [season, config, team, registration, intent, snapshot, ledger, matches, reports] = await Promise.all([
      tx.get(seasonRef), tx.get(seasonRef.collection('withdrawalSettings').doc('official')),
      tx.get(seasonRef.collection('teamEntries').doc(teamId)),
      tx.get(seasonRef.collection('withdrawalRegistrations').doc(teamId)),
      tx.get(seasonRef.collection('withdrawalActivationIntents').doc(teamId)),
      tx.get(seasonRef.collection('withdrawalReviewSnapshots').doc(teamId)),
      tx.get(ledgerRef), tx.get(matchQuery), tx.get(reportQuery),
    ]);
    if (!season.exists || season.data()?.status !== 'active') throw new Error('Stagione non attiva.');
    if (!team.exists || team.data()?.status !== 'active') throw new Error('Squadra non attiva.');
    if (!config.exists || !registration.exists || !intent.exists || !snapshot.exists) throw new Error('Preparazione o snapshot mancante.');
    const candidate = buildWithdrawalPreparation({seasonId, teamId, expectedMatchweek, config:config.data(), registration: registration.data()});
    const operationId = createHash('sha256').update(preparationFingerprint(candidate)).digest('hex');
    comparePreparedWithdrawal(intent.data(), { ...candidate, operationId });
    const affectedMatches = matches.docs.filter(d => {
      const v=d.data() as Record<string,unknown>;
      return isRS(v) && (id(v.homeTeamId)===teamId || id(v.awayTeamId)===teamId);
    }).map(d=>({id:d.id,data:d.data()})).sort((a,b)=>a.id.localeCompare(b.id));
    if (!affectedMatches.length) throw new Error('Nessuna gara coinvolta.');
    const affectedIds=new Set(affectedMatches.map(m=>m.id));
    const affectedReports=reports.docs.filter(d=>affectedIds.has(id(d.data().matchId)))
      .map(d=>({id:d.id,data:d.data()})).sort((a,b)=>a.id.localeCompare(b.id));
    const snapshotHash=hash({operationId,affectedMatches,affectedReports});
    const snap=snapshot.data();
    if (snap?.state !== 'review_only' || snap?.effectsApplied !== false || snap.operationId !== operationId || snap.snapshotHash !== snapshotHash ||
        canonical(snap.affectedMatchIds) !== canonical(affectedMatches.map(m=>m.id)) ||
        canonical(snap.affectedReportIds) !== canonical(affectedReports.map(r=>r.id))) {
      throw new Error('Snapshot obsoleto o incompatibile: rigenerare revisione.');
    }
    const reportIdsByMatch=new Map<string,string[]>();
    for(const r of affectedReports) {
      const key=id((r.data as Record<string,unknown>).matchId);
      reportIdsByMatch.set(key,[...(reportIdsByMatch.get(key)??[]),r.id]);
    }
    const entries:EffectEntry[]=affectedMatches.map(m=>{
      const d=m.data as Record<string,unknown>;
      const week=Number(d.matchweek);
      const matchweek=Number.isSafeInteger(week) && week>0?week:null;
      let effect:EffectEntry['effect']='void';
      if(candidate.policy==='retain_and_walkover') {
        if(matchweek===null) throw new Error('Giornata mancante: revisione manuale obbligatoria.');
        effect=matchweek<expectedMatchweek?'retain':'walkover_pending_official_closure';
      }
      return {matchId:m.id,matchweek,opponentTeamId:id(d.homeTeamId)===teamId?id(d.awayTeamId):id(d.homeTeamId),effect,reportIds:reportIdsByMatch.get(m.id)??[]};
    });
    const signature=hash({seasonId,teamId,operationId,snapshotHash,entries});
    if(ledger.exists) {
      const old=ledger.data();
      if(old?.state!=='staged_review_only' || old?.effectsApplied!==false || old.signature!==signature || old.snapshotHash!==snapshotHash) {
        throw new Error('Piano effetti già presente ma in conflitto: nessuna sovrascrittura.');
      }
      return {state:'unchanged',operationId,snapshotHash,entries};
    }
    tx.create(ledgerRef,{
      schemaVersion:1,seasonId,teamId,operationId,snapshotHash,signature,
      policy:candidate.policy,effectiveMatchweek:expectedMatchweek,
      state:'staged_review_only',effectsApplied:false,
      entries,createdBy:adminUid,createdAt:FieldValue.serverTimestamp(),
    });
    return {state:'created',operationId,snapshotHash,entries};
  });
}
