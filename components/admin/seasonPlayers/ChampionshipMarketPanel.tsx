"use client";

import { useMemo, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/src/lib/firebase";
import type { SeasonPlayer } from "@/src/types/SeasonPlayer";

type Team = { id: string; name: string; aliasName?: string };
type Player = { id: string; firstName: string; lastName: string };
type Preview = {
  seasonId: string;
  seasonPlayerId: string;
  playerId: string;
  fromTeamId: string;
  toTeamId: string;
  allowedToWrite?: boolean;
  reason?: string;
};
type Props = {
  seasonId: string;
  seasonName: string;
  seasonStartYear: number;
  marketWindow: { startDate: string; endDate: string };
  teams: Team[];
  players: Player[];
  roster: SeasonPlayer[];
  onCompleted: () => Promise<void>;
};

const DEMO_PROJECT = "demo-ludi-market-confirm";
const emulatorOnly =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === DEMO_PROJECT;

export default function ChampionshipMarketPanel({
  seasonId, seasonName, seasonStartYear, marketWindow, teams, players, roster, onCompleted,
}: Props) {
  const [entryId, setEntryId] = useState("");
  const [toTeamId, setToTeamId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(marketWindow.startDate);
  const [preview, setPreview] = useState<{ data: Preview; signature: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const eligible = useMemo(() => roster.filter(p => p.status === "active"), [roster]);
  const selected = eligible.find(p => p.id === entryId);
  const destinationTeams = teams.filter(t => t.id !== selected?.teamId);
  const playerName = (id: string) => {
    const p = players.find(x => x.id === id);
    return p ? `${p.lastName} ${p.firstName}` : id;
  };
  const teamName = (id: string) => {
    const t = teams.find(x => x.id === id);
    return t?.aliasName ?? t?.name ?? id;
  };
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) && effectiveDate >= marketWindow.startDate && effectiveDate <= marketWindow.endDate;
  const signature = JSON.stringify([seasonId, selected?.id, selected?.teamId, toTeamId, effectiveDate]);
  const verified = Boolean(preview && preview.signature === signature && selected &&
    preview.data.seasonId === seasonId &&
    preview.data.seasonPlayerId === selected.id &&
    preview.data.fromTeamId === selected.teamId &&
    preview.data.toTeamId === toTeamId);

  // The production UI remains disabled until security review and deployment.
  if (!emulatorOnly) {
    const activePlayers = roster.filter(p => p.status === "active").length;

    return (
      <section className="mb-5 rounded-[20px] border border-[#06142E]/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-[#06142E]">Mercato Ludi</h2>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
            Modalità consultiva
          </span>
        </div>
        <p className="mt-2 text-sm text-[#06142E]/65">
          {seasonName} — Trasferimenti non ancora abilitati.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Giocatori attivi</p>
            <p className="text-xl font-black">{activePlayers}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Squadre iscritte</p>
            <p className="text-xl font-black">{teams.length}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Finestra mercato</p>
            <p className="text-sm font-bold">{marketWindow.startDate} / {marketWindow.endDate}</p>
          </div>
        </div>
        <p className="mt-4 text-sm font-medium text-amber-800">
          Anteprima consultiva: nessun trasferimento può essere confermato da questa schermata.
        </p>
      </section>
    );
  }

  const fn = getFunctions(app, "europe-west1");
  const reset = () => { setPreview(null); setMessage(""); setSuccess(false); };

  async function verify() {
    if (!selected || !toTeamId || !validDate || busy) return;
    setBusy(true); reset();
    try {
      if (fn.app.options.projectId !== DEMO_PROJECT) throw new Error("Progetto Firebase non dimostrativo.");
      const call = httpsCallable<{ seasonId: string; seasonPlayerId: string; toTeamId: string }, Preview>(
        fn, "previewChampionshipTransfer");
      const result = await call({ seasonId, seasonPlayerId: selected.id, toTeamId });
      const d = result.data;
      if (d.seasonId !== seasonId || d.seasonPlayerId !== selected.id ||
          d.playerId !== selected.playerId || d.fromTeamId !== selected.teamId ||
          d.toTeamId !== toTeamId) {
        throw new Error("Anteprima non coerente con la selezione.");
      }
      setPreview({ data: d, signature });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Impossibile verificare il trasferimento.");
    } finally { setBusy(false); }
  }

  async function confirm() {
    if (!selected || !verified || !validDate || busy) return;
    if (!window.confirm(`TEST EMULATOR ÔÇö Confermi ${playerName(selected.playerId)} da ${teamName(selected.teamId)} a ${teamName(toTeamId)} dal ${effectiveDate}?`)) return;
    setBusy(true);
    setMessage("");
    try {
      if (fn.app.options.projectId !== DEMO_PROJECT) throw new Error("Progetto Firebase non dimostrativo.");
      const call = httpsCallable(fn, "confirmChampionshipTransfer");
      const result = await call({
        seasonId,
        seasonPlayerId: selected.id,
        playerId: selected.playerId,
        fromTeamId: selected.teamId,
        toTeamId,
        effectiveDate,
      });
      const resultData = result.data as { saved?: boolean; transferId?: string } | null;
      if (resultData?.saved !== true) throw new Error("Il server non ha confermato il salvataggio.");
      await onCompleted();
      setPreview(null);
      setEntryId("");
      setToTeamId("");
      setSuccess(true);
      const data = result.data as { transferId?: string } | null;
      setMessage(`Trasferimento salvato nell'Emulator${data?.transferId ? ` ┬À ID: ${data.transferId}` : ""}. Rosa aggiornata.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Conferma non riuscita.");
      setPreview(null);
    } finally { setBusy(false); }
  }

  return (
    <section className="mb-5 rounded-[20px] border border-[#06142E]/10 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-[#06142E]">Mercato Ludi</h2>
      <p className="mt-1 text-sm text-[#06142E]/60">{seasonName} ┬À Solo Emulator ┬À Nessuna scrittura in produzione</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-xs font-bold text-[#06142E]">Giocatore
          <select className="ludi-input mt-2 w-full" value={entryId} disabled={busy}
            onChange={e => { setEntryId(e.target.value); setToTeamId(""); reset(); }}>
            <option value="">Seleziona giocatore</option>
            {eligible.map(p => <option key={p.id} value={p.id}>{playerName(p.playerId)} ({teamName(p.teamId)})</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-[#06142E]">Squadra di destinazione
          <select className="ludi-input mt-2 w-full" value={toTeamId} disabled={!selected || busy}
            onChange={e => { setToTeamId(e.target.value); reset(); }}>
            <option value="">Seleziona squadra</option>
            {destinationTeams.map(t => <option key={t.id} value={t.id}>{teamName(t.id)}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-[#06142E]">Data effettiva (finestra stagione)
          <input className="ludi-input mt-2 w-full" type="date" value={effectiveDate}
            min={marketWindow.startDate} max={marketWindow.endDate}
            disabled={busy} onChange={e => { setEffectiveDate(e.target.value); reset(); }} />
        </label>
      </div>
      {!validDate && <p className="mt-3 text-sm text-red-700">La data deve essere nella finestra {marketWindow.startDate} - {marketWindow.endDate}.</p>}
      {verified && selected && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-[#06142E]">
        <p className="font-bold">Anteprima verificata dal server</p>
        <p className="mt-1">{playerName(selected.playerId)}: {teamName(selected.teamId)} ÔåÆ {teamName(toTeamId)} ┬À {effectiveDate}</p>
      </div>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="ludi-button-primary" disabled={!selected || !toTeamId || !validDate || busy}
          onClick={verify}>{busy ? "Operazione in corso..." : "Verifica trasferimento"}</button>
        <button type="button" className="ludi-button-primary" disabled={!verified || busy || !validDate}
          onClick={confirm}>{busy ? "Operazione in corso..." : "Conferma trasferimento (Emulator)"}</button>
      </div>
      {message && <p role={success ? "status" : "alert"} className={`mt-3 text-sm ${success ? "text-green-700" : "text-red-700"}`}>{message}</p>}
    </section>
  );
}
