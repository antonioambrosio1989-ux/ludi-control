"use client";

import { useMemo, useState } from "react";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/src/lib/firebase";

type Entry = { id: string; playerId: string; teamId: string; status: string };
type Team = { id: string; name: string; aliasName?: string };
type Player = { id: string; firstName: string; lastName: string };

type Props = {
  seasonId: string;
  seasonPlayers: Entry[];
  teams: Team[];
  players: Player[];
  onCompleted?: () => void | Promise<void>;
};

const DEMO_PROJECT = "demo-ludi-market-confirm";
const allowed =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === DEMO_PROJECT;

export default function TransferConfirmEmulator({ seasonId, seasonPlayers, teams, players, onCompleted }: Props) {
  const [entryId, setEntryId] = useState("");
  const [destination, setDestination] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = seasonPlayers.find((entry) => entry.id === entryId);
  const destinations = teams.filter((team) => String(team.id) !== String(selected?.teamId));
  const label = (entry: Entry) => {
    const player = players.find((item) => String(item.id) === String(entry.playerId));
    return `${player ? `${player.lastName} ${player.firstName}` : entry.playerId} ÔÇö ${teams.find((t) => String(t.id) === String(entry.teamId))?.name ?? entry.teamId}`;
  };
  const entries = useMemo(() => seasonPlayers.filter((entry) => entry.status === "active"), [seasonPlayers]);
  if (!allowed) return null;

  async function confirm() {
    if (!allowed || !selected || !destination || !effectiveDate || busy) return;
    if (!window.confirm(`TEST EMULATOR: trasferire ${label(selected)} alla squadra ${teams.find((t) => String(t.id) === String(destination))?.name ?? destination} dal ${effectiveDate}?`)) return;
    setBusy(true);
    setMessage("");
    try {
      const functions = getFunctions(app, "europe-west1");
      // Only demo-project local emulator can reach this call.
      if (functions.app.options.projectId !== DEMO_PROJECT) throw new Error("Progetto non demo: operazione annullata.");
      connectFunctionsEmulator(functions, "127.0.0.1", 5001);
      const call = httpsCallable(functions, "confirmChampionshipTransfer");
      const result = await call({
        seasonId,
        seasonPlayerId: selected.id,
        playerId: selected.playerId,
        fromTeamId: selected.teamId,
        toTeamId: destination,
        effectiveDate,
      });
      setMessage(`Operazione simulata completata nell'Emulator: ${JSON.stringify(result.data)}`);
      await onCompleted?.();
    } catch (error) {
      setMessage(`Operazione non eseguita: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <h2 className="font-bold text-[#06142E]">Conferma trasferimento ÔÇö SOLO EMULATOR</h2>
      <p className="mb-3 text-xs text-[#06142E]">Questa sezione ├¿ visibile solo nel progetto demo. Nessuna scrittura in produzione.</p>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs font-semibold">Giocatore
          <select className="ludi-input mt-1 w-full" value={entryId} onChange={(e) => {setEntryId(e.target.value); setDestination(""); setMessage("");}}>
            <option value="">Seleziona</option>
            {entries.map((entry) => <option key={entry.id} value={entry.id}>{label(entry)}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold">Destinazione
          <select className="ludi-input mt-1 w-full" value={destination} onChange={(e) => setDestination(e.target.value)}>
            <option value="">Seleziona</option>
            {destinations.map((team) => <option key={team.id} value={team.id}>{team.aliasName ?? team.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold">Data trasferimento
          <input type="date" className="ludi-input mt-1 w-full" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
        </label>
      </div>
      <button type="button" className="ludi-button-primary mt-3" disabled={!selected || !destination || !effectiveDate || busy} onClick={confirm}>
        {busy ? "Conferma in corso..." : "Conferma trasferimento (Emulator)"}
      </button>
      {message && <p role="status" className="mt-2 text-sm text-[#06142E]">{message}</p>}
    </section>
  );
}
