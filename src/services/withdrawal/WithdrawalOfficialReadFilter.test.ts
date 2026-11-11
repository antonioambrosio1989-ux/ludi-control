import { describe, expect, it } from "vitest";
import { selectOfficialWithdrawalInputs, type VerifiedWithdrawalRegistration } from "./WithdrawalOfficialReadFilter";

const matches = [
  { id: "m1", seasonId: "s1", matchType: "regularSeason", homeTeamId: "bristol", awayTeamId: "wolves" },
  { id: "m2", seasonId: "s1", matchType: "regularSeason", homeTeamId: "stoke", awayTeamId: "wolves" },
  { id: "m3", seasonId: "s1", matchType: "titlePlayoff", homeTeamId: "bristol", awayTeamId: "stoke" },
] as const;
const reports = [{ matchId: "m1", status: "published" }, { matchId: "m2", status: "published" }, { matchId: "m3", status: "published" }] as const;
const registration = (overrides: Partial<VerifiedWithdrawalRegistration> = {}): VerifiedWithdrawalRegistration => ({
  seasonId: "s1", teamId: "bristol", state: "active", effectsApplied: true, policy: "void_all", ...overrides,
});
const run = (registrations: VerifiedWithdrawalRegistration[], overrides: Record<string, unknown> = {}) => selectOfficialWithdrawalInputs({
  seasonId: "s1", matches, reports, registrations, registrationSnapshotComplete: true, ...overrides,
});

describe("9D: filtro dati ufficiali - sola lettura", () => {
  it("esclude gare RS e report delle squadre ritirate in sola andata", () => {
    const result = run([registration()]);
    expect(result.excludedMatchIds).toEqual(["m1"]);
    expect(result.excludedReportMatchIds).toEqual(["m1"]);
    expect(result.matches.map(m => m.id)).toEqual(["m2", "m3"]);
    expect(result.reports.map(r => r.matchId)).toEqual(["m2", "m3"]);
  });
  it("una bozza non cambia mai dati ufficiali", () => {
    expect(run([registration({ state: "draft_pending_activation", effectsApplied: false })]).matches).toHaveLength(3);
  });
  it("una bozza annullata non cambia mai dati ufficiali", () => {
    expect(run([registration({ state: "cancelled", effectsApplied: false })]).reports).toHaveLength(3);
  });
  it("ritiro secondo ritorno conserva gli storici", () => {
    expect(run([registration({ policy: "retain_and_walkover" })]).matches).toHaveLength(3);
  });
  it("rifiuta registro incompleto", () => {
    expect(() => run([], {registrationSnapshotComplete: false})).toThrow(/non completo/);
  });
  it("rifiuta effetti applicati a bozza", () => {
    expect(() => run([registration({ state: "draft_pending_activation" })])).toThrow(/incoerenti/);
  });
  it("rifiuta stati e policy non riconosciuti", () => {
    expect(() => run([registration({ state: "unknown" })])).toThrow(/sconosciuto/);
    expect(() => run([registration({ policy: "anything" })])).toThrow(/sconosciuta/);
  });
  it("rifiuta ritiri attivi prima degli effetti persistenti", () => {
    expect(() => run([registration({effectsApplied: false})])).toThrow(/non conclusa/);
  });
  it("rifiuta righe di stagione diversa e ID match duplicati", () => {
    expect(() => run([registration({ seasonId: "s2" })])).toThrow(/stagione diversa/);
    expect(() => run([], {matches: [matches[0], matches[0]]})).toThrow(/duplicato/);
  });
  it("non modifica input, gestisce ID numerici e riporta report orfani", () => {
    const originals = JSON.stringify({matches, reports});
    const result = run([registration()], {reports: [...reports, { matchId: "missing", status: "published" }]});
    expect(result.warnings).toEqual(["Tabellino orfano: missing"]);
    expect(JSON.stringify({matches, reports})).toBe(originals);
    const numeric = run([registration()], {matches: [{id: 1, seasonId: "s1", homeTeamId: "bristol", awayTeamId: 25}], reports: [{matchId: 1}]});
    expect(numeric.excludedMatchIds).toEqual(["1"]);
    expect(numeric.reports).toHaveLength(0);
  });
});
