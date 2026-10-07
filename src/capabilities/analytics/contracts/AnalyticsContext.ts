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
  SeasonPlayer,
} from "@/src/types/SeasonPlayer";

import type {
  Team,
} from "@/src/types/Team";

export type AnalyticsContext = {
  seasonId:
    string;

  competitionId:
    string;

  teamIds:
    string[];

  matches:
    Match[];

  reports:
    CloudMatchReport[];

  teams:
    Team[];

  players:
    PlayerProfile[];

  seasonPlayers:
    SeasonPlayer[];
};