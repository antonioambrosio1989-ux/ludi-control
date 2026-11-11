import {describe,it,expect} from 'vitest';
import {projectMaturedWalkovers} from './WithdrawalMaturedWalkoverReadModel';
const fixture=()=>({id:'match14',seasonId:'season',matchweek:14,matchType:'regularSeason',homeTeamId:'oxford',awayTeamId:'bristol',status:'scheduled'});
const base=()=>({
 seasonId:'season',completeSnapshot:true,
 matches:[fixture(),{...fixture(),id:'match15',matchweek:15,homeTeamId:'millwall'}],
 registrations:[{seasonId:'season',teamId:'bristol',state:'active',effectsApplied:true,policy:'retain_and_walkover',activationCommitId:'commit'}],
 ledgers:[{teamId:'bristol',state:'applied',effectsApplied:true,policy:'retain_and_walkover',activationCommitId:'commit',operationId:'op',entries:[{matchId:'match14',matchweek:14,opponentTeamId:'oxford',effect:'walkover_pending_official_closure'}]}],
 awards:[{seasonId:'season',withdrawnTeamId:'bristol',matchId:'match14',matchweek:14,winnerTeamId:'oxford',loserTeamId:'bristol',winnerPoints:3,homeScore:6,awayScore:0,state:'recorded_pending_publication',activationCommitId:'commit',operationId:'op',closureId:'14'}],
 closures:[{id:'14',seasonId:'season',matchweek:14,state:'officially_closed',closedBy:'admin',closedAt:'2026-11-09'}],
});
describe('10J - lettura ufficiale tavolini maturati',()=>{
 it('proietta 6-0 solo sulla gara certificata, senza alterare input o altre giornate',()=>{const input=base();const before=JSON.stringify(input);const r=projectMaturedWalkovers(input);expect(r.matches[0]).toMatchObject({status:'finished',homeScore:6,awayScore:0});expect(r.matches[1].status).toBe('scheduled');expect(r.maturedMatchIds).toEqual(['match14']);expect(JSON.stringify(input)).toBe(before);});
 it('senza assegnazione maturata non attribuisce gol o punti',()=>{const input=base();input.awards=[];expect(projectMaturedWalkovers(input).matches).toEqual(input.matches);});
 it('rifiuta uno snapshot parziale',()=>{const input=base();input.completeSnapshot=false;expect(()=>projectMaturedWalkovers(input)).toThrow(/snapshot incompleto/);});
 it('rifiuta bozza o ritiro non attivato',()=>{const input=base();input.registrations[0].state='draft_pending_activation';expect(()=>projectMaturedWalkovers(input)).toThrow(/ritiro non attivo/);});
 it('rifiuta tavolino 3-0',()=>{const input=base();input.awards[0].homeScore=3;expect(()=>projectMaturedWalkovers(input)).toThrow(/6-0/);});
 it('rifiuta chiusura non ufficiale',()=>{const input=base();input.closures[0].state='open';expect(()=>projectMaturedWalkovers(input)).toThrow(/ufficialmente chiusa/);});
 it('rifiuta identita di attivazione differente',()=>{const input=base();input.awards[0].operationId='fake';expect(()=>projectMaturedWalkovers(input)).toThrow(/discordanti/);});
 it('rifiuta gare giocate e doppie assegnazioni',()=>{const input=base();input.matches[0].status='played';expect(()=>projectMaturedWalkovers(input)).toThrow(/gara non valida/);const next=base();next.awards.push({...next.awards[0]});expect(()=>projectMaturedWalkovers(next)).toThrow(/duplicata/);});
 it('rifiuta squadra avversaria discordante e registro senza gara',()=>{const input=base();input.awards[0].winnerTeamId='milan';expect(()=>projectMaturedWalkovers(input)).toThrow(/avversario/);const next=base();next.ledgers[0].entries=[];expect(()=>projectMaturedWalkovers(next)).toThrow(/registro/);});
 it('proietta 0-6 quando la squadra ritirata è in casa',()=>{const input=base();input.matches[0].homeTeamId='bristol';input.matches[0].awayTeamId='oxford';input.awards[0].homeScore=0;input.awards[0].awayScore=6;expect(projectMaturedWalkovers(input).matches[0]).toMatchObject({homeScore:0,awayScore:6});});
});
