/**
 * Preparazione persistente di prova del ritiro: non attiva squadre, non modifica
 * partite, tabellini, classifiche, stats o disciplina.
 * L'API che utilizza questo contratto e' disabilitata fuori dagli emulatori.
 */
import { calculateWithdrawalPolicy, validateWithdrawalConfig, type WithdrawalConfig } from './WithdrawalRegistryRules';

export type PreparedWithdrawalIntent = {
  schemaVersion: 1;
  seasonId: string;
  teamId: string;
  effectiveMatchweek: number;
  formatSnapshot: WithdrawalConfig;
  phase: 'first_leg' | 'second_leg';
  policy: 'void_all' | 'retain_and_walkover';
  state: 'prepared_test_only';
  effectsApplied: false;
  operationId: string;
};

const idPattern = /^[a-zA-Z0-9_-]{1,160}$/;
export function validWithdrawalId(value: unknown): value is string {
  return typeof value === 'string' && idPattern.test(value);
}
export function allowEmulatorWithdrawalPreparation(env: Record<string,string | undefined>): boolean {
  return env.WITHDRAWAL_TEST_MODE === 'emulator' &&
    typeof env.FIRESTORE_EMULATOR_HOST === 'string' &&
    /^(localhost|127\.0\.0\.1|\[::1\]):\d{2,5}$/.test(env.FIRESTORE_EMULATOR_HOST) &&
    typeof env.FIREBASE_AUTH_EMULATOR_HOST === 'string' &&
    /^(localhost|127\.0\.0\.1|\[::1\]):\d{2,5}$/.test(env.FIREBASE_AUTH_EMULATOR_HOST);
}
export function buildWithdrawalPreparation(input: {
  seasonId: unknown; teamId: unknown; expectedMatchweek: unknown;
  config: unknown; registration: Record<string,unknown> | undefined;
}): Omit<PreparedWithdrawalIntent,'operationId'> {
  const { seasonId, teamId, expectedMatchweek, registration } = input;
  if (!validWithdrawalId(seasonId) || !validWithdrawalId(teamId)) throw new Error('Identificativi non validi.');
  if (!registration || registration.state !== 'draft_pending_activation' || registration.effectsApplied !== false) {
    throw new Error('Solo una bozza non applicata puo essere preparata.');
  }
  if (registration.seasonId !== seasonId || registration.teamId !== teamId) throw new Error('Bozza appartenente a un altro contesto.');
  const config = validateWithdrawalConfig(input.config);
  const matchweek = registration.effectiveMatchweek;
  if (!Number.isSafeInteger(matchweek) || matchweek !== expectedMatchweek) throw new Error('La bozza e cambiata: aggiornare l anteprima.');
  const expected = calculateWithdrawalPolicy(config, matchweek as number);
  if (registration.phase !== expected.phase || registration.policy !== expected.policy) throw new Error('La regola della bozza non coincide con la formula attuale.');
  const snapshot = validateWithdrawalConfig(registration.formatSnapshot);
  if (JSON.stringify(snapshot) !== JSON.stringify(config)) throw new Error('La formula ufficiale e cambiata: rivalidare la bozza.');
  return {schemaVersion:1,seasonId,teamId,effectiveMatchweek:matchweek as number,
    formatSnapshot:config,phase:expected.phase,policy:expected.policy,
    state:'prepared_test_only',effectsApplied:false};
}
/** Esclude metadati/timestamp e produce un contenuto ripetibile. */
export function preparationFingerprint(value: Omit<PreparedWithdrawalIntent,'operationId'>): string {
  return JSON.stringify([
    value.schemaVersion,value.seasonId,value.teamId,value.effectiveMatchweek,
    value.formatSnapshot.format,value.formatSnapshot.totalMatchweeks,
    value.formatSnapshot.firstReturnMatchweek,value.phase,value.policy,
    value.state,value.effectsApplied,
  ]);
}
export function comparePreparedWithdrawal(existing: Record<string,unknown> | undefined, candidate: PreparedWithdrawalIntent): 'duplicate' | 'create' {
  if (!existing) return 'create';
  if (existing.operationId !== candidate.operationId || existing.state !== 'prepared_test_only' || existing.effectsApplied !== false) {
    throw new Error('Preparazione precedente incompatibile: e necessaria una revisione amministrativa.');
  }
  return 'duplicate';
}
