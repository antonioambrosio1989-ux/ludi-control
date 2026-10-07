import {
  FirebaseMatchRepository,
} from "@/src/services/match/FirebaseMatchRepository";

import {
  FirebaseMatchReportRepository,
  type CloudMatchReport,
} from "@/src/services/match/FirebaseMatchReportRepository";

import type {
  MatchProcessingContext,
} from "../contracts/MatchProcessingContext";

import type {
  Match,
} from "@/src/types/Match";

import type {
  Season,
} from "@/src/types/Season";

import type {
  Team,
} from "@/src/types/Team";

import type {
  PlayerProfile,
} from "@/src/types/PlayerProfile";

import type {
  SeasonPlayer,
} from "@/src/types/SeasonPlayer";

import type {
  SeasonTeam,
} from "@/src/types/SeasonTeam";

type BuildMatchProcessingContextInput = {
  match: Match;
  report: CloudMatchReport;
  season: Season;
  teams: Team[];
  players: PlayerProfile[];
  seasonPlayers: SeasonPlayer[];
  seasonTeams?: SeasonTeam[];
};

function isMatchBefore(
  candidate: Match,
  currentMatch: Match,
): boolean {
  if (
    candidate.matchweek !==
    currentMatch.matchweek
  ) {
    return (
      candidate.matchweek <
      currentMatch.matchweek
    );
  }

  const candidateDateTime =
    `${candidate.date} ${candidate.time}`;

  const currentDateTime =
    `${currentMatch.date} ${currentMatch.time}`;

  return (
    candidateDateTime <
    currentDateTime
  );
}

export async function buildMatchProcessingContext({
  match,
  report,
  season,
  teams,
  players,
  seasonPlayers,
  seasonTeams = [],
}: BuildMatchProcessingContextInput): Promise<MatchProcessingContext> {
  const [
    seasonMatches,
    allReports,
  ] = await Promise.all([
    FirebaseMatchRepository.getBySeason(
      match.seasonId,
    ),

    FirebaseMatchReportRepository.getAll(),
  ]);

  const previousMatches =
    seasonMatches
      .filter(
        (candidate) =>
          String(candidate.id) !==
            String(match.id) &&
          isMatchBefore(
            candidate,
            match,
          ),
      )
      .sort(
        (
          firstMatch,
          secondMatch,
        ) => {
          if (
            firstMatch.matchweek !==
            secondMatch.matchweek
          ) {
            return (
              firstMatch.matchweek -
              secondMatch.matchweek
            );
          }

          const firstDateTime =
            `${firstMatch.date} ${firstMatch.time}`;

          const secondDateTime =
            `${secondMatch.date} ${secondMatch.time}`;

          return firstDateTime.localeCompare(
            secondDateTime,
          );
        },
      );

  const previousMatchIds =
    new Set(
      previousMatches.map(
        (previousMatch) =>
          String(previousMatch.id),
      ),
    );

  const previousReports =
    allReports.filter(
      (candidate) =>
        candidate.status ===
          "published" &&
        previousMatchIds.has(
          String(candidate.matchId),
        ),
    );

  return {
    match,
    report,
    season,
    teams,
    players,
    seasonPlayers,
    seasonTeams,
    previousMatches,
    previousReports,
  };
}