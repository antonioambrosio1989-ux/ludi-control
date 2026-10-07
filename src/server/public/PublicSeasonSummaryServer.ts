import "server-only";
import { unstable_cache } from "next/cache";
import { adminDb } from "@/src/lib/firebaseAdmin";
import { mapMatch } from "@/src/lib/firestore/mappers/MatchDocumentMapper";
import { calculateStandings } from "@/src/services/standings/StandingsCalculator";
import { buildStandingsMovementMap } from "@/src/services/standings/StandingsMovement";
import { calculateFirebasePlayerStats } from "@/src/services/stats/FirebasePlayerStatsCalculator";
import type { CloudMatchReport } from "@/src/services/match/FirebaseMatchReportRepository";
import type { CloudFinalStageMatchReport } from "@/src/services/final-stage/FirebaseFinalStageMatchReportRepository";
import type { FinalStageMatch } from "@/src/types/FinalStageMatch";
import type { Team } from "@/src/types/Team";
import type { CompetitionMatch } from "@/src/types/CompetitionMatch";
import type { MatchWizardData } from "@/src/types/MatchWizardData";

// This cache contains only published sporting data. Private collections and users never enter it.
export const getPublicSeasonData = unstable_cache(
  async (seasonId: string) => {
    const season = await adminDb.collection("seasons").doc(seasonId).get();
    if (!season.exists) throw new Error("SEASON_NOT_FOUND");
    const [regular, reports, finals, finalReports, entries, teamDocs] =
      await Promise.all([
        adminDb
          .collection("matches")
          .where("seasonId", "==", seasonId)
          .where("published", "==", true)
          .get(),
        adminDb
          .collection("matchReports")
          .where("seasonId", "==", seasonId)
          .where("status", "==", "published")
          .get(),
        adminDb
          .collection("finalStageMatches")
          .where("seasonId", "==", seasonId)
          .where("published", "==", true)
          .get(),
        adminDb
          .collection("finalStageMatchReports")
          .where("seasonId", "==", seasonId)
          .where("status", "==", "published")
          .get(),
        season.ref.collection("teamEntries").get(),
        adminDb.collection("teams").get(),
      ]);
    const matches = regular.docs.map((d) => mapMatch(d.id, d.data()));
    const publishedReports = reports.docs.map(
      (d) => d.data() as CloudMatchReport,
    );
    const finalStageMatches = finals.docs.map(
      (d) => ({ ...d.data(), id: d.id }) as FinalStageMatch,
    );
    const finalStageReports = finalReports.docs.map(
      (d) => d.data() as CloudFinalStageMatchReport,
    );
    const competitionId = String(season.data()?.competitionId ?? "");
    const teamIds = entries.docs.map((d) => String(d.data().teamId ?? d.id));
    const teams = teamDocs.docs.map((d) => ({
      id: d.id,
      name: String(d.data().name ?? "Squadra"),
      aliasName: d.data().aliasName ?? null,
      logoUrl: d.data().logoUrl ?? null,
      shortName: d.data().shortName ?? null,
    })) as Team[];
    const standings = calculateStandings(matches, publishedReports, {
      competitionId,
      teamIds,
    });
    const movement = Object.fromEntries(
      buildStandingsMovementMap({
        standings,
        matches,
        reports: publishedReports,
        competitionId,
      }),
    );
    return {
      matches,
      publishedReports,
      finalStageMatches,
      finalStageReports,
      teams,
      standings,
      movement,
      competitionId,
      computedAt: new Date().toISOString(),
    };
  },
  ["public-season-v1"],
  { revalidate: 15 },
);

export async function getPublicSeasonSummary(seasonId: string) {
  const data = await getPublicSeasonData(seasonId);
  const compactReport = (
    report: CloudMatchReport | CloudFinalStageMatchReport | undefined,
    phase: "regularSeason" | "finalStage",
  ) =>
    report
      ? {
          phase,
          matchId: String(report.matchId),
          seasonId,
          status: "published" as const,
          version: report.version,
          data: {
            matchId: String(report.matchId),
            status: report.data.status,
            homeScore: report.data.homeScore,
            awayScore: report.data.awayScore,
            homePresentPlayerIds: [],
            awayPresentPlayerIds: [],
            performances: {},
            goals: [],
          } as MatchWizardData,
        }
      : undefined;
  // Explicit field whitelist: never serialize raw Firestore sporting documents.
  const matches: CompetitionMatch[] = [
    ...data.matches.map((match) => ({
      id: match.id,
      seasonId,
      phase: "regularSeason" as const,
      homeTeamId: String(match.homeTeamId),
      awayTeamId: String(match.awayTeamId),
      date: match.date,
      time: match.time,
      venue: match.venue,
      status: match.status,
      published: true,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      matchType: match.matchType,
      matchweek: match.matchweek,
      matchweekId: match.matchweekId,
      source: match,
      report: compactReport(
        data.publishedReports.find((r) => String(r.matchId) === match.id),
        "regularSeason",
      ),
    })),
    ...data.finalStageMatches.map((match) => ({
      id: match.id,
      seasonId,
      phase: "finalStage" as const,
      homeTeamId: String(match.homeTeamId),
      awayTeamId: String(match.awayTeamId),
      date: match.date,
      time: match.time,
      venue: match.venue,
      status: match.status,
      published: true,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      competition: match.competition,
      round: match.round,
      leg: match.leg,
      matchOrder: match.matchOrder,
      source: {
        id: match.id,
        seasonId,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        date: match.date,
        time: match.time,
        venue: match.venue,
        status: match.status,
        published: true,
        competition: match.competition,
        round: match.round,
        leg: match.leg,
        matchOrder: match.matchOrder,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        extraTimePlayed: match.extraTimePlayed,
        homePenalties: match.homePenalties,
        awayPenalties: match.awayPenalties,
      },
      report: compactReport(
        data.finalStageReports.find((r) => String(r.matchId) === match.id),
        "finalStage",
      ),
    })),
  ];
  return {
    seasonId,
    competitionId: data.competitionId,
    teams: data.teams,
    standings: data.standings,
    movement: data.movement,
    matches,
    computedAt: data.computedAt,
  };
}
export async function getPublicPlayerSummary(
  seasonId: string,
  playerId: string,
) {
  const data = await getPublicSeasonData(seasonId);
  return {
    ...calculateFirebasePlayerStats({
      playerId,
      matches: data.matches,
      reports: data.publishedReports,
      teams: data.teams,
      finalStageMatches: data.finalStageMatches,
      finalStageReports: data.finalStageReports,
    }).stats,
    computedAt: data.computedAt,
  };
}

export const getPublicMvpSummary = unstable_cache(
  async (seasonId: string) => {
    const { buildMvpEntries } = await import(
      "@/src/application/public-summary/buildMvpEntries"
    );
    const { mapPlayer } = await import(
      "@/src/lib/firestore/mappers/PlayerDocumentMapper"
    );
    const data = await getPublicSeasonData(seasonId);
    const [roster, players] = await Promise.all([
      adminDb
        .collection("seasonPlayers")
        .where("seasonId", "==", seasonId)
        .get(),
      adminDb.collection("players").get(),
    ]);
    return buildMvpEntries({
      seasonId,
      seasonPlayers: roster.docs.map(
        (d) =>
          ({
            ...d.data(),
            id: d.id,
          }) as import("@/src/types/SeasonPlayer").SeasonPlayer,
      ),
      players: players.docs.map((d) => mapPlayer(d)),
      matches: data.matches,
      reports: data.publishedReports,
      teams: data.teams,
    });
  },
  ["public-mvp-v1"],
  { revalidate: 30 },
);
