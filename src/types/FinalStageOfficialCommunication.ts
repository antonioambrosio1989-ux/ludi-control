import type {
  OfficialCommunication,
} from "@/src/types/OfficialCommunication";

export type FinalStageOfficialCommunication =
  Omit<
    OfficialCommunication,
    | "id"
    | "matchweek"
  > & {
    id:
      string;
    phase:
      "finalStage";
    finalStageWeek:
      number;
    roundSlug:
      string;
  };
