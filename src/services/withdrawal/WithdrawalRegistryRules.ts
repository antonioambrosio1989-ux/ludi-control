export type WithdrawalFormat = "single_round_robin" | "double_round_robin";
export type WithdrawalConfig = {
  format: WithdrawalFormat;
  totalMatchweeks: number;
  firstReturnMatchweek: number | null;
};
export type WithdrawalPhase = "first_leg" | "second_leg";
export type WithdrawalPolicy = "void_all" | "retain_and_walkover";

export function validateWithdrawalConfig(value: unknown): WithdrawalConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Configurazione mancante.");
  const v = value as Record<string, unknown>;
  if (v.format !== "single_round_robin" && v.format !== "double_round_robin") throw new Error("Formato campionato non valido.");
  if (!Number.isSafeInteger(v.totalMatchweeks) || (v.totalMatchweeks as number) < 1 || (v.totalMatchweeks as number) > 100) {
    throw new Error("Numero totale di giornate non valido (1-100).");
  }
  if (v.format === "single_round_robin") {
    if (v.firstReturnMatchweek !== null) throw new Error("Il girone unico non ha giornata di ritorno.");
    return { format: v.format, totalMatchweeks: v.totalMatchweeks as number, firstReturnMatchweek: null };
  }
  if (!Number.isSafeInteger(v.firstReturnMatchweek) || (v.firstReturnMatchweek as number) < 2 ||
      (v.firstReturnMatchweek as number) > (v.totalMatchweeks as number)) {
    throw new Error("Prima giornata del ritorno non valida.");
  }
  return { format: v.format, totalMatchweeks: v.totalMatchweeks as number, firstReturnMatchweek: v.firstReturnMatchweek as number };
}

export function calculateWithdrawalPolicy(config: WithdrawalConfig, effectiveMatchweek: number): {
  phase: WithdrawalPhase; policy: WithdrawalPolicy;
} {
  validateWithdrawalConfig(config);
  if (!Number.isSafeInteger(effectiveMatchweek) || effectiveMatchweek < 1 || effectiveMatchweek > config.totalMatchweeks) {
    throw new Error("La giornata del ritiro deve essere compresa nel calendario ufficiale.");
  }
  const phase = config.format === "double_round_robin" && effectiveMatchweek >= (config.firstReturnMatchweek as number)
    ? "second_leg" : "first_leg";
  return { phase, policy: phase === "second_leg" ? "retain_and_walkover" : "void_all" };
}


/** Solo le bozze attive possono essere rivalidate o annullate. */
export function isWithdrawalDraft(record: Record<string, unknown> | undefined): boolean {
  return record?.state === "draft_pending_activation" && record.effectsApplied === false;
}

/** Stati non riconosciuti sono bloccanti per sicurezza; lo storico annullato non blocca. */
export function canEditWithdrawalConfig(records: Record<string, unknown>[]): boolean {
  return records.every(record => isWithdrawalDraft(record) || (
    record.state === "draft_cancelled" && record.effectsApplied === false
  ));
}
