import type {
  Match,
} from "@/src/types/Match";

import type {
  MatchReportInput,
} from "./MatchReportInput";

export type PublishMatchCommand = {
  match: Match;
  report: MatchReportInput;
  expectedVersion?: number;
};