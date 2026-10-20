import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/lib/firebase";

export type ExpectedLiveScores = {
  homeScore: number | undefined;
  awayScore: number | undefined;
};

export type LiveTransitionInput = {
  matchId: string;
  expectedStatus: "scheduled" | "live" | "finished";
  status: "live" | "finished";
  homeScore: number;
  awayScore: number;
  expectedScores?: ExpectedLiveScores;
  expectedSeasonId?: string;
};

/** One transaction per match. Other matches never participate in the write. */
export async function transitionLiveMatch({
  collectionName,
  reportsCollectionName,
  input,
}: {
  collectionName: "matches" | "finalStageMatches";
  reportsCollectionName: "matchReports" | "finalStageMatchReports";
  input: LiveTransitionInput;
}): Promise<void> {
  const id = String(input.matchId ?? "").trim();
  if (!id || id.includes("/")) throw new Error("La partita non è stata specificata correttamente.");
  if (![input.homeScore, input.awayScore].every((score) => Number.isSafeInteger(score) && score >= 0)) {
    throw new Error("Il risultato deve contenere numeri interi maggiori o uguali a zero.");
  }
  const allowed = new Set(["scheduled:live", "live:live", "live:finished", "finished:live"]);
  if (!allowed.has(`${input.expectedStatus}:${input.status}`)) {
    throw new Error("Transizione live non consentita.");
  }
  const matchRef = doc(db, collectionName, id);
  // Resolve the season reference only; all decisions are repeated in the transaction.
  const preflight = await getDoc(matchRef);
  if (!preflight.exists()) throw new Error("La partita selezionata non esiste.");
  const before = preflight.data();
  const seasonId = before.seasonId;
  if (typeof seasonId !== "string" || !seasonId.trim() || seasonId.includes("/")) {
    throw new Error("La stagione della partita non è valida.");
  }
  if (input.expectedSeasonId !== undefined && input.expectedSeasonId !== seasonId) {
    throw new Error("La partita non appartiene più alla stagione visualizzata.");
  }
  // Legacy callers also get protection for changes occurring after this preflight.
  const expected = input.expectedScores ?? {
    homeScore: before.homeScore,
    awayScore: before.awayScore,
  };
  await runTransaction(db, async (transaction) => {
    const [match, report, season] = await Promise.all([
      transaction.get(matchRef),
      transaction.get(doc(db, reportsCollectionName, id)),
      transaction.get(doc(db, "seasons", seasonId)),
    ]);
    if (!match.exists()) throw new Error("La partita selezionata non esiste.");
    const stored = match.data();
    if (stored.seasonId !== seasonId) throw new Error("La stagione della partita è cambiata. Ricarica i dati.");
    if (!season.exists() || season.data().status !== "active") {
      throw new Error("Il live è modificabile soltanto in una stagione attiva.");
    }
    const closedField = collectionName === "matches" ? "regularSeasonClosed" : "finalStageClosed";
    if (season.data()[closedField] === true) throw new Error("Questa fase della stagione è già chiusa.");
    if (stored.published !== true) throw new Error("Il live è disponibile soltanto per partite pubblicate.");
    const finalReport = report.exists() ? report.data() : undefined;
    if (finalReport?.status === "published" &&
      (finalReport.data?.status === "played" || finalReport.data?.status === "walkover")) {
      throw new Error("Il live non può essere modificato dopo la pubblicazione del tabellino finale.");
    }
    if (stored.status !== input.expectedStatus) {
      throw new Error("Lo stato della partita è cambiato. Attendi l'aggiornamento e riprova.");
    }
    if (stored.homeScore !== expected.homeScore || stored.awayScore !== expected.awayScore) {
      throw new Error("Risultato modificato da un altro operatore. Attendi l'aggiornamento e riprova.");
    }
    transaction.update(matchRef, {
      status: input.status,
      homeScore: input.homeScore,
      awayScore: input.awayScore,
      updatedAt: serverTimestamp(),
    });
  });
}
