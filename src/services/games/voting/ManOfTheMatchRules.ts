import type {
  VotingCandidate,
} from "@/src/types/GamesVoting";

export function canonicalizeManOfTheMatchCandidates({
  requestedCandidates,
  eligibleCandidates,
  homeTeamId,
  awayTeamId,
}: {
  requestedCandidates:
    VotingCandidate[];
  eligibleCandidates:
    VotingCandidate[];
  homeTeamId:
    string;
  awayTeamId:
    string;
}): VotingCandidate[] {
  if (
    requestedCandidates.length >
    4
  ) {
    throw new Error(
      "MOTM_EXACTLY_FOUR",
    );
  }

  const eligibleByPlayerId =
    new Map<
      string,
      VotingCandidate
    >();

  for (
    const candidate of
    eligibleCandidates
  ) {
    const playerId =
      canonicalPlayerId(
        candidate,
      );

    if (
      !playerId
    ) {
      continue;
    }

    eligibleByPlayerId.set(
      playerId,
      {
        ...candidate,
        id:
          playerId,
        playerId,
      },
    );
  }

  const seen =
    new Set<
      string
    >();

  return requestedCandidates.map(
    (
      requested,
    ) => {
      const playerId =
        canonicalPlayerId(
          requested,
        );

      if (
        !playerId ||
        seen.has(
          playerId,
        )
      ) {
        throw new Error(
          "INVALID_MOTM_CANDIDATE",
        );
      }

      const canonical =
        eligibleByPlayerId.get(
          playerId,
        );

      if (
        !canonical
      ) {
        throw new Error(
          "INVALID_MOTM_CANDIDATE",
        );
      }

      assertCandidateTeam({
        candidate:
          canonical,
        homeTeamId,
        awayTeamId,
      });

      seen.add(
        playerId,
      );

      /*
       * Nome, foto e squadra arrivano dallo snapshot autorevole:
       * il client non può alterare la candidatura con payload manuali.
       */
      return canonical;
    },
  );
}

export function validateManOfTheMatchReady({
  candidates,
  homeTeamId,
  awayTeamId,
}: {
  candidates:
    VotingCandidate[];
  homeTeamId:
    string;
  awayTeamId:
    string;
}): void {
  if (
    candidates.length !==
    4
  ) {
    throw new Error(
      "VOTING_NOT_READY",
    );
  }

  const playerIds =
    candidates.map(
      canonicalPlayerId,
    );

  if (
    playerIds.some(
      (
        playerId,
      ) =>
        !playerId,
    ) ||
    new Set(
      playerIds,
    ).size !==
      4
  ) {
    throw new Error(
      "INVALID_MOTM_CANDIDATE",
    );
  }

  for (
    const candidate of
    candidates
  ) {
    assertCandidateTeam({
      candidate,
      homeTeamId,
      awayTeamId,
    });
  }
}

function canonicalPlayerId(
  candidate:
    VotingCandidate,
): string {
  return String(
    candidate.playerId ??
    candidate.id ??
    "",
  ).trim();
}

function assertCandidateTeam({
  candidate,
  homeTeamId,
  awayTeamId,
}: {
  candidate:
    VotingCandidate;
  homeTeamId:
    string;
  awayTeamId:
    string;
}): void {
  const teamId =
    String(
      candidate.teamId ??
      "",
    ).trim();

  if (
    !teamId ||
    (
      teamId !==
        homeTeamId &&
      teamId !==
        awayTeamId
    )
  ) {
    throw new Error(
      "INVALID_MOTM_CANDIDATE",
    );
  }
}
