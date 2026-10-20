import type { Match } from "@/src/types/Match";
import type { FinalStageMatch } from "@/src/types/FinalStageMatch";

export type LiveCenterEntry = {
  phase: "regularSeason" | "finalStage";
  match: Match | FinalStageMatch;
  confirmed: boolean;
};

export function liveCenterKey(entry: LiveCenterEntry): string {
  return `${entry.phase}:${entry.match.seasonId}:${entry.match.id}`;
}

/** Calendar times are interpreted in Europe/Rome, independent of the admin's device. */
export function isAutomaticLiveDue(match: Pick<Match, "date" | "time" | "status" | "published">, now: Date): boolean {
  if (match.status !== "scheduled" || !match.published) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(match.date) || !/^\d{2}:\d{2}$/.test(match.time)) return false;
  const [year, month, day] = match.date.split("-").map(Number);
  const [hour, minute] = match.time.split(":").map(Number);
  const scheduled = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (scheduled.getUTCFullYear() !== year || scheduled.getUTCMonth() !== month - 1 ||
    scheduled.getUTCDate() !== day || hour > 23 || minute > 59) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const value = (name: string) => Number(parts.find((part) => part.type === name)?.value);
  const local = new Date(Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute")));
  const matchday = new Date(local);
  if (value("hour") < 2) matchday.setUTCDate(matchday.getUTCDate() - 1);
  return match.date === matchday.toISOString().slice(0, 10) &&
    local.getTime() >= scheduled.getTime() + 15 * 60_000;
}
