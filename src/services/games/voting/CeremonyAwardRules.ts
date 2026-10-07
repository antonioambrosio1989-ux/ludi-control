import type {
  CeremonyAwardConfig,
  VotingCandidate,
} from "@/src/types/GamesVoting";

export function normalizeCeremonyAwardName(
  value:
    unknown,
): string {
  const normalized =
    normalizeText(
      value,
    );

  if (
    !normalized
  ) {
    throw new Error(
      "AWARD_NAME_REQUIRED",
    );
  }

  return normalized;
}

export function normalizeCeremonyAwardCandidates(
  candidates:
    VotingCandidate[],
): VotingCandidate[] {
  const seenIds =
    new Set<
      string
    >();

  const seenPlayerIds =
    new Set<
      string
    >();

  return candidates.map(
    (
      candidate,
    ) => {
      const id =
        normalizeText(
          candidate.id,
        );

      const label =
        normalizeText(
          candidate.label,
        );

      if (
        !id ||
        !label
      ) {
        throw new Error(
          "INVALID_CEREMONY_CANDIDATE",
        );
      }

      if (
        seenIds.has(
          id,
        )
      ) {
        throw new Error(
          "DUPLICATE_CANDIDATE",
        );
      }

      seenIds.add(
        id,
      );

      const playerId =
        normalizeText(
          candidate.playerId,
        );

      if (
        playerId
      ) {
        if (
          seenPlayerIds.has(
            playerId,
          )
        ) {
          throw new Error(
            "DUPLICATE_CANDIDATE",
          );
        }

        seenPlayerIds.add(
          playerId,
        );
      }

      return {
        id,
        label,
        ...(normalizeText(
          candidate.description,
        )
          ? {
              description:
                normalizeText(
                  candidate.description,
                ),
            }
          : {}),
        ...(normalizeText(
          candidate.imageUrl,
        )
          ? {
              imageUrl:
                normalizeText(
                  candidate.imageUrl,
                ),
            }
          : {}),
        ...(playerId
          ? {
              playerId,
            }
          : {}),
        ...(normalizeText(
          candidate.teamId,
        )
          ? {
              teamId:
                normalizeText(
                  candidate.teamId,
                ),
            }
          : {}),
        ...(normalizeText(
          candidate.teamName,
        )
          ? {
              teamName:
                normalizeText(
                  candidate.teamName,
                ),
            }
          : {}),
      };
    },
  );
}

export function validateCeremonyAwardReady(
  config:
    CeremonyAwardConfig,
): void {
  normalizeCeremonyAwardName(
    config.awardName,
  );

  const candidates =
    normalizeCeremonyAwardCandidates(
      config.candidates,
    );

  if (
    candidates.length <
    2
  ) {
    throw new Error(
      "VOTING_NOT_READY",
    );
  }
}

function normalizeText(
  value:
    unknown,
): string {
  return String(
    value ??
    "",
  )
    .trim()
    .replace(
      /\s+/g,
      " ",
    );
}
