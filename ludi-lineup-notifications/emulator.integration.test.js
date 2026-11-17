/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const crypto = require("node:crypto");

const host = process.env.FIRESTORE_EMULATOR_HOST || "";
const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";
if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host) || !project.startsWith("demo-")) {
  throw new Error("TEST INTERROTTO: richiesti FIRESTORE_EMULATOR_HOST locale e progetto demo-; nessuna connessione produzione.");
}
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
if (!getApps().length) initializeApp({ projectId: project });
const db = getFirestore();
const sent = [];
const responses = [];
const messaging = { sendEachForMulticast: async (payload) => {
  sent.push(payload);
  const reply = responses.shift();
  if (reply instanceof Error) throw reply;
  const items = reply ?? payload.tokens.map(() => ({ success: true }));
  assert.equal(items.length, payload.tokens.length);
  return { responses: items };
}};
const modulePath = path.resolve(__dirname, "index.js");
const load = Module._load;
let functions;
try {
  Module._load = function(request, parent, main) {
    if (request === "firebase-functions/v2/firestore") {
      return { onDocumentCreated: (_config, callback) => callback };
    }
    if (request === "firebase-admin/messaging") {
      return { getMessaging: () => messaging };
    }
    return load.apply(this, arguments);
  };
  delete require.cache[require.resolve(modulePath)];
  functions = require(modulePath);
} finally { Module._load = load; }
function event(id, data, kind="suggestionId") {
  return { params: { [kind]: id }, data: { data: () => data } };
}
const suffix = `${process.pid}_${crypto.randomBytes(5).toString("hex")}`;
const seasonId = `s_${suffix}`;
const teamId = `t_${suffix}`;
const adminUid = `admin_${suffix}`;
const otherUid = `user_${suffix}`;
const base = { status: "pending", name: "Auricchio Antonio", teamName: "Oxford", seasonId, teamId };
async function put(p, value) { await db.doc(p).set(value); }
async function read(p) { const snap = await db.doc(p).get(); return snap.data(); }
async function seedUsers(extra = false) {
  await Promise.all([
    put(`admins/${adminUid}`, { active: true }),
    put(`admins/${otherUid}`, { active: false }),
    put(`users/${adminUid}/settings/preferences`, { notificationsEnabled: true }),
    put(`users/${otherUid}/settings/preferences`, { notificationsEnabled: true }),
    put(`pushInstallations/token_${suffix}_a`, { uid: adminUid, fid: `DUMMY_A_${suffix}` }),
    put(`pushInstallations/token_${suffix}_b`, { uid: otherUid, fid: `DUMMY_B_${suffix}` }),
  ]);
  if (extra) await put(`pushInstallations/token_${suffix}_c`, { uid: adminUid, fid: `DUMMY_C_${suffix}` });
}

test("Firestore Emulator: admin autorizzato, notifica e deduplica persistente", async () => {
  await seedUsers();
  const id = `one_${suffix}`;
  await put(`lineupRosterSuggestions/${id}`, base);
  await functions.notifyNewLineupRosterSuggestion(event(id, base));
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].tokens, [`DUMMY_A_${suffix}`]);
  assert.equal((await read(`lineupSuggestionPushDeliveries/${id}`)).status, "completed");
  await functions.notifyNewLineupRosterSuggestion(event(id, base));
  assert.equal(sent.length, 1);
  await db.doc(`lineupRosterSuggestions/${id}`).update({status: "approved"});
});

test("Firestore Emulator: errore temporaneo e ripresa senza rispedire ai destinatari riusciti", async () => {
  await seedUsers(true);
  const id = `retry_${suffix}`;
  responses.push([{ success: true }, { success: false, error: { code: "messaging/server-unavailable" } }]);
  await assert.rejects(() => functions.notifyNewLineupRosterSuggestion(event(id, base)), /temporaneamente falliti/);
  assert.equal((await read(`lineupSuggestionPushDeliveries/${id}`)).status, "retry_pending");
  const count = sent.length;
  await functions.notifyNewLineupRosterSuggestion(event(id, base));
  assert.equal(sent.length, count + 1);
  assert.deepEqual(sent.at(-1).tokens, [`DUMMY_C_${suffix}`]);
  assert.equal((await read(`lineupSuggestionPushDeliveries/${id}`)).status, "completed");
});

test("Firestore Emulator: modifica nome poi approvazione chiude soltanto la segnalazione corretta", async () => {
  const id = `resolve_${suffix}`;
  await put(`lineupRosterSuggestions/${id}`, { ...base, matchId: `match_${suffix}`, guestId: `guest_${suffix}` });
  await put(`lineupRosterSuggestions/unrelated_${suffix}`, { ...base, name: "Un Altro" });
  await functions.resolveLineupRosterSuggestion(event(`edit_name_${suffix}`, {
    action: "rename_guest", seasonId, teamId, matchId: `match_${suffix}`,
    guestId: `guest_${suffix}`, previousGuestName: "Auricchio Antonio", nextGuestName: "Auricchio Andrea",
  }, "editId"));
  assert.equal((await read(`lineupRosterSuggestions/${id}`)).name, "Auricchio Andrea");
  assert.equal((await read(`lineupRosterSuggestions/${id}`)).status, "pending");
  await functions.resolveLineupRosterSuggestion(event(`edit_approve_${suffix}`, {
    action: "approve_guest", seasonId, teamId, matchId: `match_${suffix}`,
    guestId: `guest_${suffix}`, guestName: "Auricchio Andrea",
  }, "editId"));
  assert.equal((await read(`lineupRosterSuggestions/${id}`)).status, "match_only");
  assert.equal((await read(`lineupRosterSuggestions/unrelated_${suffix}`)).status, "pending");
});

test("Firestore Emulator: segnalazioni ambigue non vengono risolte", async () => {
  const a = `ambig_a_${suffix}`, b = `ambig_b_${suffix}`;
  await put(`lineupRosterSuggestions/${a}`, base);
  await put(`lineupRosterSuggestions/${b}`, base);
  await functions.resolveLineupRosterSuggestion(event(`edit_ambig_${suffix}`, {
    action: "delete_guest", seasonId, teamId, guestName: "Auricchio Antonio",
  }, "editId"));
  assert.equal((await read(`lineupRosterSuggestions/${a}`)).status, "pending");
  assert.equal((await read(`lineupRosterSuggestions/${b}`)).status, "pending");
});
