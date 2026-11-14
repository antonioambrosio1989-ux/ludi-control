import { describe, expect, it } from 'vitest';
import { parseClientWalkovers, applyClientWalkovers } from './WithdrawalClientMaturedWalkovers';
const seasonId='s1';
const home={id:'m1',homeTeamId:'withdrawn',awayTeamId:'winner',status:'scheduled'};
const award={matchId:'m1',homeTeamId:'withdrawn',awayTeamId:'winner',homeScore:0,awayScore:6};
const valid=(maturedWalkovers:unknown)=>({seasonId,verified:true,maturedWalkovers});
describe('10L: tavolini convalidati nel client',()=>{
  it('accetta un 0-6 server verificato',()=>expect(parseClientWalkovers(valid([award]),seasonId)).toEqual([award]));
  it('accetta un 6-0 server verificato',()=>expect(parseClientWalkovers(valid([{...award,matchId:'m2',homeTeamId:'winner',awayTeamId:'withdrawn',homeScore:6,awayScore:0}]),seasonId)).toHaveLength(1));
  it('rifiuta risposta non verificata',()=>expect(()=>parseClientWalkovers({seasonId,verified:false,maturedWalkovers:[]},seasonId)).toThrow());
  it('rifiuta stagione differente',()=>expect(()=>parseClientWalkovers(valid([]),'other')).toThrow());
  it('rifiuta 3-0',()=>expect(()=>parseClientWalkovers(valid([{...award,awayScore:3}]),seasonId)).toThrow());
  it('rifiuta tavolini duplicati',()=>expect(()=>parseClientWalkovers(valid([award,award]),seasonId)).toThrow());
  it('non anticipa la partita senza attestazione',()=>expect(applyClientWalkovers({matches:[home],reports:[],walkovers:[]})).toEqual([home]));
  it('proietta 0-6 senza mutare partita originale',()=>{
    const res=applyClientWalkovers({matches:[home],reports:[],walkovers:[award]});
    expect(res[0]).toMatchObject({status:'finished',homeScore:0,awayScore:6});
    expect(home.status).toBe('scheduled');
  });
  it('non fabbrica gare non caricate',()=>expect(applyClientWalkovers({matches:[],reports:[],walkovers:[award]})).toEqual([]));
  it('rifiuta gara già giocata',()=>expect(()=>applyClientWalkovers({matches:[{...home,status:'played'}],reports:[],walkovers:[award]})).toThrow());
  it('rifiuta tabellino esistente',()=>expect(()=>applyClientWalkovers({matches:[home],reports:[{matchId:'m1'}],walkovers:[award]})).toThrow());
  it('rifiuta squadre discordanti',()=>expect(()=>applyClientWalkovers({matches:[{...home,homeTeamId:'other'}],reports:[],walkovers:[award]})).toThrow());
  it('rifiuta punteggio gia presente',()=>expect(()=>applyClientWalkovers({matches:[{...home,homeScore:0}],reports:[],walkovers:[award]})).toThrow());
});
