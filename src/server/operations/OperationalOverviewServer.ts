import "server-only";
import { listOperationalTasks } from "./OperationalTaskServer";
import { buildOperationalSuggestions } from "./OperationsAssistantPolicy";
import { getOperationsConnections } from "./OperationsConnections";
import { getPublicSeasonSummary } from "@/src/server/public/PublicSeasonSummaryServer";
import { romeKickoffMs } from "@/src/lib/time/RomeMatchTime";
import type { OperationalSuggestion } from "@/src/types/OperationalTask";
export async function getOperationalOverview(uid: string, seasonId?: string) {
  const data = await listOperationalTasks(uid);
  const suggestions = buildOperationalSuggestions(data.tasks, data.serverNowMs);
  let sportingError: string | null = null;
  if (seasonId) {
    try {
      const season = await getPublicSeasonSummary(seasonId);
      const names = new Map(
        season.teams.map((team) => [
          String(team.id),
          team.aliasName || team.name,
        ]),
      );
      const automatic: OperationalSuggestion[] = season.matches
        .filter(
          (match) =>
            ["finished", "played", "walkover"].includes(match.status) &&
            !match.report,
        )
        .slice(0, 3)
        .map((match) => ({
          id: `report-${match.phase}-${match.id}`,
          kind: "fact",
          title: "Tabellino da completare",
          reason: `${names.get(match.homeTeamId) ?? "Casa"} – ${names.get(match.awayTeamId) ?? "Ospiti"}: la partita risulta conclusa, ma il riepilogo non contiene un tabellino pubblicato.`,
          actionUrl:
            match.phase === "regularSeason"
              ? `/admin/partite/${match.id}`
              : `/admin/fasi-finali/partite/${match.id}`,
          taskTitle: `Completare tabellino: ${names.get(match.homeTeamId) ?? "Casa"} – ${names.get(match.awayTeamId) ?? "Ospiti"}`,
          dueAtMs: data.serverNowMs + 3600000,
        }));
      const upcoming = season.matches
        .filter((match) => match.status === "scheduled")
        .map((match) => ({
          ...match,
          kickoff: romeKickoffMs(match.date, match.time),
        }))
        .filter(
          (match) =>
            match.kickoff &&
            match.kickoff > data.serverNowMs &&
            match.kickoff <= data.serverNowMs + 86400000,
        )
        .sort((a, b) => a.kickoff! - b.kickoff!)[0];
      if (upcoming)
        automatic.push({
          id: `preview-${upcoming.id}`,
          kind: "fact",
          title: "Partita nelle prossime 24 ore",
          reason: `${names.get(upcoming.homeTeamId) ?? "Casa"} – ${names.get(upcoming.awayTeamId) ?? "Ospiti"}: verifica calendario, formazioni e comunicazione prepartita.`,
          actionUrl:
            upcoming.phase === "regularSeason"
              ? `/admin/partite/${upcoming.id}`
              : `/admin/fasi-finali/partite/${upcoming.id}`,
          taskTitle: "Preparare la comunicazione della prossima partita",
          dueAtMs: Math.max(
            data.serverNowMs + 60000,
            upcoming.kickoff! - 3600000,
          ),
        });
      suggestions.splice(0, 0, ...automatic);
    } catch {
      sportingError =
        "I segnali della competizione non sono disponibili. Le tue attività personali restano accessibili.";
    }
  }
  return {
    ...data,
    suggestions,
    connections: getOperationsConnections(),
    sportingError,
  };
}
