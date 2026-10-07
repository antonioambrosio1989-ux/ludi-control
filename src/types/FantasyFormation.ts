import type {
  FantasyRole,
} from "@/src/types/FantasySeason";

export type FantasyFormationSource =
  | "submitted"
  | "carried_forward"
  | "first_week_default";

export type FantasyFormationStatus =
  | "draft"
  | "submitted"
  | "locked";

export type FantasyFormationPlayer = {
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
};

export type FantasyFormationLineup = {
  goalkeeper:
    FantasyFormationPlayer | null;

  defenders:
    FantasyFormationPlayer[];

  forwards:
    FantasyFormationPlayer[];
};

export type FantasyFormationBench = {
  goalkeeper:
    FantasyFormationPlayer | null;

  defender:
    FantasyFormationPlayer | null;

  forward:
    FantasyFormationPlayer | null;
};

export type FantasyFormation = {
  id:
    string;

  fantasySeasonId:
    string;

  fantasyMatchweekId:
    string;

  fantasyTeamId:
    string;

  userId:
    string;

  matchweekNumber:
    number;

  status:
    FantasyFormationStatus;

  source:
    FantasyFormationSource;

  lineup:
    FantasyFormationLineup;

  bench:
    FantasyFormationBench;

  isValid:
    boolean;

  submittedAt?:
    unknown;

  lockedAt?:
    unknown;

  carriedForwardFromMatchweek?:
    number;

  createdAt?:
    unknown;

  updatedAt?:
    unknown;
};

export type SaveFantasyFormationInput = {
  fantasySeasonId:
    string;

  fantasyMatchweekId:
    string;

  fantasyTeamId:
    string;

  userId:
    string;

  matchweekNumber:
    number;

  lineup:
    FantasyFormationLineup;

  bench:
    FantasyFormationBench;
};

export type CarryForwardFantasyFormationInput = {
  fantasySeasonId:
    string;

  fantasyMatchweekId:
    string;

  fantasyTeamId:
    string;

  userId:
    string;

  matchweekNumber:
    number;

  previousMatchweekNumber:
    number;

  lineup:
    FantasyFormationLineup;

  bench:
    FantasyFormationBench;
};

export type FantasyFormationValidationIssueType =
  | "missing_goalkeeper"
  | "wrong_defender_count"
  | "wrong_forward_count"
  | "duplicate_player"
  | "player_not_in_roster"
  | "invalid_role";

export type FantasyFormationValidationIssue = {
  type:
    FantasyFormationValidationIssueType;

  message:
    string;

  fantasyPlayerId?:
    string;
};

export type FantasyFormationValidationResult = {
  isValid:
    boolean;

  issues:
    FantasyFormationValidationIssue[];

  startersCount:
    number;

  benchCount:
    number;
};