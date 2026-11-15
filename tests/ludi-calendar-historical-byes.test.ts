import { describe, expect, it } from "vitest";
import { getHistoricalByeCounts, getHistoricalByeHistory } from "../src/services/calendar/LudiHistoricalByes";
import { optimizeLudiSchedule, LUDI_BYE_TEAM_ID } from "../src/services/calendar/LudiScheduleOptimizer";

const matches = [
  { id: "mw1-a", matchweek: 1, status: "played", homeTeamId: "A", awayTeamId: "BRISTOL", date: "2026-10-01", time: "20:30" },
  { id: "mw2-b", matchweek: 2, status: "played", homeTeamId: "BRISTOL", awayTeamId: "B", date: "2026-10-08", time: "20:30" },
  { id: "mw3-future", matchweek: 3, status: "scheduled", homeTeamId: "BRISTOL", awayTeamId: "C", date: "2026-10-15", time: "20:30" },
  { id: "mw4-bye", matchweek: 4, status: "cancelled", homeTeamId: "D", awayTeamId: LUDI_BYE_TEAM_ID, date: "2026-10-22", time: "00:00" },
];
const params = { matches, activeTeamIds: ["A", "B", "C", "D", "E"], withdrawnTeamIds: ["BRISTOL"], beforeMatchweek: 8 };

describe("Riposi storici dopo il ritiro di Bristol", () => {
  it("riconosce le partite concluse con Bristol ma non quelle programmate", () => {
    expect([...getHistoricalByeCounts(params)]).toEqual([["A", 1], ["B", 1], ["C", 0], ["D", 1], ["E", 0]]);
  });
  it("riporta gli incroci sul tabellone senza modificare le partite originali", () => {
    expect(getHistoricalByeHistory(params).map((item) => `${item.teamId}:${item.matchweek}`))
      .toEqual(["A:1", "B:2", "D:4"]);
    expect(matches[0].status).toBe("played");
  });
  it("evita doppi conteggi nella stessa giornata", () => {
    const duplicate = [...matches, {id:"other", matchweek:1, status:"played", homeTeamId:"BRISTOL", awayTeamId:"A", date:"2026-10-01", time:"21:30"}];
    expect(getHistoricalByeCounts({...params,matches:duplicate}).get("A")).toBe(1);
  });
  it("dopo 1 riposo storico non riassegna A o B mentre C o E attendono", () => {
    const active=["A","B","C","D","E"];
    const availability=Object.fromEntries(active.map((id)=>[id,["0|20:30","0|21:30","1|20:30","1|21:30"]]));
    const output=optimizeLudiSchedule({teamIds:active,withdrawnTeamIds:["BRISTOL"],matches,availability,weekStart:"2026-11-16",targetMatchweek:8,salt:1});
    const bye=output.find((item)=>item.awayTeamId===LUDI_BYE_TEAM_ID);
    expect(bye?.homeTeamId).toMatch(/^(C|E)$/);
    expect(output.filter((item)=>item.awayTeamId!==LUDI_BYE_TEAM_ID)).toHaveLength(2);
  });
});
