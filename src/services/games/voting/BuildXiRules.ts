import {
  BUILD_XI_REQUIRED_ROLE_COUNTS,
  type BuildXiCandidate,
  type BuildXiLineup,
  type BuildXiRole,
} from "@/src/types/GamesVoting";

const BUILD_XI_ROLES:
  BuildXiRole[] = [
    "goalkeeper",
    "defender",
    "midfielder",
    "forward",
  ];

export function assertBuildXiCandidateSnapshot(
  candidates:
    BuildXiCandidate[],
  eligibilityRate:
    number = 0.6,
): void {
  if (
    !Number.isFinite(
      eligibilityRate,
    ) ||
    eligibilityRate <=
      0 ||
    eligibilityRate >
      1
  ) {
    throw new Error(
      "INVALID_ELIGIBILITY_RATE",
    );
  }

  if (
    candidates.length <
    11
  ) {
    throw new Error(
      "VOTING_NOT_READY",
    );
  }

  const playerIds =
    new Set<string>();

  const seasonPlayerIds =
    new Set<string>();

  const roleCounts:
    Record<
      BuildXiRole,
      number
    > = {
      goalkeeper:
        0,
      defender:
        0,
      midfielder:
        0,
      forward:
        0,
    };

  for (
    const candidate
    of candidates
  ) {
    const playerId =
      String(
        candidate.playerId ??
          "",
      ).trim();

    const seasonPlayerId =
      String(
        candidate.seasonPlayerId ??
          "",
      ).trim();

    if (
      !playerId ||
      !seasonPlayerId ||
      playerIds.has(
        playerId,
      ) ||
      seasonPlayerIds.has(
        seasonPlayerId,
      )
    ) {
      throw new Error(
        "INVALID_CANDIDATE_SNAPSHOT",
      );
    }

    playerIds.add(
      playerId,
    );

    seasonPlayerIds.add(
      seasonPlayerId,
    );

    if (
      !BUILD_XI_ROLES.includes(
        candidate.buildXiRole,
      )
    ) {
      throw new Error(
        "INVALID_CANDIDATE_SNAPSHOT",
      );
    }

    const appearances =
      Number(
        candidate.appearances,
      );

    const availableTeamMatches =
      Number(
        candidate.availableTeamMatches,
      );

    if (
      !Number.isFinite(
        appearances,
      ) ||
      !Number.isFinite(
        availableTeamMatches,
      ) ||
      appearances <=
        0 ||
      availableTeamMatches <=
        0 ||
      appearances /
        availableTeamMatches <
        eligibilityRate
    ) {
      throw new Error(
        "INELIGIBLE_BUILD_XI_CANDIDATE",
      );
    }

    roleCounts[
      candidate.buildXiRole
    ] +=
      1;
  }

  for (
    const role
    of BUILD_XI_ROLES
  ) {
    if (
      roleCounts[
        role
      ] <
      BUILD_XI_REQUIRED_ROLE_COUNTS[
        role
      ]
    ) {
      throw new Error(
        "VOTING_NOT_READY",
      );
    }
  }
}

export function assertBuildXiLineup(
  lineup:
    BuildXiLineup,
  candidates:
    BuildXiCandidate[],
): void {
  const byId =
    new Map(
      candidates.map(
        (
          candidate,
        ) => [
          candidate.playerId,
          candidate,
        ],
      ),
    );

  const groups:
    Array<
      [
        BuildXiRole,
        string[],
      ]
    > = [
      [
        "goalkeeper",
        [
          lineup.goalkeeperId,
        ],
      ],
      [
        "defender",
        lineup.defenderIds,
      ],
      [
        "midfielder",
        lineup.midfielderIds,
      ],
      [
        "forward",
        lineup.forwardIds,
      ],
    ];

  const all =
    groups.flatMap(
      (
        [
          ,
          ids,
        ],
      ) =>
        ids,
    );

  if (
    all.length !==
      11 ||
    new Set(
      all,
    ).size !==
      11 ||
    all.some(
      (
        id,
      ) =>
        !id,
    )
  ) {
    throw new Error(
      "INVALID_LINEUP",
    );
  }

  for (
    const [
      role,
      ids,
    ]
    of groups
  ) {
    if (
      ids.length !==
        BUILD_XI_REQUIRED_ROLE_COUNTS[
          role
        ] ||
      ids.some(
        (
          id,
        ) =>
          byId.get(
            id,
          )?.buildXiRole !==
          role,
      )
    ) {
      throw new Error(
        "INVALID_LINEUP_ROLE",
      );
    }
  }
}
