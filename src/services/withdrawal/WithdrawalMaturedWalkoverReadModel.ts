/** 10J: verificatore puro per risultati a tavolino maturati (6-0).
 * Non consulta Firebase, non genera chiusure, non scrive risultati o tabellini.
 * Invocare soltanto su un insieme COMPLETO letto dal server.
 */
export type WalkoverMatch = {
  id: string; seasonId: string; matchweek: number; matchType?: string;
  homeTeamId: string | number; awayTeamId: string | number;
  status: string; homeScore?: number; awayScore?: number;
};
export type WalkoverRegistration = {
  teamId: string; seasonId: string; state: string;
  effectsApplied: boolean; policy: string; activationCommitId?: string;
};
export type WalkoverLedger = {
  teamId: string; state: string; effectsApplied: boolean;
  policy: string; activationCommitId: string; operationId: string;
  entries: {matchId: string; matchweek: number; opponentTeamId: string; effect: string}[];
};
export type WalkoverAward = {
  seasonId: string; withdrawnTeamId: string; matchId: string; matchweek: number;
  winnerTeamId: string; loserTeamId: string; winnerPoints: number;
  homeScore: number; awayScore: number; state: string;
  activationCommitId: string; operationId: string; closureId: string;
};
export type WalkoverClosure = {
  id: string; seasonId: string; matchweek: number; state: string;
  closedBy: string; closedAt: unknown;
};
const isId=(s:unknown):s is string=>typeof s==='string' && /^[\w-]{1,128}$/.test(s);
function assert(test:unknown,message:string):asserts test {if(!test)throw new Error('Tavolino ufficiale: '+message);}
export function projectMaturedWalkovers<M extends WalkoverMatch>(input: {
  seasonId: string;
  matches: readonly M[];
  registrations: readonly WalkoverRegistration[];
  ledgers: readonly WalkoverLedger[];
  awards: readonly WalkoverAward[];
  closures: readonly WalkoverClosure[];
  completeSnapshot: boolean;
}): { matches:M[]; maturedMatchIds:string[] } {
  assert(input.completeSnapshot,'snapshot incompleto');
  assert(isId(input.seasonId),'stagione non valida');
  const registrations=new Map<string,WalkoverRegistration>();
  for(const reg of input.registrations){
    assert(reg.seasonId===input.seasonId && isId(reg.teamId),'registrazione non valida');
    assert(!registrations.has(reg.teamId),'registrazione duplicata');
    registrations.set(reg.teamId,reg);
  }
  const ledgers=new Map<string,WalkoverLedger>();
  for(const ledger of input.ledgers){
    assert(isId(ledger.teamId) && !ledgers.has(ledger.teamId),'registro effetti duplicato o non valido');
    ledgers.set(ledger.teamId,ledger);
  }
  const closures=new Map<string,WalkoverClosure>();
  for(const closure of input.closures){
    assert(isId(closure.id) && !closures.has(closure.id),'chiusura duplicata o non valida');
    closures.set(closure.id,closure);
  }
  const matches=new Map<string,M>();
  for(const match of input.matches){
    assert(match.seasonId===input.seasonId && isId(match.id) && !matches.has(match.id),'partita non valida o duplicata');
    matches.set(match.id,match);
  }
  const matured=new Map<string,M>();
  for(const award of input.awards){
    assert(isId(award.matchId) && !matured.has(award.matchId),'assegnazione duplicata o non valida');
    assert(award.seasonId===input.seasonId && isId(award.withdrawnTeamId),'stagione o squadra discordante');
    const reg=registrations.get(award.withdrawnTeamId);
    const ledger=ledgers.get(award.withdrawnTeamId);
    assert(reg && reg.state==='active' && reg.effectsApplied===true && reg.policy==='retain_and_walkover' && isId(reg.activationCommitId), 'ritiro non attivo nel ritorno');
    assert(ledger && ledger.state==='applied' && ledger.effectsApplied===true && ledger.policy==='retain_and_walkover' &&
      ledger.activationCommitId===reg.activationCommitId && isId(ledger.operationId), 'registro effetti non verificato');
    assert(award.activationCommitId===ledger.activationCommitId && award.operationId===ledger.operationId,
      'identificativi di attivazione discordanti');
    assert(award.state==='recorded_pending_publication' && award.winnerPoints===3, 'assegnazione non valida');
    const match=matches.get(award.matchId);
    assert(match && (match.matchType??'regularSeason')==='regularSeason' && match.status==='scheduled' &&
      Number.isSafeInteger(match.matchweek) && match.matchweek===award.matchweek,'gara non valida o già disputata');
    const home=String(match.homeTeamId),away=String(match.awayTeamId);
    assert(home!==away && (home===award.withdrawnTeamId || away===award.withdrawnTeamId),'squadra ritirata non presente');
    const winner=home===award.withdrawnTeamId?away:home;
    assert(isId(winner) && award.winnerTeamId===winner && award.loserTeamId===award.withdrawnTeamId,
      'avversario non coerente');
    assert(award.homeScore===(home===winner?6:0) && award.awayScore===(away===winner?6:0),'risultato diverso da 6-0');
    assert(Array.isArray(ledger.entries) && ledger.entries.filter(e=>e.matchId===award.matchId &&
      e.matchweek===match.matchweek && e.opponentTeamId===winner && e.effect==='walkover_pending_official_closure').length===1,
      'assegnazione assente dal registro o duplicata');
    const closure=closures.get(award.closureId);
    assert(closure && closure.id===String(match.matchweek) && closure.seasonId===input.seasonId &&
      closure.matchweek===match.matchweek && closure.state==='officially_closed' &&
      isId(closure.closedBy) && Boolean(closure.closedAt),'giornata non ufficialmente chiusa');
    // Il motore ufficiale usa "finished" e i gol persistiti quando non esiste report.
    // Nessuna partita reale viene modificata: e' una proiezione in memoria.
    matured.set(match.id,{...match,status:'finished',homeScore:award.homeScore,awayScore:award.awayScore});
  }
  return {matches:input.matches.map(m=>matured.get(m.id)??m),maturedMatchIds:[...matured.keys()].sort()};
}
