import type {
  RatedPlayer,
} from "@/src/services/rating/RatingPlayerBuilder";

import type {
  TeamStrengthResult,
} from "@/src/services/rating/RatingEngine";

export type RatingProcessingResult = {
  players: RatedPlayer[];

  teams: {
    home: TeamStrengthResult;
    away: TeamStrengthResult;
  };
};