"use client";
/* La callback asincrona sincronizza lo stato con il turno remoto. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, LockKeyhole, ShieldCheck, Skull, Trophy } from "lucide-react";
import Image from "next/image";
import AppShell from "@/components/ui/AppShell";
import { currentRomeDateTimeKey } from "@/src/services/games/survivor/SurvivorTime";
import TeamLogo from "@/components/common/TeamLogo";
import { useAuth } from "@/src/hooks/useAuth";
import type { SurvivorRuntime } from "@/src/types/GamesSurvivor";

const DEMO_SURVIVOR_RUNTIME: SurvivorRuntime = {
  gameId: "demo-survivor",
  competitionId: "league-one",
  competitionName: "League One",
  seasonId: "2025-26",
  seasonName: "2025/26",
  matchweek: 4,
  closesAtLabel: "2026-09-21 20:30",
  isLocked: false,
  canEdit: true,
  status: "active",
  matches: [
    { id: "surv-1", homeTeamId: "ludi", homeTeamName: "Ludi FC", awayTeamId: "vesuvio", awayTeamName: "Real Vesuvio", date: "2026-09-21", time: "20:30" },
    { id: "surv-2", homeTeamId: "atletico", homeTeamName: "Atletico Partenope", awayTeamId: "sporting", awayTeamName: "Sporting Napoli", date: "2026-09-21", time: "21:30" },
    { id: "surv-3", homeTeamId: "blue", homeTeamName: "Blue Lions", awayTeamId: "phoenix", awayTeamName: "Phoenix United", date: "2026-09-22", time: "20:30" },
  ],
  choice: null,
  usedTeamIds: ["vesuvio", "blue"],
};

export default function SurvivorGameScreen({ gameId, demoMode = false }: { gameId: string; demoMode?: boolean }) {
  const { user } = useAuth();
  const [runtime, setRuntime] = useState<SurvivorRuntime | null>(demoMode ? DEMO_SURVIVOR_RUNTIME : null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!demoMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [
    romeNowKey,
    setRomeNowKey,
  ] =
    useState(
      () =>
        currentRomeDateTimeKey(),
    );

  const localTimeLocked =
    Boolean(
      !demoMode &&
      runtime &&
      romeNowKey >=
        runtime.closesAtLabel,
    );

  const effectiveCanEdit =
    Boolean(
      runtime?.canEdit &&
      !localTimeLocked,
    );

  const request = useCallback(async (init?: RequestInit) => {
    if (!user) throw new Error("Accedi per partecipare al Survivor.");
    const response = await fetch(`/api/games/survivor/${gameId}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}`, ...init?.headers },
    });
    const value = await response.json() as { runtime?: SurvivorRuntime; error?: string };
    if (!response.ok) throw new Error(value.error || "Operazione non riuscita.");
    return value;
  }, [gameId, user]);

  const load = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const value = await request();
      if (value.runtime) {
        setRuntime(value.runtime);
        setSelectedTeamId(value.runtime.choice?.teamId ?? null);
      }
    } catch (current) { setError(current instanceof Error ? current.message : "Impossibile caricare il Survivor."); }
    finally { if (!silent) setLoading(false); }
  }, [request, user]);

  useEffect(() => { if (demoMode) { setLoading(false); return; } void load(); }, [demoMode, load]);
  useEffect(() => {
    if (demoMode) return;

    const syncClock = () => {
      setRomeNowKey(
        currentRomeDateTimeKey(),
      );
    };

    syncClock();

    const interval =
      window.setInterval(
        syncClock,
        15_000,
      );

    return () =>
      window.clearInterval(
        interval,
      );
  }, [demoMode]);

  useEffect(() => {
    if (
      demoMode ||
      !runtime ||
      runtime.isLocked ||
      !localTimeLocked
    ) {
      return;
    }

    /*
     * Al raggiungimento del cutoff blocchiamo subito la UI e
     * riallineiamo silenziosamente lo stato con il server.
     */
    void load(true);
  }, [
    demoMode,
    load,
    localTimeLocked,
    runtime,
  ]);

  useEffect(() => {
    if (demoMode || (!runtime?.isLocked && runtime?.status !== "waiting_result")) return;
    const interval = window.setInterval(() => { void load(true); }, 30_000);
    return () => window.clearInterval(interval);
  }, [demoMode, load, runtime?.isLocked, runtime?.status]);

  async function saveChoice() {
    if (!runtime || !selectedTeamId || !effectiveCanEdit || saving) return;
    setSaving(true); setError(null);
    try {
      if (demoMode) {
        const match = runtime.matches.find((item) => item.homeTeamId === selectedTeamId || item.awayTeamId === selectedTeamId);
        const teamName = match?.homeTeamId === selectedTeamId ? match.homeTeamName : match?.awayTeamName ?? "Squadra";
        setRuntime((current) => current ? {
          ...current,
          choice: { matchweek: current.matchweek, matchId: match?.id ?? "demo", teamId: selectedTeamId, teamName },
        } : current);
        return;
      }
      await request({ method: "POST", body: JSON.stringify({ teamId: selectedTeamId }) });
      await load(true);
    } catch (current) { setError(current instanceof Error ? current.message : "Salvataggio non riuscito."); }
    finally { setSaving(false); }
  }

  const hasChanges = selectedTeamId !== (runtime?.choice?.teamId ?? null);
  return <AppShell>
    <main className="min-h-screen bg-white pb-28">
    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
        Ludi Games
      </p>

      <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
        Ludi Survivor
      </h1>

      <p className="mt-1 text-sm font-bold text-[#06142E]/50">
        Sopravvivi al turno!
      </p>
    {loading ? <Message>Caricamento turno...</Message> : error && !runtime ? <Message error>{error}</Message> : runtime ? <>
      <div className="mt-4 flex items-justify gap-3 rounded-[18px] bg-[#F5F5F2] p-3">
        <Clock3 size={20} className="shrink-0 text-[#0B5FFF]" />
        <div>
            <p className="mt-1 text-[10px] font-black text-[#06142E]/45">Scelta modificabile fino al {formatKickoff(runtime.closesAtLabel)}
            </p>
            </div>
            </div>
      <div className="mt-3 overflow-hidden rounded-[18px]">
        <Image
          src="/games/league-one-survivor-premio.png"
          alt="Premio League One Survivor: pizza per 2 persone presso la pizzeria Zero Assoluto"
          width={988}
          height={178}
          className="h-auto w-full"
          priority={false}
        />
      </div>
      <StatusCard runtime={runtime} />
      {error ? <Message error>{error}</Message> : null}
      <div className="mt-5 space-y-4">{runtime.matches.map((match) => <article key={match.id} className="rounded-[21px] border border-[#06142E]/10 bg-white p-4 shadow-[0_10px_28px_rgba(6,20,46,0.07)]">
        <p className="text-[9px] font-black uppercase text-[#06142E]/30">{formatMatchDate(match.date, match.time)}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <TeamChoice name={match.homeTeamName} logoUrl={match.homeTeamLogoUrl} used={runtime.usedTeamIds.includes(match.homeTeamId)} selected={selectedTeamId === match.homeTeamId} disabled={!effectiveCanEdit} onClick={() => setSelectedTeamId(match.homeTeamId)} />
          <TeamChoice name={match.awayTeamName} logoUrl={match.awayTeamLogoUrl} used={runtime.usedTeamIds.includes(match.awayTeamId)} selected={selectedTeamId === match.awayTeamId} disabled={!effectiveCanEdit} onClick={() => setSelectedTeamId(match.awayTeamId)} />
        </div>
      </article>)}</div>
      {effectiveCanEdit ? <button type="button" disabled={!selectedTeamId || !hasChanges || saving || runtime.usedTeamIds.includes(selectedTeamId)} onClick={() => void saveChoice()} className="mt-5 min-h-14 w-full rounded-[15px] bg-[#0B5FFF] px-4 text-sm font-black uppercase text-white disabled:opacity-35">{saving ? "Salvataggio..." : runtime.choice ? "Aggiorna scelta" : "Conferma scelta"}</button> : null}
      <section className="mt-6 rounded-[22px] bg-[#F5F5F2] p-3"><h2 className="text-xl font-black uppercase text-[#06142E]">Regolamento</h2><div className="mt-3 space-y-3 text-sm font-bold leading-5 text-[#06142E]/55"><p>Scegli una squadra che pensi possa vincere questo turno: se vince passi al turno successivo, se perde o pareggia vieni eliminato.</p><p>Non puoi utilizzare due volte la stessa squadra.</p><p>Puoi cambiare scelta fino all’inizio della prima partita della Matchweek.</p><p>Una gara rinviata o annullata ti fa superare il turno senza consumare la squadra.</p><p>ATTENZIONE! Se non scegli entro la scadenza vieni eliminato.</p></div></section>
    </> : null}
  </main></AppShell>;
}

function TeamChoice({ name, logoUrl, used, selected, disabled, onClick }: { name: string; logoUrl?: string; used: boolean; selected: boolean; disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled || used} onClick={onClick} className={`relative min-h-20 rounded-[15px] border-2 p-3 text-center text-xs font-black uppercase ${used ? "border-transparent bg-[#F5F5F2] text-[#06142E]/25" : selected ? "border-[#0B5FFF] bg-blue-50 text-[#0B5FFF]" : "border-transparent bg-[#F5F5F2] text-[#06142E]"} disabled:cursor-default`}>
    <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center ${used ? "opacity-35 grayscale" : ""}`}>
      {logoUrl?.trim() ? <TeamLogo logoUrl={logoUrl} teamName={name} size={40} /> : <ShieldCheck size={24} />}
    </div>
    {name}
    {used ? <span className="mt-1 block text-[8px]">Già utilizzata</span> : selected ? <CheckCircle2 size={15} className="absolute right-2 top-2" /> : null}
  </button>;
}

function StatusCard({ runtime }: { runtime: SurvivorRuntime }) {
  if (runtime.status === "winner") return <div className="mt-3 flex items-start gap-3 rounded-[18px] bg-amber-50 p-4 text-amber-800"><Trophy size={21} /><p className="text-sm font-bold">Hai vinto questa edizione del Survivor!</p></div>;
  if (runtime.status === "eliminated") return <div className="mt-3 flex items-start gap-3 rounded-[18px] bg-red-50 p-4 text-red-700"><Skull size={21} /><p className="text-sm font-bold">Sei stato eliminato dal Survivor.</p></div>;
  if (runtime.status === "waiting_result") return <div className="mt-3 flex items-start gap-3 rounded-[18px] bg-amber-50 p-4 text-amber-800"><LockKeyhole size={21} /><p className="text-sm font-bold">Scelta definitiva. In attesa del risultato della squadra selezionata.</p></div>;
  if (runtime.choice) return <div className="mt-3 flex items-start gap-3 rounded-[18px] bg-emerald-50 p-4 text-emerald-800"><CheckCircle2 size={21} /><p className="text-sm font-bold">Scelta registrata: {runtime.choice.teamName}. Puoi cambiarla fino alla scadenza.</p></div>;
  return <div className="mt-3 flex items-start gap-3 rounded-[18px] bg-blue-50 p-4 text-blue-800"><ShieldCheck size={21} /><p className="text-sm font-bold">Sei ancora in gioco. Seleziona una squadra per questo turno.</p></div>;
}

function Message({ children, error = false }: { children: React.ReactNode; error?: boolean }) { return <div className={`mt-5 rounded-[18px] p-4 text-sm font-bold ${error ? "bg-red-50 text-red-700" : "bg-[#F5F5F2] text-[#06142E]/45"}`}>{children}</div>; }
function formatKickoff(value: string) { const [date, time] = value.split(" "); return `${date.split("-").reverse().join("/")} alle ${time}`; }
function formatMatchDate(date: string, time: string) { return `${date.split("-").reverse().join("/")} · ${time}`; }
