import type {
  FutCardResolution,
} from "@/src/application/fut/FutCardResolver";
import type {
  BuildXiCandidate,
} from "@/src/types/GamesVoting";

type FutSnapshot = {
  futRating?:
    number;
  futCard?:
    FutCardResolution;
};

export function applyBuildXiPublicationFutSnapshots({
  candidates,
  futSnapshots,
  competitionName,
  competitionLogoUrl,
}: {
  candidates:
    BuildXiCandidate[];
  futSnapshots:
    Map<
      string,
      FutSnapshot
    >;
  competitionName:
    string;
  competitionLogoUrl?:
    string;
}): BuildXiCandidate[] {
  return candidates.map(
    (
      candidate,
    ) => {
      const snapshot =
        futSnapshots.get(
          candidate.playerId,
        );

      if (
        !snapshot ||
        !Number.isFinite(
          snapshot.futRating,
        ) ||
        !snapshot.futCard
      ) {
        throw new Error(
          "BUILD_XI_FUT_SNAPSHOT_INCOMPLETE",
        );
      }

      return {
        ...candidate,
        futRating:
          snapshot.futRating,
        futCard:
          snapshot.futCard,
        competitionName,
        ...(competitionLogoUrl
          ? {
              competitionLogoUrl,
            }
          : {}),
      };
    },
  );
}

export function assertBuildXiPublicationSnapshotUnchanged({
  currentCandidates,
  refreshedCandidates,
}: {
  currentCandidates:
    BuildXiCandidate[];
  refreshedCandidates:
    BuildXiCandidate[];
}): void {
  if (
    currentCandidates.length !==
    refreshedCandidates.length
  ) {
    throw new Error(
      "BUILD_XI_PUBLICATION_SNAPSHOT_CHANGED",
    );
  }

  const currentBySeasonPlayerId =
    new Map(
      currentCandidates.map(
        (
          candidate,
        ) => [
          candidate.seasonPlayerId,
          candidate,
        ],
      ),
    );

  for (
    const refreshed of
    refreshedCandidates
  ) {
    const current =
      currentBySeasonPlayerId.get(
        refreshed.seasonPlayerId,
      );

    if (
      !current ||
      current.playerId !==
        refreshed.playerId ||
      current.teamId !==
        refreshed.teamId ||
      current.buildXiRole !==
        refreshed.buildXiRole ||
      current.originalRole !==
        refreshed.originalRole
    ) {
      throw new Error(
        "BUILD_XI_PUBLICATION_SNAPSHOT_CHANGED",
      );
    }
  }
}
