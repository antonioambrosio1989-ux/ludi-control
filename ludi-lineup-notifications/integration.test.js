/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const crypto = require("node:crypto");

// This harness loads the actual Cloud Function callbacks but replaces every
// Firebase SDK boundary with an in-memory fake. It NEVER contacts Firebase.
function harness(seed = {}, responses = []) {
  const records = new Map(Object.entries(seed).map(([key, val]) => [key, structuredClone(val)]));
  const sent = [];
  const calls = { multicast: 0 };
  const SERVER_TIMESTAMP = Symbol("serverTimestamp");
  class ArrayUnion { constructor(values) { this.values = values; } }
  const FieldValue = { serverTimestamp: () => SERVER_TIMESTAMP, arrayUnion: (...values) => new ArrayUnion(values) };
  function resolveValue(oldValue, nextValue) {
    if (nextValue === SERVER_TIMESTAMP) return "FAKE_TIMESTAMP";
    if (nextValue instanceof ArrayUnion) return [...new Set([...(Array.isArray(oldValue) ? oldValue : []), ...nextValue.values])];
    if (Array.isArray(nextValue)) return nextValue;
    if (nextValue && typeof nextValue === "object") {
      const out = { ...(oldValue && typeof oldValue === "object" ? oldValue : {}) };
      for (const [key, value] of Object.entries(nextValue)) out[key] = resolveValue(out[key], value);
      return out;
    }
    return nextValue;
  }
  function snapshot(key) {
    const data = records.get(key);
    return { id: key.split("/").at(-1), exists: data !== undefined, data: () => data, get: name => data?.[name], ref: doc(key) };
  }
  function doc(key) {
    return {
      id: key.split("/").at(-1),
      path: key,
      get: async () => snapshot(key),
      update: async patch => { if (!records.has(key)) throw new Error(`Document missing: ${key}`); records.set(key, resolveValue(records.get(key), patch)); },
      collection: name => collection(`${key}/${name}`),
    };
  }
  function queryCollection(prefix, filters) {
    return {
      where: (field, op, value) => queryCollection(prefix, [...filters, [field, op, value]]),
      get: async () => ({ docs: [...records.keys()].filter(key => {
        if (!key.startsWith(`${prefix}/`) || key.slice(prefix.length + 1).includes("/")) return false;
        const data = records.get(key);
        return filters.every(([field, op, value]) => op === "==" && data?.[field] === value);
      }).map(snapshot) }),
    };
  }
  function collection(prefix) { return { ...queryCollection(prefix, []), doc: id => doc(`${prefix}/${id}`) }; }
  const db = { collection, runTransaction: async fn => fn({ get: ref => ref.get(), set: (ref, patch, opts) => records.set(ref.path, opts?.merge ? resolveValue(records.get(ref.path) || {}, patch) : resolveValue({}, patch)), update: (ref, patch) => { if (!records.has(ref.path)) throw new Error(`Document missing: ${ref.path}`); records.set(ref.path, resolveValue(records.get(ref.path), patch)); } }) };
  const messaging = { sendEachForMulticast: async payload => {
    calls.multicast++;
    sent.push(payload);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    const results = next || payload.tokens.map(() => ({ success: true }));
    assert.equal(results.length, payload.tokens.length);
    return { responses: results };
  } };
  const originalLoad = Module._load;
  const target = path.resolve(__dirname, "index.js");
  const mocks = {
    "firebase-functions/v2/firestore": { onDocumentCreated: (_config, callback) => callback },
    "firebase-admin/app": { initializeApp: () => ({}), getApps: () => [] },
    "firebase-admin/firestore": { getFirestore: () => db, FieldValue },
    "firebase-admin/messaging": { getMessaging: () => messaging },
  };
  let actual;
  try {
    Module._load = function(request, parent, isMain) { if (Object.hasOwn(mocks, request)) return mocks[request]; return originalLoad.apply(this, arguments); };
    delete require.cache[require.resolve(target)];
    actual = require(target);
  } finally { Module._load = originalLoad; delete require.cache[require.resolve(target)]; }
  return { records, sent, calls, functions: actual, event: (id, data) => ({ params: { suggestionId: id, editId: id }, data: { data: () => data } }) };
}
const base = {
  "admins/adminA": { active: true }, "admins/adminB": { active: false },
  "users/adminA/settings/preferences": { notificationsEnabled: true },
  "users/adminB/settings/preferences": { notificationsEnabled: true },
  "pushInstallations/a": { uid: "adminA", fid: "TOKEN_A" },
  "pushInstallations/b": { uid: "adminB", fid: "TOKEN_B" },
  "pushInstallations/c": { uid: "regularUser", fid: "TOKEN_C" },
};
const suggestion = { status: "pending", name: "Auricchio Antonio", teamName: "Oxford", seasonId: "season1", teamId: "oxford" };
function hash(token) { return crypto.createHash("sha256").update(token).digest("hex"); }

test("new suggestion notifies only active subscribed administrators, then deduplicates", async () => {
  const h = harness(base);
  await h.functions.notifyNewLineupRosterSuggestion(h.event("s1", suggestion));
  assert.equal(h.calls.multicast, 1);
  assert.deepEqual(h.sent[0].tokens, ["TOKEN_A"]);
  assert.match(h.sent[0].data.body, /Oxford: Auricchio Antonio/);
  assert.equal(h.sent[0].data.notificationId, "s1");
  assert.equal(h.records.get("lineupSuggestionPushDeliveries/s1").status, "completed");
  await h.functions.notifyNewLineupRosterSuggestion(h.event("s1", suggestion));
  assert.equal(h.calls.multicast, 1);
});

test("transient FCM failure retries without resending completed recipient", async () => {
  const seed = { ...base, "pushInstallations/d": { uid: "adminA", fid: "TOKEN_D" } };
  const first = [{ success: true }, { success: false, error: { code: "messaging/server-unavailable" } }];
  const h = harness(seed, [first, [{ success: true }]]);
  await assert.rejects(() => h.functions.notifyNewLineupRosterSuggestion(h.event("s2", suggestion)), /temporaneamente falliti/);
  assert.equal(h.records.get("lineupSuggestionPushDeliveries/s2").status, "retry_pending");
  assert.deepEqual(h.records.get("lineupSuggestionPushDeliveries/s2").deliveredTokenHashes, [hash("TOKEN_A")]);
  await h.functions.notifyNewLineupRosterSuggestion(h.event("s2", suggestion));
  assert.deepEqual(h.sent[1].tokens, ["TOKEN_D"]);
  assert.equal(h.records.get("lineupSuggestionPushDeliveries/s2").status, "completed");
});

test("invalid FCM token is discarded without retry", async () => {
  const h = harness(base, [[{ success: false, error: { code: "messaging/registration-token-not-registered" } }]]);
  await h.functions.notifyNewLineupRosterSuggestion(h.event("s3", suggestion));
  const state = h.records.get("lineupSuggestionPushDeliveries/s3");
  assert.equal(state.status, "completed");
  assert.deepEqual(state.discardedTokenHashes, [hash("TOKEN_A")]);
});

test("admin edit: rename leaves pending; approval closes; unrelated record stays untouched", async () => {
  const h = harness({
    "lineupRosterSuggestions/s1": { ...suggestion, matchId: "match1", guestId: "guest1" },
    "lineupRosterSuggestions/s2": { ...suggestion, name: "Another Player", matchId: "match2" },
  });
  await h.functions.resolveLineupRosterSuggestion(h.event("edit1", { action: "rename_guest", seasonId: "season1", teamId: "oxford", matchId: "match1", guestId: "guest1", previousGuestName: "Auricchio Antonio", nextGuestName: "Auricchio Andrea" }));
  assert.equal(h.records.get("lineupRosterSuggestions/s1").name, "Auricchio Andrea");
  assert.equal(h.records.get("lineupRosterSuggestions/s1").status, "pending");
  await h.functions.resolveLineupRosterSuggestion(h.event("edit2", { action: "approve_guest", seasonId: "season1", teamId: "oxford", matchId: "match1", guestId: "guest1", guestName: "Auricchio Andrea" }));
  assert.equal(h.records.get("lineupRosterSuggestions/s1").status, "match_only");
  assert.equal(h.records.get("lineupRosterSuggestions/s2").status, "pending");
});

test("ambiguous name never resolves either suggestion", async () => {
  const h = harness({ "lineupRosterSuggestions/a": suggestion, "lineupRosterSuggestions/b": suggestion });
  await h.functions.resolveLineupRosterSuggestion(h.event("edit3", { action: "delete_guest", seasonId: "season1", teamId: "oxford", guestName: "Auricchio Antonio" }));
  assert.equal(h.records.get("lineupRosterSuggestions/a").status, "pending");
  assert.equal(h.records.get("lineupRosterSuggestions/b").status, "pending");
});

test("nonpending suggestion never notifies", async () => {
  const h = harness(base);
  await h.functions.notifyNewLineupRosterSuggestion(h.event("approved", { ...suggestion, status: "approved" }));
  assert.equal(h.calls.multicast, 0);
});
