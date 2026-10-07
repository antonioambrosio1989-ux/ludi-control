import {
  BEST_OF_MONTH_AWARD_LABELS,
  type BestOfMonthAwardKey,
  type BestOfMonthAwardDecision,
  type BestOfMonthConfig,
  type BuildXiRole,
  type CeremonyAwardConfig,
  type GamesVotingPoll,
  type ManOfTheMatchConfig,
  type ScorePredictionConfig,
  type VotingCandidate,
  type VotingMatchOption,
  type VotingStatus,
  type VotingType,
} from "@/src/types/GamesVoting";

const ELIGIBILITY_RATE = 0.6;

const BEST_OF_MONTH_KEYS:
  BestOfMonthAwardKey[] = [
    "player_of_the_month",
    "goal_of_the_month",
    "save_of_the_month",
  ];

export function mapVotingPoll(
  id:
    string,

  data:
    Record<string, unknown>,
): GamesVotingPoll {
  const type =
    normalizeVotingType(
      data.type,
    );

  const competitionIds =
    readStringArray(
      data.competitionIds,
    );

  const competitionNames =
    readStringArray(
      data.competitionNames,
    );

  const bestOfMonth =
    mapBestOfMonth(
      data.bestOfMonth,
    );

  const bestOfMonthDecisions =
    mapBestOfMonthDecisions(
      data.bestOfMonthDecisions,
    );

  const scorePrediction =
    mapScorePrediction(
      data.scorePrediction,
    );

  const manOfTheMatch =
    mapManOfTheMatch(
      data.manOfTheMatch,
    );

  const ceremonyAward =
    mapCeremonyAward(
      data.ceremonyAward,
    );

  return {
    id,
    gameId:
      String(
        data.gameId ??
        "",
      ),
    title:
      String(
        data.title ??
        "Votazione",
      ),
    ...(typeof data.description ===
      "string" &&
    data.description.trim()
      ? {
          description:
            data.description.trim(),
        }
      : {}),
    type,
    competitionId:
      String(
        data.competitionId ??
        "",
      ),
    competitionName:
      String(
        data.competitionName ??
        "Ludi Experience",
      ),
    competitionIds,
    competitionNames,
    seasonId:
      String(
        data.seasonId ??
        "",
      ),
    seasonName:
      String(
        data.seasonName ??
        "",
      ),
    status:
      normalizeStatus(
        data.status,
      ),
    displayOrder:
      Number.isFinite(
        Number(
          data.displayOrder,
        ),
      )
        ? Number(
            data.displayOrder,
          )
        : Number.MAX_SAFE_INTEGER,
    candidateCount:
      Number(
        data.candidateCount ??
        0,
      ),
    roleCounts: {
      ...emptyRoleCounts(),
      ...asRecord(
        data.roleCounts,
      ),
    } as Record<
      BuildXiRole,
      number
    >,
    eligibilityRate:
      Number(
        data.eligibilityRate ??
        ELIGIBILITY_RATE,
      ),
    ...(bestOfMonth
      ? {
          bestOfMonth,
        }
      : {}),
    ...(bestOfMonthDecisions
      ? {
          bestOfMonthDecisions,
        }
      : {}),
    ...(scorePrediction
      ? {
          scorePrediction,
        }
      : {}),
    ...(manOfTheMatch
      ? {
          manOfTheMatch,
        }
      : {}),
    ...(ceremonyAward
      ? {
          ceremonyAward,
        }
      : {}),
    createdAt:
      data.createdAt,
    publishedAt:
      data.publishedAt,
    closedAt:
      data.closedAt,
  };
}

function mapBestOfMonth(
  value:
    unknown,
): BestOfMonthConfig | null {
  const record =
    asRecord(
      value,
    );

  if (
    !record.monthKey
  ) {
    return null;
  }

  const awardsRecord =
    asRecord(
      record.awards,
    );

  const awards =
    Object.fromEntries(
      BEST_OF_MONTH_KEYS.map(
        (
          key,
        ) => {
          const award =
            asRecord(
              awardsRecord[
                key
              ],
            );

          return [
            key,
            {
              key,
              title:
                String(
                  award.title ??
                  BEST_OF_MONTH_AWARD_LABELS[
                    key
                  ],
                ),
              candidates:
                readCandidateArray(
                  award.candidates,
                ),
            },
          ];
        },
      ),
    ) as BestOfMonthConfig["awards"];

  return {
    monthKey:
      String(
        record.monthKey,
      ),
    monthLabel:
      String(
        record.monthLabel ??
        record.monthKey,
      ),
    opensAtMs:
      Number(
        record.opensAtMs ??
        0,
      ),
    closesAtMs:
      Number(
        record.closesAtMs ??
        0,
      ),
    awards,
  };
}

function mapBestOfMonthDecisions(
  value:
    unknown,
): Partial<
  Record<
    BestOfMonthAwardKey,
    BestOfMonthAwardDecision
  >
> | null {
  const record =
    asRecord(
      value,
    );

  const result:
    Partial<
      Record<
        BestOfMonthAwardKey,
        BestOfMonthAwardDecision
      >
    > = {};

  for (
    const key of
    BEST_OF_MONTH_KEYS
  ) {
    const raw =
      asRecord(
        record[
          key
        ],
      );

    if (
      raw.status !==
      "finalized"
    ) {
      continue;
    }

    const pollResult =
      asRecord(
        raw.pollResult,
      );

    const pointsRecord =
      asRecord(
        raw.pointsByCandidateId,
      );

    const pointsByCandidateId =
      Object.fromEntries(
        Object.entries(
          pointsRecord,
        ).map(
          (
            [
              candidateId,
              points,
            ],
          ) => [
            candidateId,
            Number(
              points ??
              0,
            ),
          ],
        ),
      );

    result[
      key
    ] = {
      awardKey:
        key,
      pollResult: {
        topCandidateIds:
          readStringArray(
            pollResult.topCandidateIds,
          ),
        isTie:
          pollResult.isTie ===
          true,
        ...(pollResult.resolvedWinnerId
          ? {
              resolvedWinnerId:
                String(
                  pollResult.resolvedWinnerId,
                ),
            }
          : {}),
        ...(pollResult.winnerId
          ? {
              winnerId:
                String(
                  pollResult.winnerId,
                ),
            }
          : {}),
      },
      refereeCandidateId:
        String(
          raw.refereeCandidateId ??
          "",
        ),
      organizer1CandidateId:
        String(
          raw.organizer1CandidateId ??
          "",
        ),
      organizer2CandidateId:
        String(
          raw.organizer2CandidateId ??
          "",
        ),
      pointsByCandidateId,
      winnerCandidateId:
        String(
          raw.winnerCandidateId ??
          "",
        ),
      winnerPlayerId:
        String(
          raw.winnerPlayerId ??
          "",
        ),
      tieBreak:
        raw.tieBreak ===
        "public_poll"
          ? "public_poll"
          : null,
      status:
        "finalized",
      ...(Number.isFinite(
        Number(
          raw.finalizedAtMs,
        ),
      )
        ? {
            finalizedAtMs:
              Number(
                raw.finalizedAtMs,
              ),
          }
        : {}),
    };
  }

  return Object.keys(
    result,
  ).length >
    0
    ? result
    : null;
}

function mapScorePrediction(
  value:
    unknown,
): ScorePredictionConfig | null {
  const record =
    asRecord(
      value,
    );

  const match =
    mapMatchOption(
      record.match,
    );

  if (
    !match
  ) {
    return null;
  }

  return {
    match,
    ...(record.posterImageUrl
      ? {
          posterImageUrl:
            String(
              record.posterImageUrl,
            ),
        }
      : {}),
    scorerOptions:
      readCandidateArray(
        record.scorerOptions,
      ),
  };
}

function mapManOfTheMatch(
  value:
    unknown,
): ManOfTheMatchConfig | null {
  const record =
    asRecord(
      value,
    );

  const match =
    mapMatchOption(
      record.match,
    );

  if (
    !match
  ) {
    return null;
  }

  return {
    match,
    candidates:
      readCandidateArray(
        record.candidates,
      ),
  };
}

function mapCeremonyAward(
  value:
    unknown,
): CeremonyAwardConfig | null {
  const record =
    asRecord(
      value,
    );

  if (
    !record.awardName
  ) {
    return null;
  }

  return {
    awardName:
      String(
        record.awardName,
      ),
    candidates:
      readCandidateArray(
        record.candidates,
      ),
  };
}

function mapMatchOption(
  value:
    unknown,
): VotingMatchOption | null {
  const record =
    asRecord(
      value,
    );

  if (
    !record.id
  ) {
    return null;
  }

  return {
    id:
      String(
        record.id,
      ),
    seasonId:
      String(
        record.seasonId ??
        "",
      ),
    competitionId:
      String(
        record.competitionId ??
        "",
      ),
    competitionName:
      String(
        record.competitionName ??
        "Competizione",
      ),
    date:
      String(
        record.date ??
        "",
      ),
    time:
      String(
        record.time ??
        "",
      ),
    kickoffAtMs:
      Number(
        record.kickoffAtMs ??
        0,
      ),
    homeTeamId:
      String(
        record.homeTeamId ??
        "",
      ),
    homeTeamName:
      String(
        record.homeTeamName ??
        "Casa",
      ),
    ...(record.homeTeamLogoUrl
      ? {
          homeTeamLogoUrl:
            String(
              record.homeTeamLogoUrl,
            ),
        }
      : {}),
    awayTeamId:
      String(
        record.awayTeamId ??
        "",
      ),
    awayTeamName:
      String(
        record.awayTeamName ??
        "Ospite",
      ),
    ...(record.awayTeamLogoUrl
      ? {
          awayTeamLogoUrl:
            String(
              record.awayTeamLogoUrl,
            ),
        }
      : {}),
    label:
      String(
        record.label ??
        "Partita",
      ),
    isUpcoming:
      Boolean(
        record.isUpcoming,
      ),
  };
}

function readCandidateArray(
  value:
    unknown,
): VotingCandidate[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value.flatMap(
    (
      item,
      index,
    ) => {
      const record =
        asRecord(
          item,
        );

      const label =
        String(
          record.label ??
          "",
        ).trim();

      if (
        !label
      ) {
        return [];
      }

      return [
        {
          id:
            String(
              record.id ??
              record.playerId ??
              `candidate-${index + 1}`,
            ),
          label,
          ...(record.description
            ? {
                description:
                  String(
                    record.description,
                  ),
              }
            : {}),
          ...(record.imageUrl
            ? {
                imageUrl:
                  String(
                    record.imageUrl,
                  ),
              }
            : {}),
          ...(record.playerId
            ? {
                playerId:
                  String(
                    record.playerId,
                  ),
              }
            : {}),
          ...(record.teamId
            ? {
                teamId:
                  String(
                    record.teamId,
                  ),
              }
            : {}),
          ...(record.teamName
            ? {
                teamName:
                  String(
                    record.teamName,
                  ),
              }
            : {}),
        },
      ];
    },
  );
}

function normalizeVotingType(
  value:
    unknown,
): VotingType {
  const raw =
    String(
      value ??
      "",
    );

  if (
    isVotingType(
      raw,
    )
  ) {
    return raw;
  }

  if (
    raw ===
    "choice"
  ) {
    return "ceremony_award";
  }

  return "build_xi";
}

export function isVotingType(
  value:
    unknown,
): value is VotingType {
  return [
    "build_xi",
    "best_of_the_month",
    "score_prediction",
    "man_of_the_match",
    "ceremony_award",
  ].includes(
    String(
      value,
    ),
  );
}

function normalizeStatus(
  value:
    unknown,
): VotingStatus {
  return [
    "planned",
    "setup",
    "ready",
    "published",
    "closed",
    "archived",
  ].includes(
    String(
      value,
    ),
  )
    ? value as VotingStatus
    : "planned";
}

export function emptyRoleCounts():
  Record<
    BuildXiRole,
    number
  > {
  return {
    goalkeeper:
      0,
    defender:
      0,
    midfielder:
      0,
    forward:
      0,
  };
}

export function parseBuildXiRole(
  value:
    unknown,
): BuildXiRole | null {
  const normalized =
    String(
      value ??
      "",
    )
      .trim()
      .toLocaleLowerCase(
        "it",
      );

  if (
    [
      "portiere",
      "p",
      "goalkeeper",
    ].includes(
      normalized,
    )
  ) {
    return "goalkeeper";
  }

  if (
    [
      "difensore",
      "d",
      "defender",
    ].includes(
      normalized,
    )
  ) {
    return "defender";
  }

  if (
    [
      "centrocampista",
      "c",
      "midfielder",
    ].includes(
      normalized,
    )
  ) {
    return "midfielder";
  }

  if (
    [
      "attaccante",
      "a",
      "forward",
    ].includes(
      normalized,
    )
  ) {
    return "forward";
  }

  return null;
}

export function asRecord(
  value:
    unknown,
): Record<string, unknown> {
  return value &&
    typeof value ===
      "object"
    ? value as
        Record<
          string,
          unknown
        >
    : {};
}

export function readStringArray(
  value:
    unknown,
): string[] {
  return Array.isArray(
    value,
  )
    ? value
        .map(
          String,
        )
        .filter(
          Boolean,
        )
    : [];
}
