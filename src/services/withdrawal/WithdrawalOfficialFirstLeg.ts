/**
 * 11F-23: limited first-leg official void_all activation.
 * Preserves original match/report documents. Refuses any possible disciplinary
 * repercussions until the chronological disciplinary replay is production-ready.
 * Important: this is NOT full first-leg support for seasons with affected cards
 * or suspensions. All verification and writes happen in one transaction.
 */
import { createHash } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { calculateWithdrawalPolicy, validateWithdrawalConfig } from './WithdrawalRegistryRules';

type Input = { seasonId: string; teamId: string; adminUid: string; expectedMatchweek: number };
type MatchData = { id: string; data: Record<string, unknown> };
const validId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const id = (v: unknown) => String(v ?? '').trim();
const rs = (m: Record<string, unknown>) => m.matchType === undefined || m.matchType === 'regularSeason';
const isInt = (x: unknown) => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;

/** For disciplinary safety, the absence of cards must be demonstrable, not assumed. */
function assertNoCards(report: Record<string, unknown>, matchId: string) {
  const data = report.data;
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error(`Tabellino ${matchId}: prestazioni non certificabili.`);
  const performances = (data as Record<string, unknown>).performances;
  if (!performances || typeof performances !== 'object' || Array.isArray(performances))
    throw new Error(`Tabellino ${matchId}: prestazioni mancanti.`);
  for (const perf of Object.values(performances as Record<string, unknown>)) {
    if (!perf || typeof perf !== 'object' || Array.isArray(perf))
      throw new Error(`Tabellino ${matchId}: prestazione non valida.`);
    const p = perf as Record<string, unknown>;
    if (!validId(p.playerId)) throw new Error(`Tabellino ${matchId}: ID giocatore non valido.`);
    for (const key of ['yellowCards', 'directRedCards', 'redCards']) {
      const value = p[key] ?? 0;
      if (!isInt(value) || Number(value) !== 0)
        throw new Error('Girone di andata: gara con cartellini. Richiesta riconciliazione disciplinare; attivazione bloccata.');
    }
  }
}

export async function activateOfficialFirstLegWithdrawal(db: Firestore, input: Input) {
  if (![input.seasonId, input.teamId, input.adminUid].every(validId) ||
      !Number.isSafeInteger(input.expectedMatchweek) || input.expectedMatchweek < 1)
    throw new Error('Dati ritiro non validi.');
  const season = db.collection('seasons').doc(input.seasonId);
  const regRef = season.collection('withdrawalRegistrations').doc(input.teamId);
  const ledgerRef = season.collection('withdrawalEffectLedgers').doc(input.teamId);
  const auditRef = season.collection('withdrawalActivationCommits').doc(input.teamId);
  return db.runTransaction(async tx => {
    const [seasonDoc, settings, team, registration, ledger, audit, registrations, awards, closures,
      matches, reports, records, suspensions] = await Promise.all([
      tx.get(season), tx.get(season.collection('withdrawalSettings').doc('official')),
      tx.get(season.collection('teamEntries').doc(input.teamId)), tx.get(regRef), tx.get(ledgerRef), tx.get(auditRef),
      tx.get(season.collection('withdrawalRegistrations')),
      tx.get(season.collection('withdrawalWalkoverAwards')),
      tx.get(season.collection('officialMatchweekClosures')),
      tx.get(db.collection('matches').where('seasonId', '==', input.seasonId)),
      tx.get(db.collection('matchReports').where('seasonId', '==', input.seasonId)),
      tx.get(db.collection('disciplinaryRecords').where('seasonId', '==', input.seasonId)),
      tx.get(db.collection('disciplinarySuspensions').where('seasonId', '==', input.seasonId)),
    ]);
    if (!seasonDoc.exists || seasonDoc.data()?.status !== 'active' || !team.exists || team.data()?.status !== 'active')
      throw new Error('Stagione o squadra non attive.');
    if (!settings.exists || !registration.exists) throw new Error('Impostazioni o bozza mancanti.');
    const config = validateWithdrawalConfig(settings.data());
    const policy = calculateWithdrawalPolicy(config, input.expectedMatchweek);
    if (policy.policy !== 'void_all') throw new Error('Questa procedura è riservata al girone di andata.');
    const draft = registration.data()!;
    if (draft.state !== 'draft_pending_activation' || draft.effectsApplied !== false ||
        draft.seasonId !== input.seasonId || draft.teamId !== input.teamId ||
        draft.effectiveMatchweek !== input.expectedMatchweek || draft.policy !== 'void_all')
      throw new Error('Bozza obsoleta o non coerente con la regola void_all.');
    if (ledger.exists || audit.exists || !awards.empty || !closures.empty)
      throw new Error('Registri, chiusure o tavolini preesistenti: attivazione negata.');
    for (const other of registrations.docs) {
      if (other.id !== input.teamId && other.data().state === 'active')
        throw new Error('Ritiri multipli richiedono una riconciliazione dedicata.');
    }
    // Existing suspensions may have been served in voided matches, or may reflect
    // yellow cycles not provable from the available reports. Fail closed.
    if (!suspensions.empty || !records.empty)
      throw new Error('Presente uno storico disciplinare: necessaria riconciliazione cronologica. Attivazione bloccata.');

    const all: MatchData[] = matches.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    const affected = all.filter(m => rs(m.data) && m.data.seasonId === input.seasonId &&
      (id(m.data.homeTeamId) === input.teamId || id(m.data.awayTeamId) === input.teamId))
      .sort((a, b) => Number(a.data.matchweek) - Number(b.data.matchweek));
    if (affected.length !== config.totalMatchweeks)
      throw new Error('Calendario stagionale incompleto. Importare tutte le giornate.');
    const reportList = reports.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    const entries: Array<{matchId:string;matchweek:number;opponentTeamId:string;effect:'void';reportIds:string[]}> = [];
    for (let week = 1; week <= config.totalMatchweeks; week++) {
      const atWeek = affected.filter(m => m.data.matchweek === week);
      if (atWeek.length !== 1) throw new Error(`Calendario duplicato o mancante alla giornata ${week}.`);
      const match = atWeek[0];
      const opponent = id(match.data.homeTeamId) === input.teamId ? id(match.data.awayTeamId) : id(match.data.homeTeamId);
      if (!validId(opponent) || opponent === input.teamId)
        throw new Error(`Squadre non valide alla giornata ${week}.`);
      const related = reportList.filter(r => id(r.data.matchId) === match.id);
      if (week < input.expectedMatchweek) {
        if (!['played', 'finished'].includes(id(match.data.status)) || related.length !== 1 || related[0].data.status !== 'published')
          throw new Error(`Giornata ${week}: partita e tabellino pubblicato obbligatori.`);
        const payload = related[0].data.data as Record<string, unknown> | undefined;
        if (!isInt(match.data.homeScore) || !isInt(match.data.awayScore) ||
            payload?.homeScore !== match.data.homeScore || payload?.awayScore !== match.data.awayScore)
          throw new Error(`Giornata ${week}: risultato e tabellino non coincidono.`);
        assertNoCards(related[0].data, match.id);
      } else if (match.data.status !== 'scheduled' || match.data.homeScore != null ||
                 match.data.awayScore != null || related.length !== 0) {
        throw new Error(`Giornata ${week}: gara futura non integra.`);
      }
      entries.push({matchId:match.id,matchweek:week,opponentTeamId:opponent,
        effect:'void',reportIds:related.map(r=>r.id)});
    }
    // All affected games, including future fixtures, are excluded by the official
    // read filter. Original match/report documents are preserved, not overwritten.
    const snapshotHash = hash(JSON.stringify(affected));
    const operationId = hash(`${input.seasonId}|${input.teamId}|${input.expectedMatchweek}|${snapshotHash}`);
    const signature = hash(JSON.stringify({operationId,entries}));
    const commitId = hash(`${operationId}|${signature}|first-leg-official-v1`);
    const now = FieldValue.serverTimestamp();
    tx.update(regRef, {state:'active',effectsApplied:true,activationCommitId:commitId,
      updatedBy:input.adminUid,updatedAt:now});
    tx.create(ledgerRef, {schemaVersion:1,seasonId:input.seasonId,teamId:input.teamId,
      policy:'void_all',effectiveMatchweek:input.expectedMatchweek,operationId,snapshotHash,signature,
      state:'applied',effectsApplied:true,activationCommitId:commitId,entries,
      createdBy:input.adminUid,appliedAt:now});
    tx.create(auditRef, {schemaVersion:1,seasonId:input.seasonId,teamId:input.teamId,
      policy:'void_all',operationId,snapshotHash,signature,commitId,state:'applied',
      affectedMatchIds:entries.map(e=>e.matchId),
      affectedReportIds:entries.flatMap(e=>e.reportIds),
      originalRegistration:{state:draft.state,effectsApplied:draft.effectsApplied},
      disciplineChanges:[],suspensionChanges:[],
      createdBy:input.adminUid,createdAt:now});
    return {status:'applied' as const,commitId,fixtureCount:entries.length,
      policy:'void_all' as const};
  });
}
