"use client";

import { useState } from "react";
import { auth } from "@/src/lib/firebase";
import type { UnifiedWithdrawalPreview } from "@/src/services/withdrawal/WithdrawalUnifiedPreview";
import type { WithdrawalActivationAudit } from "@/src/services/withdrawal/WithdrawalActivationAudit";
import { summarizeWithdrawalActivation } from "@/src/services/withdrawal/WithdrawalActivationPresentation";
import type { PreviewNotice, MatchReportCheck } from "@/src/services/withdrawal/WithdrawalPreviewPresentation";
import { displayIdentity, requiresMissingReportReview } from "@/src/services/withdrawal/WithdrawalPreviewPresentation";
import { formatWithdrawalNotice } from "@/src/services/withdrawal/WithdrawalNoticeIdentity";

type PreviewResponse = {
  preview: UnifiedWithdrawalPreview;
  warnings: string[];
  notices: PreviewNotice[];
  names: { teams: Record<string,string>; players: Record<string,string> };
  missingReportMatches: MatchReportCheck[];
  sourceCounts: { importedMatches: number; publishedReports: number; seasonPlayers: number; disciplinaryRecords: number; suspensions: number };
  readOnly: true;
  activationAudit?: WithdrawalActivationAudit;
};
type Props = { seasonId: string; teamId: string; teamName: string; effectiveMatchweek: number };
const signed = (n: number) => n > 0 ? `+${n}` : String(n);
const td = "border-b border-slate-200 px-3 py-2 text-right tabular-nums whitespace-nowrap";
const th = "sticky top-0 bg-slate-100 px-3 py-2 text-right font-bold text-slate-800 whitespace-nowrap";

export default function WithdrawalUnifiedPreviewPanel({ seasonId, teamId, teamName, effectiveMatchweek }: Props) {
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [showIds, setShowIds] = useState(false);
  async function loadPreview() {
    if (busy) return;
    setBusy(true); setError(""); setData(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Accesso amministratore richiesto.");
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/withdrawals/preview?seasonId=${encodeURIComponent(seasonId)}&teamId=${encodeURIComponent(teamId)}`,
        { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
      const result = await res.json() as PreviewResponse & {error?: string};
      if (!res.ok) throw new Error(result.error ?? "Caricamento anteprima non riuscito.");
      setData(result); setExpanded(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Impossibile caricare l'anteprima."); }
    finally { setBusy(false); }
  }
  const labelName = (id: string, kind: "teams" | "players") => {
    const identity = displayIdentity(id, data?.names[kind] ?? {});
    return <span title={id} className={identity.unresolved ? "font-semibold text-amber-800" : "font-semibold text-slate-900"}>
      {identity.name}{identity.unresolved && <span className="ml-1 text-[10px]">(ID non risolto)</span>}
      {showIds && !identity.unresolved && <span className="ml-1 text-[10px] font-normal text-slate-500">({id})</span>}
    </span>;
  };
  const noticeMatchNames: Record<string, string> = {};
  for (const match of data?.missingReportMatches ?? []) {
    const home = data?.names.teams[match.homeTeamId]?.trim() || match.homeTeamId;
    const away = data?.names.teams[match.awayTeamId]?.trim() || match.awayTeamId;
    noticeMatchNames[match.matchId] = `${home} – ${away} (giornata ${match.matchweek})`;
  }
  const noticeLabel = (message: string) => formatWithdrawalNotice(
    message, data?.names.players ?? {}, showIds, noticeMatchNames,
  );
  const notices = data?.notices ?? [];
  const blocking = notices.filter(n => n.severity === "blocking");
  const review = notices.filter(n => n.severity === "review");
  const information = notices.filter(n => n.severity === "information");
  const activation = summarizeWithdrawalActivation(data?.activationAudit);
  const activationItems = data?.activationAudit?.checks ?? [];
  const activationGroups = [
    { title: "Funzionalità non ancora disponibili", subtitle: "Requisiti tecnici mancanti prima di un ritiro effettivo", items: activationItems.filter(item => activation.pendingFeatures.includes(item.code)), style: "border-amber-300 bg-amber-50 text-amber-950" },
    { title: "Anomalie bloccanti dei dati", subtitle: "Richiedono correzione o approfondimento", items: activationItems.filter(item => item.severity === "blocking" && !activation.pendingFeatures.includes(item.code)), style: "border-red-300 bg-red-50 text-red-950" },
    { title: "Controlli amministrativi e calendario", subtitle: "Non sono di per sé errori; vanno gestiti prima dell’applicazione", items: activationItems.filter(item => item.severity === "review"), style: "border-slate-300 bg-white text-slate-800" },
    { title: "Informazioni", subtitle: "Osservazioni del controllo", items: activationItems.filter(item => item.severity === "information"), style: "border-slate-200 bg-white text-slate-800" },
  ];
  const statusLabels: Record<string,string> = { scheduled:"In programma", postponed:"Rinviata", finished:"Conclusa", played:"Giocata", live:"In diretta", walkover:"A tavolino", cancelled:"Annullata" };
  return <div className="mt-3 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm sm:p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-black text-[#06142E]">Anteprima sportiva e disciplinare — {teamName}</h3>
        <p className="mt-1 text-xs text-slate-600">Ritiro simulato alla giornata {effectiveMatchweek} · Nessuna modifica ai dati ufficiali</p></div>
      <button type="button" disabled={busy} onClick={() => void loadPreview()} className="rounded-lg bg-[#06142E] px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
        {busy ? "Calcolo in corso…" : data ? "Ricalcola anteprima" : "Calcola anteprima (solo lettura)"}
      </button>
    </div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {data && <div className="mt-4 space-y-4">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">
        <p className="font-black">Simulazione non autorizzata all'applicazione</p>
        <p className="mt-1 text-xs">Il ritiro definitivo rimane disabilitato anche in assenza di avvisi. I risultati dipendono dai dati importati e devono essere verificati.</p>
      </div>
      <section className="space-y-3 rounded-xl border border-slate-300 bg-white p-3 sm:p-4" aria-label="Audit preliminare di attivazione">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h4 className="font-black text-[#06142E]">Audit di attivazione — fase 7B</h4>
            <p className="mt-1 text-xs text-slate-600">Controlli preliminari separati dalla simulazione sportiva. La conferma definitiva resta disabilitata.</p></div>
          <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-black text-red-900">NON ATTIVABILE</span>
        </div>
        {activation.available && data.activationAudit ? <>
          <p className="text-xs text-slate-700">Gare importate: <strong>{data.activationAudit.source.imported}/{data.activationAudit.source.expected}</strong> · Tabellini pubblicati: <strong>{data.activationAudit.source.published}</strong> · Gare della squadra interessata: <strong>{data.activationAudit.source.affectedFixtures}</strong></p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["Controlli senza anomalie rilevate", activation.passed.length], ["Funzionalità mancanti", activation.missing.length], ["Anomalie bloccanti", activation.blocking.length], ["Da verificare", activation.review.length]].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-slate-200 bg-slate-50 p-2"><p className="text-[11px] text-slate-600">{label}</p><p className="text-lg font-black text-[#06142E]">{value}</p></div>)}
          </div>
          {activation.passed.length > 0 && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-950"><h5 className="text-xs font-black">Controlli senza anomalie rilevate</h5><ul className="mt-1 list-disc space-y-1 pl-4 text-xs">{activation.passed.map(value => <li key={value}>{value}</li>)}</ul><p className="mt-2 text-[11px]">Questi controlli non costituiscono autorizzazione all’applicazione.</p></div>}
          {activationGroups.filter(group => group.items.length > 0).map(group => <div key={group.title} className={`rounded-lg border p-3 ${group.style}`}><h5 className="text-xs font-black">{group.title} ({group.items.length})</h5><p className="mt-1 text-[11px]">{group.subtitle}</p><ul className="mt-2 list-disc space-y-2 pl-4 text-xs">{group.items.map(item => <li key={item.code}><span className="font-semibold">{item.message}</span>{item.matchIds?.length ? <p className="mt-1 text-[11px]">Gare coinvolte: {item.matchIds.map(id => noticeMatchNames[id] ?? id).join(" · ")}{showIds && <span className="block text-slate-500">ID: {item.matchIds.join(", ")}</span>}</p> : null}</li>)}</ul></div>)}
        </> : <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-950">Audit di attivazione assente o non valido nella risposta. Nessuna conclusione favorevole può essere tratta: ritiro non attivabile.</div>}
      </section>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          ["Gare escluse", data.preview.overview.excludedMatches],
          ["Tabellini esclusi", data.preview.overview.excludedReports],
          ["Tavolini futuri", data.preview.overview.scheduledWalkovers],
          ["Rinvii da verificare", data.preview.overview.postponedForReview],
          ["Giocatori coinvolti", data.preview.overview.affectedPlayers],
          ["Casi disciplinari", data.preview.overview.disciplinaryCasesForReview],
        ].map(([label,value]) => <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-600">{label}</div><div className="text-xl font-black text-[#06142E]">{value}</div>
        </div>)}
      </div>
      <p className="text-xs text-slate-600">Dati letti: {data.sourceCounts.importedMatches} gare · {data.sourceCounts.publishedReports} tabellini · {data.sourceCounts.seasonPlayers} iscrizioni giocatori · {data.sourceCounts.suspensions} squalifiche registrate.</p>
      <section className="space-y-3">
        <h4 className="font-black text-[#06142E]">Avvisi e verifiche</h4>
        {blocking.length > 0 && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-950"><h5 className="font-black">Verifiche bloccanti ({blocking.length})</h5><ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{blocking.map(n=><li key={n.message}>{noticeLabel(n.message)}</li>)}</ul></div>}
        {review.length > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950"><h5 className="font-black">Da verificare ({review.length})</h5><ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{review.map(n=><li key={n.message}>{noticeLabel(n.message)}</li>)}</ul></div>}
        {information.length > 0 && <div className="rounded-lg border border-slate-200 bg-white p-3 text-slate-800"><h5 className="font-black">Informazioni ({information.length})</h5><ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{information.map(n=><li key={n.message}>{noticeLabel(n.message)}</li>)}</ul></div>}
        {notices.length === 0 && <p className="text-xs text-slate-600">Nessun avviso dal motore. Non costituisce autorizzazione all'applicazione.</p>}
      </section>
      <button type="button" onClick={() => setExpanded(v=>!v)} className="text-xs font-black text-[#06142E] underline">{expanded ? "Nascondi dettagli" : "Mostra dettagli"}</button>
      {expanded && <div className="space-y-5">
        <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={showIds} onChange={e=>setShowIds(e.target.checked)}/> Mostra anche gli ID tecnici</label>
        <section><h4 className="mb-2 font-black text-[#06142E]">Classifica — variazioni rispetto alla situazione attuale</h4>
          {data.preview.teamChanges.length ? <div className="max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full min-w-[540px] text-xs"><thead><tr><th className={`${th} text-left`}>Squadra</th><th className={th}>Punti</th><th className={th}>PG</th><th className={th}>GF</th><th className={th}>GS</th></tr></thead><tbody>{data.preview.teamChanges.map(t=><tr key={t.teamId} className="hover:bg-slate-50"><td className={`${td} text-left`}>{labelName(t.teamId,"teams")}</td><td className={td}>{signed(t.pointsDelta)}</td><td className={td}>{signed(t.playedDelta)}</td><td className={td}>{signed(t.goalsForDelta)}</td><td className={td}>{signed(t.goalsAgainstDelta)}</td></tr>)}</tbody></table></div> : <p className="text-xs text-slate-600">Nessuna variazione calcolata.</p>}
        </section>
        <section><h4 className="mb-2 font-black text-[#06142E]">Giocatori — variazioni</h4>
          {data.preview.playerChanges.length ? <div className="max-h-[430px] max-w-full overflow-auto rounded-lg border border-slate-200 bg-white"><table className="w-full min-w-[760px] text-xs"><thead><tr><th className={`${th} text-left`}>Giocatore</th><th className={th}>Presenze</th><th className={th}>Gol</th><th className={th}>Assist</th><th className={th}>MVP</th><th className={th}>Top Player</th><th className={th}>Clean Sheets (pt)</th><th className={th}>Media voto</th><th className={th}>60%</th></tr></thead><tbody>{data.preview.playerChanges.map(p=><tr key={p.playerId} className="hover:bg-slate-50"><td className={`${td} text-left`}>{labelName(p.playerId,"players")}</td><td className={td}>{signed(p.appearancesDelta)}</td><td className={td}>{signed(p.goalsDelta)}</td><td className={td}>{signed(p.assistsDelta)}</td><td className={td}>{signed(p.mvpDelta)}</td><td className={td}>{signed(p.topPlayerPointsDelta)}</td><td className={td}>{signed(p.cleanSheetPointsDelta)}</td><td className={td}>{p.averageVoteBefore ?? "—"} → {p.averageVoteAfter ?? "—"}</td><td className={td}>{p.eligibilityBefore === p.eligibilityAfter ? (p.eligibilityAfter ? "Sì" : "No") : `${p.eligibilityBefore?"Sì":"No"} → ${p.eligibilityAfter?"Sì":"No"}`}</td></tr>)}</tbody></table></div> : <p className="text-xs text-slate-600">Nessuna variazione calcolata.</p>}
        </section>
        <section><h4 className="mb-2 font-black text-[#06142E]">Gare importate prive di tabellino pubblicato</h4>
          {data.missingReportMatches.length ? <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white"><table className="w-full min-w-[560px] text-xs"><thead><tr><th className={`${th} text-left`}>Partita</th><th className={th}>Giornata</th><th className={`${th} text-left`}>Stato registrato</th><th className={`${th} text-left`}>Verifica</th></tr></thead><tbody>{data.missingReportMatches.map(m=><tr key={m.matchId}><td className={`${td} text-left`}>{labelName(m.homeTeamId,"teams")} – {labelName(m.awayTeamId,"teams")}{showIds && <span className="block text-[10px] text-slate-500">{m.matchId}</span>}</td><td className={td}>{m.matchweek}</td><td className={`${td} text-left`}>{statusLabels[m.status] ?? m.status}</td><td className={`${td} text-left`}>{requiresMissingReportReview(m.status)?"Da verificare: stato senza report":"Non attestata come giocata"}</td></tr>)}</tbody></table></div> : <p className="text-xs text-slate-600">Tutte le gare importate hanno un tabellino pubblicato valido.</p>}
        </section>
        <section><h4 className="mb-2 font-black text-[#06142E]">Tavolini pianificati — mai anticipati</h4>
          {data.preview.sporting.futureWalkovers.length ? <ul className="space-y-2 text-xs">{data.preview.sporting.futureWalkovers.map(w=><li key={w.matchId} className="rounded-lg border border-slate-200 bg-white p-3">Giornata {w.matchweek} · Avversaria: {labelName(w.opponentTeamId,"teams")} {showIds && <span>· Partita {w.matchId}</span>}</li>)}</ul> : <p className="text-xs text-slate-600">Nessun tavolino nel calendario attualmente importato. Le giornate future non ancora importate restano da gestire.</p>}
        </section>
      </div>}
    </div>}
  </div>;
}
