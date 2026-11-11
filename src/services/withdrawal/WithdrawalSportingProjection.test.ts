import { describe, expect, it } from "vitest";
import type { Match } from "@/src/types/Match";
import type { CloudMatchReport } from "@/src/services/match/FirebaseMatchReportRepository";
import { buildWithdrawalSportingProjection, type WithdrawalSportingInput } from "./WithdrawalSportingProjection";

const match = (id: string, week: number, home: string, away: string, status: Match["status"] = "played"): Match => ({
  id, seasonId: "s1", matchweek: week, matchweekId: `mw${week}`, homeTeamId: home,
  awayTeamId: away, date: "2026-11-01", time: "20:30", venue: "Campo", status, published: true,
});
const report = (id: string, homeScore: number, awayScore: number): CloudMatchReport => ({
  matchId: id, seasonId: "s1", version: 1, status: "published",
  data: {
    matchId: id, status: "played", homeScore, awayScore,
    homePresentPlayerIds: ["p1"], awayPresentPlayerIds: ["p2"],
    performances: { p1: { playerId: "p1", teamId: "a", status: "rated", vote: 7,
      goals: 1, assists: 0, yellowCards: 1, redCards: 0 } }, goals: [],
  },
});
const base = (overrides: Partial<WithdrawalSportingInput> = {}): WithdrawalSportingInput => ({
  seasonId: "s1", withdrawnTeamId: "a", teamIds: ["a", "b", "c"],
  config: { format: "single_round_robin", totalMatchweeks: 3, firstReturnMatchweek: null },
  effectiveMatchweek: 2,
  matches: [match("ab", 1, "a", "b"), match("bc", 1, "b", "c")],
  reports: [report("ab", 2, 0), report("bc", 3, 1)],
  ...overrides,
});
const row = (rows: {teamId: string; points: number; played: number; goalsFor: number}[], id: string) => rows.find(r => r.teamId === id)!;

describe("fase 5A: proiezione sportiva senza scritture", () => {
  it("sola andata: elimina risultati e report, conservando gli altri match", () => {
    const p = buildWithdrawalSportingProjection(base());
    expect(p.policy).toBe("void_all");
    expect(p.excludedMatchIds).toEqual(["ab"]);
    expect(p.excludedPublishedReportIds).toEqual(["ab"]);
    expect(row(p.standingsBefore, "a").points).toBe(3);
    expect(row(p.standingsAfter, "a").played).toBe(0);
    expect(row(p.standingsAfter, "b").points).toBe(3);
    expect(row(p.standingsAfter, "b").goalsFor).toBe(3);
    expect(p.voidedMatchImpacts[0].presentPlayerIds).toEqual(["p1", "p2"]);
    expect(p.safeToApply).toBe(false);
  });
  it("ritiro durante andata A/R: annulla lo storico", () => {
    const p = buildWithdrawalSportingProjection(base({
      config: { format: "double_round_robin", totalMatchweeks: 6, firstReturnMatchweek: 4 },
      effectiveMatchweek: 3,
    }));
    expect(p.policy).toBe("void_all");
    expect(p.excludedMatchIds).toEqual(["ab"]);
  });
  it("ritiro al ritorno: conserva risultati, pianifica ma non attribuisce tavolini", () => {
    const p = buildWithdrawalSportingProjection(base({
      config: { format: "double_round_robin", totalMatchweeks: 6, firstReturnMatchweek: 4 },
      effectiveMatchweek: 4,
      matches: [match("ab", 1, "a", "b"), match("bc", 1, "b", "c"), match("ac2", 5, "c", "a", "scheduled")],
    }));
    expect(p.policy).toBe("retain_and_walkover");
    expect(p.excludedMatchIds).toEqual([]);
    expect(p.futureWalkovers).toEqual([{ matchId: "ac2", matchweek: 5, opponentTeamId: "c", scheduledDate: "2026-11-01", scheduledTime: "20:30" }]);
    expect(p.standingsAfter).toEqual(p.standingsBefore);
  });
  it("ritiro al ritorno: partite rinviate richiedono verifica", () => {
    const p = buildWithdrawalSportingProjection(base({
      config: { format: "double_round_robin", totalMatchweeks: 6, firstReturnMatchweek: 4 },
      effectiveMatchweek: 4, matches: [match("ab", 1, "a", "b"), match("ac", 5, "a", "c", "postponed")],
    }));
    expect(p.postponedToReview).toEqual(["ac"]);
    expect(p.futureWalkovers).toEqual([]);
  });
  it("non altera input originali e non duplica righe", () => {
    const i = base(); const original = JSON.stringify(i);
    buildWithdrawalSportingProjection(i);
    expect(JSON.stringify(i)).toBe(original);
  });
  it("non annulla le partite di fase finale", () => {
    const p = buildWithdrawalSportingProjection(base({
      matches: [match("ab", 1, "a", "b"), { ...match("final", 3, "a", "b"), matchType: "titlePlayoff" }],
      reports: [report("ab", 2, 0), report("final", 5, 4)],
    }));
    expect(p.excludedMatchIds).toEqual(["ab"]);
    expect(p.excludedPublishedReportIds).toEqual(["ab"]);
  });
  it("segnala incongruenze e partite concluse dopo il ritiro", () => {
    const p = buildWithdrawalSportingProjection(base({
      config: { format: "double_round_robin", totalMatchweeks: 6, firstReturnMatchweek: 4 },
      effectiveMatchweek: 4, matches: [match("ab", 4, "a", "b")], reports: [report("ab", 2, 0)],
    }));
    expect(p.issues.some(s => s.includes("serve verifica"))).toBe(true);
  });
  it("rifiuta la giornata fuori dal formato ufficiale", () => {
    expect(() => buildWithdrawalSportingProjection(base({ effectiveMatchweek: 20 }))).toThrow();
  });
});
