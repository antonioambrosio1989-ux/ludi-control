"use client";

import { useCallback, useEffect, useState } from "react";
import { Save, ShieldCheck } from "lucide-react";
import { useAuth } from "@/src/hooks/useAuth";
import { useCompetitions } from "@/src/hooks/useCompetitions";

export default function AdminSurvivorBuilder({ gameId }: { gameId: string }) {
  const { user } = useAuth();
  const { activeCompetitions } = useCompetitions();
  const [competitionId, setCompetitionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async (init?: RequestInit) => {
    if (!user) throw new Error("Autenticazione Admin richiesta.");
    const response = await fetch(`/api/admin/games/survivor/${gameId}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}`, ...init?.headers },
    });
    const value = await response.json() as { config?: { competitionId?: string; startMatchweek?: number | null } | null; error?: string };
    if (!response.ok) throw new Error(value.error || "Operazione non riuscita.");
    return value;
  }, [gameId, user]);

  useEffect(() => {
    if (!user) return;
    void request().then((value) => setCompetitionId(value.config?.competitionId ?? "")).catch((current) => setError(current instanceof Error ? current.message : "Errore caricamento."));
  }, [request, user]);

  async function save() {
    if (!competitionId || saving) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      await request({ method: "POST", body: JSON.stringify({ competitionId }) });
      setMessage("Survivor configurato. La Matchweek pubblicata diventerà automaticamente il turno disponibile.");
    } catch (current) { setError(current instanceof Error ? current.message : "Salvataggio non riuscito."); }
    finally { setSaving(false); }
  }

  return <section className="rounded-[22px] bg-[#F5F5F2] p-5">
    <div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-white text-[#0B5FFF]"><ShieldCheck size={21} /></div><div><p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#06142E]/35">League One Survivor</p><h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">Competizione sorgente</h2></div></div>
    <p className="mt-4 text-xs font-bold leading-5 text-[#06142E]/45">Ogni Matchweek pubblicata apre un turno. La scelta resta modificabile fino all’inizio della prima gara e ogni squadra può essere utilizzata una sola volta.</p>
    <select value={competitionId} onChange={(event) => setCompetitionId(event.target.value)} className="mt-4 min-h-12 w-full rounded-[13px] bg-white px-4 text-sm font-bold text-[#06142E] outline-none"><option value="">Seleziona competizione...</option>{activeCompetitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.name}</option>)}</select>
    <div className="mt-4 space-y-2 text-xs font-bold text-[#06142E]/55"><p>✓ Vittoria: qualificazione</p><p>✓ Pareggio o sconfitta: eliminazione</p><p>✓ Partita rinviata: turno superato senza consumare la squadra</p><p>✓ Mancata scelta: eliminazione</p></div>
    {error || message ? <p className={`mt-4 rounded-[13px] p-3 text-xs font-bold ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{error ?? message}</p> : null}
    <button type="button" disabled={!competitionId || saving} onClick={() => void save()} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-[#06142E] text-xs font-black uppercase text-white disabled:opacity-35"><Save size={16} />{saving ? "Salvataggio..." : "Salva configurazione"}</button>
  </section>;
}
