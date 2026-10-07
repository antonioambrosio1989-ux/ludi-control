export type FantasySeasonStatus =
  | "prelaunch"
  | "player_list_draft"
  | "rosters_open"
  | "rosters_locked"
  | "active"
  | "completed";

export type FantasyRole =
  | "goalkeeper"
  | "defender"
  | "forward";

export type FantasyScoringRules = {
  goal:
    number;

  assist:
    number;

  mvp:
    number;

  goalOfTheWeek:
    number;

  penaltySaved:
    number;

  freeKickSaved:
    number;

  goalkeeperCleanSheet:
    number;

  goalkeeperOneGoalConceded:
    number;

  goalkeeperTwoGoalsConceded:
    number;

  yellowCard:
    number;

  redCard:
    number;

  penaltyMissed:
    number;

  freeKickMissed:
    number;

  ownGoal:
    number;

  goalkeeperGoalConceded:
    number;
};

export type FantasyPoliticalVotes = {
  goalkeeper:
    number;

  defender:
    number;

  forward:
    number;
};

export type FantasyRosterRules = {
  initialBudget:
    number;

  rosterSize:
    number;

  goalkeeperCount:
    number;

  defenderCount:
    number;

  forwardCount:
    number;

  maxPlayersPerRealTeam:
    number;
};

export type FantasyLineupRules = {
  lineupSize:
    number;

  startingGoalkeepers:
    number;

  startingDefenders:
    number;

  startingForwards:
    number;

  formationCode:
    string;

  benchReplacementSameRoleOnly:
    boolean;

  svIsSubstitutable:
    boolean;

  absentIsSubstitutable:
    boolean;

  politicalVoteIsValid:
    boolean;

  politicalVoteUsesBonusesAndMaluses:
    boolean;
};

export type FantasyFormationWindowRules = {
  openWeekday:
    number;

  openHour:
    number;

  openMinute:
    number;

  closeMinutesBeforeFirstMatch:
    number;

  reminderMinutesBeforeClose:
    number;
};

export type FantasyDefaultScores = {
  firstMatchweekMissingFormation:
    number;

  frozenParticipantMatchweek:
    number;
};

export type FantasyVisibilityRules = {
  requiresGamesPass:
    boolean;

  formationsVisibleAfterDeadline:
    boolean;

  rostersVisibleAfterRosterLock:
    boolean;
};

export type FantasySeason = {
  id:
    string;

  gamesSeasonId:
    string;

  gameId:
    string;

  competitionId:
    string;

  sportSeasonId:
    string;

  name:
    string;

  status:
    FantasySeasonStatus;

  interestOpensAt?:
    unknown;

  playerListTargetDate?:
    unknown;

  playerListPublishedAt?:
    unknown;

  rosterOpensAt?:
    unknown;

  rosterClosesAt?:
    unknown;

  firstScoringMatchweek:
    number;

  lastScoringMatchweek?:
    number;

  rosterRules:
    FantasyRosterRules;

  lineupRules:
    FantasyLineupRules;

  formationWindowRules:
    FantasyFormationWindowRules;

  defaultScores:
    FantasyDefaultScores;

  politicalVotes:
    FantasyPoliticalVotes;

  scoringRules:
    FantasyScoringRules;

  scoringUsesOriginalMatchweekOnly:
    boolean;

  visibilityRules:
    FantasyVisibilityRules;

  createdAt?:
    unknown;

  updatedAt?:
    unknown;

  completedAt?:
    unknown;

  createdBy?:
    string;

  updatedBy?:
    string;
};

export type CreateFantasySeasonInput = {
  id:
    string;

  gamesSeasonId:
    string;

  gameId:
    string;

  competitionId:
    string;

  sportSeasonId:
    string;

  name:
    string;

  interestOpensAt?:
    Date;

  playerListTargetDate?:
    Date;

  rosterClosesAt?:
    Date;

  firstScoringMatchweek:
    number;

  lastScoringMatchweek?:
    number;

  createdBy?:
    string;
};

export type UpdateFantasySeasonInput = {
  fantasySeasonId:
    string;

  name:
    string;

  status:
    FantasySeasonStatus;

  interestOpensAt?:
    Date;

  playerListTargetDate?:
    Date;

  playerListPublishedAt?:
    Date;

  rosterOpensAt?:
    Date;

  rosterClosesAt?:
    Date;

  firstScoringMatchweek:
    number;

  lastScoringMatchweek?:
    number;

  rosterRules:
    FantasyRosterRules;

  lineupRules:
    FantasyLineupRules;

  formationWindowRules:
    FantasyFormationWindowRules;

  defaultScores:
    FantasyDefaultScores;

  politicalVotes:
    FantasyPoliticalVotes;

  scoringRules:
    FantasyScoringRules;

  scoringUsesOriginalMatchweekOnly:
    boolean;

  visibilityRules:
    FantasyVisibilityRules;

  updatedBy?:
    string;
};

export const DEFAULT_FANTASY_ROSTER_RULES:
  FantasyRosterRules = {
    initialBudget:
      150,

    rosterSize:
      8,

    goalkeeperCount:
      2,

    defenderCount:
      3,

    forwardCount:
      3,

    maxPlayersPerRealTeam:
      1,
  };

export const DEFAULT_FANTASY_LINEUP_RULES:
  FantasyLineupRules = {
    lineupSize:
      5,

    startingGoalkeepers:
      1,

    startingDefenders:
      2,

    startingForwards:
      2,

    formationCode:
      "1-2-2",

    benchReplacementSameRoleOnly:
      true,

    svIsSubstitutable:
      true,

    absentIsSubstitutable:
      true,

    politicalVoteIsValid:
      true,

    politicalVoteUsesBonusesAndMaluses:
      false,
  };

export const DEFAULT_FANTASY_FORMATION_WINDOW_RULES:
  FantasyFormationWindowRules = {
    // 1 = lunedì.
    openWeekday:
      1,

    openHour:
      8,

    openMinute:
      0,

    closeMinutesBeforeFirstMatch:
      30,

    reminderMinutesBeforeClose:
      120,
  };

export const DEFAULT_FANTASY_DEFAULT_SCORES:
  FantasyDefaultScores = {
    firstMatchweekMissingFormation:
      30,

    frozenParticipantMatchweek:
      30,
  };

export const DEFAULT_FANTASY_POLITICAL_VOTES:
  FantasyPoliticalVotes = {
    goalkeeper:
      6,

    defender:
      6.5,

    forward:
      7,
  };

export const DEFAULT_FANTASY_SCORING_RULES:
  FantasyScoringRules = {
    goal:
      1.5,

    assist:
      0.5,

    mvp:
      1,

    goalOfTheWeek:
      3,

    penaltySaved:
      1.5,

    freeKickSaved:
      0.5,

    goalkeeperCleanSheet:
      3,

    goalkeeperOneGoalConceded:
      2,

    goalkeeperTwoGoalsConceded:
      1,

    yellowCard:
      -0.5,

    redCard:
      -1,

    penaltyMissed:
      -1.5,

    freeKickMissed:
      -0.5,

    ownGoal:
      -1,

    goalkeeperGoalConceded:
      -0.5,
  };

export const DEFAULT_FANTASY_VISIBILITY_RULES:
  FantasyVisibilityRules = {
    requiresGamesPass:
      true,

    formationsVisibleAfterDeadline:
      true,

    rostersVisibleAfterRosterLock:
      true,
  };