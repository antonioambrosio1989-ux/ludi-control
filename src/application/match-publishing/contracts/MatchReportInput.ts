import type {
  MatchStatus,
} from "@/src/types/Match";

export type MatchReportGoalType =
  | "action"
  | "penalty"
  | "freeKick"
  | "freeShot"
  | "ownGoal";

export type MatchReportGoal = {
  id: string;

  scorerPlayerId:
    | string
    | number;

  teamId:
    | string
    | number;

  minute: number;

  type: MatchReportGoalType;

  assistPlayerId?:
    | string
    | number;
};

export type MatchReportPlayerPerformance = {
  playerId: string;

  teamId:
    | string
    | number;

  status:
    | "rated"
    | "sv";

  vote?: number;

  goals: number;
  assists: number;

  yellowCards: number;
  redCards: number;

  goalsConceded?: number;
};

export type MatchReportInput = {
  matchId: string;
  status: MatchStatus;

  homeScore: number;
  awayScore: number;

  walkoverWinnerTeamId?:
    | string
    | number;

  homePresentPlayerIds:
    string[];

  awayPresentPlayerIds:
    string[];

  performances: Record<
    string,
    MatchReportPlayerPerformance
  >;

  goals:
    MatchReportGoal[];

  mvpPlayerId?: string;
};