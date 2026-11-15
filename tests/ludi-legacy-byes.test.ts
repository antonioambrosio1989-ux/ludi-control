import { describe, expect, it } from "vitest";
import { buildLegacyByeOverlay } from "../src/services/calendar/LudiLegacyByes";
const teams = ["Bolton", "Derby County", "Middlesbrough", "Millwall", "Norwich", "QPR", "Sheffield Utd", "Stoke City", "Watford", "West Ham", "Wolves"].map((name) => ({id:name,name}));
const makeWeek = (week:number, bye:string) => teams.filter((t)=>t.id!==bye).map((t,i,a)=>i%2===0 ? ({matchweek:week,homeTeamId:t.id,awayTeamId:a[i+1].id}):null).filter((x):x is NonNullable<typeof x>=>x!==null);
const args = {seasonId:"demo",seasonStartYear:2026,seasonEndYear:2027,competitionName:"Ludi Championship",teams};
describe("RIPOSO delle giornate esistenti",()=>{
 it("riconosce MW7 West Ham e MW8 Wolves",()=>{
   const output=buildLegacyByeOverlay({...args,matches:[...makeWeek(7,"West Ham"),...makeWeek(8,"Wolves")]});
   expect(output.map(x=>[x.matchweek,x.homeTeamId,x.awayTeamId])).toEqual([[7,"West Ham","__ludi_bye__"],[8,"Wolves","__ludi_bye__"]]);
 });
 it("non inventa riposi nelle giornate parziali",()=>{
   const matches=makeWeek(7,"West Ham").slice(0,3);
   expect(buildLegacyByeOverlay({...args,matches})).toEqual([]);
 });
 it("non duplica un riposo già scritto",()=>{
   const matches=[...makeWeek(7,"West Ham"),{matchweek:7,homeTeamId:"West Ham",awayTeamId:"__ludi_bye__"}];
   expect(buildLegacyByeOverlay({...args,matches})).toEqual([]);
 });
 it("non modifica altre stagioni o competizioni",()=>{
   expect(buildLegacyByeOverlay({...args,seasonStartYear:2025,matches:makeWeek(7,"West Ham")})).toEqual([]);
   expect(buildLegacyByeOverlay({...args,competitionName:"Premier",matches:makeWeek(7,"West Ham")})).toEqual([]);
 });
});
