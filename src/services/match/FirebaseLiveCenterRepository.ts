import { collection, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { mapMatch } from "@/src/lib/firestore/mappers/MatchDocumentMapper";
import { mapFinalStageMatch } from "@/src/services/final-stage/FirebaseFinalStageMatchRepository";
import type { LiveCenterEntry } from "@/src/services/match/LiveCenterRules";

/** Admin-only queries. One listener per collection, across all competitions and seasons. */
export function subscribeLiveCenter(
  onChange: (phase: LiveCenterEntry["phase"], entries: LiveCenterEntry[]) => void,
  onError: (phase: LiveCenterEntry["phase"], error: Error) => void,
): Unsubscribe {
  let active = true;
  const unsubscribes: Unsubscribe[] = [];
  try {
    for (const phase of ["regularSeason", "finalStage"] as const) {
      const source = phase === "regularSeason" ? "matches" : "finalStageMatches";
      unsubscribes.push(onSnapshot(
        query(collection(db, source), where("status", "in", ["live", "scheduled", "finished"])),
        { includeMetadataChanges: true },
        (snapshot) => {
          if (!active) return;
          onChange(phase, snapshot.docs.map((document) => ({
            phase,
            match: phase === "regularSeason" ? mapMatch(document.id, document.data()) : mapFinalStageMatch(document.id, document.data()),
            confirmed: !snapshot.metadata.fromCache && !document.metadata.hasPendingWrites,
          })));
        },
        (error) => { if (active) onError(phase, error); },
      ));
    }
  } catch (error) {
    active = false;
    for (const unsubscribe of unsubscribes) unsubscribe();
    throw error;
  }
  return () => {
    active = false;
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
}
