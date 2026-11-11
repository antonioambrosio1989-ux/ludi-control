"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/ui/AppShell";
import WithdrawalUnifiedPreviewPanel from "@/components/admin/teams/WithdrawalUnifiedPreviewPanel";
import WithdrawalOfficialControls from "@/components/admin/teams/WithdrawalOfficialControls";
import { useCompetition } from "@/src/contexts/CompetitionContext";
import { useSeasonTeams } from "@/src/hooks/useSeasonTeams";
import { useTeams } from "@/src/hooks/useTeams";
import { auth } from "@/src/lib/firebase";
import type { WithdrawalFormat } from "@/src/services/withdrawal/WithdrawalRegistryRules";

type SavedConfig = {
  format: WithdrawalFormat;
  totalMatchweeks: number;
  firstReturnMatchweek: number | null;
  locked?: boolean;
};
type Registration = {
  id: string;
  teamId: string;
  effectiveMatchweek: number;
  phase: string;
  policy: string;
  state: string;
  effectsApplied?: boolean;
};
const inputClass = "w-full rounded-xl border border-[#06142E]/20 bg-white p-3 text-sm font-semibold text-[#06142E]";

export default function WithdrawalRegistryPage() {
  const { currentSeason, selectedCompetition } = useCompetition();
  const { entries } = useSeasonTeams(currentSeason?.id);
  const { teams } = useTeams();
  const seasonId = currentSeason?.id ?? "";
  const [format, setFormat] = useState<WithdrawalFormat>("single_round_robin");
  const [totalMatchweeks, setTotalMatchweeks] = useState("11");
  const [firstReturnMatchweek, setFirstReturnMatchweek] = useState("12");
  const [config, setConfig] = useState<SavedConfig | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [teamId, setTeamId] = useState("");
  const [effectiveMatchweek, setEffectiveMatchweek] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const authorizedFetch = useCallback(async (url: string, init?: RequestInit) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Accedi come amministratore.");
    const token = await currentUser.getIdToken();
    const response = await fetch(url,{...init, headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,...init?.headers},cache:"no-store"});
    const data = await response.json() as Record<string,unknown>;
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Operazione non riuscita.");
    return data;
  }, []);

  const reload = useCallback(async () => {
    if (!seasonId) return;
    const data = await authorizedFetch(`/api/admin/withdrawals?seasonId=${encodeURIComponent(seasonId)}`);
    const saved = data.config as SavedConfig | null;
    setConfig(saved);
    setRegistrations((data.registrations as Registration[] | undefined) ?? []);
    if (saved) {
      setFormat(saved.format);
      setTotalMatchweeks(String(saved.totalMatchweeks));
      setFirstReturnMatchweek(String(saved.firstReturnMatchweek ?? ""));
    }
  }, [seasonId, authorizedFetch]);

  useEffect(()=>{
    let alive = true;
    // Lo stato Firebase Auth può arrivare dopo il primo render.
    const unsubscribe = auth.onAuthStateChanged(user=>{
      if (!user || !seasonId) return;
      void reload().catch(caught=>{if(alive)setError(caught instanceof Error?caught.message:"Impossibile caricare i dati.");});
    });
    return ()=>{alive=false;unsubscribe();};
  },[reload,seasonId]);

  const configEditable = registrations.every(r =>
    (r.state === "draft_pending_activation" || r.state === "draft_cancelled") && r.effectsApplied === false
  );

  async function cancelDraft(registration: Registration) {
    if (busy || registration.state !== "draft_pending_activation" || registration.effectsApplied !== false) return;
    if (!window.confirm(`Annullare la bozza di ritiro di ${teamName(registration.teamId)}? La traccia resterà nel registro.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await authorizedFetch("/api/admin/withdrawals", { method:"POST", body:JSON.stringify({
        action:"cancel_draft", seasonId, teamId:registration.teamId,
      }) });
      await reload();
      setMessage("Bozza annullata. Nessuna conseguenza sportiva applicata.");
    } catch(caught) { setError(caught instanceof Error ? caught.message : "Annullamento non riuscito."); }
    finally { setBusy(false); }
  }

  async function submit(action:"configure"|"register_draft") {
    if (!seasonId || busy) return;
    setBusy(true);setMessage("");setError("");
    try {
      const payload = action === "configure" ? {
        action,seasonId,rules:{format,totalMatchweeks:Number(totalMatchweeks),firstReturnMatchweek:format==="single_round_robin"?null:Number(firstReturnMatchweek)}
      } : {action,seasonId,teamId,effectiveMatchweek:Number(effectiveMatchweek)};
      await authorizedFetch("/api/admin/withdrawals",{method:"POST",body:JSON.stringify(payload)});
      await reload();setConfirmed(false);
      setMessage(action === "configure" ? "Formato ufficiale salvato." : "Registrazione creata in BOZZA. Nessun effetto sportivo applicato.");
    } catch(caught) {setError(caught instanceof Error?caught.message:"Salvataggio non riuscito.");}
    finally {setBusy(false);}
  }

  const activeEntries = entries.filter(entry=>entry.status === "active");
  const teamName = (id:string)=>teams.find(t=>String(t.id)===id)?.name ?? id;
  const effectiveWeekNumber = Number(effectiveMatchweek);
  const prospectivePhase = config && Number.isInteger(effectiveWeekNumber) && effectiveWeekNumber >= 1 && effectiveWeekNumber <= config.totalMatchweeks
    ? config.format === "double_round_robin" && effectiveWeekNumber >= (config.firstReturnMatchweek ?? Infinity)
      ? "Ritorno: risultati precedenti validi, tavolini progressivi" : "Andata / sola andata: annullamento completo"
    : "Indica una giornata valida";

  return <AppShell>
    <main className="mx-auto max-w-3xl space-y-5 pb-12">
      <header><p className="text-xs font-black uppercase tracking-widest text-[#06142E]/50">Centro di controllo</p>
        <h1 className="mt-1 text-2xl font-black text-[#06142E]">Registro ritiri — configurazione</h1>
        <p className="mt-2 text-sm text-[#06142E]/60">{selectedCompetition?.name ?? "Competizione"} · {currentSeason?.name ?? "Nessuna stagione selezionata"}</p>
      </header>
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
        Ritiri ufficiali nel girone di ritorno: attivazione controllata e tavolini 6â€“0 soltanto dopo chiusura verificata. Le bozze non producono effetti.
      </div>
      {!seasonId ? <p>Nessuna stagione attiva selezionata.</p> : <>
        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-black text-[#06142E]">1. Formula ufficiale della stagione</h2>
          <label className="block text-sm font-semibold">Formato
            <select className={inputClass} value={format} disabled={busy||!configEditable} onChange={e=>setFormat(e.target.value as WithdrawalFormat)}>
              <option value="single_round_robin">Sola andata</option><option value="double_round_robin">Andata e ritorno</option>
            </select></label>
          <label className="block text-sm font-semibold">Giornate totali
            <input className={inputClass} type="number" min={1} max={100} value={totalMatchweeks} disabled={busy||!configEditable} onChange={e=>setTotalMatchweeks(e.target.value)}/></label>
          {format === "double_round_robin" && <label className="block text-sm font-semibold">Prima giornata del girone di ritorno
            <input className={inputClass} type="number" min={2} max={100} value={firstReturnMatchweek} disabled={busy||!configEditable} onChange={e=>setFirstReturnMatchweek(e.target.value)}/></label>}
          {!configEditable ? <p className="text-sm font-semibold text-amber-800">Configurazione bloccata: esiste un ritiro applicato o uno stato non modificabile.</p>
            : registrations.some(r=>r.state==="draft_pending_activation") && <p className="text-sm font-semibold text-amber-800">Puoi modificare la formula: le bozze attive saranno rivalidate automaticamente prima del salvataggio.</p>}
          <button type="button" disabled={busy||!configEditable} onClick={()=>void submit("configure")}
            className="rounded-xl bg-[#06142E] px-4 py-3 text-sm font-black text-white disabled:opacity-40">Salva formato ufficiale</button>
        </section>
        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-black text-[#06142E]">2. Registra il ritiro come bozza</h2>
          <label className="block text-sm font-semibold">Squadra iscritta e attiva
            <select className={inputClass} value={teamId} disabled={busy||!config} onChange={e=>{setTeamId(e.target.value);setConfirmed(false);}}>
              <option value="">Seleziona squadra</option>
              {activeEntries.filter(e=>!registrations.some(r=>r.teamId===e.teamId && r.state!=="draft_cancelled")).map(e=><option key={e.teamId} value={e.teamId}>{teamName(e.teamId)}</option>)}
            </select></label>
          <label className="block text-sm font-semibold">Giornata effettiva del ritiro
            <input className={inputClass} type="number" min={1} max={config?.totalMatchweeks ?? 100} value={effectiveMatchweek} disabled={busy||!config} onChange={e=>{setEffectiveMatchweek(e.target.value);setConfirmed(false);}}/></label>
          <p className="rounded-lg bg-slate-100 p-3 text-sm font-semibold">Conseguenza prevista: {prospectivePhase}</p>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={!config||busy}/>
            Confermo che squadra e giornata sono state verificate. Questa operazione salva soltanto una bozza amministrativa.</label>
          <button type="button" disabled={busy||!config||!teamId||!confirmed||!Number.isInteger(effectiveWeekNumber)||effectiveWeekNumber<1||effectiveWeekNumber>config.totalMatchweeks}
            onClick={()=>void submit("register_draft")}
            className="rounded-xl bg-[#06142E] px-4 py-3 text-sm font-black text-white disabled:opacity-40">Registra bozza (nessun effetto sportivo)</button>
        </section>
        <section className="space-y-2 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-black text-[#06142E]">3. Registro ritiri</h2>
          {registrations.length===0?<p className="text-sm text-slate-500">Nessuna registrazione.</p>:
            registrations.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 text-sm">
              <p><strong>{teamName(r.teamId)}</strong> · Giornata {r.effectiveMatchweek} · {r.policy==="void_all"?"Annullamento":"Tavolini progressivi"} · <strong>{r.state === "draft_cancelled" ? "BOZZA ANNULLATA" : r.state === "draft_pending_activation" ? "BOZZA" : "STATO DA VERIFICARE"}</strong></p>
              {r.state === "draft_pending_activation" && r.effectsApplied === false && <button type="button" disabled={busy} onClick={()=>void cancelDraft(r)} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-40">Annulla bozza</button>}
              {r.state === "draft_pending_activation" && r.effectsApplied === false && <WithdrawalUnifiedPreviewPanel key={`${seasonId}:${r.teamId}:${r.effectiveMatchweek}`} seasonId={seasonId} teamId={r.teamId} teamName={teamName(r.teamId)} effectiveMatchweek={r.effectiveMatchweek} />}
              {r.policy === 'retain_and_walkover' && (r.state === 'draft_pending_activation' || (r.state === 'active' && r.effectsApplied === true)) && <WithdrawalOfficialControls seasonId={seasonId} teamId={r.teamId} teamName={teamName(r.teamId)} effectiveMatchweek={r.effectiveMatchweek} onChanged={reload} />}
            </div>)}
        </section>
      </>}
      {message && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-800">{message}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</p>}
    </main>
  </AppShell>;
}
