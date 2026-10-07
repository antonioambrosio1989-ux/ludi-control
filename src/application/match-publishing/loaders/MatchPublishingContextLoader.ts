import {
  FirebaseMatchReportRepository,
  type CloudMatchReport,
} from "@/src/services/match/FirebaseMatchReportRepository";

import {
  FirebasePlayerRepository,
} from "@/src/services/player/FirebasePlayerRepository";

import {
  FirebaseSeasonPlayerRepository,
} from "@/src/services/player/FirebaseSeasonPlayerRepository";

import {
  FirebaseSeasonRepository,
} from "@/src/services/season/FirebaseSeasonRepository";

import {
  FirebaseSeasonTeamRepository,
} from "@/src/services/team/FirebaseSeasonTeamRepository";

import {
  FirebaseTeamRepository,
} from "@/src/services/team/FirebaseTeamRepository";

import type {
  Match,
} from "@/src/types/Match";

export type MatchPublishingLoadedData = {
  report: CloudMatchReport;

  season: NonNullable<
    Awaited<
      ReturnType<
        typeof FirebaseSeasonRepository.getById
      >
    >
  >;

  teams: Awaited<
    ReturnType<
      typeof FirebaseTeamRepository.getAll
    >
  >;

  players: Awaited<
    ReturnType<
      typeof FirebasePlayerRepository.getAll
    >
  >;

  seasonPlayers: Awaited<
    ReturnType<
      typeof FirebaseSeasonPlayerRepository.getBySeasonId
    >
  >;

  seasonTeams: Awaited<
    ReturnType<
      typeof FirebaseSeasonTeamRepository.getBySeasonId
    >
  >;
};

export async function loadMatchPublishingContext(
  match: Match,
): Promise<MatchPublishingLoadedData> {
  const [
    report,
    season,
    teams,
    players,
    seasonPlayers,
    seasonTeams,
  ] = await Promise.all([
    FirebaseMatchReportRepository.getByMatchId(
      String(match.id),
    ),

    FirebaseSeasonRepository.getById(
      match.seasonId,
    ),

    FirebaseTeamRepository.getAll(),

    FirebasePlayerRepository.getAll(),

    FirebaseSeasonPlayerRepository.getBySeasonId(
      match.seasonId,
    ),

    FirebaseSeasonTeamRepository.getBySeasonId(
      match.seasonId,
    ),
  ]);

  if (!report) {
    throw new Error(
      "Il tabellino pubblicato non è stato trovato.",
    );
  }

  if (report.status !== "published") {
    throw new Error(
      "Il tabellino non risulta pubblicato.",
    );
  }

  if (!season) {
    throw new Error(
      "La stagione della partita non è stata trovata.",
    );
  }

  return {
    report,
    season,
    teams,
    players,
    seasonPlayers,
    seasonTeams,
  };
}