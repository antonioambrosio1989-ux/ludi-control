import { describe, expect, it } from "vitest";
import { projectWithdrawalDiscipline, type DisciplineProjectionInput } from "./WithdrawalDisciplineProjection";
import type { DisciplinarySuspension, PlayerDisciplinaryRecord } from "../../types/DisciplinaryRecord";
const record = (data: Partial<PlayerDisciplinaryRecord> = {}): PlayerDisciplinaryRecord => ({
  id:"r1",seasonId:"s1",playerId:"p1",playerName:"Player",teamId:"a",teamName:"A",
  seasonYellowCards:5,currentYellowCycle:5,directRedCards:1,activeSuspensionIds:[],...data,
});
const suspension = (data: Partial<DisciplinarySuspension> = {}): DisciplinarySuspension => ({
  id:"x1",seasonId:"s1",playerId:"p1",playerName:"Player",teamId:"a",teamName:"A",reason:"directRed",
  totalMatches:1,servedMatches:0,remainingMatches:1,status:"active",...data,
});
const base = (): DisciplineProjectionInput => ({
  seasonId:"s1",excludedMatchIds:["m1"],matches:[{id:"m1",matchweek:1,matchType:"regularSeason"}],
  reports:[{matchId:"m1",status:"published",data:{performances:{p1:{playerId:"p1",teamId:"a",yellowCards:2,redCards:1,directRedCards:1}}}}],
  records:[record()], suspensions:[],
});
describe("Ritiro 5C - audit disciplinare in sola lettura",()=>{
 it("elimina dal prospetto due gialli e un rosso diretto",()=>{const x=projectWithdrawalDiscipline(base());expect(x.removedCards[0]).toMatchObject({yellowCards:2,directRedCards:1});expect(x.projectedSeasonTotals[0]).toMatchObject({projectedYellowCards:3,projectedDirectReds:0});expect(x.canAutoApply).toBe(false)});
 it("non usa il rosso statistico per generare sanzioni automatiche",()=>{const b=base();b.reports[0].data.performances.p1.directRedCards=0;expect(projectWithdrawalDiscipline(b).removedCards[0].directRedCards).toBe(0)});
 it("identifica squalifica automatica nata da gara annullata",()=>{const b=base();b.suspensions=[suspension({sourceMatchId:"m1"})];expect(projectWithdrawalDiscipline(b).affectedSuspensions[0].action).toBe("review-source-cancelled")});
 it("segnala l'espiazione già effettuata",()=>{const b=base();b.suspensions=[suspension({sourceMatchId:"m1",servedMatches:1,remainingMatches:0,status:"completed"})];expect(projectWithdrawalDiscipline(b).blockers.join(" ")).toContain("già scontata")});
 it("preserva provvedimenti del giudice sportivo",()=>{const b=base();b.suspensions=[suspension({id:"judge",reason:"sportsJudge",sourceMatchId:"m1"})];const x=projectWithdrawalDiscipline(b);expect(x.preservedManualSuspensionIds).toEqual(["judge"]);expect(x.affectedSuspensions).toEqual([])});
 it("segnala gara annullata usata per scontare una squalifica",()=>{const b=base();b.suspensions=[suspension({sourceMatchId:"m0",servedMatchIds:["m1"]})];expect(projectWithdrawalDiscipline(b).affectedSuspensions[0].action).toBe("review-served-match")});
 it("richiede la revisione della catena di accumulo gialli",()=>{const b=base();b.suspensions=[suspension({reason:"yellowAccumulation",sourceMatchId:"m2"})];expect(projectWithdrawalDiscipline(b).affectedSuspensions[0].action).toBe("review-yellow-chain")});
 it("ignora report draft e provvedimenti di altre stagioni",()=>{const b=base();b.reports[0].status="draft";b.suspensions=[suspension({seasonId:"s2"})];expect(projectWithdrawalDiscipline(b).removedCards).toEqual([]);expect(projectWithdrawalDiscipline(b).affectedSuspensions).toEqual([])});
 it("non altera gli input originali",()=>{const b=base();const before=JSON.stringify(b);projectWithdrawalDiscipline(b);expect(JSON.stringify(b)).toBe(before)});
 it("rileva incongruenze fra report annullato e record",()=>{const b=base();b.records=[record({seasonYellowCards:0,directRedCards:0})];expect(projectWithdrawalDiscipline(b).blockers.join(" ")).toContain("incoerenti")});
});
