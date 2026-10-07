import type {
  FantasyRole,
} from "@/src/types/FantasySeason";

export type FantasyPlayerPoolStatus =
  | "draft"
  | "published";

export type FantasyPlayerAvailabilityStatus =
  | "eligible"
  | "left_tournament"
  | "team_withdrawn";

export type FantasyPlayer = {
  id:
    string;

  fantasySeasonId:
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

  availabilityStatus:
    FantasyPlayerAvailabilityStatus;

  createdAt?:
    unknown;

  updatedAt?:
    unknown;
};

export type FantasyPlayerPool = {
  id:
    string;

  fantasySeasonId:
    string;

  status:
    FantasyPlayerPoolStatus;

  version:
    number;

  playerCount:
    number;

  importedAt?:
    unknown;

  importedBy?:
    string;

  publishedAt?:
    unknown;

  publishedBy?:
    string;

  createdAt?:
    unknown;

  updatedAt?:
    unknown;
};

export type CreateFantasyPlayerInput = {
  fantasySeasonId:
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

export type FantasyPlayerExcelRow = {
  playerSeasonCode:
    string;

  firstName:
    string;

  lastName:
    string;

  teamCode:
    string;

  teamName:
    string;

  role:
    FantasyRole;

  cost:
    number;
};

export type FantasyPlayerImportIssueType =
  | "missing_player"
  | "missing_team"
  | "duplicate_player"
  | "invalid_role"
  | "invalid_cost"
  | "invalid_row";

export type FantasyPlayerImportIssue = {
  rowNumber:
    number;

  type:
    FantasyPlayerImportIssueType;

  message:
    string;

  playerSeasonCode?:
    string;
};

export type FantasyPlayerImportPreview = {
  rows:
    FantasyPlayerExcelRow[];

  issues:
    FantasyPlayerImportIssue[];

  totalRows:
    number;

  validRows:
    number;

  invalidRows:
    number;

  canPublish:
    boolean;
};