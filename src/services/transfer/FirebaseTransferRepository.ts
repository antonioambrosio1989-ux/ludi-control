import { doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "@/src/lib/firebase";
import { assertSeasonWritable } from "@/src/services/season/SeasonWriteGuard";
import { assertMarketDate, isCivilDate, parseMarketConfiguration } from "./MarketSeasonPolicy";
import { validateTransferRequest, type TransferRequest } from "./TransferPolicy";

export type CompleteTransferRequest = TransferRequest & {
  seasonId: string;
  seasonPlayerId: string;
  seasonStartDate: string;
};

/**
 * Compatibilita API: il nome resta legacy, ma la policy e per stagione.
 * Solo la Cloud Function puo scrivere su rose e storico trasferimenti.
 * La produzione rimane disabilitata anche nella Cloud Function.
 */
export async function commitChampionshipTransfer(input: CompleteTransferRequest): Promise<string> {
  validateTransferRequest(input);
  if (!input.seasonId?.trim() || !input.seasonPlayerId?.trim() || !isCivilDate(input.seasonStartDate)) {
    throw new Error("Stagione, iscrizione e data di avvio obbligatorie.");
  }
  if (input.effectiveDate <= input.seasonStartDate) {
    throw new Error("Il trasferimento deve essere successivo all'inizio della stagione.");
  }

  // Fail-closed. Questa chiamata e riservata al progetto demo con emulatori.
  const emulatorOnly = process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "demo-ludi-market-confirm";
  if (!emulatorOnly) throw new Error("Conferme non abilitate fuori dall'Emulator di test.");

  await assertSeasonWritable(input.seasonId);
  const snapshot = await getDoc(doc(db, "seasons", input.seasonId));
  if (!snapshot.exists()) throw new Error("Stagione non trovata.");
  const season = snapshot.data();
  if (season.status !== "active" || season.regularSeasonClosed === true) {
    throw new Error("La stagione non e attiva oppure e gia chiusa.");
  }
  const competitionId = String(season.competitionId ?? "").trim();
  if (!competitionId) throw new Error("Competizione non associata alla stagione.");
  if (input.competitionSlug.trim().toLowerCase() !== competitionId.toLowerCase()) {
    throw new Error("Competizione della richiesta non coerente con la stagione.");
  }
  const todayRome = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  assertMarketDate(parseMarketConfiguration(season), todayRome);
  if (input.effectiveDate !== todayRome) {
    throw new Error("La data effettiva deve coincidere con la data odierna.");
  }

  const functions = getFunctions(app, "europe-west1");
  if (functions.app.options.projectId !== "demo-ludi-market-confirm") {
    throw new Error("Progetto Firebase non dimostrativo.");
  }
  const call = httpsCallable<{
    seasonId: string; seasonPlayerId: string; toTeamId: string; effectiveDate: string;
  }, { saved?: boolean; transferId?: string; reason?: string }>(functions, "confirmChampionshipTransfer");
  const result = await call({
    seasonId: input.seasonId,
    seasonPlayerId: input.seasonPlayerId,
    toTeamId: input.toTeamId,
    effectiveDate: input.effectiveDate,
  });
  if (result.data?.saved !== true || !result.data.transferId) {
    throw new Error(result.data?.reason || "Il server non ha confermato il trasferimento.");
  }
  return result.data.transferId;
}
