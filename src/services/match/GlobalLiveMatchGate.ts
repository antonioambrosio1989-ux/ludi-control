import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import {
  db,
} from "@/src/lib/firebase";

export type MatchLifecyclePhase =
  | "regularSeason"
  | "finalStage";

const REGULAR_SEASON_COLLECTION =
  "matches";

const FINAL_STAGE_COLLECTION =
  "finalStageMatches";

export async function getOppositePhaseMatchIds({
  seasonId,
  phase,
}: {
  seasonId:
    string;

  phase:
    MatchLifecyclePhase;
}): Promise<string[]> {
  const normalizedSeasonId =
    seasonId.trim();

  if (
    !normalizedSeasonId
  ) {
    return [];
  }

  const oppositeCollection =
    phase ===
    "regularSeason"
      ? FINAL_STAGE_COLLECTION
      : REGULAR_SEASON_COLLECTION;

  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          oppositeCollection,
        ),

        where(
          "seasonId",
          "==",
          normalizedSeasonId,
        ),
      ),
    );

  return snapshot.docs.map(
    (
      currentDocument,
    ) =>
      currentDocument.id,
  );
}
