"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import AppShell from "@/components/ui/AppShell";
import NewsCard from "@/components/news/NewsCard";
import { useCompetition } from "@/src/contexts/CompetitionContext";
import { useCompetitionMatches } from "@/src/hooks/useCompetitionMatches";
import { useMatches } from "@/src/hooks/useMatches";
import { FirebaseMatchReportRepository, type CloudMatchReport } from "@/src/services/match/FirebaseMatchReportRepository";
import { useTeams } from "@/src/hooks/useTeams";
import { useSeasonTeams } from "@/src/hooks/useSeasonTeams";
import { useFirebaseIdToken } from "@/src/hooks/useFirebaseIdToken";
import { useUploadThing } from "@/src/utils/uploadthing";
import { FirebaseNewsRepository } from "@/src/services/news/FirebaseNewsRepository";
import { FirebasePlayerRepository } from "@/src/services/player/FirebasePlayerRepository";
import { buildResultLabel, getPlayedMatchResult, NEWS_CATEGORIES, NEWSPAPER_IMAGE, PLAYER_PLACEHOLDER, isEditorialNews } from "@/src/domain/news/EditorialNews";
import type { CreateNewsItemInput, NewsCategory, NewsItem, NewsStatus } from "@/src/types/NewsItem";

const control = "mt-1 w-full rounded-xl border border-[#06142E]/15 bg-white p-3 text-sm text-[#06142E]";
export default function AdminNewsScreen() {
  const { currentSeason, isLoading } = useCompetition();
  return <AppShell>
    <header className="mt-2 mb-5">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#06142E]/35">Centro di controllo</p>
      <h1 className="mt-1 text-3xl font-black uppercase tracking-[-0.03em] text-[#06142E] sm:text-4xl">News</h1>
      <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-[#06142E]/45">
        Scrivi, controlla in anteprima e pubblica le notizie della stagione corrente.
      </p>
    </header>
    {isLoading ? <p>Caricamento...</p> : currentSeason ? <NewsEditor key={currentSeason.id} seasonId={currentSeason.id} /> : <p>Seleziona una competizione con una stagione in corso.</p>}
  </AppShell>;
}

function NewsEditor({ seasonId }: { seasonId: string }) {
  const [reports, setReports] = useState<CloudMatchReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  useEffect(() => FirebaseMatchReportRepository.subscribePublishedBySeason(seasonId, (next) => { setReports(next); setReportsLoading(false); setReportsError(null); }, (error) => { setReportsError(error.message); setReportsLoading(false); }), [seasonId]);
  const { matches, isLoading: matchesLoading, error: matchesError } = useMatches(seasonId);
  const { allMatches, isFinalStageLoading, finalStageError } = useCompetitionMatches({ seasonId, regularSeasonMatches: matches, regularSeasonReports: reports });
  const { teams, isLoading: teamsLoading, error: teamsError } = useTeams();
  const { entries, isLoading: seasonTeamsLoading, error: seasonTeamsError } = useSeasonTeams(seasonId);
  const { idToken } = useFirebaseIdToken();
  const { startUpload, isUploading } = useUploadThing("newsImageUploader", { headers: () => new Headers(idToken ? { Authorization: `Bearer ${idToken}` } : {}) });
  const [items, setItems] = useState<NewsItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newsType, setNewsType] = useState<NewsCategory>("news");
  const [matchId, setMatchId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [content, setContent] = useState("");
  const [transferImage, setTransferImage] = useState({ url: "", key: "" });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mvpImage, setMvpImage] = useState<{ playerId: string; url: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => FirebaseNewsRepository.subscribeAllBySeason(seasonId, (next) => { setItems(next); setListLoading(false); setListError(null); }, (error) => { setListError(error.message); setListLoading(false); }), [seasonId]);
  const selectedMatch = allMatches.find((match) => `${match.phase}:${match.id}` === matchId);
  const report = selectedMatch?.report;
  const mvpPlayerId = report?.data.mvpPlayerId;
  useEffect(() => {
    if (!mvpPlayerId) return;
    let active = true;
    void FirebasePlayerRepository.getById(mvpPlayerId).then((player) => { if (active) setMvpImage({ playerId: mvpPlayerId, url: player?.photoUrl || "" }); }).catch(() => { if (active) setMvpImage({ playerId: mvpPlayerId, url: "" }); });
    return () => { active = false; };
  }, [mvpPlayerId]);
  const playedMatches = allMatches
    .filter((match) => match.seasonId === seasonId && teams.some((team) => team.id === String(match.homeTeamId)) && teams.some((team) => team.id === String(match.awayTeamId)) && getPlayedMatchResult(match, match.report))
    .sort((a, b) => {
      const dateOrder = b.date.localeCompare(a.date);
      return dateOrder !== 0 ? dateOrder : b.time.localeCompare(a.time);
    });
  const seasonTeamIds = new Set(entries.map((entry) => entry.teamId));
  const participatingTeams = teams.filter((team) => seasonTeamIds.has(team.id));
  const selectedTeam = participatingTeams.find((team) => team.id === teamId);
  const resultLabel = selectedMatch && getPlayedMatchResult(selectedMatch, report) && teams.some((team) => team.id === String(selectedMatch.homeTeamId)) && teams.some((team) => team.id === String(selectedMatch.awayTeamId)) ? buildResultLabel(selectedMatch, teams, report) : "Risultato";
  const coverUrl = newsType === "news" ? NEWSPAPER_IMAGE : newsType === "calciomercato" ? transferImage.url : newsType === "intervista" ? selectedTeam?.logoUrl : report?.data.mvpPhotoUrl || (mvpImage?.playerId === mvpPlayerId ? mvpImage?.url : "") || PLAYER_PLACEHOLDER;
  const input: CreateNewsItemInput = { seasonId, editorial: true, newsType, category: newsType, content: content.trim(), coverUrl, coverKey: newsType === "calciomercato" ? transferImage.key : undefined, badgeLabel: newsType === "risultato" ? resultLabel : undefined, matchId: newsType === "risultato" ? selectedMatch?.id : undefined, matchPhase: newsType === "risultato" ? selectedMatch?.phase : undefined, teamId: newsType === "intervista" ? teamId : undefined, status: "draft" };

  function reset() { setEditingId(null); setNewsType("news"); setMatchId(""); setTeamId(""); setContent(""); setTransferImage({ url: "", key: "" }); if (fileInput.current) fileInput.current.value = ""; }
  function edit(item: NewsItem) { setEditingId(item.id); setNewsType(item.newsType || "news"); setMatchId(item.matchId ? `${item.matchPhase || "regularSeason"}:${item.matchId}` : ""); setTeamId(item.teamId || ""); setContent(item.content); setTransferImage(item.newsType === "calciomercato" ? { url: item.coverUrl || "", key: item.coverKey || "" } : { url: "", key: "" }); setFeedback(null); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function upload(file: File) {
    if (!idToken) { setFeedback("Sessione amministratore non disponibile. Effettua nuovamente l’accesso."); return; }
    if (!file.type.startsWith("image/") || file.size > 16 * 1024 * 1024) { setFeedback("Scegli un’immagine fino a 16 MB."); return; }
    setFeedback(null);
    try { const result = (await startUpload([file]))?.[0]; if (!result) throw new Error("Upload non riuscito."); if (alive.current) setTransferImage({ url: result.ufsUrl || result.url, key: result.key }); }
    catch (error) { if (alive.current) setFeedback(error instanceof Error ? error.message : "Upload non riuscito."); }
  }
  async function save(status: NewsStatus) {
    if (busy || isUploading) return;
    setBusy(true); setFeedback(null);
    try {
      if (newsType === "risultato" && (!selectedMatch || !getPlayedMatchResult(selectedMatch, report) || matchesLoading || reportsLoading || isFinalStageLoading || teamsLoading || reportsError || finalStageError)) throw new Error("Seleziona una partita già giocata della stagione corrente.");
      if (newsType === "intervista" && (!selectedTeam || seasonTeamsLoading || teamsLoading)) throw new Error("Seleziona una squadra della stagione corrente.");
      let resolvedCover = input.coverUrl;
      if (newsType === "risultato" && mvpPlayerId && !report?.data.mvpPhotoUrl) {
        const player = await FirebasePlayerRepository.getById(mvpPlayerId);
        resolvedCover = player?.photoUrl || PLAYER_PLACEHOLDER;
      }
      const data = { ...input, coverUrl: resolvedCover, status };
      if (editingId) await FirebaseNewsRepository.update({ ...data, itemId: editingId }); else await FirebaseNewsRepository.create(data);
      if (alive.current) { reset(); setFeedback(status === "published" ? "News pubblicata." : "Bozza salvata."); }
    } catch (error) { if (alive.current) setFeedback(error instanceof Error ? error.message : "Salvataggio non riuscito."); }
    finally { if (alive.current) setBusy(false); }
  }
  async function unpublish(item: NewsItem) {
    if (busy) return;
    setBusy(true);
    try { await FirebaseNewsRepository.setStatus(item.id, "draft"); if (alive.current) setFeedback("News ritirata dalla pubblicazione."); }
    catch (error) { if (alive.current) setFeedback(error instanceof Error ? error.message : "Operazione non riuscita."); }
    finally { if (alive.current) setBusy(false); }
  }
  async function remove(item: NewsItem) {
    if (busy || !window.confirm("Eliminare questa news?")) return;
    setBusy(true);
    try { await FirebaseNewsRepository.remove(item.id); if (alive.current) { if (editingId === item.id) reset(); setFeedback("News eliminata."); } }
    catch (error) { if (alive.current) setFeedback(error instanceof Error ? error.message : "Eliminazione non riuscita."); }
    finally { if (alive.current) setBusy(false); }
  }
  const dataError = newsType === "risultato" ? matchesError || reportsError || finalStageError || teamsError : newsType === "intervista" ? seasonTeamsError || teamsError : null;
  return <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
    <form onSubmit={(event: FormEvent) => { event.preventDefault(); void save("draft"); }} className="space-y-4 rounded-[20px] border border-[#06142E]/8 bg-white p-5 xl:sticky xl:top-5">
      <h2 className="text-xl font-black">{editingId ? "Modifica news" : "Nuova news"}</h2>
      <fieldset disabled={busy || isUploading} className="space-y-4 disabled:opacity-60">
        <label className="block text-sm font-bold">Categoria<select className={control} value={newsType} onChange={(event) => setNewsType(event.target.value as NewsCategory)}>{NEWS_CATEGORIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
        {newsType === "risultato" && <label className="block text-sm font-bold">Partita già giocata<select className={control} value={matchId} onChange={(event) => setMatchId(event.target.value)}><option value="">Seleziona partita</option>{playedMatches.map((match) => <option key={`${match.phase}:${match.id}`} value={`${match.phase}:${match.id}`}>{match.date} · {buildResultLabel(match, teams, match.report)}{match.phase === "finalStage" ? " · Fasi finali" : ""}</option>)}</select>{!matchesLoading && playedMatches.length === 0 && <p className="mt-2 text-xs">Nessuna partita già giocata con un risultato disponibile.</p>}<p className="mt-2 text-xs font-normal">La foto è quella del migliore in campo del tabellino. Se manca, viene mostrata una sagoma.</p></label>}
        {newsType === "intervista" && <label className="block text-sm font-bold">Squadra<select className={control} value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">Seleziona squadra</option>{participatingTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>{!seasonTeamsLoading && participatingTeams.length === 0 && <p className="mt-2 text-xs">Nessuna squadra associata alla stagione.</p>}</label>}
        {newsType === "calciomercato" && <label className="block text-sm font-bold">Foto<input ref={fileInput} className={control} type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /><p className="mt-2 text-xs font-normal">La foto verrà mostrata in formato quadrato, ritagliata al centro.</p></label>}
        <label className="block text-sm font-bold">Testo<textarea className={control} rows={3} required value={content} onChange={(event) => setContent(event.target.value)} /></label>
        {dataError && <p role="alert" className="text-sm text-red-700">{dataError}</p>}
        <div className="flex flex-wrap gap-3"><button type="submit" className="rounded-xl bg-[#06142E]/10 px-4 py-3 text-sm font-bold">Salva bozza</button><button type="button" onClick={() => void save("published")} className="rounded-xl bg-[#06142E] px-4 py-3 text-sm font-bold text-white">Pubblica ora</button>{editingId && <button type="button" onClick={reset} className="px-3 text-sm font-bold">Annulla modifica</button>}</div>
      </fieldset>
      {isUploading && <p role="status">Caricamento foto...</p>}
      {busy && <p role="status">Salvataggio...</p>}
      {feedback && <p role="status" className="text-sm font-bold">{feedback}</p>}
      <h3 className="text-sm font-black uppercase">Anteprima</h3><NewsCard item={{ ...input, id: editingId || "preview" }} />
    </form>
    <section className="min-w-0"><h2 className="text-xl font-black">Notizie</h2>{listLoading && <p>Caricamento...</p>}{listError && <p role="alert">{listError}</p>}{!listLoading && !listError && items.length === 0 && <p>Nessuna notizia.</p>}<div className="mt-4 grid gap-4 2xl:grid-cols-2">{items.map((item) => <div key={item.id} className="rounded-[18px] border border-[#06142E]/8 bg-white p-3"><p className="mb-2 text-xs font-bold uppercase">{item.status === "published" ? "Pubblicata" : "Bozza"}{!isEditorialNews(item) && " · Notizia precedente: modifica e ripubblica per inserirla nel nuovo formato"}</p><NewsCard item={item} /><div className="mt-1 flex flex-wrap gap-3"><button type="button" disabled={busy || isUploading} onClick={() => edit(item)} className="text-sm font-bold">Modifica{item.status === "draft" ? " e pubblica" : ""}</button>{item.status === "published" && <button type="button" disabled={busy || isUploading} onClick={() => void unpublish(item)} className="text-sm font-bold">Ritira</button>}<button type="button" disabled={busy || isUploading} onClick={() => void remove(item)} className="text-sm font-bold text-red-700">Elimina</button></div></div>)}</div></section>
  </div>;
}
