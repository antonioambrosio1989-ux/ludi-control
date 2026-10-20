/* Run from the project after copying the package: node scripts/check-live-center.cjs */
(async () => {
const fs = await import('node:fs');
const path = await import('node:path');
const vm = await import('node:vm');
const { default: assert } = await import('node:assert/strict');
const { createRequire } = await import('node:module');
const loadDependency = createRequire(__filename);
const root = process.env.LIVE_CENTER_SOURCE || path.resolve(__dirname, '..');
const ts = loadDependency(process.env.LIVE_CENTER_TYPESCRIPT || path.join(root, 'node_modules/typescript'));
function load(file, mocks = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: (name) => {
    if (!(name in mocks)) throw Error(`Unexpected dependency ${name}`);
    return mocks[name];
  }, Date, Intl, Set, Promise, console });
  return exports;
}
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`OK ${name}`); }
const rules = load('src/services/match/LiveCenterRules.ts');
const scheduled = { date: '2026-10-20', time: '20:00', status: 'scheduled', published: true };
const documents = new Map();
let afterPreflight;
let reads = [];
function snapshot(ref) { const value = documents.get(ref); return { exists: () => value !== undefined, data: () => structuredClone(value) }; }
const firestore = {
  doc: (_db, collection, id) => `${collection}/${id}`,
  getDoc: async (ref) => { const value = snapshot(ref); const data=value.data(); const frozen={exists:value.exists,data:()=>data}; if(afterPreflight) {const fn=afterPreflight;afterPreflight=null;fn();} return frozen; },
  serverTimestamp: () => 'server-time',
  runTransaction: async (_db, fn) => {
    const updates = [];
    await fn({ get: async (ref) => {reads.push(ref);return snapshot(ref);}, update: (ref, patch) => updates.push([ref, patch]) });
    for(const [ref, patch] of updates) documents.set(ref, {...documents.get(ref), ...patch});
  },
};
const { transitionLiveMatch } = load('src/services/match/LiveMatchTransaction.ts', {
  'firebase/firestore': firestore, '@/src/lib/firebase': { db: {} },
});
function reset() {
  documents.clear(); reads=[]; afterPreflight=null;
  documents.set('seasons/s', {status:'active'});
  for(const collection of ['matches','finalStageMatches']) documents.set(`${collection}/m`, {seasonId:'s',status:'live',published:true,homeScore:0,awayScore:0});
}
const command = (overrides={}) => transitionLiveMatch({collectionName:'matches',reportsCollectionName:'matchReports',input:{
  matchId:'m',expectedStatus:'live',status:'live',homeScore:1,awayScore:0,expectedSeasonId:'s',expectedScores:{homeScore:0,awayScore:0},...overrides,
}});
async function runChecks() {
  await test('Automatic kickoff waits until +15 in Rome', () => {
    assert.equal(rules.isAutomaticLiveDue(scheduled,new Date('2026-10-20T18:14:59Z')),false);
    assert.equal(rules.isAutomaticLiveDue(scheduled,new Date('2026-10-20T18:15:00Z')),true);
  });
  await test('Every simultaneous fixture is eligible', () => {
    const due=[scheduled,{...scheduled}].filter(m=>rules.isAutomaticLiveDue(m,new Date('2026-10-20T18:15:00Z')));
    assert.equal(due.length,2);
  });
  await test('Unpublished, finished, other days and invalid dates never start', () => {
    for(const fixture of [{...scheduled,published:false},{...scheduled,status:'finished'},{...scheduled,date:'2026-10-19'},{...scheduled,date:'2026-02-30'},{...scheduled,time:'24:00'}]) {
      assert.equal(rules.isAutomaticLiveDue(fixture,new Date('2026-10-20T18:15:00Z')),false);
    }
  });
  await test('Matchday extends beyond midnight until 02:00', () => {
    assert.equal(rules.isAutomaticLiveDue({...scheduled,time:'23:30'},new Date('2026-10-20T22:30:00Z')),true);
    assert.equal(rules.isAutomaticLiveDue({...scheduled,time:'23:30'},new Date('2026-10-21T00:00:00Z')),false);
  });
  await test('Same ID in different collections has different row keys', () => {
    assert.notEqual(rules.liveCenterKey({phase:'regularSeason',match:{id:'m',seasonId:'s'}}),rules.liveCenterKey({phase:'finalStage',match:{id:'m',seasonId:'s'}}));
  });
  await test('Multiple live matches do not block each other; reads stay local', async () => {
    reset(); await command();
    assert.equal(documents.get('matches/m').homeScore,1);
    assert.equal(reads.length,3);
    assert.equal(reads.includes('finalStageMatches/m'),false);
  });
  await test('Stale scores reject without overwriting another operator', async () => {
    reset(); documents.get('matches/m').homeScore=2;
    await assert.rejects(command(),/altro operatore/);
    assert.equal(documents.get('matches/m').homeScore,2);
  });
  await test('Concurrent score change after preflight is rejected', async () => {
    reset(); afterPreflight=()=>{documents.get('matches/m').awayScore=3;};
    await assert.rejects(command(),/altro operatore/);
  });
  await test('Concurrent season closure is checked inside the transaction', async () => {
    reset(); afterPreflight=()=>documents.set('seasons/s',{status:'completed'});
    await assert.rejects(command(),/stagione attiva/);
  });
  await test('Published final report blocks score and lifecycle changes', async () => {
    reset(); documents.set('matchReports/m',{status:'published',data:{status:'played'}});
    await assert.rejects(command(),/tabellino finale/);
  });
  await test('Invalid transitions and negative scores are rejected', async () => {
    reset(); await assert.rejects(command({expectedStatus:'scheduled',status:'finished'}),/Transizione/);
    await assert.rejects(command({homeScore:-1}),/numeri interi/);
  });
  await test('Unpublished matches, closed phases and stale season IDs are rejected', async () => {
    reset(); documents.get('matches/m').published=false;
    await assert.rejects(command(),/pubblicate/);
    reset(); documents.get('seasons/s').regularSeasonClosed=true;
    await assert.rejects(command(),/fase/);
    reset(); await assert.rejects(command({expectedSeasonId:'old'}),/stagione visualizzata/);
  });
  await test('Same safety checks apply to Final Stage', async () => {
    reset(); documents.get('seasons/s').finalStageClosed=true;
    await assert.rejects(transitionLiveMatch({collectionName:'finalStageMatches',reportsCollectionName:'finalStageMatchReports',input:{matchId:'m',expectedStatus:'live',status:'finished',homeScore:0,awayScore:0}}),/fase/);
  });
  for (const finalStage of [false,true]) {
    await test(`${finalStage ? 'Final Stage' : 'Regular Season'} service forwards concurrency tokens`, async () => {
      const calls=[];
      const repo={
        getById:async()=>({id:'m',status:'live',homeScore:2,awayScore:1}),
        updateLiveScore:async input=>calls.push(input),
        transitionLifecycle:async input=>calls.push(input),
      };
      const location=finalStage?'final-stage/FirebaseFinalStageMatchLifecycleService':'match/FirebaseMatchLifecycleService';
      const repoName=finalStage?'FirebaseFinalStageMatchRepository':'FirebaseMatchRepository';
      const rulePath=finalStage?'final-stage/FinalStageMatchLifecycleRules':'match/MatchLifecycleRules';
      const loadedModule=load(`src/services/${location}.ts`,{
        [`@/src/services/${finalStage?'final-stage':'match'}/${repoName}`]:{[repoName]:repo},
        [`@/src/services/${rulePath}`]:{ assertLiveScore:()=>{}, selectAutomaticLiveMatch:()=>{}, selectAutomaticFinalStageLiveMatch:()=>{} },
      });
      const service=Object.values(loadedModule)[0];
      const expectedScores={homeScore:2,awayScore:1};
      await service.updateLiveScore({matchId:'m',homeScore:3,awayScore:1,expectedScores});
      await service.finishMatch({matchId:'m',expectedScores});
      repo.getById=async()=>({id:'m',status:'finished',homeScore:2,awayScore:1});
      await service.restoreLive({matchId:'m',expectedScores});
      assert.equal(calls.length,3);
      for(const input of calls) assert.equal(input.expectedScores,expectedScores);
    });
  }
  await test('Listeners reject cache/pending confirmations and unsubscribe both sources', () => {
    const callbacks=[];
    const results=[];
    let stopped=0;
    const mapper=(id,data)=>({id,...data});
    const listener=load('src/services/match/FirebaseLiveCenterRepository.ts',{
      'firebase/firestore':{
        collection:(_db,name)=>name,query:(...args)=>args,where:(...args)=>args,
        onSnapshot:(_query,_options,onChange)=>{callbacks.push(onChange);return ()=>{stopped++;};},
      },
      '@/src/lib/firebase':{db:{}},
      '@/src/lib/firestore/mappers/MatchDocumentMapper':{mapMatch:mapper},
      '@/src/services/final-stage/FirebaseFinalStageMatchRepository':{mapFinalStageMatch:mapper},
    });
    const unsubscribe=listener.subscribeLiveCenter((phase,entries)=>results.push([phase,entries]),()=>{});
    const emit=(fromCache,pending)=>callbacks[0]({metadata:{fromCache},docs:[{id:'m',metadata:{hasPendingWrites:pending},data:()=>({seasonId:'s'})}]});
    emit(true,false); emit(false,true); emit(false,false);
    assert.deepEqual(results.map(result=>result[1][0].confirmed),[false,false,true]);
    unsubscribe(); emit(false,false);
    assert.equal(stopped,2); assert.equal(results.length,3);
  });
  console.log(`${passed} checks passed. These checks use an in-memory Firestore stub, not the Emulator.`);
}
await runChecks();
})().catch(error=>{console.error(error);process.exitCode=1;});
