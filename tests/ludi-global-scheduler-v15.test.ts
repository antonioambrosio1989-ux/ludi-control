import { describe, it, expect } from 'vitest';
import { optimizeLudiSchedule, LUDI_BYE_TEAM_ID } from '../src/services/calendar/LudiScheduleOptimizer';
const weekStart = '2026-11-16';
function solve(teamIds:string[],availability:Record<string,string[]>,matches:Array<{status:string;matchweek:number;homeTeamId:string;awayTeamId:string;date:string;time:string}>=[]) {
  return optimizeLudiSchedule({teamIds,availability,matches,weekStart,targetMatchweek:9,salt:3});
}
function assertValid(rows: ReturnType<typeof solve>, availability:Record<string,string[]>) {
  const real = rows.filter(r=>r.awayTeamId!==LUDI_BYE_TEAM_ID);
  expect(new Set(real.flatMap(r=>[r.homeTeamId,r.awayTeamId])).size).toBe(real.length*2);
  expect(new Set(real.map(r=>`${r.date}|${r.time}`)).size).toBe(real.length);
  for(const row of real) {
    const day=Math.round((Date.parse(row.date+'T12:00:00Z')-Date.parse(weekStart+'T12:00:00Z'))/86400000);
    expect(availability[row.homeTeamId]).toContain(`${day}|${row.time}`);
    expect(availability[row.awayTeamId]).toContain(`${day}|${row.time}`);
  }
}
describe('Ludi calendario V15 - abbinamenti e assegnazione orari separati',()=>{
  it('trova 7 incontri quando gli slot si devono riassegnare',()=>{
    const teams=['DON','WIG','LEI','WIM','BRA','OXF','STO','WYC','BLA','SOU','MK','REA','NOT','SHW'];
    const av:Record<string,string[]>=Object.fromEntries(teams.map(t=>[t,[]]));
    const add=(t:string,...slots:string[])=>av[t].push(...slots);
    for(const t of ['DON','WIG']) add(t,'0|20:30','0|21:30');
    for(const t of ['BRA','OXF']) add(t,'3|20:30','3|21:30');
    for(const t of ['STO','WYC']) add(t,'3|20:30','3|21:30','3|22:30');
    add('LEI','1|22:30','2|22:30'); add('WIM','1|22:30','2|22:30');
    add('BLA','0|20:30','0|21:30','0|22:30','2|22:30');
    add('SOU','0|20:30','0|21:30','0|22:30','2|20:30','2|21:30','2|22:30');
    add('MK','0|20:30','1|20:30','1|21:30','2|20:30');
    add('REA','0|20:30','0|21:30','0|22:30','3|21:30','3|22:30');
    add('NOT','0|20:30','0|21:30','2|20:30','2|21:30');
    add('SHW','1|20:30','1|21:30','2|20:30','2|21:30');
    const r=solve(teams,av); expect(r.length).toBe(7); expect(r.searchTruncated).toBe(false);assertValid(r,av);
  });
  it('una giornata dispari aggiunge un solo RIPOSO senza occupare slot',()=>{
    const av={A:['0|20:30'],B:['0|20:30'],C:[]};
    const r=solve(['A','B','C'],av);
    expect(r.filter(x=>x.awayTeamId===LUDI_BYE_TEAM_ID).map(x=>x.homeTeamId)).toEqual(['C']);
    assertValid(r,av);
  });
  it('una giornata inevitabilmente parziale mantiene tutti gli incontri possibili',()=>{
    const av={A:['0|20:30'],B:['0|20:30'],C:[],D:[]};
    const r=solve(['A','B','C','D'],av);expect(r.length).toBe(1);assertValid(r,av);
  });
  it('rispetta slot gia occupati e incroci precedenti',()=>{
    const av={A:['0|20:30','0|21:30'],B:['0|20:30','0|21:30'],C:['0|20:30','0|21:30'],D:['0|20:30','0|21:30']};
    const matches=[{status:'played',matchweek:8,homeTeamId:'A',awayTeamId:'B',date:'2026-11-09',time:'20:30'},
    {status:'scheduled',matchweek:8,homeTeamId:'X',awayTeamId:'Y',date:'2026-11-16',time:'20:30'}];
    const r=solve(['A','B','C','D'],av,matches);
    expect(r.length).toBe(1);expect(r[0].time).toBe('21:30');expect(new Set([r[0].homeTeamId,r[0].awayTeamId])).not.toEqual(new Set(['A','B']));
  });
  it('ricerca la giornata completa con preferenze casuali senza violare i vincoli',()=>{
    for(let seed=1;seed<=12;seed++){
      const ids=Array.from({length:14},(_,i)=>`T${i}`);
      const av:Record<string,string[]>=Object.fromEntries(ids.map(t=>[t,[]]));
      for(let i=0;i<7;i++) {
        const slot=`${i<3?0:i<6?1:2}|${['20:30','21:30','22:30'][i%3]}`;
        av[ids[i*2]].push(slot);av[ids[i*2+1]].push(slot);
        // Opzioni alternative: generano tanti accoppiamenti e scambi possibili.
        for(let j=0;j<7;j++) if((i*19+j*23+seed)%4===0){const extra=`${j<3?0:j<6?1:2}|${['20:30','21:30','22:30'][j%3]}`;av[ids[i*2]].push(extra);av[ids[i*2+1]].push(extra);}
      }
      const r=optimizeLudiSchedule({teamIds:ids,availability:av,matches:[],weekStart,targetMatchweek:9,salt:seed});
      expect(r.length).toBe(7);assertValid(r,av);
    }
  });
});
