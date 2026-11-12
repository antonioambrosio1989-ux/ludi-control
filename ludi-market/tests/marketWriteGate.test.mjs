import test from "node:test";
import assert from "node:assert/strict";
import {marketWritesAllowed} from "../src/marketWriteGate.ts";

const demo = {GCLOUD_PROJECT:"demo-ludi-market-confirm",FIRESTORE_EMULATOR_HOST:"127.0.0.1:18082",FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:19098"};
const prod = {GCLOUD_PROJECT:"ludi-os",LUDI_MARKET_ALLOWED_PROJECT_ID:"ludi-os",LUDI_MARKET_WRITES_ENABLED:"true"};
test("demo completo abilitato",()=> assert.equal(marketWritesAllowed(demo),true));
test("demo senza Auth Emulator bloccato",()=> assert.equal(marketWritesAllowed({...demo,FIREBASE_AUTH_EMULATOR_HOST:undefined}),false));
test("demo senza Firestore Emulator bloccato",()=> assert.equal(marketWritesAllowed({...demo,FIRESTORE_EMULATOR_HOST:undefined}),false));
test("produzione non abilitata di default",()=> assert.equal(marketWritesAllowed({GCLOUD_PROJECT:"ludi-os"}),false));
test("flag errato bloccato",()=> assert.equal(marketWritesAllowed({...prod,LUDI_MARKET_WRITES_ENABLED:"TRUE"}),false));
test("ID progetto consentito mancante bloccato",()=> assert.equal(marketWritesAllowed({...prod,LUDI_MARKET_ALLOWED_PROJECT_ID:undefined}),false));
test("ID progetto differente bloccato",()=> assert.equal(marketWritesAllowed({...prod,LUDI_MARKET_ALLOWED_PROJECT_ID:"altro-progetto"}),false));
test("flag esplicito e stesso progetto consentiti",()=> assert.equal(marketWritesAllowed(prod),true));
test("produzione con Firestore Emulator bloccata",()=> assert.equal(marketWritesAllowed({...prod,FIRESTORE_EMULATOR_HOST:"localhost:18082"}),false));
test("produzione con Auth Emulator bloccata",()=> assert.equal(marketWritesAllowed({...prod,FIREBASE_AUTH_EMULATOR_HOST:"localhost:19098"}),false));
test("demo non autorizzato come progetto produzione",()=> assert.equal(marketWritesAllowed({GCLOUD_PROJECT:"demo-ludi-market-confirm",LUDI_MARKET_ALLOWED_PROJECT_ID:"demo-ludi-market-confirm",LUDI_MARKET_WRITES_ENABLED:"true"}),false));
