"use client";

import { useEffect, useState } from "react";
import {
  collection, doc, onSnapshot, query, where,
} from "firebase/firestore";
import { db, auth } from "@/src/lib/firebase";
import { FirebaseSeasonPlayerRepository } from "@/src/services/player/FirebaseSeasonPlayerRepository";
import { FirebasePlayerRepository } from "@/src/services/player/FirebasePlayerRepository";

type MatchItem = {
  id: string; date: string; time: string;
  homeTeamId: string; awayTeamId: string;
};
type RosterItem = { id: string; name: string };
type LineupData = Record<string, unknown>;
type Side = "home" | "away";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function ids(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}
function sideData(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function todayInRome(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export default function AdminManualLineupsCard({ seasonId }: { seasonId?: string }) {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [today, setToday] = useState(todayInRome);

  useEffect(() => {
    const interval = window.setInterval(() => setToday(todayInRome()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  const [matchId, setMatchId] = useState("");
  const [side, setSide] = useState<Side>("home");
  const [lineup, setLineup] = useState<LineupData | null>(null);
  const [teams, setTeams] = useState<Record<string, string>>({});
  const [rosters, setRosters] = useState<Record<string, RosterItem[]>>({});
  const [draftSelectedIds, setDraftSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dirty, setDirty] = useState(false);
  const [draftGoalkeeperId, setDraftGoalkeeperId] = useState("");
  const [guestGoalkeeper, setGuestGoalkeeper] = useState("");
  const [goalkeeperSurname, setGoalkeeperSurname] = useState("");
  const [goalkeeperChoice, setGoalkeeperChoice] = useState<"" | "existing" | "new">("");
  const [goalkeeperFirstName, setGoalkeeperFirstName] = useState("");
  const [goalkeeperWizard, setGoalkeeperWizard] = useState(false);
  const [editingGuestId, setEditingGuestId] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestFirstName, setGuestFirstName] = useState("");

  useEffect(() => {
    if (!seasonId) return;
    return onSnapshot(query(collection(db, "matches"), where("seasonId", "==", seasonId)),
      (snapshot) => setMatches(snapshot.docs.flatMap((entry) => {
        const data = entry.data();
        if (!data.homeTeamId || !data.awayTeamId) return [];
        return [{ id: entry.id, date: asString(data.date), time: asString(data.time),
          homeTeamId: asString(data.homeTeamId), awayTeamId: asString(data.awayTeamId) }];
      }).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))),
      () => setError("Impossibile caricare le partite."));
  }, [seasonId]);

  useEffect(() => {
    if (!seasonId) return;
    let active = true;
    Promise.all([
      FirebaseSeasonPlayerRepository.getAll(),
      FirebasePlayerRepository.getAllWithPrivate(),
    ]).then(([assignments, players]) => {
      if (!active) return;
      const byId = new Map(players.map((p) => [p.id, p]));
      const result: Record<string, RosterItem[]> = {};
      for (const assignment of assignments) {
        if (assignment.seasonId !== seasonId || assignment.status !== "active") continue;
        const player = byId.get(assignment.playerId);
        if (!player) continue;
        const name = `${player.lastName} ${player.firstName}`.trim();
        (result[assignment.teamId] ??= []).push({ id: player.id, name });
      }
      for (const values of Object.values(result)) values.sort((a, b) => a.name.localeCompare(b.name, "it"));
      setRosters(result);
    }).catch(() => setError("Impossibile caricare le rose stagionali."));
    return () => { active = false; };
  }, [seasonId]);

  useEffect(() => onSnapshot(collection(db, "teams"), (snapshot) => {
    setTeams(Object.fromEntries(snapshot.docs.map((item) => {
      const data = item.data();
      return [item.id, asString(data.aliasName) || asString(data.name) || item.id];
    })));
  }, () => setError("Impossibile caricare i nomi delle squadre.")), []);

  useEffect(() => {
    if (!matchId) return;
    return onSnapshot(doc(db, "matchLineups", matchId), (snapshot) => {
      setLineup(snapshot.exists() ? snapshot.data() : {});
    }, () => setError("Impossibile leggere la formazione."));
  }, [matchId]);

  const todaysMatches = matches.filter((entry) => entry.date === today);
  const match = todaysMatches.find((entry) => entry.id === matchId);
  const teamId = match ? (side === "home" ? match.homeTeamId : match.awayTeamId) : "";
  const roster = rosters[teamId] ?? [];
  const currentSide = sideData(lineup?.[side]);
  const savedIds = ids(currentSide.playerIds);
  const guests = Array.isArray(currentSide.guestPlayers) ? currentSide.guestPlayers : [];
  const storedGoalkeeperId = asString(currentSide.goalkeeperId);
  const selectedIds = dirty ? draftSelectedIds : savedIds;
  const goalkeeperId = dirty ? draftGoalkeeperId : storedGoalkeeperId;
  const normalizedSurname = goalkeeperSurname.trim().toLocaleLowerCase("it");
  const surnameMatches = roster.filter((player) => selectedIds.includes(player.id) &&
    player.name.split(" ")[0]?.toLocaleLowerCase("it") === normalizedSurname);
  const newGoalkeeperName = [goalkeeperSurname.trim(), goalkeeperFirstName.trim()].filter(Boolean).join(" ");
  const goalkeeperNeedsReplacement = Boolean(storedGoalkeeperId && !selectedIds.includes(storedGoalkeeperId) &&
    !guests.some((guest) => sideData(guest).id === storedGoalkeeperId) && !goalkeeperId && !guestGoalkeeper);
  const visibleRoster = roster.filter((player) =>
    player.name.toLocaleLowerCase("it").includes(search.trim().toLocaleLowerCase("it")));


  function beginGuestEdit(guest: Record<string, unknown>) {
    setEditingGuestId(asString(guest.id));
    setGuestLastName(asString(guest.lastName));
    setGuestFirstName(asString(guest.firstName));
    setError(""); setSuccess("");
  }

  async function saveGuestName() {
    if (!match || !teamId || !seasonId || !editingGuestId || busy) return;
    if (dirty) { setError("Salva o annulla prima le altre modifiche alla formazione."); return; }
    const guest = guests.map(sideData).find((entry) => asString(entry.id) === editingGuestId);
    if (!guest) { setError("Giocatore provvisorio non più presente. Aggiorna la pagina."); return; }
    if (!guestLastName.trim()) { setError("Inserisci il cognome del giocatore."); return; }
    setBusy(true); setError(""); setSuccess("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Devi effettuare l'accesso come amministratore.");
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/lineups", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "rename_guest", matchId: match.id, seasonId, teamId, side,
          guestId: editingGuestId, expectedGuestName: asString(guest.name),
          lastName: guestLastName.trim(), firstName: guestFirstName.trim() }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Correzione non riuscita.");
      setEditingGuestId(""); setGuestFirstName(""); setGuestLastName("");
      setSuccess("Nominativo provvisorio corretto per questa partita.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Correzione non riuscita.");
    } finally { setBusy(false); }
  }

  function resetToSaved() {
    setDraftSelectedIds(savedIds); setDraftGoalkeeperId(storedGoalkeeperId); setGuestGoalkeeper("");
    setGoalkeeperWizard(false); setDirty(false); setSuccess("");
  }
  function toggle(playerId: string) {
    if (selectedIds.includes(playerId) && goalkeeperId === playerId) {
      setDraftGoalkeeperId(""); setGoalkeeperWizard(true);
      setGoalkeeperSurname(""); setGoalkeeperFirstName(""); setGoalkeeperChoice("");
    }
    if (!dirty) setDraftGoalkeeperId(goalkeeperId === playerId ? "" : goalkeeperId);
    setDirty(true); setSuccess("");
    setDraftSelectedIds(selectedIds.includes(playerId)
      ? selectedIds.filter((id) => id !== playerId) : [...selectedIds, playerId]);
  }

  async function save() {
    if (!match || !teamId || !seasonId || !lineup || busy) return;
    if (selectedIds.some((id) => !roster.some((player) => player.id === id))) {
      setError("Sono presenti giocatori non appartenenti alla rosa attiva."); return;
    }
    if (goalkeeperWizard || goalkeeperNeedsReplacement) {
      setError("Prima di salvare indica chi giocherà in porta."); return;
    }
    if (goalkeeperId && !selectedIds.includes(goalkeeperId) && !guestGoalkeeper) {
      setError("Il portiere selezionato non è nella formazione."); return;
    }
    setBusy(true); setError(""); setSuccess("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Devi effettuare l'accesso come amministratore.");
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/lineups", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ matchId: match.id, seasonId, teamId, side,
          playerIds: selectedIds, expectedPlayerIds: savedIds,
          goalkeeperId: goalkeeperId || null, expectedGoalkeeperId: storedGoalkeeperId || null,
          guestGoalkeeperName: guestGoalkeeper || null }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Salvataggio non riuscito.");
      setDirty(false); setGoalkeeperWizard(false); setGuestGoalkeeper("");
      setSuccess("Formazione e portiere salvati su Firebase.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Salvataggio non riuscito.");
    } finally { setBusy(false); }
  }

  return (
    <section className="rounded-[18px] border border-[#06142E]/10 bg-white p-5">
      <h2 className="text-lg font-black uppercase text-[#06142E]">Gestione manuale formazioni</h2>
      <p className="mt-1 text-xs font-semibold text-[#06142E]/55">Seleziona una partita, poi aggiungi o rimuovi giocatori dalla rosa della squadra.</p>
      <p className="mt-2 text-xs font-semibold text-[#06142E]/55">Solo partite di oggi ({today.split("-").reverse().join("/")}, ora italiana).</p>
      <label className="mt-4 block text-xs font-bold">Partita
        <select value={matchId} onChange={(event) => { setMatchId(event.target.value); setDirty(false); setGoalkeeperWizard(false); setGuestGoalkeeper(""); setEditingGuestId(""); setSuccess(""); }}
          className="mt-1 w-full rounded-lg border p-2 text-sm">
          <option value="">Seleziona partita</option>
          {todaysMatches.map((item) => <option key={item.id} value={item.id}>
            {item.date} {item.time} · {teams[item.homeTeamId] ?? item.homeTeamId} vs {teams[item.awayTeamId] ?? item.awayTeamId}
          </option>)}
        </select>
      </label>
      {todaysMatches.length === 0 && (
        <p className="mt-3 text-sm font-semibold text-[#06142E]/60">Nessuna partita in programma oggi per questa competizione.</p>
      )}
      {match && <>
        <label className="mt-3 block text-xs font-bold">Squadra
          <select value={side} onChange={(event) => { setSide(event.target.value as Side); setDirty(false); setGoalkeeperWizard(false); setGuestGoalkeeper(""); setEditingGuestId(""); setSuccess(""); }}
            className="mt-1 w-full rounded-lg border p-2 text-sm">
            <option value="home">{teams[match.homeTeamId] ?? match.homeTeamId}</option>
            <option value="away">{teams[match.awayTeamId] ?? match.awayTeamId}</option>
          </select>
        </label>
        <p className="mt-3 text-xs font-bold">Giocatori selezionati: {selectedIds.length}{guests.length ? ` · Ospiti WhatsApp conservati: ${guests.length}` : ""}</p>
        <p className="mt-3 text-xs font-bold text-[#06142E]">Portiere designato: {roster.find((p) => p.id === goalkeeperId)?.name ||
          (guests.find((g) => sideData(g).id === goalkeeperId) ? asString(sideData(guests.find((g) => sideData(g).id === goalkeeperId)).name) : "Da indicare")}</p>
        {!goalkeeperWizard && !guestGoalkeeper && <label className="mt-2 block text-xs font-bold">Scegli il portiere tra i convocati
          <select className="mt-1 w-full rounded-lg border p-2 text-sm" value={goalkeeperId}
            onChange={(event) => { setDraftSelectedIds(selectedIds); setDraftGoalkeeperId(event.target.value); setDirty(true); }}>
            <option value="">Nessuno selezionato</option>
            {roster.filter((p) => selectedIds.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>}
        {(goalkeeperWizard || goalkeeperNeedsReplacement) && <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
          <p className="text-sm font-black">Chi giocherà in porta per questa partita?</p>
          <input value={goalkeeperSurname} onChange={(e) => { setGoalkeeperSurname(e.target.value); setGoalkeeperChoice(""); }}
            placeholder="Cognome del portiere" className="w-full rounded-lg border p-2 text-sm" />
          {!!goalkeeperSurname.trim() && (surnameMatches.length > 0 ? <>
            <p className="text-xs">Il cognome è già presente. Si tratta dello stesso giocatore o di un omonimo?</p>
            <label className="block text-xs"><input type="radio" checked={goalkeeperChoice === "existing"}
              onChange={() => setGoalkeeperChoice("existing")}/> Giocatore già presente</label>
            {goalkeeperChoice === "existing" && <select className="w-full rounded-lg border p-2 text-sm" value={goalkeeperId}
              onChange={(e) => setDraftGoalkeeperId(e.target.value)}>
              <option value="">Scegli il giocatore</option>
              {surnameMatches.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>}
            <label className="block text-xs"><input type="radio" checked={goalkeeperChoice === "new"}
              onChange={() => { setGoalkeeperChoice("new"); setDraftGoalkeeperId(""); }}/> Giocatore diverso con lo stesso cognome</label>
          </> : <p className="text-xs">Cognome non presente: verrà registrato come portiere provvisorio.</p>)}
          {goalkeeperChoice === "new" && <input value={goalkeeperFirstName}
            onChange={(e) => setGoalkeeperFirstName(e.target.value)} placeholder="Nome del nuovo portiere"
            className="w-full rounded-lg border p-2 text-sm" />}
          <button type="button" className="rounded-lg bg-[#06142E] px-3 py-2 text-xs font-bold text-white"
            onClick={() => {
              if (!goalkeeperSurname.trim()) return;
              if (surnameMatches.length && !goalkeeperChoice) { setError("Scegli se è un giocatore già presente o un omonimo."); return; }
              if (goalkeeperChoice === "existing") {
                if (!goalkeeperId || !surnameMatches.some((p) => p.id === goalkeeperId)) { setError("Seleziona il giocatore presente."); return; }
                setGuestGoalkeeper("");
              } else {
                if (goalkeeperChoice === "new" && !goalkeeperFirstName.trim()) { setError("Indica anche il nome dell'omonimo."); return; }
                setGuestGoalkeeper(newGoalkeeperName); setDraftGoalkeeperId("");
              }
              setDraftSelectedIds(selectedIds); setGoalkeeperWizard(false); setDirty(true); setError("");
            }}>Conferma nuovo portiere</button>
        </div>}
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca giocatore per nome o cognome"
          className="mt-2 w-full rounded-lg border p-2 text-sm" />
        <div className="mt-2 max-h-64 space-y-1 overflow-auto">
          {visibleRoster.map((player) => <label key={player.id} className="flex items-center gap-2 rounded-lg bg-[#06142E]/5 p-2 text-sm">
            <input type="checkbox" checked={selectedIds.includes(player.id)} onChange={() => toggle(player.id)} />
            {player.name}
          </label>)}
          {!roster.length && <p className="text-xs text-amber-700">Nessun giocatore attivo trovato per questa rosa.</p>}
        </div>
        {!!guests.length && <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-black text-amber-900">Giocatori provvisori della partita</p>
          <p className="text-xs text-amber-800">La correzione del nominativo non modifica la rosa stagionale.</p>
          {guests.map((value) => {
            const guest = sideData(value);
            const guestId = asString(guest.id);
            if (!guestId) return null;
            return <div key={guestId} className="rounded-lg border border-amber-200 bg-white p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-[#06142E]">{asString(guest.name) || "Senza nome"}{guestId === goalkeeperId ? " (GK)" : ""}</span>
                <button type="button" disabled={busy || dirty} onClick={() => beginGuestEdit(guest)}
                  className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">Modifica nominativo</button>
              </div>
              {editingGuestId === guestId && <div className="mt-3 space-y-2">
                <label className="block text-xs font-bold">Cognome
                  <input value={guestLastName} onChange={(event) => setGuestLastName(event.target.value)}
                    placeholder="Es. Pagano" className="mt-1 w-full rounded-lg border p-2 text-sm" />
                </label>
                <label className="block text-xs font-bold">Nome (facoltativo)
                  <input value={guestFirstName} onChange={(event) => setGuestFirstName(event.target.value)}
                    placeholder="Es. Michele" className="mt-1 w-full rounded-lg border p-2 text-sm" />
                </label>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => setEditingGuestId("")}
                    className="rounded-lg border px-3 py-2 text-xs font-bold">Annulla</button>
                  <button type="button" disabled={busy || !guestLastName.trim()} onClick={() => void saveGuestName()}
                    className="rounded-lg bg-[#06142E] px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
                    {busy ? "Salvataggio..." : "Salva nominativo"}
                  </button>
                </div>
              </div>}
            </div>;
          })}
        </div>}
        {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
        {success && <p className="mt-2 text-xs text-green-700">{success}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={resetToSaved} disabled={busy || !dirty} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">Annulla</button>
          <button type="button" onClick={() => void save()} disabled={busy || !dirty || !roster.length}
            className="rounded-lg bg-[#06142E] px-3 py-2 text-xs font-black text-white disabled:opacity-40">
            {busy ? "Salvataggio..." : "Salva formazione"}
          </button>
        </div>
      </>}
    </section>
  );
}
