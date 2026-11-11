/**
 * 10I: assegnazioni a tavolino progressive solo per Firestore Emulator.
 * Questo modulo crea una fonte verificabile di attribuzione, NON scrive
 * risultati sui match e NON abilita ancora il calcolatore delle classifiche.
 */
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export type MatureWalkoverRequest = {
  seasonId: string;
  withdrawnTeamId: string;
  matchId: string;
  matchweek: number;
  adminUid: string;
};
export type MatureWalkoverResult = {
  status: 'created' | 'unchanged';
  matchId: string;
  matchweek: number;
  winnerTeamId: string;
  winnerPoints: 3;
};
const id = (value: unknown) => String(value ?? '').trim();
const goodId = (value: unknown) => /^[a-zA-Z0-9_-]{1,128}$/.test(id(value));
function requireDemoEmulator(): void {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
  if (!/^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host) || !project.startsWith('demo-')) {
    throw new Error('Solo Firebase Firestore Emulator su progetto demo-.');
  }
}

export async function matureWithdrawalWalkoverInEmulator(db: Firestore, req: MatureWalkoverRequest): Promise<MatureWalkoverResult> {
  requireDemoEmulator();
  if (![req.seasonId,req.withdrawnTeamId,req.matchId,req.adminUid].every(goodId) ||
      !Number.isSafeInteger(req.matchweek) || req.matchweek < 1) throw new Error('Richiesta tavolino non valida.');
  const season = db.collection('seasons').doc(req.seasonId);
  const registrationRef = season.collection('withdrawalRegistrations').doc(req.withdrawnTeamId);
  const ledgerRef = season.collection('withdrawalEffectLedgers').doc(req.withdrawnTeamId);
  const closureRef = season.collection('officialMatchweekClosures').doc(String(req.matchweek));
  const matchRef = db.collection('matches').doc(req.matchId);
  const awardRef = season.collection('withdrawalWalkoverAwards').doc(req.matchId);
  return db.runTransaction(async tx => {
    const [seasonSnap, registration, ledger, closure, match, award] = await Promise.all([
      tx.get(season),tx.get(registrationRef),tx.get(ledgerRef),tx.get(closureRef),tx.get(matchRef),tx.get(awardRef),
    ]);
    if (!seasonSnap.exists || seasonSnap.data()?.status !== 'active') throw new Error('Stagione inattiva.');
    const reg=registration.data(), led=ledger.data(), m=match.data(), c=closure.data();
    if (!registration.exists || reg?.state !== 'active' || reg.effectsApplied !== true || !goodId(reg.activationCommitId)) {
      throw new Error('Ritiro non attivato.');
    }
    if (!ledger.exists || led?.state !== 'applied' || led.effectsApplied !== true ||
        led.policy !== 'retain_and_walkover' || led.activationCommitId !== reg.activationCommitId ||
        !goodId(led.operationId)) throw new Error('Registro effetti non attivo per il ritorno.');
    if (!Number.isSafeInteger(led.effectiveMatchweek) || req.matchweek < led.effectiveMatchweek) {
      throw new Error('Giornata precedente al ritiro.');
    }
    const entries = led.entries;
    if (!Array.isArray(entries)) throw new Error('Registro gare incompleto.');
    const selected=entries.filter((e:unknown)=>{
      if (!e || typeof e !== 'object') return false;
      return id((e as Record<string, unknown>).matchId)===req.matchId;
    });
    if (selected.length!==1 || selected[0].effect!=='walkover_pending_official_closure' ||
        selected[0].matchweek!==req.matchweek) throw new Error('Gara non prevista fra i tavolini del ritiro.');
    if (!match.exists || !m || m.seasonId!==req.seasonId || m.matchweek!==req.matchweek ||
        (m.matchType && m.matchType!=='regularSeason') || m.status!=='scheduled' ||
        (id(m.homeTeamId)!==req.withdrawnTeamId && id(m.awayTeamId)!==req.withdrawnTeamId) ||
        id(m.homeTeamId)===id(m.awayTeamId)) throw new Error('Calendario incompatibile con il tavolino.');
    const winner=id(m.homeTeamId)===req.withdrawnTeamId?id(m.awayTeamId):id(m.homeTeamId);
    if (!goodId(winner) || id(selected[0].opponentTeamId)!==winner) throw new Error('Avversario incoerente.');
    // Una giornata può essere attestata ufficialmente, non dedotta da data/ora.
    if (!closure.exists || c?.state!=='officially_closed' || c.seasonId!==req.seasonId ||
        c.matchweek!==req.matchweek || !goodId(c.closedBy) || !c.closedAt) {
      throw new Error('Giornata non dichiarata ufficialmente conclusa.');
    }
    const expected = {seasonId:req.seasonId,withdrawnTeamId:req.withdrawnTeamId,matchId:req.matchId,
      matchweek:req.matchweek,winnerTeamId:winner,loserTeamId:req.withdrawnTeamId,
      winnerPoints:3,homeScore:id(m.homeTeamId)===winner?6:0,
      awayScore:id(m.awayTeamId)===winner?6:0,
      state:'recorded_pending_publication',activationCommitId:reg.activationCommitId,
      operationId:led.operationId,closureId:closureRef.id};
    if (award.exists) {
      const existing=award.data()??{};
      for (const [key,value] of Object.entries(expected)) if(existing[key]!==value)
        throw new Error('Assegnazione esistente discordante: nessuna sovrascrittura.');
      return {status:'unchanged',matchId:req.matchId,matchweek:req.matchweek,winnerTeamId:winner,winnerPoints:3};
    }
    tx.create(awardRef,{...expected,createdBy:req.adminUid,createdAt:FieldValue.serverTimestamp()});
    return {status:'created',matchId:req.matchId,matchweek:req.matchweek,winnerTeamId:winner,winnerPoints:3};
  });
}
