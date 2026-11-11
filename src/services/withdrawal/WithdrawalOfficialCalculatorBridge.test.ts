import { describe, expect, it } from "vitest";
import type { Match } from "../../types/Match";
import type { CloudMatchReport } from "../match/FirebaseMatchReportRepository";
import type { Team } from "../../types/Team";
import { calculateOfficialWithdrawalAwareData } from "./WithdrawalOfficialCalculatorBridge";

const match = (id: string, homeTeamId: string, awayTeamId: string, matchweek: number): Match => ({
  id, seasonId: "s", matchType: "regularSeason", matchweek, matchweekId: `mw${matchweek}`,
  homeTeamId, awayTeamId, date: "2026-10-02", time: "20:30", venue: "Ludi", status: "played", published: true,
});
const report = (matchId: string, homeScore: number, awayScore: number, scorer: string): CloudMatchReport => ({
  matchId, seasonId: "s", status: "published", version: 1,
  data: {
    matchId, status: "played", homeScore, awayScore,
    homePresentPlayerIds: [scorer], awayPresentPlayerIds: [],
    performances: { [scorer]: { playerId: scorer, teamId: "b", status: "rated", vote: 8, assists: 1, yellowCards: 1, redCards: 0, directRedCards: 0 } },
    goals: [{ type: "goal", scorerPlayerId: scorer }], mvpPlayerId: scorer,
  } as unknown as CloudMatchReport["data"],
});
const team = (id: string): Team => ({id, name:id, slug:id, primaryColor:"#fff",secondaryColor:"#000"});
const matches = [match("m1", "b", "w", 1), match("m2", "w", "s2", 2)];
const reports = [report("m1", 3, 1, "p"), report("m2", 1, 0, "q")];
const registration = (state = "active", effectsApplied = true, policy = "void_all") =>
  ({seasonId:"s",teamId:"b",state,effectsApplied,policy});
const run = (registrations = [registration()], changes: Record<string, unknown> = {}) =>
  calculateOfficialWithdrawalAwareData({
    seasonId:"s", matches, reports, registrations, registrationSnapshotComplete:true,
    standingsOptions:{teamIds:["b","w","s2"]},
    players:[{playerId:"p", teams:[team("b"),team("w"),team("s2")]}],
    ...changes,
  });

describe("9E — calcolatori reali con filtro ritiro", () => {
  it("bozze non alterano la classifica né il profilo", () => {
    const result = run([registration("draft_pending_activation", false)]);
    expect(result.excludedMatchIds).toEqual([]);
    expect(result.playerResults[0].stats.appearances).toBe(1);
    expect(result.playerResults[0].stats.assists).toBe(1);
    expect(result.standings.find(r=>r.teamId === "b")?.played).toBe(1);
  });
  it("ritiro applicato all'andata esclude gara e report per entrambi", () => {
    const result = run();
    expect(result.excludedMatchIds).toEqual(["m1"]);
    expect(result.excludedReportMatchIds).toEqual(["m1"]);
    expect(result.playerResults[0].stats.appearances).toBe(0);
    expect(result.playerResults[0].stats.goals).toBe(0);
    expect(result.playerResults[0].stats.mvp).toBe(0);
    expect(result.standings.find(r=>r.teamId === "b")?.played).toBe(0);
    expect(result.standings.find(r=>r.teamId === "w")?.played).toBe(1);
  });
  it("ritiro al ritorno conserva lo storico", () => {
    const result = run([registration("active",true,"retain_and_walkover")]);
    expect(result.excludedMatchIds).toEqual([]);
    expect(result.playerResults[0].stats.appearances).toBe(1);
  });
  it("non accetta registro non completo o ritiri attivi senza effetti", () => {
    expect(()=>run([], {registrationSnapshotComplete:false})).toThrow(/non completo/);
    expect(()=>run([registration("active",false)])).toThrow(/non conclusa/);
  });
  it("rifiuta report orfani invece di pubblicare numeri parziali", () => {
    expect(()=>run([], {reports:[...reports,report("missing",2,0,"p")]})).toThrow(/orfano/);
  });
  it("non modifica gare né report originali", () => {
    const original = JSON.stringify({matches,reports}); run();
    expect(JSON.stringify({matches,reports})).toBe(original);
  });
});
