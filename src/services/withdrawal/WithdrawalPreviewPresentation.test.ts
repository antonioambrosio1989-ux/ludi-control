import { describe, expect, it } from "vitest";
import { classifyWithdrawalNotices, displayIdentity, getMatchReportChecks, requiresMissingReportReview } from "./WithdrawalPreviewPresentation";

describe("fase 6C: presentazione prudente", () => {
  it("deduplica gli avvisi senza alterarne il contenuto", () => {
    const result=classifyWithdrawalNotices(["Calendario parziale: 36 gare importate su 132 attese.","Calendario parziale: 36 gare importate su 132 attese."]);
    expect(result).toHaveLength(1); expect(result[0].severity).toBe("blocking");
  });
  it("rende bloccanti i cicli disciplinari da ricostruire",()=>{
    expect(classifyWithdrawalNotices(["Giocatore X: ciclo ammonizioni da ricalcolare cronologicamente."])[0].severity).toBe("blocking");
  });
  it("rende bloccanti i report mancanti",()=>{
    expect(classifyWithdrawalNotices(["Report pubblicato mancante per gara A"])[0].severity).toBe("blocking");
  });
  it("non interpreta una gara programmata senza report come gia disputata",()=>{
    expect(requiresMissingReportReview("scheduled")).toBe(false);
    expect(requiresMissingReportReview("finished")).toBe(true);
    expect(requiresMissingReportReview("played")).toBe(true);
  });
  it("separa le gare senza report ed esclude le fasi non regolari",()=>{
    const matches=[
      {id:"a",matchweek:1,status:"played",homeTeamId:1,awayTeamId:2},
      {id:"b",matchweek:2,status:"scheduled",homeTeamId:2,awayTeamId:3},
      {id:"c",matchweek:3,status:"played",homeTeamId:1,awayTeamId:3,matchType:"titlePlayoff"},
    ];
    const missing=getMatchReportChecks(matches,new Set(["a"]));
    expect(missing).toHaveLength(1);expect(missing[0].matchId).toBe("b");
  });
  it("mantiene visibile ID quando il nome non e disponibile",()=>{
    expect(displayIdentity("p1",{})).toEqual({name:"p1",unresolved:true});
    expect(displayIdentity("p1",{p1:" Mario Rossi "})).toEqual({name:"Mario Rossi",unresolved:false});
  });
});
