"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { auditWithdrawalSchedule } from "@/src/services/withdrawal/WithdrawalScheduleAudit";
import { planPartialSeasonWithdrawal } from "@/src/services/withdrawal/WithdrawalPartialSchedule";
import {
  previewTeamWithdrawal,
  type SeasonScheduleFormat,
  type WithdrawalMatch,
} from "@/src/services/withdrawal/WithdrawalPreview";

type Props = {
  seasonId: string;
  seasonName: string;
  teamId: string;
  teamName: string;
  seasonTeamIds: string[];
  onClose: () => void;
};

export default function WithdrawalPreviewPanel({
  seasonId, seasonName, teamId, teamName, seasonTeamIds, onClose,
}: Props) {
  const [matches, setMatches] = useState<WithdrawalMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<SeasonScheduleFormat | "">("");
  const [returnStart, setReturnStart] = useState("");
  const [retirementRound, setRetirementRound] = useState("");


  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getDocs(query(collection(db, "matches"), where("seasonId", "==", seasonId)))
      .then((snapshot) => {
        if (!active) return;
        const result: WithdrawalMatch[] = [];
        for (const document of snapshot.docs) {
          const data = document.data();
          if (typeof data.homeTeamId !== "string" && typeof data.homeTeamId !== "number") continue;
          if (typeof data.awayTeamId !== "string" && typeof data.awayTeamId !== "number") continue;
          result.push({
            id: document.id,
            homeTeamId: data.homeTeamId,
            awayTeamId: data.awayTeamId,
            matchType: typeof data.matchType === "string" ? data.matchType : undefined,
            matchweek: typeof data.matchweek === "number" ? data.matchweek : Number.NaN,
            date: typeof data.date === "string" ? data.date : "",
            time: typeof data.time === "string" ? data.time : "",
            status: typeof data.status === "string" ? data.status : "unknown",
          });
        }
        setMatches(result);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Impossibile leggere il calendario.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [seasonId]);

  const nowRome = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date()).replace(" ", "T");
  const audit = useMemo(() => format && !loading && !error
    ? auditWithdrawalSchedule({ format, teamIds: seasonTeamIds, matches, nowRome })
    : null, [format, seasonTeamIds, loading, error, matches, nowRome]);
  const preview = useMemo(() => format && audit?.phase && !loading && !error
    ? previewTeamWithdrawal({ teamId, seasonFormat: format, withdrawalPhase: audit.phase, matches })
    : null, [teamId, format, audit, loading, error, matches]);

  // Piano provvisorio: la fase si ricava dalla giornata dichiarata e dal confine
  // configurato. Il calendario incompleto NON viene interpretato come stagione conclusa.
  const partialPlan = useMemo(() => {
    if (!format || loading || error || !retirementRound.trim()) return null;
    return planPartialSeasonWithdrawal({
      seasonId, teamId, effectiveMatchweek: Number(retirementRound),
      rules: {
        format,
        firstReturnMatchweek: format === "single_round_robin" ? null :
          returnStart.trim() ? Number(returnStart) : null,
      },
    }, matches);
  }, [seasonId, teamId, format, returnStart, retirementRound, matches, loading, error]);

  // Anche con calendario incompleto possiamo mostrare le gare GIA' caricate,
  // ma NON dedurre il girone o il numero totale di partite rimanenti.
  const knownTeamMatches = useMemo(() => matches.filter((match) =>
    (match.matchType ?? "regularSeason") === "regularSeason" &&
    (String(match.homeTeamId) === teamId || String(match.awayTeamId) === teamId)
  ), [matches, teamId]);
  const knownCompleted = knownTeamMatches.filter((match) =>
    ["played", "finished", "walkover"].includes(match.status)).length;
  const knownPending = knownTeamMatches.filter((match) =>
    ["scheduled", "postponed"].includes(match.status)).length;
  const invalidDates = matches.filter((match) =>
    (match.matchType ?? "regularSeason") === "regularSeason").some((match) =>
    !Number.isInteger(match.matchweek) || match.matchweek < 1 || !match.date || !match.time);
  const issues = [...(audit?.issues ?? []), ...(preview?.issues ?? []), ...(invalidDates ? ["Calendario incompleto: verificare giornata, data e ora prima di qualsiasi ritiro."] : [])];

  return (
    <section className="mt-4 rounded-[18px] border-2 border-amber-300 bg-amber-50 p-4" aria-label="Anteprima ritiro squadra">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black uppercase text-[#06142E]">Simulazione ritiro — {teamName}</h3>
          <p className="mt-1 text-xs font-semibold text-[#06142E]/60">Stagione: {seasonName}. Nessuna scrittura su Firestore.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg border border-[#06142E]/20 bg-white px-3 py-2 text-xs font-bold">Chiudi</button>
      </div>

      <p className="mt-3 text-xs font-semibold text-amber-900">
        Il formato della stagione non è ancora registrato: va verificato manualmente. La fase viene calcolata automaticamente
        soltanto se il calendario contiene tutti gli incontri previsti tra le squadre iscritte. Una simulazione incompleta non autorizza il ritiro.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-black text-[#06142E]">Formato dichiarato per la simulazione
          <select className="mt-1 w-full rounded-lg border bg-white p-3 text-sm" value={format} onChange={(event) => {
            setFormat(event.target.value as SeasonScheduleFormat | "");
          }}>
            <option value="">Seleziona formato</option>
            <option value="single_round_robin">Sola andata</option>
            <option value="double_round_robin">Andata e ritorno</option>
          </select>
        </label>
        <div className="text-xs font-black text-[#06142E]">Fase del ritiro (calcolo automatico)
          <div className="mt-1 min-h-12 rounded-lg border bg-white p-3 text-sm">
            {!audit ? "In attesa di formato" : !audit.complete ? "Non determinabile: calendario da completare" :
              audit.phase === "second_leg" ? "Girone di ritorno" : format === "single_round_robin" ? "Sola andata" : "Girone di andata"}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-amber-300 bg-white p-3">
        <p className="text-sm font-black text-[#06142E]">Simulazione con calendario settimanale parziale</p>
        <p className="mt-1 text-xs text-[#06142E]/65">Inserisci i parametri del regolamento e la giornata effettiva del ritiro. Non vengono salvati in Firestore. La fase è calcolata dai parametri, non dal numero di gare caricate.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {format === "double_round_robin" && <label className="text-xs font-bold">Prima giornata del ritorno
            <input type="number" min="2" step="1" value={returnStart} onChange={e => setReturnStart(e.target.value)} placeholder="Es. 12" className="mt-1 w-full rounded-lg border p-3 text-sm" />
          </label>}
          <label className="text-xs font-bold">Giornata effettiva del ritiro (da verificare)
            <input type="number" min="1" step="1" value={retirementRound} onChange={e => setRetirementRound(e.target.value)} placeholder="Es. 6" className="mt-1 w-full rounded-lg border p-3 text-sm" />
          </label>
        </div>
        {partialPlan && <div className="mt-3 rounded-lg bg-[#F4F7FB] p-3 text-xs">
          {partialPlan.valid ? <>
            <p className="font-black">Fase calcolata: {partialPlan.phase === "second_leg" ? "Girone di ritorno" : "Girone di andata / sola andata"}</p>
            <p className="mt-1">Regola: {partialPlan.policy === "void_all" ? "Annullamento integrale delle gare contro la squadra" : "Risultati precedenti conservati; vittorie a tavolino maturate alle giornate future"}.</p>
            <p className="mt-1">Partite gia' note: {partialPlan.knownPlayed.length} concluse, {partialPlan.knownPending.length} ancora in calendario.</p>
            <p className="mt-2 font-bold text-amber-800">Anteprima parziale, non autorizza alcun ritiro. Le gare non ancora importate saranno gestite solo dal futuro motore di esecuzione.</p>
          </> : <p className="font-bold text-red-700">Configurazione da verificare: {partialPlan.issues.join(" ")}</p>}
        </div>}
      </div>
      {audit && <p className="mt-3 text-xs font-semibold text-[#06142E]/70">
        Calendario Regular Season: {audit.foundMatches} incontri caricati su {audit.expectedMatches} attesi secondo il formato dichiarato.
        {audit.firstReturnMatchweek !== null ? ` Inizio ritorno: giornata ${audit.firstReturnMatchweek}.` : ""}
      </p>}
      {loading && <p className="mt-4 text-sm font-bold">Caricamento calendario...</p>}
      {error && <p role="alert" className="mt-4 text-sm font-bold text-red-700">{error}</p>}
      {!loading && !error && !preview && <p className="mt-4 text-sm text-[#06142E]/65">{format ? "Impossibile simulare la fase con calendario incompleto o incoerente." : "Seleziona il formato verificato per avviare il controllo."}</p>}
      {!loading && !error && audit && !audit.complete && (
        <div className="mt-3 space-y-3 rounded-xl border-2 border-red-300 bg-white p-4" role="status">
          <p className="text-sm font-black text-red-800">Calendario non completo o incoerente — ritiro bloccato</p>
          <p className="text-xs font-semibold leading-5 text-[#06142E]/75">
            I dati seguenti descrivono esclusivamente le partite gia' caricate per {teamName}.
            Non indicano quante gare restano nell'intera stagione e non autorizzano annullamenti o tavolini.
          </p>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-[#F4F7FB] p-3"><p className="text-xl font-black">{knownCompleted}</p><p className="text-[10px] font-bold">Risultati presenti nel calendario</p></div>
            <div className="rounded-lg bg-[#F4F7FB] p-3"><p className="text-xl font-black">{knownPending}</p><p className="text-[10px] font-bold">Gare future gia' caricate</p></div>
          </div>
          <p className="text-xs font-black text-red-800">Girone effettivo non determinabile. Nessuna decisione sportiva calcolata.</p>
        </div>
      )}
      {issues.length > 0 && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
        <p className="font-black">Controlli bloccanti</p>
        {issues.slice(0, 12).map((issue, index) => <p className="mt-1" key={index}>{issue}</p>)}
        {issues.length > 12 && <p className="mt-1">... e altri {issues.length - 12} problemi.</p>}
      </div>}
      {preview && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-white p-3 text-sm font-bold text-[#06142E]">
            {preview.policy === "void_all"
              ? "Regola: annullamento dei risultati precedenti e delle gare future."
              : "Regola: risultati precedenti validi; tavolini futuri da attribuire solo alla giornata prevista."}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-white p-2"><p className="text-xl font-black">{preview.alreadyPlayed.length}</p><p className="text-[10px] font-bold">Gare disputate</p></div>
            <div className="rounded-lg bg-white p-2"><p className="text-xl font-black">{preview.pending.length}</p><p className="text-[10px] font-bold">Gare da giocare</p></div>
            <div className="rounded-lg bg-white p-2"><p className="text-xl font-black">{preview.impactedTeamIds.length}</p><p className="text-[10px] font-bold">Avversarie coinvolte</p></div>
          </div>
          {preview.alreadyPlayed.length > 0 && <div className="rounded-lg bg-white p-3 text-xs">
            <p className="font-black">Gare già disputate {preview.policy === "void_all" ? "da escludere dai conteggi" : "da conservare"}</p>
            <p className="mt-1 break-words text-[#06142E]/65">{preview.alreadyPlayed.join(", ")}</p>
          </div>}
          {preview.pending.length > 0 && <div className="rounded-lg bg-white p-3 text-xs">
            <p className="font-black">Gare future {preview.policy === "void_all" ? "da annullare" : "da gestire progressivamente"}</p>
            <ul className="mt-2 max-h-44 space-y-1 overflow-auto">
              {preview.pending.map((item) => <li key={item.matchId}>Giornata {item.matchweek}: {item.matchId} (avversaria ID {item.opponentTeamId})</li>)}
            </ul>
          </div>}
          <p className="text-xs font-semibold text-[#06142E]/65">Il motore non ha ancora ricalcolato i dati individuali, la disciplina o le classifiche: questa anteprima mostra le gare coinvolte, non i nuovi valori finali.</p>
        </div>
      )}
      <button type="button" disabled className="mt-4 w-full cursor-not-allowed rounded-xl bg-[#06142E]/20 px-4 py-3 text-xs font-black text-[#06142E]/60">
        Conferma ritiro — non disponibile (sola simulazione)
      </button>
    </section>
  );
}
