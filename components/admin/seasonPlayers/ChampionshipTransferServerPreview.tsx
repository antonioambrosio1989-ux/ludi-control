"use client";

import { useMemo, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/src/lib/firebase";
import type { SeasonPlayer } from "@/src/types/SeasonPlayer";

type TeamOption = { id: string; name: string; aliasName?: string };
type PlayerOption = { id: string; firstName: string; lastName: string };
type Props = {
  seasonId: string;
  seasonName: string;
  seasonStartYear: number;
  teams: TeamOption[];
  players: PlayerOption[];
  roster: SeasonPlayer[];
};
type Preview = {
  allowedToWrite: boolean;
  reason: string;
  seasonId: string;
  seasonPlayerId: string;
  playerId: string;
  fromTeamId: string;
  toTeamId: string;
};

export default function ChampionshipTransferServerPreview({seasonId, seasonName, seasonStartYear, teams, players, roster}: Props) {
  const [rosterId, setRosterId] = useState("");
  const [toTeamId, setToTeamId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(`${seasonStartYear + 1}-01-01`);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const eligible = useMemo(() => roster.filter(p => p.status === "active"), [roster]);
  const selected = eligible.find(p => p.id === rosterId);
  const destinations = teams.filter(t => String(t.id) !== String(selected?.teamId ?? ""));
  const playerName = (id: string) => {
    const found = players.find(p => p.id === id);
    return found ? `${found.lastName} ${found.firstName}` : id;
  };
  const teamName = (id: string) => teams.find(t => String(t.id) === String(id))?.aliasName ?? teams.find(t => String(t.id) === String(id))?.name ?? id;
  const validJanuary = /^\d{4}-01-(0[1-9]|[12]\d|3[01])$/.test(effectiveDate) && effectiveDate.startsWith(String(seasonStartYear + 1));
  async function requestPreview() {
    if (!selected || !toTeamId || !validJanuary) return;
    setLoading(true); setError(""); setPreview(null);
    try {
      const fn = httpsCallable<{
        seasonId: string; seasonPlayerId: string; toTeamId: string
      }, Preview>(getFunctions(app, "europe-west1"), "previewChampionshipTransfer");
      const result = await fn({seasonId, seasonPlayerId: selected.id, toTeamId});
      if (result.data.seasonPlayerId !== selected.id || result.data.toTeamId !== toTeamId || result.data.seasonId !== seasonId) {
        throw new Error("La risposta server non corrisponde alla selezione.");
      }
      setPreview(result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Anteprima non disponibile.");
    } finally { setLoading(false); }
  }
  return (
    <section className="mb-5 rounded-[20px] border border-[#06142E]/10 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-black text-[#06142E]">Mercato Championship ÔÇö anteprima server</h2>
        <p className="mt-1 text-sm text-[#06142E]/60">Stagione {seasonName}. Nessun trasferimento viene salvato da questa schermata.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-bold text-[#06142E]">Giocatore
          <select className="ludi-input mt-2 w-full" value={rosterId} onChange={e => {setRosterId(e.target.value);setToTeamId("");setPreview(null);}}>
            <option value="">Seleziona giocatore</option>
            {eligible.map(p => <option key={p.id} value={p.id}>{playerName(p.playerId)} ({teamName(p.teamId)})</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold text-[#06142E]">Squadra di destinazione
          <select className="ludi-input mt-2 w-full" value={toTeamId} onChange={e => {setToTeamId(e.target.value);setPreview(null);}} disabled={!selected}>
            <option value="">Seleziona squadra</option>
            {destinations.map(t => <option key={t.id} value={t.id}>{t.aliasName ?? t.name}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold text-[#06142E]">Data effettiva (gennaio)
          <input type="date" className="ludi-input mt-2 w-full" value={effectiveDate} min={`${seasonStartYear+1}-01-01`} max={`${seasonStartYear+1}-01-31`} onChange={e => {setEffectiveDate(e.target.value);setPreview(null);}} />
        </label>
      </div>
      {!validJanuary && <p className="mt-3 text-sm font-semibold text-red-700">Seleziona una data compresa tra il 1┬░ e il 31 gennaio {seasonStartYear + 1}.</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="ludi-button-primary" disabled={!selected || !toTeamId || !validJanuary || loading} onClick={requestPreview}>{loading ? "Verifica in corsoÔÇª" : "Verifica trasferimento"}</button>
        <button type="button" className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-bold text-slate-500" disabled title="Conferma disabilitata fino al collaudo">Conferma trasferimento (non attiva)</button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      {preview && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-[#06142E]">
        <p className="font-bold">Anteprima verificata dal server</p>
        <p className="mt-1">{playerName(preview.playerId)}: {teamName(preview.fromTeamId)} ÔåÆ {teamName(preview.toTeamId)} ┬À {effectiveDate}</p>
        <p className="mt-1 text-slate-600">{preview.reason}</p>
      </div>}
    </section>
  );
}
