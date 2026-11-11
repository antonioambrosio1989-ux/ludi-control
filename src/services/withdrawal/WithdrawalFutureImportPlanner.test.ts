import { describe, expect, it } from "vitest";
import { planWithdrawalFutureImports, type ImportedFixture } from "./WithdrawalFutureImportPlanner";
import type { WithdrawalConfig } from "./WithdrawalRegistryRules";

const single: WithdrawalConfig = { format: "single_round_robin", totalMatchweeks: 11, firstReturnMatchweek: null };
const double: WithdrawalConfig = { format: "double_round_robin", totalMatchweeks: 22, firstReturnMatchweek: 12 };
const mk = (id: string, week: number, status = "scheduled", extra: Partial<ImportedFixture> = {}): ImportedFixture => ({
  id, seasonId: "s1", matchweek: week, homeTeamId: "bristol", awayTeamId: "stoke", status,
  date: `2026-11-${String(week).padStart(2,"0")}`, time: "20:30", ...extra,
});
const plan = (
  fixtures: ImportedFixture[],
  cfg: WithdrawalConfig = single,
  effectiveMatchweek = 6,
  existingFixtures: ImportedFixture[] = [],
) => planWithdrawalFutureImports({ seasonId: "s1", withdrawnTeamId: "bristol", config: cfg, effectiveMatchweek, existingFixtures, incomingFixtures: fixtures });

describe("Fase 8A - importazioni future senza scritture", () => {
  it("annulla le gare future in sola andata", () => {
    const p = plan([mk("a", 7)]);
    expect(p.policy).toBe("void_all");
    expect(p.decisions.map(d => d.action)).toEqual(["void_candidate"]);
    expect(p.safeToApply).toBe(false);
    expect(p.decisions[0].assignedPoints).toBe(0);
  });
  it("annulla anche nel girone di andata del doppio", () => {
    expect(plan([mk("a", 15)], double, 6).decisions[0].action).toBe("void_candidate");
  });
  it("il ritiro nel ritorno pianifica soltanto tavolini futuri", () => {
    const p = plan([mk("a", 13)], double, 12);
    expect(p.policy).toBe("retain_and_walkover");
    expect(p.decisions[0]).toMatchObject({ action: "walkover_candidate", matchweek: 13, opponentTeamId: "stoke", assignedPoints: 0 });
  });
  it("non anticipa il tavolino nella stessa giornata di ritiro", () => {
    expect(plan([mk("a", 12)], double, 12).decisions[0]).toMatchObject({ action: "walkover_candidate", assignedPoints: 0 });
  });
  it("mantiene il risultato già concluso prima del ritorno", () => {
    expect(plan([mk("a", 10, "finished")], double, 12).decisions[0].action).toBe("retain_result");
  });
  it("non applica automaticamente il tavolino alle gare arretrate", () => {
    expect(plan([mk("a", 10, "scheduled")], double, 12).decisions[0].action).toBe("manual_review");
  });
  it("non assegna tavolini a rinvii, live o conclusi dopo il ritiro", () => {
    const p = plan([mk("a", 13,"postponed"),mk("b",14,"live"),mk("c",15,"played")], double, 12);
    expect(p.decisions.every(d => d.action === "manual_review" && d.assignedPoints === 0)).toBe(true);
  });
  it("ignora gara non coinvolta e fase finale", () => {
    const p = plan([mk("a",7,"scheduled",{homeTeamId:"stoke",awayTeamId:"derby"}), mk("b",8,"scheduled",{matchType:"titlePlayoff"})]);
    expect(p.decisions).toEqual([]);
    expect(p.ignoredUnrelatedMatchIds).toEqual(["a","b"]);
  });
  it("non riprocessa una gara già presente e identica", () => {
    const f = mk("a", 7);
    const p = plan([f],single,6,[f]);
    expect(p.decisions).toEqual([]);
    expect(p.alreadyPresentMatchIds).toEqual(["a"]);
  });
  it("blocca la valutazione di una gara esistente con lo stesso ID ma dati discordanti", () => {
    const p = plan([mk("a", 8)], single, 6,[mk("a", 7)]);
    expect(p.decisions).toEqual([]);
    expect(p.issues.some(i=>i.code==="conflicting_match_id")).toBe(true);
  });
  it("tratta un import ripetuto identico una volta sola", () => {
    const f=mk("a", 7);
    const p=plan([f, {...f}]);
    expect(p.decisions).toHaveLength(1);
    expect(p.issues.some(i=>i.code==="duplicate_fixture")).toBe(true);
  });
  it("non elabora un ID ripetuto con informazioni diverse", () => {
    const p=plan([mk("a",7),mk("a",8)]);
    expect(p.decisions).toEqual([]);
    expect(p.issues.some(i=>i.code==="conflicting_match_id")).toBe(true);
  });
  it("rifiuta match fuori stagione, giornata e squadra contro se stessa", () => {
    const p=plan([mk("a",7,"scheduled",{seasonId:"s2"}),mk("b",30),mk("c",8,"scheduled",{awayTeamId:"bristol"})]);
    expect(p.decisions).toEqual([]);
    expect(p.issues.filter(i=>i.code==="invalid_fixture")).toHaveLength(3);
  });
  it("preserva gli input, senza mutazioni", () => {
    const f=mk("a",7);
    const src=[f];
    const before=JSON.stringify(src);
    plan(src);
    expect(JSON.stringify(src)).toBe(before);
  });
  it("ordina deterministicamente per giornata e ID", () => {
    const p=plan([mk("z",10),mk("b",7),mk("a",7)]);
    expect(p.decisions.map(d=>d.matchId)).toEqual(["a","b","z"]);
  });
});
