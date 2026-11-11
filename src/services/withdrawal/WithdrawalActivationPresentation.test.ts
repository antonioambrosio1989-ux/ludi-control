import { describe, expect, it } from 'vitest';
import { summarizeWithdrawalActivation } from './WithdrawalActivationPresentation';
import type { WithdrawalActivationAudit } from './WithdrawalActivationAudit';

const makeAudit = (checks: WithdrawalActivationAudit['checks']): WithdrawalActivationAudit => ({
  status: 'not_ready', canActivate: false, readOnly: true,
  source: { imported: 36, expected: 132, published: 34, affectedFixtures: 6 }, checks,
});

describe('Fase 7B: rappresentazione audit senza autorizzazione', () => {
  it('assenza audit: non mostra controlli superati', () => {
    const d = summarizeWithdrawalActivation(undefined);
    expect(d.available).toBe(false);
    expect(d.passed).toEqual([]);
  });
  it('separa le funzionalità mancanti dai blocchi sui dati', () => {
    const d = summarizeWithdrawalActivation(makeAudit([
      { code:'FUTURE_IMPORT_HOOK_MISSING', severity:'blocking', message:'Hook mancante' },
      { code:'INVALID_FIXTURES', severity:'blocking', message:'Gara incoerente', matchIds:['m'] },
      { code:'CALENDAR_COVERAGE', severity:'review', message:'Calendario parziale' },
    ]));
    expect(d.missing).toEqual(['FUTURE_IMPORT_HOOK_MISSING']);
    expect(d.blocking).toEqual(['INVALID_FIXTURES']);
    expect(d.review).toEqual(['CALENDAR_COVERAGE']);
  });
  it('il calendario parziale non è classificato come anomalia bloccante dei dati', () => {
    const d = summarizeWithdrawalActivation(makeAudit([{ code:'CALENDAR_COVERAGE', severity:'review', message:'Calendario parziale' }]));
    expect(d.blocking).toEqual([]);
    expect(d.review).toEqual(['CALENDAR_COVERAGE']);
  });
  it('non segna come superato il controllo che presenta un’anomalia', () => {
    const d = summarizeWithdrawalActivation(makeAudit([{ code:'DUPLICATE_MATCH_IDS', severity:'blocking', message:'ID duplicato' }]));
    expect(d.passed.some(s => s.includes('duplicato'))).toBe(false);
  });
  it('gli altri controlli non anomalamente segnalati appaiono come senza anomalie rilevate', () => {
    const d = summarizeWithdrawalActivation(makeAudit([]));
    expect(d.passed.length).toBe(6);
  });
  it('non muta l’audit ricevuto', () => {
    const a = makeAudit([{ code:'POSTPONED_PENDING', severity:'review', message:'Da verificare' }]);
    const before = JSON.stringify(a);
    summarizeWithdrawalActivation(a);
    expect(JSON.stringify(a)).toBe(before);
  });
  it('il display resta non disponibile se il contratto di sicurezza è incoerente', () => {
    const invalid = { ...makeAudit([]), canActivate: true } as unknown as WithdrawalActivationAudit;
    expect(summarizeWithdrawalActivation(invalid).available).toBe(false);
  });
});
