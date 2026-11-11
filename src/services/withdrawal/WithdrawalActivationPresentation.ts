/** Fase 7B: sola presentazione dell'audit fase 7A, senza cambiare le decisioni del motore. */
import type { WithdrawalActivationAudit } from './WithdrawalActivationAudit';

export const MISSING_ACTIVATION_FEATURE_CODES = [
  'FUTURE_IMPORT_HOOK_MISSING',
  'SPORTING_WRITES_NOT_IMPLEMENTED',
  'DISCIPLINE_WRITE_NOT_IMPLEMENTED',
  'DELAYED_WALKOVER_NOT_IMPLEMENTED',
] as const;

const simpleChecks = [
  { code: 'TEAM_NOT_REGISTERED', label: 'Squadra presente nell’elenco delle iscritte' },
  { code: 'INVALID_COMPETITION', label: 'Numero di squadre verificato' },
  { code: 'DUPLICATE_MATCH_IDS', label: 'Nessun identificativo partita duplicato rilevato' },
  { code: 'INVALID_FIXTURES', label: 'Nessuna giornata o gara incoerente rilevata' },
  { code: 'UNKNOWN_TEAMS', label: 'Nessuna squadra estranea rilevata nelle gare importate' },
  { code: 'DUPLICATE_FIXTURES', label: 'Nessun accoppiamento eccedente il formato rilevato' },
] as const;

export type WithdrawalActivationDisplay = {
  available: boolean;
  passed: string[];
  missing: string[];
  blocking: string[];
  review: string[];
  pendingFeatures: readonly string[];
};

export function summarizeWithdrawalActivation(audit: WithdrawalActivationAudit | undefined): WithdrawalActivationDisplay {
  const pendingFeatures: readonly string[] = MISSING_ACTIVATION_FEATURE_CODES;
  if (!audit || audit.readOnly !== true || audit.canActivate !== false || audit.status !== 'not_ready' || !Array.isArray(audit.checks)) {
    return { available: false, passed: [], missing: [], blocking: [], review: [], pendingFeatures };
  }
  const codes = new Set(audit.checks.map(check => check.code));
  return {
    available: true,
    passed: simpleChecks.filter(check => !codes.has(check.code)).map(check => check.label),
    missing: audit.checks.filter(check => pendingFeatures.includes(check.code)).map(check => check.code),
    blocking: audit.checks.filter(check => check.severity === 'blocking' && !pendingFeatures.includes(check.code)).map(check => check.code),
    review: audit.checks.filter(check => check.severity === 'review').map(check => check.code),
    pendingFeatures,
  };
}
