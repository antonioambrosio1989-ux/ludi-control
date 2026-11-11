import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/src/lib/firebaseAdmin";
import { calculateWithdrawalPolicy, validateWithdrawalConfig, canEditWithdrawalConfig, isWithdrawalDraft } from "@/src/services/withdrawal/WithdrawalRegistryRules";

export const runtime = "nodejs";
const validId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(value);
const fail = (message: string, status = 400) => NextResponse.json({error:message}, {status, headers:{"Cache-Control":"no-store"}});
const good = (data: object) => NextResponse.json(data, {headers:{"Cache-Control":"no-store"}});

async function requireAdmin(request: NextRequest): Promise<string | null> {
  const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!bearer) return null;
  try {
    const uid = (await adminAuth.verifyIdToken(bearer, true)).uid;
    const snapshot = await adminDb.collection("admins").doc(uid).get();
    return snapshot.exists && snapshot.data()?.active === true ? uid : null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  try {
    const uid = await requireAdmin(request);
    if (!uid) return fail("Accesso amministratore richiesto.",403);
    const seasonId = request.nextUrl.searchParams.get("seasonId");
    if (!validId(seasonId)) return fail("Stagione non valida.");
    const seasonRef = adminDb.collection("seasons").doc(seasonId);
    const [season, config, registrations] = await Promise.all([
      seasonRef.get(), seasonRef.collection("withdrawalSettings").doc("official").get(),
      seasonRef.collection("withdrawalRegistrations").get(),
    ]);
    if (!season.exists) return fail("Stagione inesistente.",404);
    return good({ok:true,config:config.exists ? config.data() : null,
      registrations:registrations.docs.map(d=>({id:d.id,...d.data()}))});
  } catch (error) {
    console.error("Withdrawal registry GET",error); return fail("Impossibile leggere il registro.",500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = await requireAdmin(request);
    if (!uid) return fail("Accesso amministratore richiesto.",403);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail("Dati non validi.");
    const data = body as Record<string,unknown>;
    if (!validId(data.seasonId)) return fail("Stagione non valida.");
    const seasonId = data.seasonId;
    const seasonRef = adminDb.collection("seasons").doc(seasonId);
    const configRef = seasonRef.collection("withdrawalSettings").doc("official");

    if (data.action === "configure") {
      const rules = validateWithdrawalConfig(data.rules);
      await adminDb.runTransaction(async tx=>{
        const registrationsRef = seasonRef.collection("withdrawalRegistrations");
        const [season, oldConfig, registrations] = await Promise.all([
          tx.get(seasonRef), tx.get(configRef), tx.get(registrationsRef),
        ]);
        if (!season.exists || season.data()?.status === "completed") throw new Error("Stagione inesistente o completata.");
        const records = registrations.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (!canEditWithdrawalConfig(records)) {
          throw new Error("Configurazione bloccata: esiste un ritiro applicato o in uno stato non modificabile.");
        }
        // Una modifica del formato non deve lasciare bozze con regole obsolete.
        for (const registration of registrations.docs) {
          const data = registration.data();
          if (!isWithdrawalDraft(data)) continue;
          const policy = calculateWithdrawalPolicy(rules, data.effectiveMatchweek);
          tx.update(registration.ref, {
            ...policy, formatSnapshot: rules,
            updatedAt: FieldValue.serverTimestamp(), updatedBy: uid,
          });
        }
        tx.set(configRef, {
          ...rules, locked: false, updatedBy: uid, updatedAt: FieldValue.serverTimestamp(),
          createdAt: oldConfig.exists ? oldConfig.data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        }, {merge:true});
      });
      return good({ok:true});
    }
    if (data.action === "register_draft") {
      if (!validId(data.teamId)) return fail("Squadra non valida.");
      if (!Number.isSafeInteger(data.effectiveMatchweek)) return fail("Giornata non valida.");
      const teamId = data.teamId;
      const effectiveMatchweek = data.effectiveMatchweek as number;
      const entryRef = seasonRef.collection("teamEntries").doc(teamId);
      const withdrawalRef = seasonRef.collection("withdrawalRegistrations").doc(teamId);
      const result = await adminDb.runTransaction(async tx=>{
        const [season,config,entry,existing] = await Promise.all([
          tx.get(seasonRef),tx.get(configRef),tx.get(entryRef),tx.get(withdrawalRef),
        ]);
        if (!season.exists || season.data()?.status !== "active") throw new Error("La stagione deve essere attiva.");
        if (!entry.exists || entry.data()?.status !== "active") throw new Error("Squadra non attiva nella stagione.");
        if (!config.exists) throw new Error("Salva prima il formato ufficiale della stagione.");
        if (existing.exists && (existing.data()?.state !== "draft_cancelled" || existing.data()?.effectsApplied !== false)) {
          throw new Error("Esiste già una registrazione non annullata per questa squadra.");
        }
        const rules = validateWithdrawalConfig(config.data());
        const policy = calculateWithdrawalPolicy(rules,effectiveMatchweek);
        const now = FieldValue.serverTimestamp();
        const newRecord = {seasonId,teamId,effectiveMatchweek,...policy,formatSnapshot:rules,
          state:"draft_pending_activation",effectsApplied:false,createdBy:uid,createdAt:now,updatedAt:now};
        if (existing.exists) {
          const auditRef = withdrawalRef.collection("audit").doc();
          tx.set(withdrawalRef,{...newRecord,cancelledBy:FieldValue.delete(),cancelledAt:FieldValue.delete()},{merge:true});
          tx.create(auditRef,{action:"reopen_draft",seasonId,teamId,performedBy:uid,createdAt:now});
        } else {
          tx.create(withdrawalRef,newRecord);
        }
        return policy;
      });
      return good({ok:true,...result,state:"draft_pending_activation",effectsApplied:false});
    }
    if (data.action === "cancel_draft") {
      if (!validId(data.teamId)) return fail("Squadra non valida.");
      const teamId = data.teamId;
      const withdrawalRef = seasonRef.collection("withdrawalRegistrations").doc(teamId);
      const auditRef = withdrawalRef.collection("audit").doc();
      await adminDb.runTransaction(async tx => {
        const [season, registration] = await Promise.all([tx.get(seasonRef), tx.get(withdrawalRef)]);
        if (!season.exists || season.data()?.status === "completed") throw new Error("Stagione non disponibile.");
        if (!registration.exists || !isWithdrawalDraft(registration.data())) {
          throw new Error("La bozza non esiste oppure non può più essere annullata.");
        }
        const previous = registration.data() ?? {};
        const changedAt = FieldValue.serverTimestamp();
        tx.update(withdrawalRef, {
          state: "draft_cancelled", effectsApplied: false,
          cancelledBy: uid, cancelledAt: changedAt, updatedAt: changedAt,
        });
        tx.create(auditRef, {
          action: "cancel_draft", teamId, seasonId, previousState: previous.state,
          performedBy: uid, createdAt: changedAt,
        });
      });
      return good({ ok: true, state: "draft_cancelled", effectsApplied: false });
    }
    return fail("Azione non riconosciuta.");
  } catch (error) {
    console.error("Withdrawal registry POST",error);
    return fail(error instanceof Error ? error.message : "Operazione non riuscita.",400);
  }
}
