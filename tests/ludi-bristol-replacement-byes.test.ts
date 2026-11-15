import { describe, expect, it } from "vitest";
import { buildLegacyByeOverlay } from "../src/services/calendar/LudiLegacyByes";

const teams = [
  { id: "west", name: "West Ham" },
  { id: "wolves", name: "Wolves" },
  { id: "mid", name: "Middlesbrough" },
];
const allTeams = [...teams, { id: "bristol", name: "Bristol City" }];
const makeMatch = (matchweek: number, homeTeamId: string, awayTeamId: string, status = "played") =>
  ({ matchweek, homeTeamId, awayTeamId, status });
const base = {
  seasonId: "champ-2026", seasonStartYear: 2026, seasonEndYear: 2027,
  competitionName: "Ludi Championship", teams, allTeams,
  withdrawnTeamIds: ["bristol"],
};

describe("Sostituzione storica Bristol / RIPOSO (solo lettura)", () => {
  it("riconosce le gare MW1–6 e i riposi MW7 WHU, MW8 Wolves anche se non tutte le squadre hanno partita", () => {
    const matches = [
      makeMatch(1, "bristol", "mid"),
      makeMatch(3, "bristol", "west"),
      makeMatch(7, "mid", "wolves", "scheduled"),
      makeMatch(8, "mid", "west", "scheduled"),
    ];
    const got = buildLegacyByeOverlay({ ...base, matches });
    expect(got.map((m) => [m.matchweek, m.homeTeamId])).toEqual([
      [1, "mid"], [3, "west"], [7, "west"], [8, "wolves"],
    ]);
    expect(got.every((m) => m.status === "cancelled" && m.published === false)).toBe(true);
    expect(matches[0].status).toBe("played");
  });
  it("non attiva la sostituzione se Bristol non è ufficialmente ritirata", () => {
    expect(buildLegacyByeOverlay({ ...base, withdrawnTeamIds: [], matches: [makeMatch(7, "mid", "wolves")] })).toEqual([]);
  });
  it("non registra RIPOSO se il club ha già una partita o un riposo esplicito", () => {
    const matches = [
      makeMatch(7, "west", "mid"),
      makeMatch(8, "mid", "west"),
      makeMatch(8, "wolves", "__ludi_bye__", "cancelled"),
    ];
    expect(buildLegacyByeOverlay({ ...base, matches })).toEqual([]);
  });
  it("non influenza altre stagioni o competizioni", () => {
    const matches = [makeMatch(7, "mid", "wolves")];
    expect(buildLegacyByeOverlay({ ...base, seasonStartYear: 2025, matches })).toEqual([]);
    expect(buildLegacyByeOverlay({ ...base, competitionName: "Premier", matches })).toEqual([]);
  });
});
