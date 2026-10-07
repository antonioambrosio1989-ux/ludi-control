import type { Match, MatchStatus, MatchType } from "@/src/types/Match";

export function mapMatch(
  documentId: string,
  data: Record<string, unknown>,
): Match {
  const rawStatus = data.status;

  const status: MatchStatus =
    rawStatus === "live" ||
    rawStatus === "finished" ||
    rawStatus === "played" ||
    rawStatus === "postponed" ||
    rawStatus === "cancelled" ||
    rawStatus === "walkover"
      ? rawStatus
      : "scheduled";

  const matchType:
  MatchType =
    data.matchType ===
    "titlePlayoff"
      ? "titlePlayoff"
      : "regularSeason";

  const matchweek =
    typeof data.matchweek === "number"
      ? data.matchweek
      : 1;

  return {
    id: documentId,

    seasonId:
      typeof data.seasonId === "string"
        ? data.seasonId
        : "",

    matchType,

    matchweek,

    matchweekId:
      typeof data.matchweekId === "string"
        ? data.matchweekId
        : `mw${matchweek}`,

    date:
      typeof data.date === "string"
        ? data.date
        : "",

    time:
      typeof data.time === "string"
        ? data.time
        : "",

    venue:
      typeof data.venue === "string"
        ? data.venue
        : "Centro Sportivo Ludi",

    homeTeamId:
      typeof data.homeTeamId === "string"
        ? data.homeTeamId
        : "",

    awayTeamId:
      typeof data.awayTeamId === "string"
        ? data.awayTeamId
        : "",

    status,

    published:
      typeof data.published === "boolean"
        ? data.published
        : false,

    homeScore:
      typeof data.homeScore === "number"
        ? data.homeScore
        : undefined,

    awayScore:
      typeof data.awayScore === "number"
        ? data.awayScore
        : undefined,

    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}
