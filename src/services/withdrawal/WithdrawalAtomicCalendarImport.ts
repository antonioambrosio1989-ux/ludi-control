/**
 * Atomic calendar import + withdrawal candidate ledger update.
 * DEMO EMULATOR ONLY until reviewed for production. No awards or reports are created.
 * This operation must replace, rather than follow, the legacy client createMany()
 * on a future authenticated, explicitly enabled admin path.
 */
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  planFutureWalkoverRegistrations,
  type ImportedScheduledFixture,
  type WalkoverFutureRegistration,
} from './WithdrawalPostImportAndTopPlayer';

export type AtomicCalendarFixture = {
  homeTeamId: string;
  awayTeamId: string;
  date: string;
  time: string;
  venue: string;
};
export type AtomicCalendarImportRequest = {
  seasonId: string;
  matchweek: number;
  fixtures: AtomicCalendarFixture[];
  adminUid: string;
};
export type AtomicCalendarImportResult = {
  createdMatchIds: string[];
  registeredPendingWalkovers: number;
  awardedWalkovers: 0;
};

const validId = (x: unknown): x is string =>
  typeof x === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(x);

function requireDemoFirestore(): void {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
  const project = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? '';
  if (!/^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host) || !project.startsWith('demo-')) {
    throw new Error('Importazione atomica disponibile solo su Firestore Emulator demo-.');
  }
}

function validateRequest(req: AtomicCalendarImportRequest): void {
  if (!validId(req.seasonId) || !validId(req.adminUid) || !Number.isSafeInteger(req.matchweek) ||
      req.matchweek < 1 || !Array.isArray(req.fixtures) || req.fixtures.length < 1 ||
      req.fixtures.length > 75) {
    throw new Error('Importazione calendario non valida.');
  }
  const teams = new Set<string>();
  const slots = new Set<string>();
  for (const f of req.fixtures) {
    if (!f || !validId(f.homeTeamId) || !validId(f.awayTeamId) ||
        f.homeTeamId === f.awayTeamId || teams.has(f.homeTeamId) || teams.has(f.awayTeamId) ||
        typeof f.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f.date) ||
        Number.isNaN(Date.parse(`${f.date}T12:00:00Z`)) ||
        typeof f.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(f.time) ||
        typeof f.venue !== 'string' || f.venue.trim().length === 0 || f.venue.length > 200) {
      throw new Error('Gara o duplicato della giornata non valido.');
    }
    teams.add(f.homeTeamId); teams.add(f.awayTeamId);
    const slot = `${f.date}|${f.time}`;
    if (slots.has(slot)) throw new Error('Orario duplicato nella giornata.');
    slots.add(slot);
  }
}

type PendingLedgerEntry = WalkoverFutureRegistration & { reportIds?: string[] };
function canonicalLedgerEntries(raw: unknown): WalkoverFutureRegistration[] {
  if (!Array.isArray(raw)) throw new Error('Registro effetti non verificabile.');
  const ids = new Set<string>();
  return raw.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('Voce registro malformata.');
    const e = entry as Record<string, unknown>;
    if (Object.keys(e).some(k => !['matchId','matchweek','opponentTeamId','effect','reportIds'].includes(k)) ||
        !validId(e.matchId) || !validId(e.opponentTeamId) ||
        !Number.isSafeInteger(e.matchweek) || Number(e.matchweek) < 1 ||
        e.effect !== 'walkover_pending_official_closure' ||
        (e.reportIds !== undefined && (!Array.isArray(e.reportIds) || e.reportIds.length !== 0)) ||
        ids.has(e.matchId)) throw new Error('Registro futuro non canonico.');
    ids.add(e.matchId);
    return {matchId:e.matchId,matchweek:e.matchweek as number,
      opponentTeamId:e.opponentTeamId,effect:'walkover_pending_official_closure'};
  });
}

export async function createCalendarAndWithdrawalCandidatesInDemo(
  db: Firestore,
  req: AtomicCalendarImportRequest,
): Promise<AtomicCalendarImportResult> {
  requireDemoFirestore();
  validateRequest(req);
  const seasonRef = db.collection('seasons').doc(req.seasonId);
  const matchesQuery = db.collection('matches').where('seasonId','==',req.seasonId);
  const registrationsQuery = seasonRef.collection('withdrawalRegistrations');
  const closureRef = seasonRef.collection('officialMatchweekClosures').doc(String(req.matchweek));
  // Generate deterministic refs *per attempt*, including transaction retries.
  // The returned IDs are the IDs actually committed by the successful attempt.
  return db.runTransaction(async tx => {
    const [season, existingMatches, registrations, closure] = await Promise.all([
      tx.get(seasonRef), tx.get(matchesQuery), tx.get(registrationsQuery), tx.get(closureRef),
    ]);
    if (!season.exists || season.data()?.status !== 'active')
      throw new Error('Stagione non attiva: importazione bloccata.');
    if (closure.exists && closure.data()?.state === 'officially_closed')
      throw new Error('Giornata già conclusa ufficialmente.');

    // No existing fixture can share either a team in this matchweek or a slot.
    const occupiedTeams = new Set<string>();
    const occupiedSlots = new Set<string>();
    for (const snap of existingMatches.docs) {
      const m = snap.data();
      if (m.status === 'cancelled') continue;
      occupiedSlots.add(`${String(m.date ?? '')}|${String(m.time ?? '')}`);
      if (m.matchweek === req.matchweek) {
        occupiedTeams.add(String(m.homeTeamId));
        occupiedTeams.add(String(m.awayTeamId));
      }
    }
    for (const f of req.fixtures) {
      if (occupiedTeams.has(f.homeTeamId) || occupiedTeams.has(f.awayTeamId))
        throw new Error('Squadra già presente nella giornata.');
      if (occupiedSlots.has(`${f.date}|${f.time}`))
        throw new Error('Fascia oraria già occupata.');
    }

    const activeRegistrations = registrations.docs.filter(s => s.data().state === 'active');
    const ledgerRefs = activeRegistrations.map(s =>
      seasonRef.collection('withdrawalEffectLedgers').doc(s.id));
    const ledgerSnaps = await Promise.all(ledgerRefs.map(ref => tx.get(ref)));
    const matchRefs = req.fixtures.map(() => db.collection('matches').doc());
    const imported: ImportedScheduledFixture[] = req.fixtures.map((f,i) => ({
      id: matchRefs[i].id,seasonId:req.seasonId,matchweek:req.matchweek,
      homeTeamId:f.homeTeamId,awayTeamId:f.awayTeamId,status:'scheduled',matchType:'regularSeason',
    }));
    const ledgerWrites: {ref: (typeof ledgerRefs)[number]; entries: PendingLedgerEntry[]}[] = [];
    let registeredPendingWalkovers = 0;
    for (let i=0;i<activeRegistrations.length;i++) {
      const reg = activeRegistrations[i].data();
      const ledgerSnap = ledgerSnaps[i];
      const ledger = ledgerSnap.data();
      if (reg.effectsApplied !== true || !validId(reg.activationCommitId) ||
          !ledgerSnap.exists || ledger?.state !== 'applied' || ledger.effectsApplied !== true ||
          ledger.policy !== 'retain_and_walkover' || ledger.activationCommitId !== reg.activationCommitId ||
          !validId(ledger.operationId) || !Number.isSafeInteger(ledger.effectiveMatchweek) ||
          ledger.effectiveMatchweek < 1) {
        // First-leg/unknown active withdrawal cannot silently use this path.
        throw new Error('Ritiro attivo non compatibile: revisione amministrativa obbligatoria.');
      }
      const previous = canonicalLedgerEntries(ledger.entries);
      const plan = planFutureWalkoverRegistrations({
        seasonId:req.seasonId,withdrawnTeamId:activeRegistrations[i].id,
        effectiveMatchweek:ledger.effectiveMatchweek,fixtures:imported,registeredEntries:previous,
      });
      if (plan.newEntries.length !== 0) {
        ledgerWrites.push({ref:ledgerRefs[i],entries:[...(ledger.entries as PendingLedgerEntry[]),
          ...plan.newEntries.map(entry => ({...entry,reportIds:[]}))]});
        registeredPendingWalkovers += plan.newEntries.length;
      }
    }
    // All reads and all validations complete. The fixture creation and ledger
    // updates now form one Firestore transaction. No partial import is possible.
    for (let i=0;i<matchRefs.length;i++) {
      const f = req.fixtures[i];
      tx.create(matchRefs[i],{
        seasonId:req.seasonId,matchweek:req.matchweek,matchweekId:`mw${req.matchweek}`,
        matchType:'regularSeason',homeTeamId:f.homeTeamId,awayTeamId:f.awayTeamId,
        date:f.date,time:f.time,venue:f.venue.trim(),
        status:'scheduled',published:false,
        createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),
      });
    }
    for (const w of ledgerWrites) tx.update(w.ref,{entries:w.entries});
    return {createdMatchIds:matchRefs.map(ref=>ref.id),registeredPendingWalkovers,awardedWalkovers:0};
  });
}
