import { buildCompletedMatchweeks } from "@/src/application/ludi-week/buildCompletedMatchweeks";
import type { Match } from "@/src/types/Match";
import type { CloudMatchReport } from "@/src/services/match/FirebaseMatchReportRepository";
import type { MatchweekAwardsPublication } from "@/src/types/MatchweekAwardsPublication";
import type { OfficialCommunication } from "@/src/types/OfficialCommunication";
import type { NewsItem } from "@/src/types/NewsItem";

// Announcement cards are a view of the actual publication, never independent news documents.
export function buildPublicationNewsFeed({ seasonId, publications, communications, matches, reports }: {
  seasonId: string;
  publications: MatchweekAwardsPublication[];
  communications: OfficialCommunication[];
  matches: Match[];
  reports: CloudMatchReport[];
}): NewsItem[] {
  const completed = new Set(buildCompletedMatchweeks({
    matches: matches.filter((match) => match.seasonId === seasonId && match.published),
    reports: reports.filter((report) => !report.seasonId || report.seasonId === seasonId),
  }));
  const hubs: NewsItem[] = publications.filter((item) => item.seasonId === seasonId && item.status === "published" && item.ludiWeekPublished === true && completed.has(item.matchweek)).map((item) => ({
    id: `hub-publication-${item.id}`, seasonId, matchweek: item.matchweek,
    category: "MATCHWEEK HUB", content: `Matchweek Hub · Matchweek ${item.matchweek} disponibile`,
    linkUrl: `/ludi-week?matchweek=${item.matchweek}`, status: "published",
    publishedAt: item.updatedAt, createdAt: item.createdAt,
  }));
  const notices: NewsItem[] = communications.filter((item) => item.seasonId === seasonId && item.status === "published").map((item) => ({
    id: `communication-publication-${item.id}`, seasonId, matchweek: item.matchweek,
    category: "COMUNICATO", content: item.title || `Comunicato · Matchweek ${item.matchweek}`,
    linkUrl: `/comunicati/mw${item.matchweek}`, status: "published",
    publishedAt: item.publishedAt, createdAt: item.createdAt,
  }));
  return [...hubs, ...notices];
}
