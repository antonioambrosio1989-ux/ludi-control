import type {
  FantasyRole,
} from "@/src/types/FantasySeason";

export type FantasyTeamStatus =
  | "draft"
  | "active"
  | "incomplete"
  | "suspended"
  | "frozen"
  | "completed";

export type FantasyRosterPlayer = {
  fantasyPlayerId:
    string;

  playerSeasonCode:
    string;

  teamCode:
    string;

  firstName:
    string;

  lastName:
    string;

  displayName:
    string;

  role:
    FantasyRole;

  cost:
    number;

  addedAt?:
    unknown;
};

export type FantasyTeam = {
  id:
    string;

  fantasySeasonId:
    string;

  gamesSeasonId:
    string;

  userId:
    string;

  userEmail:
    string;

  name:
    string;

  normalizedName:
    string;

  status:
    FantasyTeamStatus;

  roster:
    FantasyRosterPlayer[];

  budget:
    number;

  spentCredits:
    number;

  remainingCredits:
    number;

  isRosterValid:
    boolean;

  isEligible:
    boolean;

  registeredAt:
    unknown;

  rosterLockedAt?:
    unknown;

  suspendedAt?:
    unknown;

  frozenAt?:
    unknown;

  reactivatedAt?:
    unknown;

  completedAt?:
    unknown;

  createdAt?:
    unknown;

  updatedAt?:
    unknown;
};

export type CreateFantasyTeamInput = {
  fantasySeasonId:
    string;

  gamesSeasonId:
    string;

  userId:
    string;

  userEmail:
    string;

  name:
    string;

  budget:
    number;
};

export type UpdateFantasyTeamNameInput = {
  fantasyTeamId:
    string;

  name:
    string;
};

export type AddFantasyRosterPlayerInput = {
  fantasyTeamId:
    string;

  fantasyPlayerId:
    string;

  playerSeasonCode:
    string;

  teamCode:
    string;

  firstName:
    string;

  lastName:
    string;

  role:
    FantasyRole;

  cost:
    number;
};

export type RemoveFantasyRosterPlayerInput = {
  fantasyTeamId:
    string;

  fantasyPlayerId:
    string;
};

export type FantasyRosterValidationIssueType =
  | "wrong_roster_size"
  | "wrong_goalkeeper_count"
  | "wrong_defender_count"
  | "wrong_forward_count"
  | "budget_exceeded"
  | "duplicate_real_team"
  | "duplicate_player"
  | "player_not_eligible";

export type FantasyRosterValidationIssue = {
  type:
    FantasyRosterValidationIssueType;

  message:
    string;

  fantasyPlayerId?:
    string;

  teamCode?:
    string;
};

export type FantasyRosterValidationResult = {
  isValid:
    boolean;

  issues:
    FantasyRosterValidationIssue[];

  playerCount:
    number;

  goalkeeperCount:
    number;

  defenderCount:
    number;

  forwardCount:
    number;

  spentCredits:
    number;

  remainingCredits:
    number;
};