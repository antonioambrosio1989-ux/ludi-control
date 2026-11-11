import { describe, expect, it } from "vitest";
import { planPartialSeasonWithdrawal } from "./WithdrawalPartialSchedule";
import type { WithdrawalMatch } from "./WithdrawalPreview";
const matches: WithdrawalMatch[] = [
  { id: "a", homeTeamId: "A", awayTeamId: "B", matchweek: 3, date: "2026-09-01", time: "20:30", status: "played" },
  { id: "b", homeTeamId: "C", awayTeamId: "A", matchweek: 8, date: "2026-11-20", time: "20:30", status: "scheduled" },
];
const base = { seasonId: "S", teamId: "A", rules: { format: "double_round_robin" as const, firstReturnMatchweek: 7 } };
describe("ritiro su calendario importato parzialmente", () => {
  it("andata: annulla gare, senza inventare le future mancanti", () => {
    const plan = planPartialSeasonWithdrawal({ ...base, effectiveMatchweek: 4 }, matches);
    expect(plan.phase).toBe("first_leg");
    expect(plan.policy).toBe("void_all");
    expect(plan.knownPlayed).toEqual(["a"]);
    expect(plan.knownPending).toHaveLength(1);
    expect(plan.safeToApply).toBe(false);
  });
  it("ritorno: mantiene i risultati e pianifica solo tavolini conosciuti", () => {
    const plan = planPartialSeasonWithdrawal({ ...base, effectiveMatchweek: 7 }, matches);
    expect(plan.phase).toBe("second_leg");
    expect(plan.policy).toBe("retain_and_walkover");
    expect(plan.knownPending[0].matchweek).toBe(8);
  });
  it("sola andata: esclude sempre il ritorno", () => {
    const plan = planPartialSeasonWithdrawal({ ...base, rules: { format: "single_round_robin", firstReturnMatchweek: null }, effectiveMatchweek: 8 }, matches);
    expect(plan.phase).toBe("first_leg");
  });
  it("blocca una configurazione del ritorno mancante", () => {
    const plan = planPartialSeasonWithdrawal({ ...base, rules: { format: "double_round_robin", firstReturnMatchweek: null }, effectiveMatchweek: 7 }, matches);
    expect(plan.valid).toBe(false);
    expect(plan.phase).toBeNull();
  });
  it("blocca giornate di ritiro precedenti a risultati gia' conclusi", () => {
    const plan = planPartialSeasonWithdrawal({ ...base, effectiveMatchweek: 2 }, matches);
    expect(plan.valid).toBe(false);
  });
  it("non comprende gare di altre squadre o fasi finali", () => {
    const plan = planPartialSeasonWithdrawal({ ...base, effectiveMatchweek: 7 }, [...matches,
      { id: "other", homeTeamId: "D", awayTeamId: "E", matchweek: 2, date: "2026-01-01", time: "20:30", status: "played" },
      { id: "final", homeTeamId: "A", awayTeamId: "D", matchType: "titlePlayoff", matchweek: 10, date: "2027-03-01", time: "20:30", status: "scheduled" },
    ]);
    expect(plan.knownPending.map(m => m.matchId)).toEqual(["b"]);
  });
});
