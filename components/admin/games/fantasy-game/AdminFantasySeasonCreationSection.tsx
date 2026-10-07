"use client";

import { useState } from "react";
import { MiniStat } from "./AdminFantasyUi";
import type { useAdminFantasySeason } from "@/src/hooks/useAdminFantasySeason";
import type { useSeasons } from "@/src/hooks/useSeasons";

type FantasySeasonHook = ReturnType<typeof useAdminFantasySeason>;
type SeasonsHook = ReturnType<typeof useSeasons>;

type Props = {
  gameId: string;
  gamesSeasonId: string;
  currentSeason: SeasonsHook["currentSeason"];
  fantasySeasonSaving: boolean;
  createFantasySeason: FantasySeasonHook["createFantasySeason"];
};

export default function AdminFantasySeasonCreationSection({ gameId, gamesSeasonId, currentSeason, fantasySeasonSaving, createFantasySeason }: Props) {
  const [fantasyName, setFantasyName] = useState("Fantacalcio Premier League");
  const [interestOpensAt, setInterestOpensAt] = useState("");
  const [playerListTargetDate, setPlayerListTargetDate] = useState("");
  const [rosterClosesAt, setRosterClosesAt] = useState("");
  const [firstScoringMatchweek, setFirstScoringMatchweek] = useState("3");
  const [lastScoringMatchweek, setLastScoringMatchweek] = useState("");
  const [creationError, setCreationError] = useState<string | null>(null);
  const [creationMessage, setCreationMessage] = useState<string | null>(null);

  async function handleCreateFantasySeason() {
    setCreationError(null); setCreationMessage(null);
    const normalizedName = fantasyName.trim();
    if (!normalizedName) { setCreationError("Inserisci il nome del Fantacalcio."); return; }
    if (!gamesSeasonId) { setCreationError("La stagione Games collegata non è disponibile."); return; }
    if (!currentSeason?.id) { setCreationError("Nessuna stagione sportiva attiva disponibile."); return; }
    const firstMatchweek = Number(firstScoringMatchweek);
    if (!Number.isInteger(firstMatchweek) || firstMatchweek <= 0) { setCreationError("La prima Matchweek Fantasy non è valida."); return; }
    const parsedLastMatchweek = lastScoringMatchweek.trim() ? Number(lastScoringMatchweek) : undefined;
    if (parsedLastMatchweek !== undefined && (!Number.isInteger(parsedLastMatchweek) || parsedLastMatchweek < firstMatchweek)) { setCreationError("L'ultima Matchweek deve essere uguale o successiva alla prima."); return; }
    const parsedInterestOpensAt = parseOptionalDateTime(interestOpensAt);
    const parsedPlayerListTargetDate = parseOptionalDateTime(playerListTargetDate);
    const parsedRosterClosesAt = parseOptionalDateTime(rosterClosesAt);
    if (interestOpensAt && !parsedInterestOpensAt) { setCreationError("La data di apertura interesse non è valida."); return; }
    if (playerListTargetDate && !parsedPlayerListTargetDate) { setCreationError("La data prevista per il listone non è valida."); return; }
    if (rosterClosesAt && !parsedRosterClosesAt) { setCreationError("La data di chiusura delle rose non è valida."); return; }
    if (parsedPlayerListTargetDate && parsedRosterClosesAt && parsedRosterClosesAt.getTime() <= parsedPlayerListTargetDate.getTime()) { setCreationError("La chiusura delle rose deve essere successiva alla data prevista per il listone."); return; }
    try {
      await createFantasySeason({ id: `${gameId}__fantasy`, gamesSeasonId, gameId, competitionId: "premier-league", sportSeasonId: String(currentSeason.id), name: normalizedName, interestOpensAt: parsedInterestOpensAt, playerListTargetDate: parsedPlayerListTargetDate, rosterClosesAt: parsedRosterClosesAt, firstScoringMatchweek: firstMatchweek, lastScoringMatchweek: parsedLastMatchweek });
      setCreationMessage("Stagione Fantacalcio creata correttamente.");
    } catch (currentError) {
      console.error("Errore creazione stagione Fantacalcio:", currentError);
      setCreationError(currentError instanceof Error ? currentError.message : "Impossibile creare la stagione Fantacalcio.");
    }
  }

  return (
    <section className="mt-8 rounded-[22px] bg-white p-6 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">Configurazione</p>
      <h2 className="mt-2 text-xl font-black uppercase text-[#06142E]">Crea stagione Fantasy</h2>
      <p className="mt-3 text-sm font-bold leading-6 text-[#06142E]/45">Configura il Fantacalcio collegato alla Premier League. Le regole di rosa, formazione, punteggi e voti politici verranno inizializzate automaticamente.</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-[14px] bg-[#F5F5F2] p-4"><p className="text-[9px] font-black uppercase text-[#06142E]/35">Competizione</p><p className="mt-1 text-sm font-black text-[#06142E]">Premier League</p></div>
        <div className="rounded-[14px] bg-[#F5F5F2] p-4"><p className="text-[9px] font-black uppercase text-[#06142E]/35">Stagione sportiva</p><p className="mt-1 text-sm font-black text-[#06142E]">{currentSeason?.name ?? currentSeason?.id ?? "Non disponibile"}</p></div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2"><span className="text-[10px] font-black uppercase text-[#06142E]/45">Nome</span><input type="text" value={fantasyName} onChange={(e) => setFantasyName(e.target.value)} className="mt-2 min-h-12 w-full rounded-[13px] bg-[#F5F5F2] px-4 text-sm font-bold text-[#06142E] outline-none" /></label>
        <label className="block"><span className="text-[10px] font-black uppercase text-[#06142E]/45">Apertura interesse</span><input type="datetime-local" value={interestOpensAt} onChange={(e) => setInterestOpensAt(e.target.value)} className="mt-2 min-h-12 w-full rounded-[13px] bg-[#F5F5F2] px-4 text-sm font-bold text-[#06142E] outline-none" /><p className="mt-2 text-[9px] font-bold leading-4 text-[#06142E]/30">Data dalla quale gli utenti possono mostrare interesse per il Fantacalcio.</p></label>
        <label className="block"><span className="text-[10px] font-black uppercase text-[#06142E]/45">Data prevista listone</span><input type="datetime-local" value={playerListTargetDate} onChange={(e) => setPlayerListTargetDate(e.target.value)} className="mt-2 min-h-12 w-full rounded-[13px] bg-[#F5F5F2] px-4 text-sm font-bold text-[#06142E] outline-none" /><p className="mt-2 text-[9px] font-bold leading-4 text-[#06142E]/30">Data indicativa entro la quale verrà pubblicato il listone ufficiale.</p></label>
        <label className="block md:col-span-2"><span className="text-[10px] font-black uppercase text-[#06142E]/45">Chiusura rose</span><input type="datetime-local" value={rosterClosesAt} onChange={(e) => setRosterClosesAt(e.target.value)} className="mt-2 min-h-12 w-full rounded-[13px] bg-[#F5F5F2] px-4 text-sm font-bold text-[#06142E] outline-none" /><p className="mt-2 text-[9px] font-bold leading-4 text-[#06142E]/30">Dopo questa scadenza le rose verranno bloccate definitivamente.</p></label>
        <label className="block"><span className="text-[10px] font-black uppercase text-[#06142E]/45">Prima Matchweek Fantasy</span><input type="number" min="1" step="1" value={firstScoringMatchweek} onChange={(e) => setFirstScoringMatchweek(e.target.value)} className="mt-2 min-h-12 w-full rounded-[13px] bg-[#F5F5F2] px-4 text-sm font-bold text-[#06142E] outline-none" /></label>
        <label className="block"><span className="text-[10px] font-black uppercase text-[#06142E]/45">Ultima Matchweek Fantasy</span><input type="number" min="1" step="1" value={lastScoringMatchweek} onChange={(e) => setLastScoringMatchweek(e.target.value)} placeholder="Da definire" className="mt-2 min-h-12 w-full rounded-[13px] bg-[#F5F5F2] px-4 text-sm font-bold text-[#06142E] outline-none" /></label>
      </div>
      <div className="mt-6 rounded-[16px] bg-[#F5F5F2] p-4"><p className="text-xs font-black uppercase text-[#06142E]">Regole iniziali automatiche</p><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"><MiniStat label="Budget" value="150 cr" /><MiniStat label="Rosa" value="8" /><MiniStat label="Modulo" value="1-2-2" /><MiniStat label="Max per club" value="1" /></div><div className="mt-3 grid grid-cols-3 gap-3"><MiniStat label="Portieri" value="2" /><MiniStat label="Difensori" value="3" /><MiniStat label="Attaccanti" value="3" /></div></div>
      {creationError && <p className="mt-5 rounded-[12px] bg-red-50 p-3 text-sm font-bold text-red-700">{creationError}</p>}
      {creationMessage && <p className="mt-5 rounded-[12px] bg-green-50 p-3 text-sm font-bold text-green-700">{creationMessage}</p>}
      <button type="button" disabled={fantasySeasonSaving || !gamesSeasonId || !currentSeason?.id} onClick={() => { void handleCreateFantasySeason(); }} className="mt-6 min-h-12 w-full rounded-[13px] bg-[#0B5FFF] px-5 text-sm font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40">{fantasySeasonSaving ? "Creazione..." : "Crea stagione Fantacalcio"}</button>
      {!gamesSeasonId && <p className="mt-3 text-center text-[10px] font-bold text-red-600">Games Season ID non disponibile.</p>}
    </section>
  );
}

function parseOptionalDateTime(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}
