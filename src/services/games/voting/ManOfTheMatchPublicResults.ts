import type {
  ManOfTheMatchPublicResult,
  VotingAdminResults,
} from "@/src/types/GamesVoting";

export function buildManOfTheMatchPublicResult({
  adminResults,
  ownSubmission,
}: {
  adminResults:
    VotingAdminResults;
  ownSubmission:
    Record<string, unknown> |
    null;
}): ManOfTheMatchPublicResult {
  const result =
    adminResults.manOfTheMatch;

  if (
    !result
  ) {
    return {
      status:
        "completed",
      totalVotes:
        0,
      ranking:
        adminResults.choices ??
        [],
      winnerCandidateIds:
        [],
      isTie:
        false,
      winners:
        [],
    };
  }

  const ownVoteCandidateId =
    ownSubmission?.type ===
      "man_of_the_match"
      ? String(
          ownSubmission.optionId ??
          "",
        ).trim()
      : "";

  return {
    status:
      "completed",
    totalVotes:
      adminResults
        .submissionCount,
    ranking:
      adminResults.choices ??
      [],
    winnerCandidateIds:
      result
        .winnerCandidateIds,
    isTie:
      result.isTie,
    winners:
      result.winners,
    ...(ownVoteCandidateId
      ? {
          ownVoteCandidateId,
        }
      : {}),
  };
}
