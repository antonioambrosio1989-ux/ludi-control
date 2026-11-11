import { describe, expect, it } from 'vitest';
import { verifyWithdrawalPublishedSnapshot } from './WithdrawalPublishedBoundaryRules';
const seasonId = 's1';
const draft = { seasonId, teamId:'a', state:'draft_pending_activation', policy:'void_all', effectsApplied:false };
const active = { seasonId, teamId:'a', state:'active', policy:'void_all', effectsApplied:true, activationCommitId:'commit1' };
describe('9F: lettura pubblica controllata',()=>{
  it('senza ritiri non modifica il registro',()=>expect(verifyWithdrawalPublishedSnapshot(seasonId,[])).toEqual([]));
  it('la bozza resta innocua',()=>expect(verifyWithdrawalPublishedSnapshot(seasonId,[draft])[0].effectsApplied).toBe(false));
  it('bozza annullata resta innocua',()=>expect(verifyWithdrawalPublishedSnapshot(seasonId,[{...draft,state:'cancelled'}])[0].effectsApplied).toBe(false));
  it('ritiro completato con commit esplicito è riconosciuto',()=>expect(verifyWithdrawalPublishedSnapshot(seasonId,[active])[0].effectsApplied).toBe(true));
  it('ritiro attivo senza commit è rifiutato',()=>expect(()=>verifyWithdrawalPublishedSnapshot(seasonId,[{...active,activationCommitId:undefined}])).toThrow());
  it('ritiro attivo non applicato è rifiutato',()=>expect(()=>verifyWithdrawalPublishedSnapshot(seasonId,[{...active,effectsApplied:false}])).toThrow());
  it('ritiro al ritorno con commit e policy verificata è riconosciuto',()=>expect(verifyWithdrawalPublishedSnapshot(seasonId,[{...active,policy:'retain_and_walkover'}])[0].policy).toBe('retain_and_walkover'));
  it('stati sconosciuti vengono rifiutati',()=>expect(()=>verifyWithdrawalPublishedSnapshot(seasonId,[{...draft,state:'prepared_test_only'}])).toThrow());
  it('stagione discordante viene rifiutata',()=>expect(()=>verifyWithdrawalPublishedSnapshot(seasonId,[{...draft,seasonId:'s2'}])).toThrow());
  it('duplicati vengono rifiutati',()=>expect(()=>verifyWithdrawalPublishedSnapshot(seasonId,[draft,draft])).toThrow());
  it('bozze con effetti inattesi vengono rifiutate',()=>expect(()=>verifyWithdrawalPublishedSnapshot(seasonId,[{...draft,effectsApplied:true}])).toThrow());
  it('policy sconosciuta su ritiro attivo viene rifiutata',()=>expect(()=>verifyWithdrawalPublishedSnapshot(seasonId,[{...active,policy:'unknown'}])).toThrow());
});
