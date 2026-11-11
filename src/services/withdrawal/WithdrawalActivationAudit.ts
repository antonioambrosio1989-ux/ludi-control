/**
 * Fase 7A — audit pre-attivazione, puramente deterministico, nessuna operazione I/O.
 * Non autorizza mai l'applicazione del ritiro: confronta i prerequisiti tecnici
 * per progettare e collaudare successivamente l'attivazione.
 */
import type { Match } from '../../types/Match';
import type { CloudMatchReport } from '../match/FirebaseMatchReportRepository';
import type { UnifiedWithdrawalPreview } from './WithdrawalUnifiedPreview';
import type { WithdrawalConfig } from './WithdrawalRegistryRules';

export type ActivationFinding = {
  code: string;
  severity: 'blocking' | 'review' | 'information';
  message: string;
  matchIds?: string[];
};
export type WithdrawalActivationAudit = {
  status: 'not_ready';
  canActivate: false;
  readOnly: true;
  source: { imported: number; expected: number; published: number; affectedFixtures: number };
  checks: ActivationFinding[];
};
export type ActivationAuditInput = {
  config: WithdrawalConfig;
  teamIds: readonly string[];
  withdrawnTeamId: string;
  matches: readonly Match[];
  reports: readonly CloudMatchReport[];
  preview: Pick<UnifiedWithdrawalPreview, 'issues' | 'sporting'>;
  futureImportEffectsImplemented?: boolean;
  matchAndStatsEffectsImplemented?: boolean;
  disciplineReconciliationImplemented?: boolean;
  delayedWalkoversImplemented?: boolean;
};
const finished = new Set(['played', 'finished']);
const str = (v: string | number) => String(v);
const uniq = (xs: string[]) => [...new Set(xs)].sort();

export function auditWithdrawalActivation(input: ActivationAuditInput): WithdrawalActivationAudit {
  const findings: ActivationFinding[] = [];
  const reportIds = new Set(input.reports.filter(r => r.status === 'published').map(r => String(r.matchId)));
  const regular = input.matches.filter(m => (m.matchType ?? 'regularSeason') === 'regularSeason');
  const members = uniq(input.teamIds.map(String).filter(Boolean));
  const expected = input.config.format === 'double_round_robin'
    ? members.length * (members.length - 1)
    : members.length * (members.length - 1) / 2;
  const involved = regular.filter(m => str(m.homeTeamId) === input.withdrawnTeamId || str(m.awayTeamId) === input.withdrawnTeamId);
  const add = (code: string, severity: ActivationFinding['severity'], message: string, matchIds?: string[]) => {
    findings.push({ code, severity, message, ...(matchIds?.length ? { matchIds: uniq(matchIds) } : {}) });
  };

  if (!members.includes(input.withdrawnTeamId)) add('TEAM_NOT_REGISTERED', 'blocking', 'La squadra ritiranda non risulta iscritta.');
  if (members.length < 2 || expected < 1) add('INVALID_COMPETITION', 'blocking', 'Numero di squadre insufficiente.');
  if (regular.length !== expected) {
    add('CALENDAR_COVERAGE', regular.length > expected ? 'blocking' : 'review',
      `${regular.length} gare di Regular Season importate, ${expected} attese: la copertura non è completa.`);
  }
  const repeatedIds = new Set<string>();
  const seenIds = new Set<string>();
  const invalid: string[] = [];
  const stray: string[] = [];
  const fixtures = new Map<string,string[]>();
  for (const m of regular) {
    if (seenIds.has(m.id)) repeatedIds.add(m.id);
    seenIds.add(m.id);
    if (m.seasonId !== input.matches[0]?.seasonId || !Number.isSafeInteger(m.matchweek) ||
      m.matchweek < 1 || m.matchweek > input.config.totalMatchweeks ||
      str(m.homeTeamId) === str(m.awayTeamId)) invalid.push(m.id);
    if (!members.includes(str(m.homeTeamId)) || !members.includes(str(m.awayTeamId))) stray.push(m.id);
    const pair = [str(m.homeTeamId), str(m.awayTeamId)].sort().join('::');
    fixtures.set(pair, [...(fixtures.get(pair) ?? []), m.id]);
  }
  if (repeatedIds.size) add('DUPLICATE_MATCH_IDS', 'blocking', 'ID partita duplicati.', [...repeatedIds]);
  if (invalid.length) add('INVALID_FIXTURES', 'blocking', 'Gare con giornata, stagione o squadre incoerenti.', invalid);
  if (stray.length) add('UNKNOWN_TEAMS', 'blocking', 'Gare che coinvolgono squadre non iscritte.', stray);
  const maxPair = input.config.format === 'double_round_robin' ? 2 : 1;
  const duplicateFixtures = [...fixtures.values()].filter(ids => ids.length > maxPair).flat();
  if (duplicateFixtures.length) add('DUPLICATE_FIXTURES', 'blocking', 'Troppi incontri tra la stessa coppia di squadre.', duplicateFixtures);

  const pending = regular.filter(m => finished.has(m.status) && !reportIds.has(m.id)).map(m => m.id);
  if (pending.length) add('FINISHED_WITHOUT_REPORT', 'blocking', 'Gare concluse prive di tabellino pubblicato: verificarne risultati e disciplina.', pending);
  const walkovers = regular.filter(m => m.status === 'walkover' && !reportIds.has(m.id)).map(m => m.id);
  if (walkovers.length) add('WALKOVER_WITHOUT_REPORT', 'review', 'Vittorie a tavolino senza tabellino: verificare la delibera e la disciplina senza considerarle gare giocate.', walkovers);
  const postponed = regular.filter(m => m.status === 'postponed' && !reportIds.has(m.id)).map(m => m.id);
  if (postponed.length) add('POSTPONED_PENDING', 'review', 'Gare rinviate senza tabellino: non sono automaticamente considerate disputate.', postponed);
  const live = regular.filter(m => m.status === 'live' && !reportIds.has(m.id)).map(m => m.id);
  if (live.length) add('LIVE_WITHOUT_REPORT', 'review', 'Gare in corso: il risultato non è ancora definitivo.', live);
  if (!involved.length) add('NO_AFFECTED_FIXTURES', 'blocking', 'Non sono presenti gare importate della squadra ritiranda.');
  if (input.preview.issues.length) add('PROJECTION_ISSUES', 'blocking',
    `${input.preview.issues.length} anomalie segnalate dai motori sportivi/disciplinari: verificare il dettaglio.`);

  if (input.futureImportEffectsImplemented !== true) add('FUTURE_IMPORT_HOOK_MISSING', 'blocking',
    'Non è attiva la gestione automatica delle partite importate dopo il ritiro.');
  if (input.matchAndStatsEffectsImplemented !== true) add('SPORTING_WRITES_NOT_IMPLEMENTED', 'blocking',
    'Manca il meccanismo transazionale e reversibile per applicare i conteggi ufficiali.');
  if (input.disciplineReconciliationImplemented !== true) add('DISCIPLINE_WRITE_NOT_IMPLEMENTED', 'blocking',
    'La riconciliazione delle squalifiche con lo storico reale non è stata implementata.');
  if (input.delayedWalkoversImplemented !== true) add('DELAYED_WALKOVER_NOT_IMPLEMENTED', 'blocking',
    'La pubblicazione dei tavolini soltanto nella giornata dovuta non è ancora implementata.');

  return {
    status: 'not_ready', canActivate: false, readOnly: true,
    source: { imported: regular.length, expected, published: input.reports.filter(r => r.status === 'published').length,
      affectedFixtures: involved.length },
    checks: findings,
  };
}
