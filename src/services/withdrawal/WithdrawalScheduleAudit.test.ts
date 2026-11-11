import { describe, expect, it } from "vitest";
import { auditWithdrawalSchedule } from "./WithdrawalScheduleAudit";
import type { WithdrawalMatch } from "./WithdrawalPreview";
const games: WithdrawalMatch[] = [
  { id: "ab1", homeTeamId: "a", awayTeamId: "b", matchweek: 1, date: "2026-09-01", time: "20:30", status: "played" },
  { id: "bc1", homeTeamId: "b", awayTeamId: "c", matchweek: 2, date: "2026-09-08", time: "20:30", status: "played" },
  { id: "ca1", homeTeamId: "c", awayTeamId: "a", matchweek: 3, date: "2026-09-15", time: "20:30", status: "played" },
  { id: "ba2", homeTeamId: "b", awayTeamId: "a", matchweek: 4, date: "2026-09-22", time: "20:30", status: "scheduled" },
  { id: "cb2", homeTeamId: "c", awayTeamId: "b", matchweek: 5, date: "2026-09-29", time: "20:30", status: "scheduled" },
  { id: "ac2", homeTeamId: "a", awayTeamId: "c", matchweek: 6, date: "2026-10-06", time: "20:30", status: "scheduled" },
];
const args = { format: "double_round_robin" as const, teamIds: ["a", "b", "c"], matches: games };
describe("audit calendario prima di un ritiro", () => {
  it("riconosce automaticamente il girone di andata", () => {
    const a = auditWithdrawalSchedule({...args, nowRome: "2026-09-20T12:00"});
    expect(a.complete).toBe(true); expect(a.phase).toBe("first_leg"); expect(a.firstReturnMatchweek).toBe(4);
  });
  it("riconosce automaticamente il girone di ritorno", () => {
    const a = auditWithdrawalSchedule({...args, nowRome: "2026-09-23T12:00"});
    expect(a.complete).toBe(true); expect(a.phase).toBe("second_leg");
  });
  it("blocca calendari stagionali caricati solo parzialmente", () => {
    const a = auditWithdrawalSchedule({...args, matches: games.slice(0, 4), nowRome: "2026-09-23T12:00"});
    expect(a.complete).toBe(false); expect(a.phase).toBeNull();
  });
  it("blocca calendari che duplicano gli incontri senza invertire il campo", () => {
    const a = auditWithdrawalSchedule({...args, matches: [...games.slice(0,3), {...games[0], id:"ab2", matchweek:4, date:"2026-09-22"}, ...games.slice(4)],nowRome:"2026-09-23T12:00"});
    expect(a.complete).toBe(false);
  });
  it("blocca gironi sovrapposti", () => {
    const a = auditWithdrawalSchedule({...args, matches:games.map(m=>m.id === "ba2" ? {...m, matchweek:3}:m),nowRome:"2026-09-23T12:00"});
    expect(a.complete).toBe(false);
  });
  it("supporta la sola andata con calendario completo", () => {
    const a = auditWithdrawalSchedule({format:"single_round_robin",teamIds:["a","b","c"],matches:games.slice(0,3),nowRome:"2026-09-16T12:00"});
    expect(a.complete).toBe(true);expect(a.phase).toBe("first_leg");expect(a.expectedMatches).toBe(3);
  });
  it("non include partite della fase finale", () => {
    const a = auditWithdrawalSchedule({...args,matches:[...games,{...games[0],id:"f1", matchType:"titlePlayoff"}],nowRome:"2026-09-20T12:00"});
    expect(a.complete).toBe(true);
  });
  it("blocca risultati LIVE ancora in corso", () => {
    const a = auditWithdrawalSchedule({...args,matches:games.map(m=>m.id==="ba2"?{...m,status:"live"}:m),nowRome:"2026-09-23T12:00"});
    expect(a.complete).toBe(false);
  });
});
