"use client";

import { useMemo, useState } from "react";
import { previewChampionshipTransfer } from "@/src/services/transfer/TransferRosterPreview";
import type { SeasonPlayer } from "@/src/types/SeasonPlayer";
import type { Team } from "@/src/types/Team";
import type { PlayerProfile } from "@/src/types/PlayerProfile";
import type { RecordedTransfer } from "@/src/services/transfer/TransferHistory";

type Props = {
  competitionId?: string;
  seasonStartYear: number;
  teams: Team[];
  roster: SeasonPlayer[];
  players: PlayerProfile[];
  transfers?: RecordedTransfer[];
};

/** Solo anteprima: non crea, aggiorna o cancella documenti Firestore. */
export default function ChampionshipTransferPreview({
  competitionId,
  seasonStartYear,
  teams,
  roster,
  players,
  transfers = [],
}: Props) {
  const [playerId, setPlayerId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(`${seasonStartYear + 1}-01-01`);
  const activeRoster = useMemo(() => roster.filter(entry => entry.status === "active"), [roster]);
  const currentEntry = activeRoster.find(entry => entry.playerId === playerId);
  const originTeam = teams.find(team => String(team.id) === String(currentEntry?.teamId));
  const destinationTeams = teams.filter(team => String(team.id) !== String(currentEntry?.teamId));
  const playerName = (id: string) => {
    const p = players.find(item => String(item.id) === String(id));
    return p ? `${p.lastName} ${p.firstName}`.trim() : id;
  };

  let preview: ReturnType<typeof previewChampionshipTransfer> | undefined;
  let error: string | undefined;
  if (playerId && destinationId && effectiveDate && currentEntry && competitionId === "championship") {
    try {
      const playerTransfers = transfers.filter(t => t.playerId === playerId)
        .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
      // Senza lo storico completo non possiamo presumere la squadra iniziale.
      if (playerTransfers.length > 0) {
        error = "Anteprima sospesa: recuperare dal database l'appartenenza iniziale e lo storico completo del giocatore.";
      } else {
        preview = previewChampionshipTransfer({
          request: { competitionSlug: "championship", effectiveDate, playerId,
            fromTeamId: String(currentEntry.teamId), toTeamId: destinationId },
          seasonStartDate: `${seasonStartYear}-09-01`,
          initialTeamId: String(currentEntry.teamId),
          existingTransfers: [],
          seasonRoster: activeRoster.map(entry => ({ playerId: String(entry.playerId), teamId: String(entry.teamId), status: entry.status })),
          registeredTeamIds: teams.map(team => String(team.id)),
        });
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Impossibile simulare il trasferimento.";
    }
  }

  if (competitionId !== "championship") return null;
  return (
    <section className="mb-5 rounded-[20px] border border-[#06142E]/10 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-black uppercase text-[#06142E]">Calciomercato Championship</h2>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Solo simulazione</span>
      </div>
      <p className="mt-2 text-sm text-[#06142E]/65">Finestra 1ÔÇô31 gennaio. Nessuna modifica viene salvata: l&apos;attivazione richiede lo storico trasferimenti e l&apos;adeguamento delle statistiche pubbliche.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-bold text-[#06142E]">Giocatore
          <select className="ludi-input mt-1 w-full" value={playerId} onChange={e => {setPlayerId(e.target.value); setDestinationId("");}}>
            <option value="">Seleziona giocatore</option>
            {activeRoster.map(entry => <option key={entry.id} value={String(entry.playerId)}>{playerName(String(entry.playerId))}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-[#06142E]">Destinazione
          <select className="ludi-input mt-1 w-full" value={destinationId} onChange={e => setDestinationId(e.target.value)} disabled={!currentEntry}>
            <option value="">Seleziona squadra</option>
            {destinationTeams.map(team => <option key={team.id} value={String(team.id)}>{team.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-[#06142E]">Data effettiva
          <input type="date" className="ludi-input mt-1 w-full" value={effectiveDate} min={`${seasonStartYear + 1}-01-01`} max={`${seasonStartYear + 1}-01-31`} onChange={e => setEffectiveDate(e.target.value)} />
        </label>
      </div>
      {currentEntry && <p className="mt-3 text-sm text-[#06142E]/70">Squadra attuale: <strong>{originTeam?.name ?? currentEntry.teamId}</strong></p>}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      {preview && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-950">
        <strong>Simulazione valida</strong>: {originTeam?.name} ÔåÆ {teams.find(t => String(t.id) === destinationId)?.name}, dal {effectiveDate.split("-").reverse().join("/")}.
        <p className="mt-1">Le partite precedenti rimarrebbero associate alla squadra di origine. Nessuna scrittura eseguita.</p>
      </div>}
      <button type="button" disabled className="mt-4 rounded-xl bg-slate-200 px-4 py-2 text-sm font-bold text-slate-500">Conferma trasferimento ÔÇö non ancora disponibile</button>
    </section>
  );
}
