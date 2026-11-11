import { describe, expect, it } from 'vitest';
import { buildWithdrawalOperationalPlan, type OperationalPlanInput } from './WithdrawalOperationalPlan';
import type { ImportedFixture } from './WithdrawalFutureImportPlanner';

const config = { format: 'double_round_robin' as const, totalMatchweeks: 22, firstReturnMatchweek: 12 };
const f = (id: string, week: number, home='A', away='B', status='scheduled'): ImportedFixture => ({
  id, seasonId: 's1', matchweek: week, homeTeamId: home, awayTeamId: away,
  status, matchType:'regularSeason', date:'2026-11-08', time:'20:30',
});
const draft = (week=6) => ({ seasonId:'s1', teamId:'A', effectiveMatchweek:week, state:'draft_pending_activation' as const, effectsApplied:false });
const data = (overrides: Partial<OperationalPlanInput> = {}): OperationalPlanInput => ({
  seasonId:'s1', config, registrations:[draft()], existingFixtures:[], incomingFixtures:[f('m1',7)],
  officiallyClosedMatchweeks:[], recordedWalkoverMatchIds:[], ...overrides,
});

describe('ritiro 9A - piano operativo integrato, senza scritture', () => {
  it('annullamento all andata: nessun punto assegnato', () => {
    const x=buildWithdrawalOperationalPlan(data());
    expect(x.decisions[0]).toMatchObject({action:'void_candidate',assignedPoints:0});
    expect(x.canActivate).toBe(false);
    expect(x.canPublish).toBe(false);
  });
  it('ritiro al ritorno: partita futura non dovuta', () => {
    const x=buildWithdrawalOperationalPlan(data({registrations:[draft(13)],incomingFixtures:[f('m',16)]}));
    expect(x.decisions[0].maturity).toBe('not_due');
    expect(x.summary.notDue).toBe(1);
  });
  it('giornata ufficialmente chiusa: soltanto pronta per revisione', () => {
    const x=buildWithdrawalOperationalPlan(data({registrations:[draft(13)],incomingFixtures:[f('m',16)],officiallyClosedMatchweeks:[16]}));
    expect(x.decisions[0].maturity).toBe('ready_for_review');
    expect(x.summary.readyForReview).toBe(1);
    expect(x.decisions[0].assignedPoints).toBe(0);
  });
  it('tavolino già registrato non viene duplicato', () => {
    const x=buildWithdrawalOperationalPlan(data({registrations:[draft(13)],incomingFixtures:[f('m',16)],officiallyClosedMatchweeks:[16],recordedWalkoverMatchIds:['m']}));
    expect(x.decisions[0].maturity).toBe('already_recorded');
    expect(x.summary.readyForReview).toBe(0);
  });
  it('ritiro in stato active senza effetti consolidati blocca', () => {
    const x=buildWithdrawalOperationalPlan(data({registrations:[{...draft(13),state:'active',effectsApplied:false}]}));
    expect(x.blockingIssues.join(' ')).toMatch(/senza riconciliazione/);
  });
  it('anche con record active tutti i comandi restano disabilitati', () => {
    const x=buildWithdrawalOperationalPlan(data({registrations:[{...draft(13),state:'active',effectsApplied:true}]}));
    expect(x.canActivate).toBe(false);
    expect(x.canPublish).toBe(false);
  });
  it('registro annullato non crea decisioni', () => {
    const x=buildWithdrawalOperationalPlan(data({registrations:[{...draft(),state:'cancelled'}]}));
    expect(x.decisions).toHaveLength(0);
  });
  it('reimportazione identica non produce doppi effetti', () => {
    const match=f('m1',7);
    const x=buildWithdrawalOperationalPlan(data({existingFixtures:[match],incomingFixtures:[match]}));
    expect(x.decisions).toHaveLength(0);
  });
  it('reimportazione con squadre differenti viene bloccata', () => {
    const x=buildWithdrawalOperationalPlan(data({existingFixtures:[f('m1',7)],incomingFixtures:[f('m1',7,'A','C')]}));
    expect(x.blockingIssues.some(s=>s.includes('discordanti'))).toBe(true);
  });
  it('non include partite di altre squadre', () => {
    const x=buildWithdrawalOperationalPlan(data({incomingFixtures:[f('other',17,'B','C')]}));
    expect(x.decisions).toHaveLength(0);
  });
  it('non programma tavolino per partite rinviate al ritorno', () => {
    const x=buildWithdrawalOperationalPlan(data({registrations:[draft(13)],incomingFixtures:[f('m',16,'A','B','postponed')],officiallyClosedMatchweeks:[16]}));
    expect(x.decisions[0].action).toBe('manual_review');
    expect(x.summary.manualReviews).toBe(1);
  });
  it('due ritiri che riguardano una stessa gara vengono bloccati', () => {
    const b={seasonId:'s1',teamId:'B',effectiveMatchweek:14,state:'draft_pending_activation' as const,effectsApplied:false};
    const x=buildWithdrawalOperationalPlan(data({registrations:[draft(13),b],incomingFixtures:[f('m',16)]}));
    expect(x.blockingIssues.join(' ')).toMatch(/Conflitto/);
  });
  it('rifiuta giornata fuori dal formato', () => {
    expect(()=>buildWithdrawalOperationalPlan(data({registrations:[draft(23)]}))).toThrow();
  });
  it('rifiuta le gare con stagioni discordanti', () => {
    const x=buildWithdrawalOperationalPlan(data({incomingFixtures:[{...f('m',16),seasonId:'s2'}]}));
    expect(x.blockingIssues.join(' ')).toMatch(/stagione diversa/);
  });
  it('non modifica mai gli input di partenza', () => {
    const x=data();const frozen=JSON.stringify(x);
    buildWithdrawalOperationalPlan(x);
    expect(JSON.stringify(x)).toBe(frozen);
  });
});
