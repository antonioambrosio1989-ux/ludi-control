/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { selectEligibleInstallations, classifyFcmFailure, remainingInstallations } = require("./push-helpers");

test("sends only to active admin with enabled pushes", () => {
  const result = selectEligibleInstallations({
    adminUids: ["active", "off"], settings: [{ notificationsEnabled: true }, { notificationsEnabled: false }],
    installations: [
      { uid: "active", fid: "a" }, { uid: "active", fid: "a" },
      { uid: "off", fid: "b" }, { uid: "ordinaryUser", fid: "c" },
      { uid: "active", fid: "d" },
    ],
  });
  assert.deepEqual(result, [{ uid: "active", fid: "a" }, { uid: "active", fid: "d" }]);
});

test("invalid tokens are terminal; transient and unknown failures retry", () => {
  assert.equal(classifyFcmFailure("messaging/registration-token-not-registered"), "permanent");
  assert.equal(classifyFcmFailure("messaging/invalid-registration-token"), "permanent");
  assert.equal(classifyFcmFailure("messaging/unavailable"), "retry");
  assert.equal(classifyFcmFailure(undefined), "retry");
});

test("retries only unfinished token deliveries", () => {
  const eligible = [{ fid: "a" }, { fid: "b" }, { fid: "c" }];
  const pending = remainingInstallations(eligible, new Set(["a"]), new Set(["c"]), x => x);
  assert.deepEqual(pending, [{ fid: "b" }]);
});
