import { describe, expect, it } from 'vitest';
import { auditWithdrawalActivation } from './WithdrawalActivationAudit';
import type { ActivationAuditInput } from './WithdrawalActivationAudit';
import type { Match } from '../../types/Match';

const match = (id: string, home: string, away: string, week: number, status: Match['status'] = 'scheduled'): Match => ({
  id, seasonId: 's', matchweek: week, matchweekId: `mw${week}`,
  homeTeamId: home, awayTeamId: away, date: '2026-11-02', time: '20:30', venue: 'Ludi', status, published: true,
});
const input = (matches: Match[], overrides: Partial<ActivationAuditInput> = {}): ActivationAuditInput => ({
  config: { format: 'single_round_robin', totalMatchweeks: 3, firstReturnMatchweek: null },
  teamIds: ['a', 'b', 'c'], withdrawnTeamId: 'a', matches, reports: [],
  preview: { issues: [], sporting: {} as ActivationAuditInput['preview']['sporting'] }, ...overrides,
});
const codes = (arg: ActivationAuditInput) => auditWithdrawalActivation(arg).checks.map(c => c.code);

describe('Fase 7A - audit di sicurezza pre-attivazione (sola lettura)', () => {
  it('resta sempre non autorizzato anche con calendario completo', () => {
    const result = auditWithdrawalActivation(input([match('1','a','b',1), match('2','a','c',2), match('3','b','c',3)]));
    expect(result.canActivate).toBe(false);
    expect(result.readOnly).toBe(true);
    expect(result.source.expected).toBe(3);
  });
  it('distingue calendario settimanale incompleto dagli errori', () => {
    const result = auditWithdrawalActivation(input([match('1','a','b',1)]));
    expect(result.checks.find(c => c.code === 'CALENDAR_COVERAGE')?.severity).toBe('review');
    expect(codes(input([match('1','a','b',1)]))).toContain('FUTURE_IMPORT_HOOK_MISSING');
  });
  it('tavolino senza report richiede revisione ma non è automaticamente un errore', () => {
    const result = auditWithdrawalActivation(input([match('1','a','b',1,'walkover')]));
    expect(result.checks.some(c => c.code === 'FINISHED_WITHOUT_REPORT')).toBe(false);
    expect(result.checks.find(c => c.code === 'WALKOVER_WITHOUT_REPORT')?.severity).toBe('review');
  });
  it('una gara rinviata senza tabellino non è gara conclusa', () => {
    const result = auditWithdrawalActivation(input([match('1','a','b',1,'postponed')]));
    expect(codes(input([match('1','a','b',1,'postponed')]))).not.toContain('FINISHED_WITHOUT_REPORT');
    expect(result.checks.find(c => c.code === 'POSTPONED_PENDING')?.matchIds).toEqual(['1']);
  });
  it('gara conclusa senza report resta bloccante', () => {
    expect(codes(input([match('1','a','b',1,'played')]))).toContain('FINISHED_WITHOUT_REPORT');
  });
  it('la gara con report pubblicato non è considerata mancante', () => {
    const result = auditWithdrawalActivation(input([match('1','a','b',1,'played')], { reports: [{ matchId: '1', status: 'published', version: 1, data: {} as never }] }));
    expect(result.checks.some(c => c.code === 'FINISHED_WITHOUT_REPORT')).toBe(false);
  });
  it('rileva ID partita duplicati e anomalie negli accoppiamenti', () => {
    const m = match('1','a','b',1);
    expect(codes(input([m, m]))).toContain('DUPLICATE_MATCH_IDS');
    expect(codes(input([match('1','a','b',1),match('2','b','a',2)]))).toContain('DUPLICATE_FIXTURES');
  });
  it('andata e ritorno consente due gare per coppia', () => {
    const config: ActivationAuditInput['config'] = { format: 'double_round_robin', totalMatchweeks: 6, firstReturnMatchweek: 4 };
    expect(codes(input([match('1','a','b',1), match('2','b','a',4)], {config}))).not.toContain('DUPLICATE_FIXTURES');
  });
  it('rileva giornata oltre formato e squadra non iscritta', () => {
    const result = auditWithdrawalActivation(input([match('1','a','x',5)]));
    expect(result.checks.some(c=>c.code==='INVALID_FIXTURES')).toBe(true);
    expect(result.checks.some(c=>c.code==='UNKNOWN_TEAMS')).toBe(true);
  });
  it('controlla anomalie segnalate da altri motori', () => {
    const arg = input([match('1','a','b',1)]);
    arg.preview.issues.push('Ciclo ammonizioni da ricostruire');
    expect(codes(arg)).toContain('PROJECTION_ISSUES');
  });
  it('non altera gli input', () => {
    const arg = input([match('1','a','b',1)]);
    const before = JSON.stringify(arg);
    auditWithdrawalActivation(arg);
    expect(JSON.stringify(arg)).toBe(before);
  });
});
