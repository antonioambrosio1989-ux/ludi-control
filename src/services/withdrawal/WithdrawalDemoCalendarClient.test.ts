import { describe, it, expect } from 'vitest';
import { isLocalDemoHost, shouldUseDemoAtomicImport, validateDemoCalendarResponse } from './WithdrawalDemoCalendarContract';

describe('11B route admin demo calendar guard', () => {
  it('consente solo hostname locali esatti', () => {
    expect(isLocalDemoHost('localhost')).toBe(true);
    expect(isLocalDemoHost('127.0.0.1')).toBe(true);
    expect(isLocalDemoHost('example.com')).toBe(false);
    expect(isLocalDemoHost('localhost.evil.example')).toBe(false);
  });
  it('disabilita senza flag', () => {
    expect(shouldUseDemoAtomicImport({enabled:false,development:true,hostname:'localhost'})).toBe(false);
  });
  it('disabilita in produzione anche con flag', () => {
    expect(shouldUseDemoAtomicImport({enabled:true,development:false,hostname:'localhost'})).toBe(false);
  });
  it('disabilita in hostname remoto', () => {
    expect(shouldUseDemoAtomicImport({enabled:true,development:true,hostname:'ludisleague.it'})).toBe(false);
  });
  it('consente localhost con flag e development', () => {
    expect(shouldUseDemoAtomicImport({enabled:true,development:true,hostname:'localhost'})).toBe(true);
  });
  it('accetta un commit con numero giusto e nessun premio', () => {
    expect(validateDemoCalendarResponse({ok:true,createdMatchIds:['a','b'],registeredPendingWalkovers:1,awardedWalkovers:0},2).registeredPendingWalkovers).toBe(1);
  });
  it('rifiuta una risposta incompleta', () => {
    expect(() => validateDemoCalendarResponse({ok:true,createdMatchIds:['a'],registeredPendingWalkovers:0,awardedWalkovers:0},2)).toThrow();
  });
  it('rifiuta ID duplicati', () => {
    expect(() => validateDemoCalendarResponse({ok:true,createdMatchIds:['a','a'],registeredPendingWalkovers:0,awardedWalkovers:0},2)).toThrow();
  });
  it('rifiuta premi anticipati', () => {
    expect(() => validateDemoCalendarResponse({ok:true,createdMatchIds:['a'],registeredPendingWalkovers:1,awardedWalkovers:1},1)).toThrow();
  });
  it('rifiuta risultato senza ok', () => {
    expect(() => validateDemoCalendarResponse({ok:false,createdMatchIds:['a'],registeredPendingWalkovers:0,awardedWalkovers:0},1)).toThrow();
  });
});
