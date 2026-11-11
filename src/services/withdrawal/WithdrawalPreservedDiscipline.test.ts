import { describe, expect, it } from "vitest";
import { preservedDisciplineForPlayer } from "./WithdrawalPreservedDiscipline";
import type { CloudMatchReport } from "../match/FirebaseMatchReportRepository";

const report = (matchId: string, yellowCards: number, redCards: number, directRedCards: number) => ({
  matchId, status: "published",
  data: { performances: {
    main: { playerId: "playerA", yellowCards, redCards, directRedCards, goals: 2, assists: 1, vote: 8 },
  } },
}) as unknown as CloudMatchReport;

describe("void_all retains disciplinary totals only", () => {
  it("counts original yellow and red cards from excluded sporting reports", () => {
    const result = preservedDisciplineForPlayer("playerA", [
      report("voided", 2, 1, 1),
      report("notVoided", 3, 0, 0),
    ], new Set(["voided"]));
    expect(result).toEqual({ yellowCards: 2, redCards: 1, directRedCards: 1 });
  });
  it("does not count reports for other players", () => {
    expect(preservedDisciplineForPlayer("playerB", [report("voided", 1, 1, 1)],
      new Set(["voided"]))).toEqual({ yellowCards: 0, redCards: 0, directRedCards: 0 });
  });
  it("rejects malformed disciplinary counts", () => {
    expect(() => preservedDisciplineForPlayer("playerA", [report("voided", -1, 0, 0)],
      new Set(["voided"]))).toThrow(/Sanzioni/);
  });
});
