import { describe, expect, it } from "vitest";
import { suggestMissingFixtures } from "../src/services/calendar/LudiMissingFixtures";
const empty = { withdrawnTeamIds: [], matches: [], weekStart: "2026-11-16", targetMatchweek: 9 };
describe("proposte per completare la giornata", () => {
  it("propone due partite e un riposo con cinque squadre escluse", () => {
    const result = suggestMissingFixtures({ ...empty, activeTeamIds: ["A","B","C","D","E"], generated: [], availability: {} });
    expect(result.complete).toBe(true);
    expect(result.fixtures.filter((x) => !x.isBye)).toHaveLength(2);
    expect(result.fixtures.filter((x) => x.isBye)).toHaveLength(1);
  });
  it("non ripropone un incrocio gia disputato", () => {
    const result = suggestMissingFixtures({ ...empty, activeTeamIds: ["A","B"], generated: [], availability: {}, matches: [{matchweek: 2, status:"played", homeTeamId:"A", awayTeamId:"B", date:"2026-10-01",time:"20:30"}] });
    expect(result.fixtures).toHaveLength(0);
    expect(result.unresolvedTeamIds).toHaveLength(2);
  });
  it("non assegna il riposo a chi lo ha gia effettuato", () => {
    const result = suggestMissingFixtures({ ...empty, activeTeamIds: ["A","B","C"], generated: [], availability: {}, matches: [{matchweek: 2, status:"cancelled", homeTeamId:"A", awayTeamId:"__ludi_bye__",date:"2026-10-01",time:"00:00"}] });
    expect(result.fixtures.find((x) => x.isBye)?.homeTeamId).not.toBe("A");
  });
  it("le partite suggerite non usano gli slot della bozza", () => {
    const result = suggestMissingFixtures({ ...empty, activeTeamIds: ["A","B","C","D"], generated: [{homeTeamId:"A",awayTeamId:"B",date:"2026-11-16",time:"20:30"}], availability: {C:["0|20:30"],D:["0|20:30"]} });
    expect(result.fixtures[0].commonSlots).toBe(0);
  });
});
