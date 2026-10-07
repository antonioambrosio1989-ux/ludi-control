import {
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import type { Season } from "@/src/types/Season";

const SEASONS_COLLECTION = "seasons";

type SeasonWriteGuardOptions = {
  allowCompleted?: boolean;
};

export async function assertSeasonWritable(
  seasonId: string,
  options: SeasonWriteGuardOptions = {},
): Promise<Season> {
  const normalizedSeasonId =
    seasonId.trim();

  if (!normalizedSeasonId) {
    throw new Error(
      "La stagione non è stata specificata.",
    );
  }

  const snapshot = await getDoc(
    doc(
      db,
      SEASONS_COLLECTION,
      normalizedSeasonId,
    ),
  );

  if (!snapshot.exists()) {
    throw new Error(
      "La stagione selezionata non esiste.",
    );
  }

  const data = snapshot.data();

  const status: Season["status"] =
    data.status === "active" ||
    data.status === "completed"
      ? data.status
      : "draft";

  const season: Season = {
    id: snapshot.id,

    name:
      typeof data.name === "string"
        ? data.name
        : snapshot.id,

    startYear:
      typeof data.startYear === "number"
        ? data.startYear
        : 0,

    endYear:
      typeof data.endYear === "number"
        ? data.endYear
        : 0,

    status,

    isCurrent:
      typeof data.isCurrent === "boolean"
        ? data.isCurrent
        : false,
  };

  if (
    season.status === "completed" &&
    !options.allowCompleted
  ) {
    throw new Error(
      `La stagione ${season.name} è conclusa e non può essere modificata.`,
    );
  }

  return season;
}