import type {
  Match,
  MatchType,
} from "@/src/types/Match";

import type {
  FinalStageCompetition,
  FinalStageLeg,
  FinalStageMatch,
  FinalStageRound,
} from "@/src/types/FinalStageMatch";

import type {
  MatchStatus,
} from "@/src/types/MatchStatus";

import type {
  MatchWizardData,
} from "@/src/types/MatchWizardData";

export type CompetitionMatchPhase =
  | "regularSeason"
  | "finalStage";

export type CompetitionMatchReport = {
  phase:
    CompetitionMatchPhase;

  matchId:
    string;

  seasonId?:
    string;

  status:
    "draft" |
    "published";

  version:
    number;

  data:
    MatchWizardData;

  updatedAt?:
    unknown;

  publishedAt?:
    unknown;
};

type CompetitionMatchBase = {
  id:
    string;

  seasonId:
    string;

  phase:
    CompetitionMatchPhase;

  homeTeamId:
    string;

  awayTeamId:
    string;

  date:
    string;

  time:
    string;

  venue:
    string;

  status:
    MatchStatus;

  published:
    boolean;

  homeScore?:
    number;

  awayScore?:
    number;

  report?:
    CompetitionMatchReport;
};

export type RegularSeasonCompetitionMatch =
  CompetitionMatchBase & {
    phase:
      "regularSeason";

    matchType?:
      MatchType;

    matchweek:
      number;

    matchweekId:
      string;

    source:
      Match;
  };

export type FinalStageCompetitionMatch =
  CompetitionMatchBase & {
    phase:
      "finalStage";

    competition:
      FinalStageCompetition;

    round:
      FinalStageRound;

    group?:
      string;

    leg:
      FinalStageLeg;

    matchOrder?:
      number;

    finalStageWeek?:
      number;

    extraTimePlayed?:
      boolean;

    homePenalties?:
      number;

    awayPenalties?:
      number;

    source:
      FinalStageMatch;
  };

export type CompetitionMatch =
  | RegularSeasonCompetitionMatch
  | FinalStageCompetitionMatch;
