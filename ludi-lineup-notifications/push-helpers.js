"use strict";

/** Select only active admins who opted into notifications, one delivery per FCM token. */
function selectEligibleInstallations({ adminUids, settings, installations }) {
  const enabled = new Set(adminUids.filter((uid, i) => settings[i]?.notificationsEnabled === true));
  const selected = new Map();
  for (const installation of installations) {
    const uid = typeof installation.uid === "string" ? installation.uid.trim() : "";
    const fid = typeof installation.fid === "string" ? installation.fid.trim() : "";
    if (enabled.has(uid) && fid && !selected.has(fid)) selected.set(fid, { uid, fid });
  }
  return Array.from(selected.values());
}

/** Only intrinsically invalid tokens are terminal; other failures should be retried. */
function classifyFcmFailure(code) {
  const terminal = new Set([
    "messaging/registration-token-not-registered",
    "messaging/invalid-registration-token",
  ]);
  return terminal.has(code) ? "permanent" : "retry";
}

function remainingInstallations(eligible, deliveredHashes, discardedHashes, hashToken) {
  return eligible.filter(item => {
    const hash = hashToken(item.fid);
    return !deliveredHashes.has(hash) && !discardedHashes.has(hash);
  });
}

module.exports = { selectEligibleInstallations, classifyFcmFailure, remainingInstallations };
