"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import AppShell from "@/components/ui/AppShell";
import TeamLogo from "@/components/common/TeamLogo";
import { useAuth } from "@/src/hooks/useAuth";
import { useTeams } from "@/src/hooks/useTeams";
import { useSeasons } from "@/src/hooks/useSeasons";
import { useCompetitions } from "@/src/hooks/useCompetitions";
import { subscribeLiveCenter } from "@/src/services/match/FirebaseLiveCenterRepository";
import { isAutomaticLiveDue, liveCenterKey, type LiveCenterEntry } from "@/src/services/match/LiveCenterRules";
import { transitionLiveMatch } from "@/src/services/match/LiveMatchTransaction";
import type { Season } from "@/src/types/Season";
import type { Team } from "@/src/types/Team";

const finalStageNames: Record<string, string> = {
  championsLeague: "Champions League", europaLeague: "Europa League",
  conferenceLeague: "Conference League", ludiFootballLeagueCup: "Ludi Football League Cup",
};
type Action = "home+" | "home-" | "away+" | "away-" | "finish" | "restore" | "start";
type RowState = { saving?: boolean; error?: string; message?: string };
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const button = "min-h-11 rounded-xl bg-[#06142E] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-35";

function todayInRome() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (name: string) => parts.find((value) => value.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export default function AdminLiveCenterScreen() {
  const { isAdmin, isLoading } = useAuth();
  return <AppShell>
    {isLoading ? <p role="status">Verifica accesso...</p> : isAdmin ? <LiveCenter /> :
      <p role="alert">Il Live Center è riservato agli amministratori.</p>}
  </AppShell>;
}

function LiveCenter() {
  const { teams, isLoading: teamsLoading, error: teamsError } = useTeams();
  const { seasons, isLoading: seasonsLoading, error: seasonsError } = useSeasons();
  const { competitions, error: competitionsError } = useCompetitions();
  const [sources, setSources] = useState<Partial<Record<LiveCenterEntry["phase"], LiveCenterEntry[]>>>({});
  const [sourceErrors, setSourceErrors] = useState<Partial<Record<LiveCenterEntry["phase"], string>>>({});
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [competition, setCompetition] = useState("");
  const [status, setStatus] = useState("live");
  const [date, setDate] = useState(todayInRome);
  const [online, setOnline] = useState(false);
  const [subscriptionVersion, setSubscriptionVersion] = useState(0);
  const inFlight = useRef(new Set<string>());
  const nextAutomaticAttempt = useRef(new Map<string, number>());
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      mounted.current = false;
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setSources({});
    setSourceErrors({});
    try {
      const unsubscribe = subscribeLiveCenter((phase, entries) => {
        if (!active) return;
        setSources((previous) => ({ ...previous, [phase]: entries }));
        setSourceErrors((previous) => ({ ...previous, [phase]: undefined }));
      }, (phase, error) => {
        if (!active) return;
        setSourceErrors((previous) => ({ ...previous, [phase]: error.message }));
      });
      return () => { active = false; unsubscribe(); };
    } catch (error) {
      setSourceErrors({ regularSeason: error instanceof Error ? error.message : "Collegamento non disponibile." });
      return () => { active = false; };
    }
  }, [subscriptionVersion]);

  const seasonMap = useMemo(() => new Map(seasons.map((season) => [season.id, season])), [seasons]);
  const teamMap = useMemo(() => new Map(teams.map((team) => [String(team.id), team])), [teams]);
  const competitionMap = useMemo(() => new Map(competitions.map((item) => [item.id, item])), [competitions]);
  const entries = useMemo(() => [...(sources.regularSeason ?? []), ...(sources.finalStage ?? [])], [sources]);
  const loading = !sources.regularSeason || !sources.finalStage || seasonsLoading || teamsLoading;
  const sourceFailed = Object.values(sourceErrors).some(Boolean);

  function writable(entry: LiveCenterEntry) {
    const season = seasonMap.get(entry.match.seasonId);
    return online && !sourceFailed && !loading && !seasonsError && !teamsError && entry.confirmed && entry.match.published &&
      season?.status === "active" && !(entry.phase === "regularSeason" ? season.regularSeasonClosed : season.finalStageClosed);
  }

  async function run(entry: LiveCenterEntry, action: Action, automatic = false) {
    const key = liveCenterKey(entry);
    if (inFlight.current.has(key) || !writable(entry) || !navigator.onLine) return;
    const match = entry.match;
    if (!["scheduled", "live", "finished"].includes(match.status)) return;
    if ((action === "finish" || action === "restore") && !window.confirm(
      action === "finish" ? `Terminare la partita sul risultato ${match.homeScore ?? 0}-${match.awayScore ?? 0}?` : "Ripristinare questa partita in live?",
    )) return;
    const currentHome = match.homeScore ?? 0;
    const currentAway = match.awayScore ?? 0;
    const homeScore = action === "home+" ? currentHome + 1 : action === "home-" ? Math.max(0, currentHome - 1) : currentHome;
    const awayScore = action === "away+" ? currentAway + 1 : action === "away-" ? Math.max(0, currentAway - 1) : currentAway;
    inFlight.current.add(key);
    setRows((previous) => ({ ...previous, [key]: { saving: true } }));
    try {
      await transitionLiveMatch({
        collectionName: entry.phase === "regularSeason" ? "matches" : "finalStageMatches",
        reportsCollectionName: entry.phase === "regularSeason" ? "matchReports" : "finalStageMatchReports",
        input: {
          matchId: match.id, expectedSeasonId: match.seasonId,
          expectedStatus: action === "start" ? "scheduled" : action === "restore" ? "finished" : "live",
          status: action === "finish" ? "finished" : "live", homeScore, awayScore,
          expectedScores: { homeScore: match.homeScore, awayScore: match.awayScore },
        },
      });
      if (mounted.current) setRows((previous) => ({ ...previous, [key]: { message: automatic ? "Live avviato." : "Salvato." } }));
    } catch (error) {
      if (mounted.current) setRows((previous) => ({ ...previous, [key]: {
        error: error instanceof Error ? error.message : "Salvataggio non riuscito. Riprova.",
      } }));
    } finally {
      inFlight.current.delete(key);
    }
  }

  // This callback always uses the latest snapshots and does not restart the timer on each goal.
  const startDueMatches = useEffectEvent(() => {
    const now = new Date();
    for (const entry of entries) {
      const key = liveCenterKey(entry);
      if (!writable(entry) || !isAutomaticLiveDue(entry.match, now) ||
        (nextAutomaticAttempt.current.get(key) ?? 0) > now.getTime()) continue;
      nextAutomaticAttempt.current.set(key, now.getTime() + 60_000);
      void run(entry, "start", true);
    }
  });
  useEffect(() => {
    const timer = window.setInterval(() => startDueMatches(), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  function competitionId(entry: LiveCenterEntry) {
    return seasonMap.get(entry.match.seasonId)?.competitionId ?? "legacy";
  }
  function competitionName(entry: LiveCenterEntry) {
    const season = seasonMap.get(entry.match.seasonId);
    return competitionMap.get(season?.competitionId ?? "")?.name ?? season?.name ?? entry.match.seasonId;
  }
  const options = [...new Map(entries.map((entry) => [competitionId(entry), competitionName(entry)])).entries()]
    .sort((first, second) => first[1].localeCompare(second[1]));
  const visible = entries.filter((entry) => {
    const season = seasonMap.get(entry.match.seasonId);
    if (competition && competitionId(entry) !== competition) return false;
    if (entry.match.status !== status) return false;
    // All live matches remain visible, including dates outside the selected calendar day.
    return status === "live" || (season?.status === "active" && entry.match.published && (!date || entry.match.date === date));
  }).sort((first, second) => first.match.date.localeCompare(second.match.date) || first.match.time.localeCompare(second.match.time) || liveCenterKey(first).localeCompare(liveCenterKey(second)));

  return <div className="mx-auto max-w-7xl space-y-5">
    <header>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Ludi Control</p>
      <h1 className="mt-1 text-3xl font-black text-[#06142E]">Live Center</h1>
      <p className="mt-2 text-sm text-slate-600">Tutte le competizioni, Regular Season e fasi finali, in una sola schermata.</p>
      <p className="mt-1 text-xs text-slate-500">Avvio automatico all’orario di calendario + 15 minuti, mentre il Live Center è aperto. Orari italiani.</p>
    </header>
    {!online ? <p role="status" className="rounded-xl bg-amber-50 p-4 text-amber-900">Connessione assente. Le modifiche sono sospese.</p> : null}
    {[seasonsError, teamsError, competitionsError, ...Object.values(sourceErrors)].filter(Boolean).map((error, index) =>
      <p key={index} role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>)}
    {sourceFailed ? <button className={button} onClick={() => setSubscriptionVersion((value) => value + 1)}>Ricollega i risultati</button> : null}
    {Object.values(rows).some((row) => row.error) ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
      <p className="font-bold">Operazioni non riuscite</p>
      <ul className="mt-2 space-y-1">
        {Object.entries(rows).filter(([, row]) => row.error).map(([key, row]) => {
          const entry = entries.find((item) => liveCenterKey(item) === key);
          return <li key={key}>{entry ? `${competitionName(entry)} · ${entry.match.time}: ` : ""}{row.error}</li>;
        })}
      </ul>
    </div> : null}
    <div className={`${card} flex flex-wrap items-end gap-4`}>
      <label className="flex min-w-48 flex-col gap-1 text-sm font-bold">Competizione
        <select className="min-h-11 rounded-lg border p-2" value={competition} onChange={(event) => setCompetition(event.target.value)}>
          <option value="">Tutte le competizioni</option>
          {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-bold">Partite
        <select className="min-h-11 rounded-lg border p-2" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="live">Live ({entries.filter((entry) => entry.match.status === "live").length})</option>
          <option value="scheduled">In programma</option><option value="finished">Terminate</option>
        </select>
      </label>
      {status !== "live" ? <label className="flex flex-col gap-1 text-sm font-bold">Data
        <input type="date" className="min-h-11 rounded-lg border p-2" value={date} onChange={(event) => setDate(event.target.value)} />
      </label> : null}
    </div>
    {loading && !sourceFailed ? <p role="status">Caricamento partite...</p> : null}
    {!loading && !sourceFailed && visible.length === 0 ? <p className={card}>Nessuna partita per i filtri selezionati.</p> : null}
    <div className="grid gap-4 xl:grid-cols-2">
      {visible.map((entry) => <MatchCard key={liveCenterKey(entry)} entry={entry}
        season={seasonMap.get(entry.match.seasonId)} competitionName={competitionName(entry)}
        homeTeam={teamMap.get(String(entry.match.homeTeamId))} awayTeam={teamMap.get(String(entry.match.awayTeamId))}
        state={rows[liveCenterKey(entry)]} disabled={!writable(entry)} onAction={(action) => { void run(entry, action); }} />)}
    </div>
  </div>;
}

function MatchCard({ entry, season, competitionName, homeTeam, awayTeam, state, disabled, onAction }: {
  entry: LiveCenterEntry; season?: Season; competitionName: string; homeTeam?: Team; awayTeam?: Team;
  state?: RowState; disabled: boolean; onAction: (action: Action) => void;
}) {
  const match = entry.match;
  const isLive = match.status === "live";
  const busy = disabled || !!state?.saving;
  const phase = "competition" in match ? finalStageNames[match.competition] ?? match.competition :
    match.matchType === "titlePlayoff" ? "Spareggio" : "Regular Season";
  return <section className={card} aria-busy={!!state?.saving}>
    <div className="flex flex-wrap justify-between gap-2 text-xs font-bold text-slate-500">
      <span>{competitionName} · {phase}</span>
      <span className={isLive ? "text-red-600" : ""}>{isLive ? "● LIVE" : match.status === "finished" ? "TERMINATA" : "IN PROGRAMMA"}</span>
    </div>
    <p className="mt-1 text-xs text-slate-500">{season?.name ?? match.seasonId} · {match.date.split("-").reverse().join("/")} · {match.time}</p>
    <div className="my-5 grid grid-cols-2 gap-4">
      {(["home", "away"] as const).map((side) => {
        const team = side === "home" ? homeTeam : awayTeam;
        const name = team?.aliasName?.trim() || team?.name || `Squadra ${side === "home" ? match.homeTeamId : match.awayTeamId}`;
        const score = (side === "home" ? match.homeScore : match.awayScore) ?? 0;
        return <div key={side} className="min-w-0 text-center">
          <div className="flex justify-center"><TeamLogo logoUrl={team?.logoUrl} teamName={name} size={44} /></div>
          <p className="my-2 min-h-10 break-words text-sm font-bold">{name}</p>
          <div className="flex items-center justify-center gap-2">
            <button className={button} aria-label={`Diminuisci gol ${name}`} disabled={busy || !isLive || score <= 0} onClick={() => onAction(`${side}-`)}>−</button>
            <span className="min-w-12 text-3xl font-black tabular-nums" aria-label={`Gol ${name}`}>{score}</span>
            <button className={button} aria-label={`Aumenta gol ${name}`} disabled={busy || !isLive || score >= 99} onClick={() => onAction(`${side}+`)}>+</button>
          </div>
        </div>;
      })}
    </div>
    {isLive ? <button className={`${button} bg-red-600`} disabled={busy} onClick={() => onAction("finish")}>Fine partita</button> :
      match.status === "finished" ? <button className={button} disabled={busy} onClick={() => onAction("restore")}>Ritorna al live</button> :
        <p className="text-xs text-slate-500">Avvio automatico a calendario + 15 minuti.</p>}
    {state?.saving ? <p role="status" className="mt-3 text-sm">Salvataggio...</p> : null}
    {state?.error ? <p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p> : null}
    {state?.message ? <p role="status" className="mt-3 text-sm text-green-700">{state.message}</p> : null}
    {!entry.confirmed ? <p className="mt-2 text-xs text-amber-800">In attesa di conferma dal server.</p> : null}
    {disabled && entry.confirmed ? <p className="mt-2 text-xs text-slate-500">Modifiche momentaneamente non disponibili per questa partita.</p> : null}
  </section>;
}
