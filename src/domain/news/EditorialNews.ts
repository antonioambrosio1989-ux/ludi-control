import type { Match } from "@/src/types/Match";
import type { Team } from "@/src/types/Team";
import type { CloudMatchReport } from "@/src/services/match/FirebaseMatchReportRepository";
import type { CreateNewsItemInput, NewsCategory, NewsItem } from "@/src/types/NewsItem";

export const NEWS_CATEGORIES: { value: NewsCategory; label: string }[] = [
  { value: "risultato", label: "Risultato" },
  { value: "intervista", label: "Intervista" },
  { value: "calciomercato", label: "Calciomercato" },
  { value: "news", label: "News" },
];
export const NEWSPAPER_IMAGE = "/images/news-newspaper.svg";
export const TEAM_PLACEHOLDER = "/images/news-team-placeholder.svg";
export const PLAYER_PLACEHOLDER = "/images/news-player-placeholder.svg";
export function isEditorialNews(item: Pick<NewsItem, "newsType" | "editorial">): boolean {
  return item.editorial === true && NEWS_CATEGORIES.some(({ value }) => value === item.newsType);
}
// The link controls card presentation; the feed verifies the underlying publication.
export function getNewsHref(item: Pick<NewsItem, "linkUrl" | "category" | "id">): string | null {
  const href = item.linkUrl?.trim();
  if (href && /^\/(?:ludi-week(?:[/?#]|$)|comunicati(?:[/?#]|$))/.test(href)) return href;
  if (!href && /comunicat/i.test(item.category)) return `/news/${encodeURIComponent(item.id)}`;
  return null;
}
export function getNewsLabel(item: Pick<NewsItem, "newsType" | "badgeLabel" | "category">): string {
  if (item.newsType === "risultato") return item.badgeLabel || "Risultato";
  return NEWS_CATEGORIES.find(({ value }) => value === item.newsType)?.label || item.category;
}
export function getNewsImage(item: Pick<NewsItem, "newsType" | "coverUrl">): string {
  if (item.newsType === "news") return NEWSPAPER_IMAGE;
  return item.coverUrl || (item.newsType === "risultato" ? PLAYER_PLACEHOLDER : item.newsType === "intervista" ? TEAM_PLACEHOLDER : NEWSPAPER_IMAGE);
}
type NewsResultMatch = Pick<Match, "status" | "homeScore" | "awayScore" | "homeTeamId" | "awayTeamId">;
export function getPlayedMatchResult(match: NewsResultMatch, report?: CloudMatchReport) {
  if (!["played", "finished", "walkover"].includes(match.status)) return null;
  const homeScore = report?.status === "published" ? report.data.homeScore : match.homeScore;
  const awayScore = report?.status === "published" ? report.data.awayScore : match.awayScore;
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore! < 0 || awayScore! < 0) return null;
  return { homeScore: homeScore!, awayScore: awayScore! };
}
export function buildResultLabel(match: NewsResultMatch, teams: Team[], report?: CloudMatchReport): string {
  const result = getPlayedMatchResult(match, report);
  if (!result) throw new Error("Seleziona una partita già giocata con risultato confermato.");
  const name = (id: string | number) => {
    const team = teams.find((entry) => entry.id === String(id));
    if (!team) throw new Error("Squadra della partita non disponibile.");
    return team.shortName?.trim() || team.name;
  };
  return `${name(match.homeTeamId)} ${result.homeScore} - ${result.awayScore} ${name(match.awayTeamId)}`;
}
export function validateEditorialNews(input: CreateNewsItemInput): void {
  if (!input.seasonId.trim()) throw new Error("Seleziona una stagione.");
  if (!input.newsType || !NEWS_CATEGORIES.some(({ value }) => value === input.newsType)) throw new Error("Seleziona uno dei quattro tipi di news.");
  if (!input.content.trim()) throw new Error("Scrivi il testo della news.");
  if (input.newsType === "risultato" && (!input.matchId || !input.badgeLabel)) throw new Error("Seleziona una partita già giocata.");
  if (input.newsType === "intervista" && !input.teamId) throw new Error("Seleziona una squadra della stagione.");
  if (input.newsType === "calciomercato" && !input.coverUrl) throw new Error("Carica la foto della news di calciomercato.");
}
