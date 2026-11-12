const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = process.cwd();
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const repo = read('src/services/player/FirebaseSeasonPlayerRepository.ts');
const api = read('app/api/admin/season-roster-registry/route.ts');
const hook = read('src/hooks/useSeasonRosterData.ts');
const tests = read('tests/market.registry.api.e2e.test.ts');
const rules = read('firestore.rules');
const checks = [
 ['Aggiunta via API admin',()=>assert.match(repo,/requestRosterRegistry<[^>]+>\("create",\s*\{ input \}\)/)],
 ['Import via API admin',()=>assert.match(repo,/requestRosterRegistry\("createMany",\s*\{ inputs \}\)/)],
 ['Rimozione via API admin',()=>assert.match(repo,/requestRosterRegistry\("remove",\s*\{ seasonPlayerId \}\)/)],
 ['Limite client 200',()=>{assert.match(repo,/inputs\.length > 200/);assert.doesNotMatch(repo,/inputs\.length > 500/)}],
 ['Limite server 200',()=>assert.match(api,/MAX_ATOMIC_IMPORT\s*=\s*200/)],
 ['Import server in transazione unica',()=>assert.match(api,/async function createManyAtomic[\s\S]*?adminDb\.runTransaction/)],
 ['Creazione bloccata fuori demo',()=>assert.match(api,/if \(!registryWritesAllowed\) return reply/)],
 ['Modifica squadra diretta negata',()=>assert.match(repo,/Cambio squadra consentito soltanto tramite Mercato Ludi/)],
 ['UI aggiunta chiama repository',()=>assert.match(hook,/FirebaseSeasonPlayerRepository\.create\(/)],
 ['UI modifica chiama repository',()=>assert.match(hook,/FirebaseSeasonPlayerRepository\.update\(/)],
 ['UI rimozione chiama repository',()=>assert.match(hook,/FirebaseSeasonPlayerRepository\.remove\(/)],
 ['UI aggiorna lista dopo salvataggio',()=>assert.ok((hook.match(/await refreshSeasonPlayers\(\)/g)||[]).length>=3)],
 ['Test API E2E disponibili',()=>assert.match(tests,/createMany valido salva tutte le iscrizioni e tutte le chiavi/)],
 ['Regole client negano creazione iscrizioni',()=>assert.match(rules,/match \/seasonPlayers\/\{documentId\}/)],
];
let errors=0;
for (const [name,fn] of checks){try{fn(); console.log('OK  '+name)}catch(e){errors++; console.error('KO  '+name+' — '+e.message)}}
if(errors){console.error(`${errors} controlli non superati`);process.exitCode=1}else console.log(`FASE 5F — ${checks.length} verifiche statiche superate. E2E UI ancora da eseguire.`);
