import type {
  MatchProcessingResult,
} from "../../match-processing/contracts/MatchProcessingResult";

export type PublishMatchProcessingStatus =
  | "completed"
  | "failed";

export type PublishMatchResult = {
  success: true;

  matchId: string;
  reportStatus: "published";

  processing: {
    status: PublishMatchProcessingStatus;
    result?: MatchProcessingResult;
    error?: string;
  };
};