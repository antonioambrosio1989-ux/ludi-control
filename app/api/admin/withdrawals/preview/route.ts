import { NextRequest, NextResponse } from "next/server";
import { auditWithdrawalActivation } from "@/src/services/withdrawal/WithdrawalActivationAudit";
import { classifyWithdrawalNotices, getMatchReportChecks, requiresMissingReportReview } from "@/src/services/withdrawal/WithdrawalPreviewPresentation";
import { adminAuth, adminDb } from "@/src/lib/firebaseAdmin";
import { mapMatch } from "@/src/lib/firestore/mappers/MatchDocumentMapper";
import { mapDisciplinaryRecord, mapDisciplinarySuspension } from "@/src/services/discipline/DisciplinaryFirestoreCodec";
import { buildUnifiedWithdrawalPreview } from "@/src/services/withdrawal/WithdrawalUnifiedPreview";
import { validateWithdrawalConfig } from "@/src/services/withdrawal/WithdrawalRegistryRules";
import type { WithdrawalPlayerReference } from "@/src/services/withdrawal/WithdrawalPlayerProjection";
import type { CloudMatchReport } from "@/src/services/match/FirebaseMatchReportRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(value);
const response = (payload: object, status = 200) => NextResponse.json(payload, {
  status, headers: { "Cache-Control": "private, no-store, max-age=0" },
});

/** Unica API amministrativa di consultazione. Nessuna scrittura Firestore. */
export async function GET(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!bearer) return response({ error: "Autenticazione richiesta." }, 401);
  let uid: string;
  try { uid = (await adminAuth.verifyIdToken(bearer, true)).uid; }
  catch { return response({ error: "Sessione non valida." }, 401); }
  try {
    const admin = await adminDb.collection("admins").doc(uid).get();
    if (!admin.exists || admin.data()?.active !== true) {
      return response({ error: "Permessi amministrativi insufficienti." }, 403);
    }
    const seasonId = request.nextUrl.searchParams.get("seasonId");
    const teamId = request.nextUrl.searchParams.get("teamId");
    if (!validId(seasonId) || !validId(teamId)) {
      return response({ error: "Stagione o squadra non valida." }, 400);
    }

    const seasonRef = adminDb.collection("seasons").doc(seasonId);
    const [season, configuration, registration, entries, matchesSnap, rosterSnap, recordsSnap, suspensionsSnap] = await Promise.all([
      seasonRef.get(),
      seasonRef.collection("withdrawalSettings").doc("official").get(),
      seasonRef.collection("withdrawalRegistrations").doc(teamId).get(),
      seasonRef.collection("teamEntries").get(),
      adminDb.collection("matches").where("seasonId", "==", seasonId).get(),
      adminDb.collection("seasonPlayers").where("seasonId", "==", seasonId).get(),
      adminDb.collection("disciplinaryRecords").where("seasonId", "==", seasonId).get(),
      adminDb.collection("disciplinarySuspensions").where("seasonId", "==", seasonId).get(),
    ]);
    if (!season.exists) return response({ error: "Stagione non trovata." }, 404);
    if (!configuration.exists || !registration.exists) return response({ error: "Configurazione o bozza assente." }, 404);
    const registered = registration.data() ?? {};
    if (registered.state !== "draft_pending_activation" || registered.effectsApplied !== false) {
      return response({ error: "Anteprima disponibile soltanto per bozze attive." }, 409);
    }
    const config = validateWithdrawalConfig(configuration.data());
    const week = registered.effectiveMatchweek;
    if (!Number.isSafeInteger(week)) return response({ error: "Giornata della bozza non valida." }, 409);

    const matches = matchesSnap.docs.map(doc => mapMatch(doc.id, doc.data()));
    const notes: string[] = [];
    const currentTeams = entries.docs.map(doc => String(doc.data().teamId ?? doc.id));
    if (!currentTeams.includes(teamId)) notes.push("La squadra non risulta nelle iscrizioni stagionali.");
    const expectedMatches = config.format === "double_round_robin"
      ? currentTeams.length * (currentTeams.length - 1)
      : currentTeams.length * (currentTeams.length - 1) / 2;
    const regularMatches = matches.filter(match => (match.matchType ?? "regularSeason") === "regularSeason");
    if (regularMatches.length < expectedMatches) {
      notes.push(`Calendario parziale: ${regularMatches.length} gare importate su ${expectedMatches} attese. I risultati non coprono le giornate non ancora importate.`);
    }

    // La lettura per ID include i report legacy che non riportano seasonId.
    const reports: CloudMatchReport[] = [];
    for (let i = 0; i < matches.length; i += 100) {
      const refs = matches.slice(i, i + 100).map(match => adminDb.collection("matchReports").doc(match.id));
      if (!refs.length) continue;
      const snapshots = await adminDb.getAll(...refs);
      for (const snapshot of snapshots) {
        if (!snapshot.exists) continue;
        const raw = snapshot.data() ?? {};
        if (raw.status !== "published") continue;
        const data = raw.data;
        if (!data || typeof data !== "object" || Array.isArray(data) ||
            !Array.isArray(data.homePresentPlayerIds) || !Array.isArray(data.awayPresentPlayerIds) ||
            !data.performances || typeof data.performances !== "object") {
          notes.push(`Tabellino ${snapshot.id}: dati incompleti o non riconosciuti.`);
          continue;
        }
        reports.push({
          matchId: snapshot.id, seasonId, status: "published", version: Number(raw.version ?? 1),
          data: data as CloudMatchReport["data"],
        });
      }
    }

    const role = (value: unknown): value is WithdrawalPlayerReference["role"] =>
      value === "Portiere" || value === "Difensore" || value === "Attaccante";
    const players: WithdrawalPlayerReference[] = [];
    const seen = new Set<string>();
    for (const doc of rosterSnap.docs) {
      const item = doc.data();
      const playerId = String(item.playerId ?? "");
      const rosterTeamId = String(item.teamId ?? "");
      if (!playerId || !rosterTeamId || !role(item.role)) {
        notes.push(`Iscrizione giocatore ${doc.id}: ID, squadra o ruolo mancante.`);
        continue;
      }
      if (item.status === "transferred" || item.status === "withdrawn" ||
          (Array.isArray(item.transferHistory) && item.transferHistory.length > 0)) {
        notes.push(`Giocatore ${playerId}: trasferimento/storico rosa da verificare manualmente. La proiezione usa l'assegnazione attuale.`);
      }
      if (seen.has(playerId)) {
        notes.push(`Giocatore ${playerId}: iscrizioni duplicate nella stagione; verificare i trasferimenti.`);
        continue;
      }
      seen.add(playerId);
      players.push({ playerId, teamId: rosterTeamId, role: item.role });
    }
    if (!players.length) notes.push("Nessun giocatore valido trovato nella rosa stagionale.");

    const preview = buildUnifiedWithdrawalPreview({
      seasonId, withdrawnTeamId: teamId, config, effectiveMatchweek: week,
      matches, reports, players, teamIds: currentTeams,
      disciplinaryRecords: recordsSnap.docs.map(doc => mapDisciplinaryRecord(doc.id, doc.data())),
      disciplinarySuspensions: suspensionsSnap.docs.map(doc => mapDisciplinarySuspension(doc.id, doc.data())),
    });
    const checkMatches = getMatchReportChecks(matches, new Set(reports.map(item => item.matchId)));
    const pendingOrMissingReports = checkMatches.filter(match => requiresMissingReportReview(match.status));
    if (pendingOrMissingReports.length > 0) {
      notes.push(`${pendingOrMissingReports.length} gare con stato di disputa/attività ma senza tabellino pubblicato: verifica necessaria prima di qualunque applicazione.`);
    }

    // Nomi dai documenti pubblici delle entità. Le chiavi Firestore restano sempre visibili come fallback.
    // Anche i soggetti citati solo dall'audit disciplinare devono avere un nome disponibile.
    const disciplinaryIds = [
      ...recordsSnap.docs.map(doc => String(doc.data().playerId ?? "")),
      ...suspensionsSnap.docs.map(doc => String(doc.data().playerId ?? "")),
    ].filter(Boolean);
    const playerIds = [...new Set([
      ...players.map(p => p.playerId),
      ...preview.playerChanges.map(p => p.playerId),
      ...disciplinaryIds,
    ])];
    const teamIds = [...new Set([...currentTeams, ...preview.teamChanges.map(t => t.teamId)])];
    const names = { teams: {} as Record<string,string>, players: {} as Record<string,string> };
    const loadNames = async (collectionName: "teams" | "players", ids: string[], target: Record<string,string>) => {
      for (let start = 0; start < ids.length; start += 100) {
        const chunk = ids.slice(start, start + 100).filter(validId);
        if (!chunk.length) continue;
        const snapshots = await adminDb.getAll(...chunk.map(id => adminDb.collection(collectionName).doc(id)));
        for (const snap of snapshots) {
          if (!snap.exists) continue;
          const value = snap.data() ?? {};
          const name = collectionName === "teams" ? value.name :
            [value.firstName, value.lastName].filter(part => typeof part === "string" && part.trim()).join(" ").trim();
          if (typeof name === "string" && name.trim()) target[snap.id] = name.trim();
        }
      }
    };
    await Promise.all([
      loadNames("teams", teamIds, names.teams),
      loadNames("players", playerIds, names.players),
    ]);
    const activationAudit = auditWithdrawalActivation({
      config, teamIds: currentTeams, withdrawnTeamId: teamId, matches, reports, preview,
      // Nessuno dei quattro moduli di scrittura e aggiornamento futuro è attivo.
    });
    const notices = classifyWithdrawalNotices([...notes, ...preview.issues]);
    return response({ ok: true, preview, activationAudit, warnings: [...new Set(notes)], notices, names,
      missingReportMatches: checkMatches,
      sourceCounts: { importedMatches: regularMatches.length, publishedReports: reports.length,
        seasonPlayers: rosterSnap.size, disciplinaryRecords: recordsSnap.size,
        suspensions: suspensionsSnap.size },
      readOnly: true, effectsApplied: false,
    });
  } catch (error) {
    console.error("Withdrawal unified preview GET", error);
    return response({ error: "Impossibile elaborare l'anteprima. Controllare i dati e i log del server." }, 500);
  }
}
