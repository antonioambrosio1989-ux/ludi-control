import type {
  CeremonyAwardPublicResult,
  GamesVotingPoll,
  VotingAdminResults,
} from "@/src/types/GamesVoting";

export function buildCeremonyAwardPublicResult({
  poll,
  adminResults,
  ownSubmission,
}: {
  poll:
    GamesVotingPoll;
  adminResults:
    VotingAdminResults;
  ownSubmission:
    Record<string, unknown> |
    null;
}): CeremonyAwardPublicResult {
  const ceremony =
    poll.ceremonyAward;

  if (
    !ceremony
  ) {
    throw new Error(
      "VOTING_NOT_READY",
    );
  }

  const result =
    adminResults.ceremonyAward;

  const ownVoteCandidateId =
    ownSubmission?.type ===
      "ceremony_award"
      ? String(
          ownSubmission.optionId ??
          "",
        ).trim()
      : "";

  return {
    status:
      "completed",
    awardName:
      ceremony.awardName,
    totalVotes:
      adminResults
        .submissionCount,
    ranking:
      adminResults.choices ??
      [],
    winnerCandidateIds:
      result
        ?.winnerCandidateIds ??
      [],
    isTie:
      result
        ?.isTie ??
      false,
    winners:
      result
        ?.winners ??
      [],
    ...(ownVoteCandidateId
      ? {
          ownVoteCandidateId,
        }
      : {}),
  };
}
