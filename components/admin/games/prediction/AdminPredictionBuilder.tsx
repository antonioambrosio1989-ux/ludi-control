"use client";

import { useCallback, useEffect, useState } from "react";
import { Save, Target, Eye, Send } from "lucide-react";
import { useAuth } from "@/src/hooks/useAuth";
import { useCompetitions } from "@/src/hooks/useCompetitions";

type Preview = {
  seasonId: string;
  matchweek: number;
  closesAt: string;
  isClosed: boolean;
  alreadyPublished: boolean;
  matches: Array<{
    id: string;
    competitionName: string;
    homeTeamName: string;
    awayTeamName: string;
    date: string;
    time: string;
  }>;
};

type ResponseData = {
  config?: { competitionId?: string; activeMatchweek?: number } | null;
  matchweeks?: number[];
  preview?: Preview | null;
  error?: string;
};

export default function AdminPredictionBuilder({ gameId }: { gameId: string }) {
  const { user } = useAuth();
  const { activeCompetitions } = useCompetitions();
  const [competitionId, setCompetitionId] = useState("");
  const [savedCompetitionId, setSavedCompetitionId] = useState("");
  const [matchweeks, setMatchweeks] = useState<number[]>([]);
  const [matchweek, setMatchweek] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const request = useCallback(async (query = "", init?: RequestInit): Promise<ResponseData> => {
    if (!user) throw new Error("Autenticazione Admin richiesta.");
    const response = await fetch(`/api/admin/games/predictions/${encodeURIComponent(gameId)}${query}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await user.getIdToken()}`,
        ...init?.headers,
      },
      cache: "no-store",
    });
    const data = await response.json() as ResponseData;
    if (!response.ok) throw new Error(data.error || "Operazione non riuscita.");
    return data;
  }, [gameId, user]);

  useEffect(() => {
    if (!user) return;
    void request().then((data) => {
      const id = data.config?.competitionId ?? "";
      setCompetitionId(id);
      setSavedCompetitionId(id);
      setActiveWeek(data.config?.activeMatchweek ?? null);
      setMatchweeks(data.matchweeks ?? []);
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : "Errore caricamento."));
  }, [request, user]);

  async function saveConfig() {
    if (!competitionId || working) return;
    setWorking(true); setError(null); setMessage(null);
    try {
      await request("", { method: "POST", body: JSON.stringify({ competitionId, action: "configure" }) });
      const data = await request(`?competitionId=${encodeURIComponent(competitionId)}`);
      setSavedCompetitionId(competitionId);
      setMatchweeks(data.matchweeks ?? []);
      setMatchweek("");
      setPreview(null);
      setMessage("Competizione salvata. Seleziona la giornata e genera l'anteprima.");
    } catch (e) { setError(e instanceof Error ? e.message : "Salvataggio non riuscito."); }
    finally { setWorking(false); }
  }

  async function loadPreview() {
    if (!matchweek || working || competitionId !== savedCompetitionId) return;
    setWorking(true); setError(null); setMessage(null); setPreview(null);
    try {
      const data = await request(`?competitionId=${encodeURIComponent(competitionId)}&matchweek=${encodeURIComponent(matchweek)}`);
      setPreview(data.preview ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : "Impossibile generare anteprima."); }
    finally { setWorking(false); }
  }

  async function publish() {
    if (!preview || working || preview.isClosed || preview.matches.length !== 10) return;
    if (!window.confirm(`Pubblicare la schedina della Matchweek ${preview.matchweek} con 10 incontri?`)) return;
    setWorking(true); setError(null); setMessage(null);
    try {
      await request("", { method: "POST", body: JSON.stringify({
        action: "publish", competitionId, matchweek: preview.matchweek,
      }) });
      setActiveWeek(preview.matchweek);
      setPreview({ ...preview, alreadyPublished: true });
      setMessage(`Matchweek ${preview.matchweek} pubblicata. La schedina è ora quella attiva per gli utenti.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Pubblicazione non riuscita."); }
    finally { setWorking(false); }
  }

  return (
    <section className="rounded-[22px] bg-[#F5F5F2] p-5 text-[#06142E]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-white text-[#0B5FFF]"><Target size={21} /></div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#06142E]/35">Ludi Bet Club</p>
          <h2 className="mt-1 text-xl font-black uppercase">Gestione schedine</h2>
        </div>
      </div>
      <p className="mt-3 text-xs font-bold text-[#06142E]/55">
        Scegli la competizione, seleziona una Matchweek e controlla le 10 partite prima di pubblicarle.
        La schedina si chiude all&apos;inizio della prima gara.
      </p>
      {activeWeek !== null && (
        <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs font-black text-blue-800">
          Schedina attiva: Matchweek {activeWeek}
        </p>
      )}
      <label className="mt-4 block text-xs font-black">Competizione sorgente</label>
      <select value={competitionId} onChange={(event) => {
        setCompetitionId(event.target.value); setMatchweek(""); setPreview(null); setMatchweeks([]);
      }} className="mt-2 min-h-12 w-full rounded-[13px] bg-white px-4 text-sm font-bold">
        <option value="">Seleziona competizione...</option>
        {activeCompetitions.map((competition) =>
          <option key={competition.id} value={competition.id}>{competition.name}</option>)}
      </select>
      <button type="button" onClick={() => void saveConfig()} disabled={!competitionId || working}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-[#06142E] text-xs font-black uppercase text-white disabled:opacity-40">
        <Save size={16}/>{working ? "Operazione in corso..." : "Salva competizione"}
      </button>
      {savedCompetitionId === competitionId && savedCompetitionId && (
        <>
          <label className="mt-5 block text-xs font-black">Giornata da pubblicare</label>
          <select value={matchweek} onChange={(event) => { setMatchweek(event.target.value); setPreview(null); }}
            className="mt-2 min-h-12 w-full rounded-[13px] bg-white px-4 text-sm font-bold">
            <option value="">Seleziona Matchweek...</option>
            {matchweeks.map((week) =>
              <option key={week} value={String(week)}>Matchweek {week}</option>)}
          </select>
          <button type="button" onClick={() => void loadPreview()} disabled={!matchweek || working}
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-white text-xs font-black uppercase disabled:opacity-40">
            <Eye size={16}/>Genera anteprima
          </button>
        </>
      )}
      {preview && (
        <div className="mt-5 space-y-3">
          <div className="rounded-xl bg-white p-4">
            <h3 className="font-black uppercase">Matchweek {preview.matchweek} · {preview.matches.length} partite</h3>
            <p className="mt-1 text-xs text-[#06142E]/55">Chiusura: {preview.closesAt}</p>
            {preview.isClosed && <p className="mt-2 text-xs font-black text-red-600">La prima gara è già iniziata.</p>}
            {preview.alreadyPublished && <p className="mt-2 text-xs font-black text-emerald-700">Schedina già pubblicata.</p>}
          </div>
          {preview.matches.map((match) => (
            <div key={match.id} className="rounded-xl bg-white p-3">
              <p className="text-[10px] font-black uppercase text-[#06142E]/45">{match.competitionName} · {match.date} {match.time}</p>
              <p className="mt-1 text-sm font-black">{match.homeTeamName} – {match.awayTeamName}</p>
            </div>
          ))}
          <button type="button" onClick={() => void publish()}
            disabled={working || preview.isClosed || preview.matches.length !== 10}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-[#0B5FFF] text-xs font-black uppercase text-white disabled:opacity-40">
            <Send size={16}/>{working ? "Pubblicazione..." : "Pubblica schedina"}
          </button>
        </div>
      )}
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
      {message && <p className="mt-4 rounded-xl bg-green-50 p-3 text-xs font-bold text-green-700">{message}</p>}
    </section>
  );
}
