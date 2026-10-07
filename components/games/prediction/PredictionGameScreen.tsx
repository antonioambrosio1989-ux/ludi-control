"use client";
/* La callback asincrona sincronizza lo stato con la schedina remota. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Crown, LockKeyhole, Trophy } from "lucide-react";
import Image from "next/image";
import AppShell from "@/components/ui/AppShell";
import { currentRomeDateTimeKey } from "@/src/services/games/prediction/PredictionTime";
import { useAuth } from "@/src/hooks/useAuth";
import type { PredictionGoalBand, PredictionLeaderboardEntry, PredictionOneXTwo, PredictionSelection, PredictionTicket } from "@/src/types/GamesPrediction";

const DEMO_PREDICTION_TICKET: PredictionTicket = {
  gameId: "demo-prediction",
  competitionId: "championship",
  competitionName: "Championship",
  seasonId: "2025-26",
  seasonName: "2025/26",
  matchweek: 4,
  matchweekId: "mw4",
  closesAtLabel: "2026-09-21 20:30",
  isLocked: false,
  matches: [
    { id: "demo-1", competitionId: "championship", competitionName: "Championship", homeTeamName: "Ludi FC", awayTeamName: "Real Vesuvio", date: "2026-09-21", time: "20:30" },
    { id: "demo-2", competitionId: "championship", competitionName: "Championship", homeTeamName: "Atletico Partenope", awayTeamName: "Sporting Napoli", date: "2026-09-21", time: "21:30" },
    { id: "demo-3", competitionId: "championship", competitionName: "Championship", homeTeamName: "Blue Lions", awayTeamName: "Phoenix United", date: "2026-09-22", time: "20:30" },
    { id: "demo-4", competitionId: "championship", competitionName: "Championship", homeTeamName: "Borussia Napoli", awayTeamName: "Red Devils", date: "2026-09-22", time: "21:30" },
    { id: "demo-5", competitionId: "championship", competitionName: "Championship", homeTeamName: "New Team", awayTeamName: "Royal Club", date: "2026-09-23", time: "20:30" },
    { id: "demo-6", competitionId: "championship", competitionName: "Championship", homeTeamName: "Napoli Five", awayTeamName: "Vesuvio United", date: "2026-09-23", time: "21:30" },
    { id: "demo-7", competitionId: "league-one", competitionName: "League One", homeTeamName: "Black Lions", awayTeamName: "City Boys", date: "2026-09-21", time: "22:00" },
    { id: "demo-8", competitionId: "league-one", competitionName: "League One", homeTeamName: "Real Napoli", awayTeamName: "Partenope FC", date: "2026-09-22", time: "22:00" },
    { id: "demo-9", competitionId: "league-one", competitionName: "League One", homeTeamName: "Sporting Vesuvio", awayTeamName: "Atletico Sud", date: "2026-09-23", time: "22:00" },
    { id: "demo-10", competitionId: "league-one", competitionName: "League One", homeTeamName: "Royal Napoli", awayTeamName: "Blue Stars", date: "2026-09-24", time: "20:30" },
  ],
  selections: [],
  maxScore: 500,
  isScored: false,
  seasonLeaderboard: [
    { position: 1, userId: "demo-user-1", displayName: "Antonio", totalScore: 320, submittedTickets: 3 },
    { position: 2, userId: "demo-user-2", displayName: "Marco", totalScore: 280, submittedTickets: 3 },
    { position: 3, userId: "demo-user-3", displayName: "Luca", totalScore: 250, submittedTickets: 3 },
  ],
};

export default function PredictionGameScreen({ gameId, demoMode = false }: { gameId: string; demoMode?: boolean }) {
  const { user } = useAuth();
  const [ticket, setTicket] = useState<PredictionTicket | null>(demoMode ? DEMO_PREDICTION_TICKET : null);
  const [selections, setSelections] = useState<Record<string, Partial<PredictionSelection>>>({});
  const [loading, setLoading] = useState(!demoMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async (init?: RequestInit) => {
    if (!user) throw new Error("Accedi per giocare la schedina.");
    const response = await fetch(`/api/games/predictions/${gameId}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}`, ...init?.headers },
    });
    const value = await response.json() as { ticket?: PredictionTicket; error?: string };
    if (!response.ok) throw new Error(value.error || "Operazione non riuscita.");
    return value;
  }, [gameId, user]);

  const load = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const value = await request();
      if (value.ticket) {
        setTicket(value.ticket);
        setSelections(Object.fromEntries(value.ticket.selections.map((selection) => [selection.matchId, selection])));
      }
    } catch (current) { setError(current instanceof Error ? current.message : "Impossibile caricare la schedina."); }
    finally { if (!silent) setLoading(false); }
  }, [request, user]);

  useEffect(() => { if (demoMode) { setLoading(false); return; } void load(); }, [demoMode, load]);

  const complete = useMemo(() => ticket?.matches.every((match) => selections[match.id]?.oneXTwo && selections[match.id]?.goalBand) ?? false, [selections, ticket]);
  const alreadySubmitted = Boolean(ticket && ticket.selections.length === ticket.matches.length && ticket.matches.length > 0);
  const [romeNowKey, setRomeNowKey] = useState(() => currentRomeDateTimeKey());

  const localTimeLocked = Boolean(
    !demoMode &&
    ticket &&
    romeNowKey >= ticket.closesAtLabel,
  );

  const effectiveLocked = Boolean(
    ticket?.isLocked ||
    localTimeLocked,
  );

  useEffect(() => {
    if (demoMode) return;

    const syncClock = () => {
      setRomeNowKey(
        currentRomeDateTimeKey(),
      );
    };

    syncClock();

    const interval =
      window.setInterval(
        syncClock,
        15_000,
      );

    return () =>
      window.clearInterval(
        interval,
      );
  }, [demoMode]);

  useEffect(() => {
    if (
      demoMode ||
      !ticket ||
      ticket.isLocked ||
      !localTimeLocked
    ) {
      return;
    }

    /*
     * Appena il browser raggiunge il cutoff blocchiamo subito la UI
     * e riallineiamo silenziosamente lo stato con il server.
     */
    void load(true);
  }, [
    demoMode,
    load,
    localTimeLocked,
    ticket,
  ]);

  useEffect(() => {
    if (demoMode || !alreadySubmitted) return;
    const interval = window.setInterval(() => { void load(true); }, 30_000);
    return () => window.clearInterval(interval);
  }, [alreadySubmitted, demoMode, load]);

  function selectOneXTwo(matchId: string, value: PredictionOneXTwo) {
    if (effectiveLocked) return;
    setSelections((current) => ({ ...current, [matchId]: { ...current[matchId], matchId, oneXTwo: value } }));
  }
  function selectGoalBand(matchId: string, value: PredictionGoalBand) {
    if (effectiveLocked) return;
    setSelections((current) => ({ ...current, [matchId]: { ...current[matchId], matchId, goalBand: value } }));
  }

  async function submit() {
    if (!ticket || !complete || effectiveLocked || submitting) return;
    if (!window.confirm("Confermi l’invio? Dopo la conferma la schedina non potrà più essere modificata.")) return;
    setSubmitting(true); setError(null);
    try {
      const finalSelections = ticket.matches.map((match) => selections[match.id] as PredictionSelection);
      if (demoMode) {
        setTicket((current) => current ? { ...current, isLocked: true, selections: finalSelections, submittedAt: new Date().toISOString() } : current);
        return;
      }
      await request({ method: "POST", body: JSON.stringify({ selections: finalSelections }) });
      await load(true);
    } catch (current) { setError(current instanceof Error ? current.message : "Invio non riuscito."); }
    finally { setSubmitting(false); }
  }

  return <AppShell>
    <main className="min-h-screen bg-white pb-28">
    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
       Ludi Bet
    </p>

      <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
        Schedina settimanale
      </h1>

      <p className="mt-1 text-sm font-bold text-[#06142E]/50">
        Ottieni più punti e scala la classifica
      </p>
    {loading ? 
    <Message>
      Caricamento schedina...
    </Message>
     : error && !ticket ? 
    <Message error>{error}</Message> : ticket ? <>
    <div className="mt-4 flex items-justify gap-3 rounded-[18px] bg-[#F5F5F2] p-3">
      <Clock3 size={20} className="shrink-0 text-[#0B5FFF]" />
        <div>
          <p className="mt-1 text-[10px] font-black text-[#06142E]/45">
             Chiusura: {formatKickoff(ticket.closesAtLabel)}
          </p>
        </div>
    </div>
      {effectiveLocked ? 
      <div className={`mt-3 flex items-start gap-3 rounded-[18px] p-4 ${alreadySubmitted ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
        <LockKeyhole size={20} className="shrink-0" />
        <p className="text-sm font-bold">{alreadySubmitted ? "Schedina inviata. Le scelte sono definitive e visibili in sola lettura." : "Schedina chiusa: la prima partita della Matchweek è già iniziata."}
        </p>
      </div> : null}
      {ticket.isScored && alreadySubmitted ? <div className="mt-3 flex items-center justify-between rounded-[18px] bg-[#06142E] p-4 text-white"><div><p className="text-[9px] font-black uppercase text-white/45">Punteggio ottenuto</p><p className="mt-1 text-2xl font-black">{ticket.score ?? 0} / {ticket.maxScore}</p></div><Trophy className="text-[#FFD45A]" /></div> : null}
      {error ? <Message error>{error}</Message> : null}

      <div className="mt-5 overflow-hidden rounded-[16px]">
        <Image
          src="/games/ludi-bet-club-voucher-settimanale.png"
          alt="Indovina tutti gli esiti della giornata e vinci un voucher di 25 euro presso il centro scommesse Intralot Terzigno"
          width={994}
          height={206}
          className="h-auto w-full"
        />
      </div>

      <div className="mt-5 space-y-4">{ticket.matches.map((match, index) => {
        const current = selections[match.id];
        return <article key={match.id} className="rounded-[21px] border border-[#06142E]/10 bg-white p-4 shadow-[0_10px_28px_rgba(6,20,46,0.07)]">
          <p className="text-[9px] font-black uppercase text-[#06142E]/30">{match.competitionName} · Partita {index + 1} · {formatMatchDate(match.date, match.time)}</p>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2"><p className="text-right text-sm font-black uppercase text-[#06142E]">{match.homeTeamName}</p><span className="text-[10px] font-black text-[#06142E]/30">VS</span><p className="text-sm font-black uppercase text-[#06142E]">{match.awayTeamName}</p></div>
          {match.result ? <p className="mt-2 text-center text-lg font-black text-[#06142E]">{match.result.status === "postponed" ? "Partita rinviata" : `${match.result.homeScore} - ${match.result.awayScore}${match.result.status === "walkover" ? " · A tavolino" : ""}`}</p> : null}
          <div className="mt-4 grid grid-cols-3 gap-2">{(["1", "X", "2"] as PredictionOneXTwo[]).map((value) => <ChoiceButton key={value} selected={current?.oneXTwo === value} feedback={current?.oneXTwo === value && match.result && match.result.status !== "postponed" ? (value === match.result.oneXTwo ? "correct" : "wrong") : undefined} disabled={effectiveLocked} onClick={() => selectOneXTwo(match.id, value)}>{value}</ChoiceButton>)}</div>
          <div className="mt-2 grid grid-cols-2 gap-2">{(["under", "over"] as PredictionGoalBand[]).map((value) => <ChoiceButton key={value} selected={current?.goalBand === value} feedback={current?.goalBand === value && match.result && match.result.status === "played" ? (value === match.result.goalBand ? "correct" : "wrong") : undefined} disabled={effectiveLocked} onClick={() => selectGoalBand(match.id, value)}>{value === "under" ? "Under 7.5" : "Over 7.5"}</ChoiceButton>)}</div>
          {current && match.result ? match.result.status === "postponed" ? <p className="mt-3 text-[9px] font-black uppercase text-[#06142E]/40">Gara rinviata · 0 punti</p> : <div className="mt-3 flex gap-2 text-[9px] font-black uppercase"><span className={current.oneXTwo === match.result.oneXTwo ? "text-emerald-700" : "text-red-600"}>1X2 {current.oneXTwo === match.result.oneXTwo ? "+30" : "+0"}</span>{match.result.status === "walkover" ? <span className="text-[#06142E]/40">U/O non conteggiato</span> : <span className={current.goalBand === match.result.goalBand ? "text-emerald-700" : "text-red-600"}>U/O {current.goalBand === match.result.goalBand ? "+20" : "+0"}</span>}</div> : null}
        </article>;
      })}</div>
      {!effectiveLocked ? <button type="button" disabled={!complete || submitting} onClick={() => void submit()} className="mt-5 min-h-14 w-full rounded-[15px] bg-[#0B5FFF] text-sm font-black uppercase text-white disabled:opacity-35">{submitting ? "Invio..." : "Conferma e invia schedina"}</button> : null}

      <div className="mt-7 overflow-hidden rounded-[20px]">
        <Image
          src="/games/ludi-bet-club-premi.png"
          alt="Premio primo classificato: kit da gara della squadra a scelta"
          width={1426}
          height={364}
          className="h-auto w-full"
        />
      </div>

      <LeaderboardSection
        title="Classifica generale"
        subtitle="Ludi Bet Club"
      >
        <PredictionSeasonLeaderboard entries={ticket.seasonLeaderboard} />
      </LeaderboardSection>

      <section className="mt-6 rounded-[22px] bg-[#F5F5F2] p-3">
        <h2 className="text-xl font-black uppercase text-[#06142E]">
          Regolamento
        </h2>
        <div className="mt-3 space-y-3 text-sm font-bold leading-5 text-[#06142E]/55">
          <p><strong className="text-[#06142E]">30 punti</strong> per ogni esito indovinato</p>
          <p><strong className="text-[#06142E]">20 punti</strong> per ogni Under/Over indovinato</p>
          <p>Per una partita decisa<strong className="text-[#06142E]"> a tavolino</strong> si possono ottenere soltanto i 30 punti dell’esito 1-X-2</p>
          <p>Una partita<strong className="text-[#06142E]"> rinviata</strong> assegna 0 punti</p>
        </div>
      </section>
    </> : null}
  </main></AppShell>;
}

function LeaderboardSection({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  return <section className="mt-7">
    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">{subtitle}</p>
    <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">{title}</h2>
    <div className="mt-4">{children}</div>
  </section>;
}

function PredictionSeasonLeaderboard({ entries }: { entries: PredictionLeaderboardEntry[] }) {
  if (entries.length === 0) {
    return <Message>La classifica generale si popolerà dopo le prime schedine inviate.</Message>;
  }

  return <div className="overflow-hidden rounded-[20px] bg-white">
    {entries.slice(0, 10).map((entry) => <LeaderboardRow
      key={entry.userId}
      position={entry.position}
      name={entry.displayName}
      value={`${entry.totalScore} pt`}
      detail={`${entry.submittedTickets} ${entry.submittedTickets === 1 ? "schedina" : "schedine"}`}
    />)}
  </div>;
}

function LeaderboardRow({ position, name, value, detail }: { position: number; name: string; value: string; detail: string }) {
  return <div className="flex items-center gap-3 border-b border-[#06142E]/[0.06] px-4 py-3.5 last:border-b-0">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5F5F2] text-xs font-black text-[#06142E]">
      {position === 1 ? <Crown size={15} /> : position}
    </div>
    <p className="min-w-0 flex-1 truncate text-sm font-black text-[#06142E]">{name}</p>
    <div className="text-right">
      <p className="text-sm font-black text-[#06142E]">{value}</p>
      <p className="text-[9px] font-bold uppercase text-[#06142E]/30">{detail}</p>
    </div>
  </div>;
}

function ChoiceButton({ children, selected, feedback, disabled, onClick }: { children: React.ReactNode; selected: boolean; feedback?: "correct" | "wrong"; disabled: boolean; onClick: () => void }) { const colors = feedback === "correct" ? "bg-emerald-600 text-white" : feedback === "wrong" ? "bg-red-600 text-white" : selected ? "bg-[#0B5FFF] text-white" : "bg-[#F5F5F2] text-[#06142E]/55"; return <button type="button" disabled={disabled} onClick={onClick} className={`relative min-h-11 rounded-[12px] text-[10px] font-black uppercase ${colors} disabled:cursor-default`}>{selected ? <CheckCircle2 size={14} className="absolute right-2 top-2" /> : null}{children}</button>; }
function Message({ children, error = false }: { children: React.ReactNode; error?: boolean }) { return <div className={`mt-5 rounded-[18px] p-4 text-sm font-bold ${error ? "bg-red-50 text-red-700" : "bg-[#F5F5F2] text-[#06142E]/45"}`}>{children}</div>; }
function formatKickoff(value: string) { const [date, time] = value.split(" "); return `${date.split("-").reverse().join("/")} alle ${time}`; }
function formatMatchDate(date: string, time: string) { return `${date.split("-").reverse().join("/")} · ${time}`; }

