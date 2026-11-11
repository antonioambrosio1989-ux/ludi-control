import {describe,it,expect} from 'vitest';
import {buildTopPlayerPoliticalAwards,applyTopPlayerPoliticalAwards,planFutureWalkoverRegistrations,
  type OfficialWalkover} from './WithdrawalPostImportAndTopPlayer';
const win:OfficialWalkover={seasonId:'s1',verified:true,matchId:'m12',matchweek:12,
  homeTeamId:'teamA',awayTeamId:'withdrawn',homeScore:6,awayScore:0};
const memberships=[{playerId:'p1',teamId:'teamA',validFromMatchweek:1},
  {playerId:'p2',teamId:'teamA',validFromMatchweek:12},
  {playerId:'p3',teamId:'teamA',validFromMatchweek:1,validUntilMatchweek:11},
  {playerId:'p4',teamId:'withdrawn',validFromMatchweek:1}];
const valid={seasonId:'s1',awards:[win],memberships,officiallyClosedMatchweeks:[12]};
const fixture={id:'m13',seasonId:'s1',matchweek:13,homeTeamId:'withdrawn',awayTeamId:'teamB',status:'scheduled'};
const future={seasonId:'s1',withdrawnTeamId:'withdrawn',effectiveMatchweek:12,fixtures:[fixture],registeredEntries:[]};
describe('10M - top player 7 politico',()=>{
  it('attribuisce 7 ai componenti della rosa valida, anche non presenti',()=>{
    expect(buildTopPlayerPoliticalAwards(valid).map(x=>x.playerId)).toEqual(['p1','p2']);
  });
  it('non attribuisce 7 senza chiusura ufficiale',()=>{
    expect(()=>buildTopPlayerPoliticalAwards({...valid,officiallyClosedMatchweeks:[]})).toThrow();
  });
  it('non attribuisce 7 a un risultato 3-0',()=>{
    expect(()=>buildTopPlayerPoliticalAwards({...valid,awards:[{...win,homeScore:3}]})).toThrow();
  });
  it('non attribuisce punti a una gara non verificata',()=>{
    expect(()=>buildTopPlayerPoliticalAwards({...valid,awards:[{...win,verified:false as true}]})).toThrow();
  });
  it('rifiuta tavolini duplicati nello stesso match',()=>{
    expect(()=>buildTopPlayerPoliticalAwards({...valid,awards:[win,win]})).toThrow();
  });
  it('rifiuta doppio tesseramento simultaneo',()=>{
    expect(()=>buildTopPlayerPoliticalAwards({...valid,memberships:[...memberships,
      {playerId:'p1',teamId:'other',validFromMatchweek:12}]})).toThrow();
  });
  it('sostituisce 5 con 7 senza sommarli',()=>{
    const awards=buildTopPlayerPoliticalAwards(valid);
    const after=applyTopPlayerPoliticalAwards([{playerId:'p1',matchId:'m12',points:5}],awards);
    expect(after.find(x=>x.playerId==='p1')?.points).toBe(7);
    expect(after).toHaveLength(2);
  });
  it('applicare due volte la stessa proiezione non raddoppia i punti',()=>{
    const awards=buildTopPlayerPoliticalAwards(valid);
    const once=applyTopPlayerPoliticalAwards([],awards);
    expect(applyTopPlayerPoliticalAwards(once,awards)).toEqual(once);
  });
  it('non sovrascrive un voto reale',()=>{
    expect(()=>applyTopPlayerPoliticalAwards([{playerId:'p1',matchId:'m12',points:8}],
      buildTopPlayerPoliticalAwards(valid))).toThrow();
  });
  it('non inventa statistiche individuali',()=>{
    const output=buildTopPlayerPoliticalAwards(valid);
    expect(Object.keys(output[0]).sort()).toEqual(['matchId','matchweek','playerId','points','source','teamId']);
  });
});
describe('10M - importazioni successive',()=>{
  it('genera solo una candidatura da maturare, non punti immediati',()=>{
    expect(planFutureWalkoverRegistrations(future)).toMatchObject({readyToWrite:false,
      newEntries:[{matchId:'m13',matchweek:13,opponentTeamId:'teamB',effect:'walkover_pending_official_closure'}]});
  });
  it('reimportazione identica non crea una seconda candidatura',()=>{
    const entry=planFutureWalkoverRegistrations(future).newEntries[0];
    expect(planFutureWalkoverRegistrations({...future,registeredEntries:[entry]}).newEntries).toEqual([]);
  });
  it('due righe identiche nello stesso import non duplicano',()=>{
    expect(planFutureWalkoverRegistrations({...future,fixtures:[fixture,fixture]}).newEntries).toHaveLength(1);
  });
  it('stesso ID con squadre diverse blocca import',()=>{
    expect(()=>planFutureWalkoverRegistrations({...future,fixtures:[fixture,{...fixture,awayTeamId:'teamC'}]})).toThrow();
  });
  it('non altera le gare estranee al ritiro',()=>{
    expect(planFutureWalkoverRegistrations({...future,fixtures:[{...fixture,homeTeamId:'teamA'}]}))
      .toMatchObject({newEntries:[],unrelatedMatchIds:['m13']});
  });
  it('blocca la trasformazione automatica di una gara già giocata',()=>{
    expect(()=>planFutureWalkoverRegistrations({...future,fixtures:[{...fixture,status:'played'}]})).toThrow();
  });
  it('blocca la partita precedente al ritiro',()=>{
    expect(()=>planFutureWalkoverRegistrations({...future,fixtures:[{...fixture,matchweek:11}]})).toThrow();
  });
  it('blocca registro con squadra avversaria non coerente',()=>{
    expect(()=>planFutureWalkoverRegistrations({...future,registeredEntries:[{matchId:'m13',matchweek:13,
      opponentTeamId:'wrong',effect:'walkover_pending_official_closure'}]})).toThrow();
  });
});
