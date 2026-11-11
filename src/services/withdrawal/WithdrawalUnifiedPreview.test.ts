import { describe, expect, it } from 'vitest';
import { buildUnifiedWithdrawalPreview, type UnifiedWithdrawalInput } from './WithdrawalUnifiedPreview';
import type { Match } from '../../types/Match';
import type { CloudMatchReport } from '../match/FirebaseMatchReportRepository';

const match = (id: string, matchweek: number, homeTeamId: string, awayTeamId: string, status: Match['status'] = 'played'): Match => ({
  id, seasonId: 's', matchweek, matchweekId: `mw${matchweek}`, homeTeamId, awayTeamId,
  date: '2026-11-01', time: '20:30', venue: 'Campo', status, published: true,
});
const report = (id: string, homeScore: number, awayScore: number, teamId = 'a'): CloudMatchReport => ({
  matchId: id, seasonId: 's', status: 'published', version: 1,
  data: {
    matchId: id, status: 'played', homeScore, awayScore,
    homePresentPlayerIds: teamId === 'a' ? ['p'] : [], awayPresentPlayerIds: [],
    performances: { p: { playerId: 'p', teamId, status: 'rated', vote: 7, goals: 1, assists: 1, yellowCards: 1, redCards: 0, directRedCards: 0 } },
    goals: [], mvpPlayerId: 'p',
  },
});
const base = (): UnifiedWithdrawalInput => ({
  seasonId: 's', withdrawnTeamId: 'a', teamIds: ['a','b','c'],
  config: { format: 'single_round_robin', totalMatchweeks: 3, firstReturnMatchweek: null },
  effectiveMatchweek: 2, matches: [match('ab',1,'a','b'), match('bc',2,'b','c')],
  reports: [report('ab',2,0), report('bc',3,1,'b')],
  players: [{ playerId:'p',teamId:'a',role:'Attaccante' }],
  disciplinaryRecords: [], disciplinarySuspensions: [],
});

describe('Fase 6A: riepilogo integrato, nessuna scrittura', () => {
  it('unifica risultati, giocatori e disciplina usando esclusioni coerenti', () => {
    const x = buildUnifiedWithdrawalPreview(base());
    expect(x.sporting.excludedMatchIds).toEqual(['ab']);
    expect(x.players.excludedMatchIds).toEqual(['ab']);
    expect(x.disciplineReplay.excludedMatchIds).toEqual(['ab']);
    expect(x.overview.excludedMatches).toBe(1);
    expect(x.overview.excludedReports).toBe(1);
    expect(x.playerChanges.find(p => p.playerId === 'p')?.goalsDelta).toBe(-1);
    expect(x.disciplineAudit.removedCards.find(p => p.playerId === 'p')?.yellowCards).toBe(1);
  });
  it('espone variazione punti delle squadre senza eliminare la loro riga', () => {
    const x = buildUnifiedWithdrawalPreview(base());
    expect(x.teamChanges.find(t => t.teamId === 'a')?.pointsDelta).toBe(-3);
    expect(x.sporting.standingsAfter.find(t => t.teamId === 'a')?.played).toBe(0);
  });
  it('mantiene risultati passati e pianifica tavolini soltanto nel ritorno', () => {
    const b = base(); b.config = {format:'double_round_robin',totalMatchweeks:6,firstReturnMatchweek:4};
    b.effectiveMatchweek = 4;
    b.matches.push(match('ac',5,'a','c','scheduled'));
    const x = buildUnifiedWithdrawalPreview(b);
    expect(x.sporting.policy).toBe('retain_and_walkover');
    expect(x.sporting.excludedMatchIds).toEqual([]);
    expect(x.overview.scheduledWalkovers).toBe(1);
    expect(x.teamChanges).toEqual([]);
    expect(x.safeToApply).toBe(false);
  });
  it('rileva partite rinviate per revisione', () => {
    const b = base(); b.config = {format:'double_round_robin',totalMatchweeks:6,firstReturnMatchweek:4};
    b.effectiveMatchweek = 4;
    b.matches.push(match('ac',5,'a','c','postponed'));
    const x = buildUnifiedWithdrawalPreview(b);
    expect(x.overview.postponedForReview).toBe(1);
  });
  it('non modifica gli oggetti forniti', () => {
    const b = base(); const before = JSON.stringify(b);
    buildUnifiedWithdrawalPreview(b);
    expect(JSON.stringify(b)).toBe(before);
  });
  it('produce un risultato ripetibile', () => {
    const b = base();
    expect(buildUnifiedWithdrawalPreview(b)).toEqual(buildUnifiedWithdrawalPreview(b));
  });
  it('propaga le anomalie invece di dichiarare il ritiro applicabile', () => {
    const b = base(); b.teamIds = ['b','c'];
    const x = buildUnifiedWithdrawalPreview(b);
    expect(x.issues.join(' ')).toContain('iscrizioni');
    expect(x.safeToApply).toBe(false);
  });
  it('accetta gli ID squadra numerici nel replay senza alterare gli input', () => {
    const b = base();
    b.matches[0].homeTeamId = 101;
    b.matches[0].awayTeamId = 202;
    b.matches[1].homeTeamId = 202;
    b.matches[1].awayTeamId = 303;
    b.teamIds = ['101', '202', '303'];
    b.withdrawnTeamId = '101';
    b.players = [];
    const original = JSON.stringify(b);
    const result = buildUnifiedWithdrawalPreview(b);
    expect(result.disciplineReplay.blockers.some(issue => issue.includes('Squadre invalide'))).toBe(false);
    expect(JSON.stringify(b)).toBe(original);
  });
  it('rifiuta giornate di ritiro oltre il calendario ufficiale', () => {
    const b = base(); b.effectiveMatchweek = 99;
    expect(() => buildUnifiedWithdrawalPreview(b)).toThrow();
  });
});
