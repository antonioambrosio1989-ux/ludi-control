import type {
  VotingMatchOption,
  VotingStatus,
} from "@/src/types/GamesVoting";

export function resolveScorePredictionLifecycle({
  persistedStatus,
  kickoffAtMs,
  nowMs,
}: {
  persistedStatus:
    VotingStatus;
  kickoffAtMs:
    number;
  nowMs:
    number;
}): VotingStatus {
  if (
    persistedStatus !==
    "published"
  ) {
    return persistedStatus;
  }

  if (
    !Number.isFinite(
      kickoffAtMs,
    ) ||
    kickoffAtMs <=
      0
  ) {
    return "closed";
  }

  return nowMs >=
    kickoffAtMs
    ? "closed"
    : "published";
}

export function assertScorePredictionMatchIdentity({
  stored,
  current,
}: {
  stored:
    VotingMatchOption;
  current:
    VotingMatchOption;
}): void {
  if (
    stored.id !==
      current.id ||
    stored.seasonId !==
      current.seasonId ||
    stored.competitionId !==
      current.competitionId ||
    stored.homeTeamId !==
      current.homeTeamId ||
    stored.awayTeamId !==
      current.awayTeamId
  ) {
    throw new Error(
      "SCORE_PREDICTION_MATCH_CHANGED",
    );
  }
}
