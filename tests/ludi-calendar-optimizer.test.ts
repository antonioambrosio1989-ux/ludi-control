import { describe, expect, it } from "vitest";
import { optimizeLudiSchedule } from "../src/services/calendar/LudiScheduleOptimizer";

const start = "2026-11-16";
const teams = ["BOL", "DER", "MID", "MIL", "NOR", "QPR", "SHU", "STO", "WAT", "WHU", "WOL"];
const pairs: [string, string, string][] = [
  ["WOL", "QPR", "0|20:30"],
  ["DER", "MIL", "0|21:30"],
  ["BOL", "STO", "0|22:30"],
  ["NOR", "WAT", "1|20:30"],
  ["MID", "SHU", "2|21:30"],
];

describe("Ludi Calendar V6 — algoritmo e riposi", () => {
  it("crea cinque partite e MID-SHU mercoledì 21:30, lasciando riposare WHU", () => {
    const availability = Object.fromEntries(teams.map((id) => [id, [] as string[]]));
    for (const [a, b, slot] of pairs) {
      availability[a].push(slot);
      availability[b].push(slot);
    }
    availability.WHU.push("2|21:30");
    const result = optimizeLudiSchedule({teamIds: teams, matches: [], availability, weekStart: start, targetMatchweek: 9, salt: 1});
    expect(result).toHaveLength(5);
    expect(result.some((match) =>
      [match.homeTeamId, match.awayTeamId].sort().join("-") === "MID-SHU" &&
      match.date === "2026-11-18" && match.time === "21:30"
    )).toBe(true);
    expect(result.some((match) => match.homeTeamId === "WHU" || match.awayTeamId === "WHU")).toBe(false);
  });

  it("non assegna un secondo riposo a E prima delle altre", () => {
    const ids = ["A", "B", "C", "D", "E"];
    const all = ["0|20:30", "0|21:30", "0|22:30", "1|20:30", "1|21:30", "1|22:30"];
    const history = [
      { status: "finished", matchweek: 1, homeTeamId: "A", awayTeamId: "B", date: "2026-11-09", time: "20:30" },
      { status: "finished", matchweek: 1, homeTeamId: "C", awayTeamId: "D", date: "2026-11-09", time: "21:30" },
    ];
    const result = optimizeLudiSchedule({teamIds: ids, matches: history, availability: Object.fromEntries(ids.map((x) => [x, all])), weekStart: start, targetMatchweek: 2, salt: 5});
    expect(result).toHaveLength(2);
    expect(result.some((match) => match.homeTeamId === "E" || match.awayTeamId === "E")).toBe(true);
  });

  it("mantiene gli abbinamenti parziali quando una giornata non può essere completata", () => {
    const ids = ["A", "B", "C", "D", "E", "F", "G"];
    const availability = { A: ["0|20:30"], B: ["0|20:30"], C: ["2|21:30"], D: ["2|21:30"], E: [] as string[], F: [] as string[], G: [] as string[] };
    const result = optimizeLudiSchedule({teamIds: ids, matches: [], availability, weekStart: start, targetMatchweek: 1, salt: 2});
    expect(result).toHaveLength(2);
  });

  it("Rigenera esplora soluzioni differenti per pari disponibilità", () => {
    const ids = ["A", "B", "C", "D", "E"];
    const all = ["0|20:30", "0|21:30", "0|22:30", "1|20:30", "1|21:30", "1|22:30", "2|20:30", "2|21:30", "2|22:30"];
    const availability = Object.fromEntries(ids.map((x) => [x, all]));
    const signatures = new Set(Array.from({length: 5}, (_, idx) => {
      const result = optimizeLudiSchedule({teamIds: ids, matches: [], availability, weekStart: start, targetMatchweek: 1, salt: idx + 1});
      expect(result).toHaveLength(2);
      return result.map((x) => `${x.date}/${x.time}/${x.homeTeamId}/${x.awayTeamId}`).join("#");
    }));
    expect(signatures.size).toBeGreaterThan(1);
  });
});
