import type { VerifiedWithdrawalRegistration } from './WithdrawalOfficialReadFilter';

/**
 * Controlli stretti sui dati letti integralmente dal backend. Il filtro non
 * può essere abilitato da bozze, preparazioni emulator o registri incompleti.
 * Fino all'implementazione della chiusura giornata persistente, i ritiri al
 * ritorno non sono pubblicabili: meglio un errore che punti anticipati.
 */
export function verifyWithdrawalPublishedSnapshot(
  seasonId: string,
  registrations: readonly Record<string, unknown>[],
): VerifiedWithdrawalRegistration[] {
  if (!seasonId.trim()) throw new Error('Stagione richiesta non valida.');
  const ids = new Set<string>();
  const out: VerifiedWithdrawalRegistration[] = [];
  for (const raw of registrations) {
    const teamId = raw.teamId;
    if (typeof teamId !== 'string' || !teamId.trim()) throw new Error('Registro ritiri: squadra non valida.');
    if (raw.seasonId !== seasonId) throw new Error('Registro ritiri: stagione discordante.');
    if (ids.has(teamId)) throw new Error('Registro ritiri: squadra duplicata.');
    ids.add(teamId);
    const state = raw.state;
    if (state === 'draft_pending_activation' || state === 'cancelled') {
      if (raw.effectsApplied !== false) throw new Error('Bozza o annullamento con effetti sportivi inattesi.');
      out.push({ seasonId, teamId, state, effectsApplied: false, policy: String(raw.policy ?? '') });
      continue;
    }
    if (state !== 'active') throw new Error('Stato ritiro non supportato nel riepilogo pubblico.');
    if (raw.effectsApplied !== true) throw new Error('Ritiro attivo senza effetti confermati.');
    if (typeof raw.activationCommitId !== 'string' || !raw.activationCommitId.trim()) {
      throw new Error('Ritiro attivo senza conferma persistente di attivazione.');
    }
    if (raw.policy !== 'void_all' && raw.policy !== 'retain_and_walkover') {
      throw new Error('Policy ritiro non riconosciuta.');
    }
    out.push({ seasonId, teamId, state, effectsApplied: true, policy: raw.policy });
  }
  return out;
}
