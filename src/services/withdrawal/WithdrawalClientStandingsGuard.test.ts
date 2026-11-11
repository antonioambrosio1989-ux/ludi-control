import { describe, expect, it } from 'vitest';
import { guardWithdrawalStandings, parseWithdrawalStateResponse } from './WithdrawalClientStandingsGuard';
const matches = [
  { id: 'a', seasonId: 's', homeTeamId: 'a', awayTeamId: 'b', matchType: 'regularSeason' },
  { id: 'b', seasonId: 's', homeTeamId: 'c', awayTeamId: 'b' },
  { id: 'c', seasonId: 's', homeTeamId: 'b', awayTeamId: 'd', matchType: 'titlePlayoff' },
];
const reports = [{ matchId: 'a' }, { matchId: 'b' }, { matchId: 'c' }];
describe('9G - confine ufficiale classifica client', () => {
  it('nessuna squadra ritirata: classifica invariata', () => {
    const x = guardWithdrawalStandings({seasonId:'s', matches, reports, cancelledTeamIds:[]});
    expect(x.matches).toEqual(matches); expect(x.reports).toEqual(reports);
  });
  it('ritiro andata: elimina gare RS e relativi report', () => {
    const x = guardWithdrawalStandings({seasonId:'s', matches, reports, cancelledTeamIds:['b']});
    expect(x.excludedMatchIds).toEqual(['a','b']); expect(x.reports).toEqual([{matchId:'c'}]);
  });
  it('non muta i dati originali', () => {
    guardWithdrawalStandings({seasonId:'s', matches, reports, cancelledTeamIds:['b']});
    expect(matches).toHaveLength(3); expect(reports).toHaveLength(3);
  });
  it('rifiuta partite di altre stagioni', () => {
    expect(() => guardWithdrawalStandings({seasonId:'other', matches, reports, cancelledTeamIds:[]})).toThrow();
  });
  it('rifiuta partite duplicate', () => {
    expect(() => guardWithdrawalStandings({seasonId:'s', matches:[matches[0],matches[0]], reports, cancelledTeamIds:[]})).toThrow();
  });
  it('rifiuta lista ritiri duplicata', () => {
    expect(() => guardWithdrawalStandings({seasonId:'s', matches, reports, cancelledTeamIds:['b','b']})).toThrow();
  });
  it('accetta esclusivamente risposta verificata della stessa stagione', () => {
    expect(parseWithdrawalStateResponse({seasonId:'s',cancelledTeamIds:['b'],verified:true},'s')).toEqual(['b']);
    expect(() => parseWithdrawalStateResponse({seasonId:'s',cancelledTeamIds:[]},'s')).toThrow();
    expect(() => parseWithdrawalStateResponse({seasonId:'x',cancelledTeamIds:[],verified:true},'s')).toThrow();
  });
  it('rifiuta IDs malformati', () => {
    expect(() => parseWithdrawalStateResponse({seasonId:'s',cancelledTeamIds:['b','b'],verified:true},'s')).toThrow();
    expect(() => parseWithdrawalStateResponse({seasonId:'s',cancelledTeamIds:['b/1'],verified:true},'s')).toThrow();
  });
});
