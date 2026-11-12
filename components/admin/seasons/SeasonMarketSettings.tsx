"use client";

import { useEffect, useState } from "react";
import type { Season, RegularSeasonFormat } from "@/src/types/Season";
import { FirebaseSeasonRepository } from "@/src/services/season/FirebaseSeasonRepository";

export default function SeasonMarketSettings({ season }: { season: Season }) {
  const [format, setFormat] = useState<RegularSeasonFormat | "">(season.format ?? "");
  const [returnWeek, setReturnWeek] = useState(String(season.firstReturnMatchweek ?? ""));
  const [startDate, setStartDate] = useState(season.marketWindow?.startDate ?? "");
  const [endDate, setEndDate] = useState(season.marketWindow?.endDate ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setFormat(season.format ?? "");
    setReturnWeek(String(season.firstReturnMatchweek ?? ""));
    setStartDate(season.marketWindow?.startDate ?? "");
    setEndDate(season.marketWindow?.endDate ?? "");
    setMessage("");
  }, [season.id, season.format, season.firstReturnMatchweek, season.marketWindow?.startDate, season.marketWindow?.endDate]);

  const isLocked = Boolean(season.format) && season.status !== "draft";
  const canSave = !busy && !isLocked && format !== "" &&
    (format === "single_round_robin" || (Number.isSafeInteger(Number(returnWeek)) && Number(returnWeek) >= 2 && startDate !== "" && endDate !== ""));

  async function save() {
    if (!canSave || !format) return;
    setBusy(true); setMessage("");
    try {
      const config = format === "single_round_robin"
        ? { format, firstReturnMatchweek: null }
        : { format, firstReturnMatchweek: Number(returnWeek), marketWindow: { startDate, endDate } };
      await FirebaseSeasonRepository.updateMarketConfiguration(season.id, config);
      setMessage("Configurazione salvata. Il mercato in produzione resta disabilitato fino al collaudo server.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossibile salvare la configurazione.");
    } finally { setBusy(false); }
  }

  return <section className="mb-5 rounded-[20px] border border-[#06142E]/10 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-black text-[#06142E]">Formato e mercato · {season.name}</h2>
    <p className="mt-1 text-sm text-[#06142E]/60">Il mercato e disponibile solo nelle stagioni con andata e ritorno. Il salvataggio non autorizza trasferimenti in produzione.</p>
    <div className="mt-4 grid gap-3 md:grid-cols-4">
      <label className="text-xs font-bold text-[#06142E]">Formato regular season
        <select className="ludi-input mt-2 w-full" value={format} disabled={busy || isLocked} onChange={e => setFormat(e.target.value as RegularSeasonFormat | "")}>
          <option value="">Non configurato</option>
          <option value="single_round_robin">Sola andata</option>
          <option value="double_round_robin">Andata e ritorno</option>
        </select>
      </label>
      {format === "double_round_robin" && <>
        <label className="text-xs font-bold text-[#06142E]">Prima giornata di ritorno
          <input className="ludi-input mt-2 w-full" type="number" min={2} max={100} value={returnWeek} disabled={busy || isLocked} onChange={e => setReturnWeek(e.target.value)} />
        </label>
        <label className="text-xs font-bold text-[#06142E]">Apertura mercato
          <input className="ludi-input mt-2 w-full" type="date" value={startDate} disabled={busy || isLocked} onChange={e => setStartDate(e.target.value)} />
        </label>
        <label className="text-xs font-bold text-[#06142E]">Chiusura mercato
          <input className="ludi-input mt-2 w-full" type="date" value={endDate} disabled={busy || isLocked} onChange={e => setEndDate(e.target.value)} />
        </label>
      </>}
    </div>
    {isLocked && <p className="mt-3 text-xs font-bold text-amber-800">Configurazione bloccata per stagione gia attiva. Per modifiche successive serve una procedura amministrativa protetta.</p>}
    <button type="button" className="ludi-button-primary mt-4" disabled={!canSave} onClick={() => { void save(); }}>{busy ? "Salvataggio..." : "Salva configurazione"}</button>
    {message && <p role="status" className="mt-3 text-sm text-[#06142E]">{message}</p>}
  </section>;
}
