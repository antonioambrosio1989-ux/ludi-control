import { describe, expect, it } from "vitest";
import { calculateWithdrawalPolicy, canEditWithdrawalConfig, isWithdrawalDraft, validateWithdrawalConfig } from "./WithdrawalRegistryRules";

describe("Registro ritiri: bozze e revisione configurazione", () => {
  const draft = { state: "draft_pending_activation", effectsApplied: false };
  it("permette la modifica della configurazione con sole bozze", () => {
    expect(canEditWithdrawalConfig([draft])).toBe(true);
    expect(isWithdrawalDraft(draft)).toBe(true);
  });
  it("le bozze annullate non bloccano", () => {
    expect(canEditWithdrawalConfig([{ state: "draft_cancelled", effectsApplied: false }])).toBe(true);
  });
  it("impedisce modifiche quando il ritiro è applicato", () => {
    expect(canEditWithdrawalConfig([{ state: "applied", effectsApplied: true }])).toBe(false);
    expect(canEditWithdrawalConfig([draft,{ state: "applied", effectsApplied: true }])).toBe(false);
  });
  it("blocca stati imprevisti o privi del flag di sicurezza", () => {
    expect(canEditWithdrawalConfig([{ state: "draft_pending_activation" }])).toBe(false);
    expect(canEditWithdrawalConfig([{ state: "unknown", effectsApplied: false }])).toBe(false);
  });
  it("rivalida la giornata di una bozza quando cambia il formato", () => {
    const previous = validateWithdrawalConfig({ format:"double_round_robin", totalMatchweeks:22, firstReturnMatchweek:12 });
    const next = validateWithdrawalConfig({ format:"double_round_robin", totalMatchweeks:22, firstReturnMatchweek:15 });
    expect(calculateWithdrawalPolicy(previous,13).policy).toBe("retain_and_walkover");
    expect(calculateWithdrawalPolicy(next,13).policy).toBe("void_all");
    expect(() => calculateWithdrawalPolicy(validateWithdrawalConfig({format:"single_round_robin",totalMatchweeks:11,firstReturnMatchweek:null}),13)).toThrow();
  });
});
