import { describe, it, expect } from "vitest";
import { selectAllWeeklyFixtures } from "./PredictionWeeklyFixtures";
const fixture = (id: string, seasonId: string, date: string, overrides: Record<string, unknown> = {}) => ({
  id, seasonId, date, time: "20:30", published: true, status: "scheduled", homeTeamId: `home-${id}`, awayTeamId: `away-${id}`, ...overrides,
});

describe("Ludi Bet Club: tutte le partite della settimana", () => {
  it("include 21 partite di tre campionati senza troncarle a 10", () => {
    const matches = [
      ...Array.from({length: 7}, (_, i) => fixture(`p${i}`, "premier-season", "2026-11-23")),
      ...Array.from({length: 7}, (_, i) => fixture(`c${i}`, "championship-season", "2026-11-24")),
      ...Array.from({length: 7}, (_, i) => fixture(`l${i}`, "league-season", "2026-11-26")),
    ];
    const selected = selectAllWeeklyFixtures({
      matches,
      activeSeasonIds: ["premier-season", "championship-season", "league-season"],
      anchorMatches: [matches[7]],
    });
    expect(selected).toHaveLength(21);
    expect(new Set(selected.map(m => m.id)).size).toBe(21);
  });
  it("esclude stagioni inattive, altre settimane, riposi, annullate e non pubblicate", () => {
    const matches = [
      fixture("valid", "championship", "2026-11-24"),
      fixture("old", "retired", "2026-11-24"),
      fixture("other-week", "premier", "2026-11-30"),
      fixture("hidden", "premier", "2026-11-25", {published: false}),
      fixture("bye", "premier", "2026-11-25", {awayTeamId: "__ludi_bye__"}),
      fixture("cancelled", "premier", "2026-11-25", {status: "cancelled"}),
      fixture("valid2", "premier", "2026-11-26"),
    ];
    expect(selectAllWeeklyFixtures({matches, activeSeasonIds: ["premier", "championship"], anchorMatches: [matches[0]]}).map(m => m.id)).toEqual(["valid", "valid2"]);
  });
  it("gestisce un numero variabile di incontri, senza alcun limite", () => {
    for (const count of [1, 7, 10, 14, 21, 30]) {
      const matches = Array.from({length: count}, (_, i) => fixture(`m${i}`, "championship", "2026-11-23"));
      expect(selectAllWeeklyFixtures({matches,activeSeasonIds:["championship"],anchorMatches:[matches[0]]})).toHaveLength(count);
    }
  });
});
