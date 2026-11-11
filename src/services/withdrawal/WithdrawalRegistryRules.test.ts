import { describe, expect, it } from "vitest";
import { calculateWithdrawalPolicy, validateWithdrawalConfig } from "./WithdrawalRegistryRules";

describe("registro ritiro: validazione senza effetti sportivi", () => {
  it("sola andata annulla anche all'ultima giornata", () => {
    const config = validateWithdrawalConfig({format:"single_round_robin", totalMatchweeks:11, firstReturnMatchweek:null});
    expect(calculateWithdrawalPolicy(config,11).policy).toBe("void_all");
  });
  it("andata e ritorno: prima giornata del ritorno compresa", () => {
    const config = validateWithdrawalConfig({format:"double_round_robin", totalMatchweeks:22, firstReturnMatchweek:12});
    expect(calculateWithdrawalPolicy(config,11).policy).toBe("void_all");
    expect(calculateWithdrawalPolicy(config,12).policy).toBe("retain_and_walkover");
  });
  it("rifiuta un girone di ritorno nel formato sola andata", () => {
    expect(() => validateWithdrawalConfig({format:"single_round_robin",totalMatchweeks:11,firstReturnMatchweek:12})).toThrow();
  });
  it("rifiuta giornate fuori calendario", () => {
    const config = validateWithdrawalConfig({format:"double_round_robin",totalMatchweeks:22,firstReturnMatchweek:12});
    expect(() => calculateWithdrawalPolicy(config,23)).toThrow();
    expect(() => calculateWithdrawalPolicy(config,0)).toThrow();
  });
  it("rifiuta configurazioni impossibili", () => {
    expect(() => validateWithdrawalConfig({format:"double_round_robin",totalMatchweeks:11,firstReturnMatchweek:12})).toThrow();
    expect(() => validateWithdrawalConfig({format:"single_round_robin",totalMatchweeks:0,firstReturnMatchweek:null})).toThrow();
  });
});
