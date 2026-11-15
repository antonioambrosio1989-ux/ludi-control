import { describe, expect, it } from "vitest";
import { optimizeLudiSchedule, LUDI_BYE_TEAM_ID } from "../src/services/calendar/LudiScheduleOptimizer";

const monday = "2026-11-16";
const allSlots = ["0|20:30", "0|21:30", "0|22:30", "1|20:30", "1|21:30", "1|22:30"];

describe("RIPOSO — squadra virtuale e riposi distribuiti", () => {
  it("11 squadre: cinque gare vere, RIPOSO per West Ham e nessuno slot occupato", () => {
    const teams = ["BOL", "DER", "MID", "MIL", "NOR", "QPR", "SHU", "STO", "WAT", "WHU", "WOL"];
    const pairings = [
      ["WOL", "QPR", "0|20:30"], ["DER", "MIL", "0|21:30"],
      ["BOL", "STO", "0|22:30"], ["NOR", "WAT", "1|20:30"],
      ["MID", "SHU", "2|21:30"],
    ];
    const availability = Object.fromEntries(teams.map((id) => [id, [] as string[]]));
    for (const [first, second, slot] of pairings) { availability[first].push(slot); availability[second].push(slot); }
    const generated = optimizeLudiSchedule({ teamIds: teams, matches: [], availability, weekStart: monday, targetMatchweek: 9, salt: 1 });
    const real = generated.filter((match) => match.awayTeamId !== LUDI_BYE_TEAM_ID);
    const fake = generated.filter((match) => match.awayTeamId === LUDI_BYE_TEAM_ID);
    expect(real).toHaveLength(5);
    expect(fake).toHaveLength(1);
    expect(fake[0]).toMatchObject({ homeTeamId: "WHU", time: "00:00" });
    expect(real.some((match) => [match.homeTeamId, match.awayTeamId].sort().join("|") === "MID|SHU" &&
      match.date === "2026-11-18" && match.time === "21:30")).toBe(true);
  });

  it("5 squadre: chi ha già RIPOSO non lo riceve ancora finché le altre non hanno riposato", () => {
    const teams = ["A", "B", "C", "D", "E"];
    const earlier = [
      { status: "played", matchweek: 1, homeTeamId: "A", awayTeamId: "B", date: "2026-11-09", time: "20:30" },
      { status: "played", matchweek: 1, homeTeamId: "C", awayTeamId: "D", date: "2026-11-09", time: "21:30" },
      { status: "cancelled", matchweek: 1, homeTeamId: "E", awayTeamId: LUDI_BYE_TEAM_ID, date: "2026-11-09", time: "00:00" },
    ];
    const availability = Object.fromEntries(teams.map((id) => [id, allSlots]));
    const result = optimizeLudiSchedule({ teamIds: teams, matches: earlier, availability, weekStart: monday, targetMatchweek: 2, salt: 2 });
    expect(result.filter((match) => match.awayTeamId === LUDI_BYE_TEAM_ID)).toHaveLength(1);
    expect(result.find((match) => match.awayTeamId === LUDI_BYE_TEAM_ID)?.homeTeamId).not.toBe("E");
  });

  it("Giornata parziale: nessun RIPOSO viene assegnato arbitrariamente", () => {
    const teams = ["A", "B", "C", "D", "E"];
    const availability = { A: ["0|20:30"], B: ["0|20:30"], C: [], D: [], E: [] };
    const result = optimizeLudiSchedule({ teamIds: teams, matches: [], availability, weekStart: monday, targetMatchweek: 1, salt: 1 });
    expect(result).toHaveLength(1);
    expect(result.some((match) => match.awayTeamId === LUDI_BYE_TEAM_ID)).toBe(false);
  });

  it("Squadre pari: nessuna pseudo-partita", () => {
    const teams = ["A", "B", "C", "D"];
    const availability = Object.fromEntries(teams.map((id) => [id, allSlots]));
    const result = optimizeLudiSchedule({ teamIds: teams, matches: [], availability, weekStart: monday, targetMatchweek: 1, salt: 1 });
    expect(result).toHaveLength(2);
    expect(result.some((match) => match.awayTeamId === LUDI_BYE_TEAM_ID)).toBe(false);
  });
});
