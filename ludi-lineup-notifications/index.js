/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

if (!getApps().length) initializeApp();
const db = getFirestore(getApps()[0], "default");
const REGION = "europe-west1";

function string(value) {
  return typeof value === "string" ? value.trim() : "";
}
function normalized(value) {
  return string(value).toLocaleLowerCase("it")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function simpleLink() { return "/admin#manual-lineups"; }

/**
 * Delivery tracker: one document for each suggestion. Record successful
 * installations after each batch, then retry only unresolved recipients.
 * FCM and Firestore cannot form a single atomic transaction: a crash between
 * send and acknowledgement can still produce a duplicate (at-least-once).
 */
const { createHash } = require("node:crypto");
const MAX_ATTEMPTS = 5;
const LOCK_MS = 120_000;
const BATCH_SIZE = 400;
const { classifyFcmFailure, selectEligibleInstallations, remainingInstallations } = require("./push-helpers");

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}
function transientError(reason) {
  const error = new Error(reason);
  error.retryable = true;
  return error;
}

exports.notifyNewLineupRosterSuggestion = onDocumentCreated({
  document: "lineupRosterSuggestions/{suggestionId}",
  database: "default",
  region: REGION,
  retry: true,
}, async (event) => {
  if (!event.data) return;
  const data = event.data.data() || {};
  if (data.status !== "pending") return;
  const name = string(data.name);
  const team = string(data.teamName);
  const seasonId = string(data.seasonId);
  const teamId = string(data.teamId);
  if (!name || !team || !teamId || !seasonId) {
    console.warn("Segnalazione incompleta", event.params.suggestionId);
    return;
  }
  const key = event.params.suggestionId;
  const sendRef = db.collection("lineupSuggestionPushDeliveries").doc(key);
  const now = Date.now();
  // A lease prevents two concurrent function instances from sending the same
  // notification. If an instance crashes, an Eventarc retry can reclaim it.
  const claim = await db.runTransaction(async (tx) => {
    const old = await tx.get(sendRef);
    const state = old.exists ? (old.data() || {}) : {};
    if (["completed", "no_admins", "no_subscribers", "failed_exhausted"].includes(state.status)) {
      return { skip: true };
    }
    if (state.status === "processing" && Number(state.leaseUntilMs || 0) > now) {
      return { busy: true };
    }
    const attempt = Number(state.attempt || 0) + 1;
    if (attempt > MAX_ATTEMPTS) {
      tx.set(sendRef, {
        status: "failed_exhausted", updatedAt: FieldValue.serverTimestamp(),
        leaseUntilMs: 0,
      }, { merge: true });
      return { skip: true };
    }
    tx.set(sendRef, {
      status: "processing", name, seasonId, teamId, attempt,
      leaseUntilMs: now + LOCK_MS,
      updatedAt: FieldValue.serverTimestamp(),
      ...(old.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    return { attempt, delivered: new Set(state.deliveredTokenHashes || []),
      discarded: new Set(state.discardedTokenHashes || []) };
  });
  if (claim.skip) return;
  if (claim.busy) throw transientError(`Notifica ${key} ancora in elaborazione`);

  try {
    const adminSnap = await db.collection("admins").where("active", "==", true).get();
    const adminUids = Array.from(new Set(adminSnap.docs.map(doc => doc.id)));
    if (!adminUids.length) {
      await sendRef.update({ status: "no_admins", leaseUntilMs: 0,
        completedAt: FieldValue.serverTimestamp() });
      return;
    }
    const [installationSnap, ...settingsSnaps] = await Promise.all([
      db.collection("pushInstallations").get(),
      ...adminUids.map(uid => db.collection("users").doc(uid)
        .collection("settings").doc("preferences").get()),
    ]);
    const eligible = selectEligibleInstallations({
      adminUids,
      settings: settingsSnaps.map(snap => snap.data() || {}),
      installations: installationSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })),
    });
    const unsent = remainingInstallations(eligible, claim.delivered, claim.discarded, tokenHash);
    if (!eligible.length) {
      await sendRef.update({ status: "no_subscribers", leaseUntilMs: 0,
        completedAt: FieldValue.serverTimestamp() });
      return;
    }

    let attempted = 0;
    let succeeded = 0;
    let permanentlyFailed = 0;
    let retryableFailures = 0;
    for (let i = 0; i < unsent.length; i += BATCH_SIZE) {
      const batch = unsent.slice(i, i + BATCH_SIZE);
      const response = await getMessaging().sendEachForMulticast({
        tokens: batch.map(item => item.fid),
        data: {
          title: "Nuovo giocatore da verificare",
          body: `${team}: ${name}. Apri la gestione manuale formazioni.`,
          link: simpleLink(),
          category: "lineup-suggestion",
          notificationId: key,
        },
        webpush: { headers: { Urgency: "high" } },
      });
      const delivered = [];
      const discarded = [];
      response.responses.forEach((result, j) => {
        const hash = tokenHash(batch[j].fid);
        attempted++;
        if (result.success) {
          delivered.push(hash);
          succeeded++;
        } else if (classifyFcmFailure(result.error?.code) === "permanent") {
          discarded.push(hash);
          permanentlyFailed++;
        } else {
          retryableFailures++;
        }
      });
      // Record each completed batch immediately; future attempts skip these.
      const patch = { updatedAt: FieldValue.serverTimestamp() };
      if (delivered.length) patch.deliveredTokenHashes = FieldValue.arrayUnion(...delivered);
      if (discarded.length) patch.discardedTokenHashes = FieldValue.arrayUnion(...discarded);
      await sendRef.update(patch);
    }
    if (retryableFailures) {
      throw transientError(`${retryableFailures} invii temporaneamente falliti`);
    }
    await sendRef.update({ status: "completed", leaseUntilMs: 0,
      attemptedLastRun: attempted, sentLastRun: succeeded,
      permanentlyFailedLastRun: permanentlyFailed,
      completedAt: FieldValue.serverTimestamp() });
    console.info("Push segnalazione completata", { key, attempt: claim.attempt,
      attempted, succeeded, permanentlyFailed });
  } catch (error) {
    const exhausted = claim.attempt >= MAX_ATTEMPTS;
    await sendRef.update({ status: exhausted ? "failed_exhausted" : "retry_pending",
      leaseUntilMs: 0,
      lastError: String(error).slice(0, 500),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (!exhausted) throw error;
    console.error("Notifica esaurita dopo tentativi", { key, attempt: claim.attempt, error });
  }
});

/**
 * La gestione manuale scrive gia' un audit per ogni operazione.
 * Risolviamo la segnalazione soltanto se la corrispondenza e' univoca.
 * Una semplice rinomina non costituisce ancora approvazione.
 */
exports.resolveLineupRosterSuggestion = onDocumentCreated({
  document: "lineupAdminEdits/{editId}",
  database: "default",
  region: REGION,
  retry: false,
}, async (event) => {
  if (!event.data) return;
  const edit = event.data.data() || {};
  const statuses = {
    approve_guest: "match_only",
    register_lineup_guest: "approved",
    delete_guest: "dismissed",
  };
  const status = statuses[edit.action];
  const isRename = edit.action === "rename_guest";
  if (!status && !isRename) return;
  const seasonId = string(edit.seasonId);
  const teamId = string(edit.teamId);
  const name = normalized(isRename ? edit.previousGuestName : (edit.guestName || edit.previousGuestName));
  if (!seasonId || !teamId || !name) return;

  const snapshot = await db.collection("lineupRosterSuggestions")
    .where("seasonId", "==", seasonId)
    .where("teamId", "==", teamId)
    .where("status", "==", "pending").get();
  const candidates = snapshot.docs.filter(doc => {
    const item = doc.data();
    if (string(item.matchId) && string(edit.matchId) && item.matchId !== edit.matchId) return false;
    if (string(item.guestId) && string(edit.guestId) && item.guestId !== edit.guestId) return false;
    return normalized(item.name) === name;
  });
  if (candidates.length !== 1) {
    console.info("Segnalazione non risolta: corrispondenza non univoca", {
      editId: event.params.editId, candidates: candidates.length, seasonId, teamId, name,
    });
    return;
  }
  const ref = candidates[0].ref;
  await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (!current.exists || current.get("status") !== "pending") return;
    if (isRename) {
      const nextName = string(edit.nextGuestName);
      if (!nextName) return;
      tx.update(ref, { name: nextName, updatedAt: FieldValue.serverTimestamp() });
      return;
    }
    tx.update(ref, {
      status,
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedByEditId: event.params.editId,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
});
