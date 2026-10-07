import type {
  CloudMatchReport,
} from "@/src/services/match/FirebaseMatchReportRepository";

import type {
  Match,
} from "@/src/types/Match";

import type {
  PlayerProfile,
} from "@/src/types/PlayerProfile";

import type {
  Season,
} from "@/src/types/Season";

import type {
  SeasonPlayer,
} from "@/src/types/SeasonPlayer";

import type {
  SeasonTeam,
} from "@/src/types/SeasonTeam";

import type {
  Team,
} from "@/src/types/Team";

export type MatchProcessingContext = {
  match: Match;
  report: CloudMatchReport;
  season: Season;

  teams: Team[];
  seasonTeams: SeasonTeam[];

  players: PlayerProfile[];
  seasonPlayers: SeasonPlayer[];

  previousMatches: Match[];
  previousReports: CloudMatchReport[];
};