import {
  BUILD_XI_REQUIRED_ROLE_COUNTS,
  type BuildXiCandidate,
  type BuildXiLineup,
  type BuildXiRankedCandidate,
  type BuildXiRole,
  type BuildXiTieBreakDecisions,
  type BuildXiVotingResult,
} from "@/src/types/GamesVoting";

import {
  assertBuildXiLineup,
} from "@/src/services/games/voting/BuildXiRules";

const ROLES:
  BuildXiRole[] = [
    "goalkeeper",
    "defender",
    "midfielder",
    "forward",
  ];

export function buildBuildXiVotingResults({
  candidates,
  submissions,
  tieBreakDecisions = {},
}: {
  candidates:
    BuildXiCandidate[];
  submissions:
    unknown[];
  tieBreakDecisions?:
    BuildXiTieBreakDecisions;
}): {
  submissionCount:
    number;
  result:
    BuildXiVotingResult;
} {
  const votes =
    new Map<
      string,
      number
    >();

  let validSubmissionCount =
    0;

  let invalidSubmissionCount =
    0;

  for (
    const rawSubmission
    of submissions
  ) {
    const submission =
      asRecord(
        rawSubmission,
      );

    if (
      submission.type !==
      "build_xi"
    ) {
      continue;
    }

    const lineup =
      parseLineup(
        submission.lineup,
      );

    if (
      !lineup ||
      !isValidLineup(
        lineup,
        candidates,
      )
    ) {
      invalidSubmissionCount +=
        1;

      continue;
    }

    validSubmissionCount +=
      1;

    for (
      const playerId of
        lineupIds(
          lineup,
        )
    ) {
      votes.set(
        playerId,
        (
          votes.get(
            playerId,
          ) ??
          0
        ) +
          1,
      );
    }
  }

  const byRole =
    {} as Record<
      BuildXiRole,
      BuildXiRankedCandidate[]
    >;

  const tieRoles:
    BuildXiRole[] = [];

  const tieBreaks:
    BuildXiVotingResult[
      "tieBreaks"
    ] = {};

  const selectedByRole =
    new Map<
      BuildXiRole,
      string[]
    >();

  for (
    const role of
      ROLES
  ) {
    const required =
      BUILD_XI_REQUIRED_ROLE_COUNTS[
        role
      ];

    const sorted =
      candidates
        .filter(
          (candidate) =>
            candidate.buildXiRole ===
            role,
        )
        .map(
          (candidate) => ({
            candidate,
            votes:
              votes.get(
                candidate.playerId,
              ) ??
              0,
          }),
        )
        .sort(
          (
            first,
            second,
          ) =>
            second.votes -
              first.votes ||
            first.candidate.playerName.localeCompare(
              second.candidate.playerName,
              "it",
            ),
        );

    const cutoffVotes =
      sorted[
        required -
          1
      ]?.votes;

    const nextVotes =
      sorted[
        required
      ]?.votes;

    const hasCutoffTie =
      validSubmissionCount >
        0 &&
      cutoffVotes !==
        undefined &&
      nextVotes !==
        undefined &&
      cutoffVotes ===
        nextVotes;

    const automaticSelectedIds =
      hasCutoffTie &&
      cutoffVotes !==
        undefined
        ? sorted
            .filter(
              (entry) =>
                entry.votes >
                cutoffVotes,
            )
            .map(
              (entry) =>
                entry.candidate.playerId,
            )
        : sorted
            .slice(
              0,
              validSubmissionCount >
                0
                ? required
                : 0,
            )
            .map(
              (entry) =>
                entry.candidate.playerId,
            );

    const tiedCandidateIds =
      hasCutoffTie &&
      cutoffVotes !==
        undefined
        ? sorted
            .filter(
              (entry) =>
                entry.votes ===
                cutoffVotes,
            )
            .map(
              (entry) =>
                entry.candidate.playerId,
            )
        : [];

    const requiredTieSelections =
      hasCutoffTie
        ? Math.max(
            0,
            required -
              automaticSelectedIds.length,
          )
        : 0;

    const decision =
      normalizeTieBreakDecision(
        tieBreakDecisions[
          role
        ],
        tiedCandidateIds,
        requiredTieSelections,
      );

    const tieResolved =
      hasCutoffTie &&
      decision.length ===
        requiredTieSelections &&
      requiredTieSelections >
        0;

    if (
      hasCutoffTie
    ) {
      tieBreaks[
        role
      ] = {
        role,
        candidateIds:
          tiedCandidateIds,
        requiredSelections:
          requiredTieSelections,
        selectedPlayerIds:
          decision,
        resolved:
          tieResolved,
      };

      if (
        !tieResolved
      ) {
        tieRoles.push(
          role,
        );
      }
    }

    const finalSelectedIds =
      new Set([
        ...automaticSelectedIds,
        ...decision,
      ]);

    const adminSelectedIds =
      new Set(
        decision,
      );

    let previousVotes:
      number |
      undefined;

    let previousRank =
      0;

    const ranking =
      sorted.map(
        (
          entry,
          index,
        ) => {
          const rank =
            previousVotes ===
            entry.votes
              ? previousRank
              : index +
                1;

          previousVotes =
            entry.votes;

          previousRank =
            rank;

          const tiedAtCutoff =
            hasCutoffTie &&
            cutoffVotes !==
              undefined &&
            entry.votes ===
              cutoffVotes;

          return {
            playerId:
              entry.candidate.playerId,
            playerName:
              entry.candidate.playerName,
            teamName:
              entry.candidate.teamName,
            role,
            votes:
              entry.votes,
            percentage:
              votingPercentage(
                entry.votes,
                validSubmissionCount,
              ),
            rank,
            isFinalSelection:
              validSubmissionCount >
                0 &&
              finalSelectedIds.has(
                entry.candidate.playerId,
              ) &&
              (
                !hasCutoffTie ||
                tieResolved
              ),
            isAdminSelection:
              adminSelectedIds.has(
                entry.candidate.playerId,
              ),
            tiedAtCutoff,
          };
        },
      );

    byRole[
      role
    ] =
      ranking;

    if (
      validSubmissionCount >
        0 &&
      (
        !hasCutoffTie ||
        tieResolved
      )
    ) {
      selectedByRole.set(
        role,
        [
          ...automaticSelectedIds,
          ...decision,
        ],
      );
    }
  }

  const finalLineup =
    validSubmissionCount >
      0 &&
    tieRoles.length ===
      0 &&
    ROLES.every(
      (role) =>
        (
          selectedByRole.get(
            role,
          ) ??
          []
        ).length ===
        BUILD_XI_REQUIRED_ROLE_COUNTS[
          role
        ],
    )
      ? buildFinalLineup(
          selectedByRole,
        )
      : undefined;

  return {
    submissionCount:
      validSubmissionCount,
    result: {
      byRole,
      finalLineup,
      tieRoles,
      tieBreaks,
      invalidSubmissionCount,
    },
  };
}


function normalizeTieBreakDecision(
  value:
    string[] |
    undefined,
  allowedCandidateIds:
    string[],
  requiredSelections:
    number,
): string[] {
  if (
    requiredSelections <=
      0 ||
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  const allowed =
    new Set(
      allowedCandidateIds,
    );

  const normalized =
    Array.from(
      new Set(
        value
          .map(
            (
              playerId,
            ) =>
              String(
                playerId,
              ).trim(),
          )
          .filter(
            (
              playerId,
            ) =>
              playerId &&
              allowed.has(
                playerId,
              ),
          ),
      ),
    );

  return normalized.length ===
    requiredSelections
    ? normalized
    : [];
}


function parseLineup(
  value:
    unknown,
): BuildXiLineup | undefined {
  const data =
    asRecord(
      value,
    );

  const goalkeeperId =
    stringValue(
      data.goalkeeperId,
    );

  const defenderIds =
    stringArray(
      data.defenderIds,
    );

  const midfielderIds =
    stringArray(
      data.midfielderIds,
    );

  const forwardIds =
    stringArray(
      data.forwardIds,
    );

  if (
    !goalkeeperId ||
    defenderIds.length !==
      3 ||
    midfielderIds.length !==
      4 ||
    forwardIds.length !==
      3
  ) {
    return undefined;
  }

  return {
    goalkeeperId,
    defenderIds: [
      defenderIds[0],
      defenderIds[1],
      defenderIds[2],
    ],
    midfielderIds: [
      midfielderIds[0],
      midfielderIds[1],
      midfielderIds[2],
      midfielderIds[3],
    ],
    forwardIds: [
      forwardIds[0],
      forwardIds[1],
      forwardIds[2],
    ],
  };
}

function isValidLineup(
  lineup:
    BuildXiLineup,
  candidates:
    BuildXiCandidate[],
): boolean {
  try {
    assertBuildXiLineup(
      lineup,
      candidates,
    );

    return true;
  } catch {
    return false;
  }
}

function lineupIds(
  lineup:
    BuildXiLineup,
): string[] {
  return [
    lineup.goalkeeperId,
    ...lineup.defenderIds,
    ...lineup.midfielderIds,
    ...lineup.forwardIds,
  ];
}

function buildFinalLineup(
  selectedByRole:
    Map<
      BuildXiRole,
      string[]
    >,
): BuildXiLineup {
  const defenders =
    selectedByRole.get(
      "defender",
    ) ??
    [];

  const midfielders =
    selectedByRole.get(
      "midfielder",
    ) ??
    [];

  const forwards =
    selectedByRole.get(
      "forward",
    ) ??
    [];

  if (
    defenders.length !==
      3 ||
    midfielders.length !==
      4 ||
    forwards.length !==
      3
  ) {
    throw new Error(
      "INVALID_FINAL_BUILD_XI",
    );
  }

  return {
    goalkeeperId:
      selectedByRole.get(
        "goalkeeper",
      )?.[0] ??
      "",
    defenderIds: [
      defenders[0],
      defenders[1],
      defenders[2],
    ],
    midfielderIds: [
      midfielders[0],
      midfielders[1],
      midfielders[2],
      midfielders[3],
    ],
    forwardIds: [
      forwards[0],
      forwards[1],
      forwards[2],
    ],
  };
}

function votingPercentage(
  votes:
    number,
  totalVoters:
    number,
): number {
  if (
    totalVoters <=
    0
  ) {
    return 0;
  }

  return (
    Math.round(
      (
        votes /
        totalVoters
      ) *
        1000,
    ) /
    10
  );
}

function asRecord(
  value:
    unknown,
): Record<
  string,
  unknown
> {
  return value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value,
    )
    ? value as
        Record<
          string,
          unknown
        >
    : {};
}

function stringValue(
  value:
    unknown,
): string {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function stringArray(
  value:
    unknown,
): string[] {
  return Array.isArray(
    value,
  )
    ? value
        .map(
          stringValue,
        )
        .filter(
          Boolean,
        )
    : [];
}
