import { describe, it, expect } from "vitest";
import type { Match } from "../../types/Match";
import type { CloudMatchReport } from "../match/FirebaseMatchReportRepository";
import { buildWithdrawalIndividualProjection, type WithdrawalIndividualInput } from "./WithdrawalPlayerProjection";

const match = (id: string, week: number, h: string, a: string, status: Match["status"] = "played"): Match => ({
  id, seasonId: "s", matchweek: week, matchweekId: `mw${week}`, homeTeamId: h, awayTeamId: a,
  date: "2026-11-01", time: "20:30", venue: "Campo", status, published: true,
});
const report = (id: string, home: number, away: number, opts: { status?: "played" | "walkover"; presentHome?: string[]; vote?: number | null } = {}): CloudMatchReport => ({
  matchId: id, seasonId: "s", version: 1, status: "published",
  data: { matchId: id, status: opts.status ?? "played", homeScore: home, awayScore: away,
    homePresentPlayerIds: opts.presentHome ?? ["p", "g"], awayPresentPlayerIds: ["q"],
    performances: {
      p: { playerId: "p", teamId: "a", status: opts.vote === null ? "sv" : "rated", vote: opts.vote ?? (opts.vote === null ? undefined : 8), goals: 2, assists: 1, yellowCards: 1, redCards: 0 },
      g: { playerId: "g", teamId: "a", status: "rated", vote: 7, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
      q: { playerId: "q", teamId: "b", status: "rated", vote: 6, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
    }, goals: [], mvpPlayerId: "p" },
});
const base = (overrides: Partial<WithdrawalIndividualInput> = {}): WithdrawalIndividualInput => ({
  seasonId: "s", matches: [match("ab", 1, "a", "b"), match("ac", 2, "a", "c"), match("bc", 3, "b", "c")],
  reports: [report("ab", 2, 1), report("ac", 0, 0), report("bc", 1, 0)],
  players: [{playerId:"p", teamId:"a", role:"Attaccante"}, {playerId:"g", teamId:"a", role:"Portiere"}, {playerId:"q", teamId:"b", role:"Difensore"}],
  excludedMatchIds: ["ab"], ...overrides,
});
const player = (arr: ReturnType<typeof buildWithdrawalIndividualProjection>["before"], id: string) => arr.find(x => x.playerId === id)!;

describe("fase 5B - proiezione statistiche individuali", () => {
  it("esclude gol assist MVP e cartellini da entrambe le squadre nella gara annullata", () => {
    const p = buildWithdrawalIndividualProjection(base());
    expect(player(p.before,"p").goals).toBe(4);
    expect(player(p.after,"p").goals).toBe(2);
    expect(player(p.after,"p").assists).toBe(1);
    expect(player(p.after,"p").yellowCards).toBe(1);
    expect(player(p.after,"p").mvp).toBe(1);
    expect(player(p.after,"q").appearances).toBe(0);
  });
  it("ricalcola media voto e soglia 60 percento per gare valide della squadra", () => {
    const p = buildWithdrawalIndividualProjection(base({reports:[report("ab",2,1),report("ac",0,0,{presentHome:[]}),report("bc",1,0)]}));
    expect(player(p.before,"p").eligibleForAverageRanking).toBe(false);
    expect(player(p.after,"p").teamMatchesPlayed).toBe(1);
    expect(player(p.after,"p").appearances).toBe(0);
  });
  it("Top Player usa voto effettivo e 5 politico per assente o SV", () => {
    const p=buildWithdrawalIndividualProjection(base({excludedMatchIds:[], reports:[report("ab",2,1),report("ac",0,0,{presentHome:["g"]}), report("bc",1,0)]}));
    expect(player(p.after,"p").topPlayerPoints).toBe(13);
  });
  it("SV assegna 5 politico ma non entra nella media", () => {
    const p=buildWithdrawalIndividualProjection(base({excludedMatchIds:[],reports:[report("ab",2,1,{vote:null})]}));
    expect(player(p.after,"p").topPlayerPoints).toBe(5);
    expect(player(p.after,"p").averageVote).toBe(null);
  });
  it("clean sheet portiere 0,1,2,3+ gol: 3,2,1,0 punti", () => {
    const input=base({excludedMatchIds:[],matches:[match("1",1,"a","b"),match("2",2,"a","b"),match("3",3,"a","b"),match("4",4,"a","b")],reports:[report("1",1,0),report("2",1,1),report("3",1,2),report("4",1,3)]});
    expect(player(buildWithdrawalIndividualProjection(input).after,"g").cleanSheetPoints).toBe(6);
  });
  it("tavolino pubblicato attribuisce 7 politico solo alla squadra vincitrice e non inventa gol", () => {
    const p=buildWithdrawalIndividualProjection(base({excludedMatchIds:[],matches:[match("w",4,"a","b","walkover")],reports:[report("w",3,0,{status:"walkover",presentHome:[]})]}));
    expect(player(p.after,"p").topPlayerPoints).toBe(7);
    expect(player(p.after,"q").topPlayerPoints).toBe(0);
    expect(player(p.after,"p").goals).toBe(0);
    expect(player(p.after,"g").cleanSheetPoints).toBe(0);
  });
  it("non matura punti su match scheduled e non include gare di final stage", () => {
    const p=buildWithdrawalIndividualProjection(base({excludedMatchIds:[],matches:[match("future",4,"a","b","scheduled"),{...match("final",5,"a","b"),matchType:"titlePlayoff"}],reports:[report("future",3,0),report("final",2,0)]}));
    expect(player(p.after,"p").teamMatchesPlayed).toBe(0);
  });
  it("non muta input e indica ID da annullare inesistente", () => {
    const input=base({excludedMatchIds:["missing"]}); const original=JSON.stringify(input);
    const p=buildWithdrawalIndividualProjection(input);
    expect(JSON.stringify(input)).toBe(original);
    expect(p.issues.some(x=>x.includes("missing"))).toBe(true);
    expect(p.safeToApply).toBe(false);
  });
});
