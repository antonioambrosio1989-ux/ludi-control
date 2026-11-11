import { describe, it, expect } from "vitest";
import { previewTeamWithdrawal, type WithdrawalMatch } from "./WithdrawalPreview";

const matches: WithdrawalMatch[] = [
  { id: "m1", homeTeamId: "a", awayTeamId: "b", matchweek: 1, date: "2026-09-01", time: "20:30", status: "played" },
  { id: "m2", homeTeamId: "c", awayTeamId: "a", matchweek: 2, date: "2026-09-08", time: "20:30", status: "scheduled" },
  { id: "m3", homeTeamId: "c", awayTeamId: "b", matchweek: 2, date: "2026-09-08", time: "21:30", status: "played" },
];

describe("simulazione del ritiro", () => {
  it("sola andata: annullamento completo senza scritture", () => {
    const x = previewTeamWithdrawal({ teamId: "a", seasonFormat: "single_round_robin", withdrawalPhase: "first_leg", matches });
    expect(x.policy).toBe("void_all");
    expect(x.alreadyPlayed).toEqual(["m1"]);
    expect(x.pending).toEqual([{matchId:"m2",matchweek:2,opponentTeamId:"c"}]);
    expect(x.impactedTeamIds).toEqual(["b", "c"]);
    expect(x.safeToApply).toBe(false);
  });
  it("andata: annullamento completo anche in andata/ritorno", () => {
    expect(previewTeamWithdrawal({ teamId:"a",seasonFormat:"double_round_robin",withdrawalPhase:"first_leg",matches }).policy).toBe("void_all");
  });
  it("ritorno: risultati passati validi, tavolini non ancora attribuiti", () => {
    const x = previewTeamWithdrawal({ teamId:"a",seasonFormat:"double_round_robin",withdrawalPhase:"second_leg",matches });
    expect(x.policy).toBe("retain_and_walkover");
    expect(x.pending).toHaveLength(1);
    expect(x.safeToApply).toBe(false);
  });
  it("impedisce la scelta del ritorno su sola andata", () => {
    const x = previewTeamWithdrawal({ teamId:"a",seasonFormat:"single_round_robin",withdrawalPhase:"second_leg",matches });
    expect(x.issues).toContain("Un campionato di sola andata non prevede il girone di ritorno.");
  });
  it("segnala stati non determinabili e non contabilizza final stage", () => {
    const x = previewTeamWithdrawal({ teamId:"a",seasonFormat:"double_round_robin",withdrawalPhase:"second_leg",matches:[
      {...matches[0],status:"live"}, {...matches[1],matchType:"titlePlayoff"}
    ] });
    expect(x.issues.some(s=>s.includes("live"))).toBe(true);
    expect(x.pending).toHaveLength(0);
    expect(x.safeToApply).toBe(false);
  });
});
