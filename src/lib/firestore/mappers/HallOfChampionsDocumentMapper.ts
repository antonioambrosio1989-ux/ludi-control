import type { HallOfChampionsEntry, HallOfChampionsFinalGoalMinute, HallOfChampionsFinalPenaltyKick, HallOfChampionsFinalPlayer, HallOfChampionsFinalReport, HallOfChampionsGoal, HallOfChampionsPlayer } from "@/src/types/HallOfChampionsEntry";

export function mapDocument(
  document:
    FirestoreDocument,
): HallOfChampionsEntry {
  const data =
    document.data();

  const entry:
    HallOfChampionsEntry = {
    id:
      document.id,

    seasonId:
      normalizeOptionalString(
        data.seasonId,
      ),

    seasonName:
      normalizeString(
        data.seasonName,
      ) ||
      normalizeString(
        data.seasonLabel,
      ) ||
      normalizeString(
        data.season,
      ) ||
      normalizeString(
        data.name,
      ),

    competitionId:
  normalizeOptionalString(
    data.competitionId,
  ) ??
  "premier-league",

    competitionName:
      normalizeString(
        data.competitionName,
      ),

    championTeamId:
      normalizeOptionalString(
        data.championTeamId,
      ),

    championTeamName:
      normalizeString(
        data.championTeamName,
      ),

    runnerUpTeamId:
      normalizeOptionalString(
        data.runnerUpTeamId,
      ),

    runnerUpTeamName:
      normalizeString(
        data.runnerUpTeamName,
      ),

    championScore:
      normalizeNumber(
        data.championScore,
      ),

    runnerUpScore:
      normalizeNumber(
        data.runnerUpScore,
      ),

    finalGoals:
      normalizeGoals(
        data.finalGoals,
      ),

    finalReport:
      normalizeFinalReport(
        data.finalReport,
      ),

    winnerPhotoUrl:
      normalizeOptionalString(
        data.winnerPhotoUrl,
      ),

    winnerPhotoKey:
      normalizeOptionalString(
        data.winnerPhotoKey,
      ),

    finalMvpPhotoUrl:
      normalizeOptionalString(
        data.finalMvpPhotoUrl,
      ),

    finalMvpPhotoKey:
      normalizeOptionalString(
        data.finalMvpPhotoKey,
      ),

    roster:
      normalizeRoster(
        data.roster,
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };

  const championPenalties =
    normalizeOptionalNumber(
      data.championPenalties,
    );

  if (
    championPenalties !==
    undefined
  ) {
    entry.championPenalties =
      championPenalties;
  }

  const runnerUpPenalties =
    normalizeOptionalNumber(
      data.runnerUpPenalties,
    );

  if (
    runnerUpPenalties !==
    undefined
  ) {
    entry.runnerUpPenalties =
      runnerUpPenalties;
  }

  return entry;
}

type FirestoreDocument = {
  id: string;

  data: () => Record<
    string,
    unknown
  >;
};

export function normalizeOptionalString(
  value: unknown,
): string | undefined {
  const normalized =
    normalizeString(
      value,
    );

  return normalized ||
    undefined;
}

export function normalizeString(
  value: unknown,
): string {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

export function normalizeNumber(
  value: unknown,
  fallback = 0,
): number {
  const normalized =
    Number(
      value,
    );

  return Number.isFinite(
    normalized,
  )
    ? normalized
    : fallback;
}

export function normalizeGoals(
  value: unknown,
): HallOfChampionsGoal[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value.reduce<
    HallOfChampionsGoal[]
  >(
    (
      result,
      currentGoal,
      index,
    ) => {
      if (
        !currentGoal ||
        typeof currentGoal !==
          "object"
      ) {
        return result;
      }

      const goal =
        currentGoal as Record<
          string,
          unknown
        >;

      const normalizedGoal:
        HallOfChampionsGoal = {
        id:
          normalizeString(
            goal.id,
          ) ||
          `goal-${index}`,

        minute:
          normalizeNumber(
            goal.minute,
          ),

        scorerName:
          normalizeString(
            goal.scorerName,
          ),

        team:
          goal.team ===
          "runnerUp"
            ? "runnerUp"
            : "champion",

        isOwnGoal:
          normalizeBoolean(
            goal.isOwnGoal,
          ),
      };

      const stoppageTime =
        normalizeOptionalNumber(
          goal.stoppageTime,
        );

      if (
        stoppageTime !==
        undefined
      ) {
        normalizedGoal.stoppageTime =
          stoppageTime;
      }

      result.push(
        normalizedGoal,
      );

      return result;
    },
    [],
  );
}

export function normalizeFinalReport(
  value: unknown,
): HallOfChampionsFinalReport | undefined {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return undefined;
  }

  const report =
    value as Record<
      string,
      unknown
    >;

  const homeTeamCode =
    normalizeString(
      report.homeTeamCode,
    );

  const awayTeamCode =
    normalizeString(
      report.awayTeamCode,
    );

  const homeTeamName =
    normalizeString(
      report.homeTeamName,
    );

  const awayTeamName =
    normalizeString(
      report.awayTeamName,
    );

  const homeTeamAliasName =
    normalizeOptionalString(
      report.homeTeamAliasName,
    );

  const awayTeamAliasName =
    normalizeOptionalString(
      report.awayTeamAliasName,
    );

  if (
    !homeTeamCode ||
    !awayTeamCode ||
    !homeTeamName ||
    !awayTeamName
  ) {
    return undefined;
  }

  const normalizedReport:
    HallOfChampionsFinalReport = {
    homeTeamCode,

    homeTeamName,

    ...(homeTeamAliasName
      ? {
          homeTeamAliasName,
        }
      : {}),

    awayTeamCode,

    awayTeamName,

    ...(awayTeamAliasName
      ? {
          awayTeamAliasName,
        }
      : {}),

    homeScore:
      normalizeNumber(
        report.homeScore,
      ),

    awayScore:
      normalizeNumber(
        report.awayScore,
      ),

    homePlayers:
      normalizeFinalPlayers(
        report.homePlayers,
      ),

    awayPlayers:
      normalizeFinalPlayers(
        report.awayPlayers,
      ),
  };

  const homeRegulationScore =
    normalizeOptionalNumber(
      report.homeRegulationScore,
    );

  if (
    homeRegulationScore !==
    undefined
  ) {
    normalizedReport.homeRegulationScore =
      homeRegulationScore;
  }

  const awayRegulationScore =
    normalizeOptionalNumber(
      report.awayRegulationScore,
    );

  if (
    awayRegulationScore !==
    undefined
  ) {
    normalizedReport.awayRegulationScore =
      awayRegulationScore;
  }

  if (
    report.wentToExtraTime !==
    undefined
  ) {
    normalizedReport.wentToExtraTime =
      normalizeBoolean(
        report.wentToExtraTime,
      );
  }

  const homePenalties =
    normalizeOptionalNumber(
      report.homePenalties,
    );

  if (
    homePenalties !==
    undefined
  ) {
    normalizedReport.homePenalties =
      homePenalties;
  }

  const awayPenalties =
    normalizeOptionalNumber(
      report.awayPenalties,
    );

  if (
    awayPenalties !==
    undefined
  ) {
    normalizedReport.awayPenalties =
      awayPenalties;
  }

  const homePenaltyKicks =
    normalizeFinalPenaltyKicks(
      report.homePenaltyKicks,
    );

  if (
    homePenaltyKicks.length >
    0
  ) {
    normalizedReport.homePenaltyKicks =
      homePenaltyKicks;
  }

  const awayPenaltyKicks =
    normalizeFinalPenaltyKicks(
      report.awayPenaltyKicks,
    );

  if (
    awayPenaltyKicks.length >
    0
  ) {
    normalizedReport.awayPenaltyKicks =
      awayPenaltyKicks;
  }

  return normalizedReport;
}

export function normalizeRoster(
  value: unknown,
): HallOfChampionsPlayer[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value.reduce<
    HallOfChampionsPlayer[]
  >(
    (
      result,
      currentPlayer,
    ) => {
      if (
        !currentPlayer ||
        typeof currentPlayer !==
          "object"
      ) {
        return result;
      }

      const player =
        currentPlayer as Record<
          string,
          unknown
        >;

      const normalizedPlayer:
        HallOfChampionsPlayer = {
        firstName:
          normalizeString(
            player.firstName,
          ),

        lastName:
          normalizeString(
            player.lastName,
          ),

        appearances:
          normalizeNumber(
            player.appearances,
          ),

        goals:
          normalizeNumber(
            player.goals,
          ),

        assists:
          normalizeNumber(
            player.assists,
          ),

        ownGoals:
          normalizeNumber(
            player.ownGoals,
          ),

        yellowCards:
          normalizeNumber(
            player.yellowCards,
          ),

        redCards:
          normalizeNumber(
            player.redCards,
          ),
      };

      const playerId =
        normalizeOptionalString(
          player.playerId,
        );

      if (
        playerId
      ) {
        normalizedPlayer.playerId =
          playerId;
      }

      const role =
        normalizeOptionalString(
          player.role,
        );

      if (
        role
      ) {
        normalizedPlayer.role =
          role;
      }

      const shirtNumber =
        normalizeOptionalNumber(
          player.shirtNumber,
        );

      if (
        shirtNumber !==
        undefined
      ) {
        normalizedPlayer.shirtNumber =
          shirtNumber;
      }

      const averageVote =
        normalizeOptionalNumber(
          player.averageVote,
        );

      if (
        averageVote !==
        undefined
      ) {
        normalizedPlayer.averageVote =
          averageVote;
      }

      result.push(
        normalizedPlayer,
      );

      return result;
    },
    [],
  );
}

export function normalizeOptionalNumber(
  value: unknown,
): number | undefined {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  const normalized =
    Number(
      value,
    );

  return Number.isFinite(
    normalized,
  )
    ? normalized
    : undefined;
}

export function normalizeBoolean(
  value: unknown,
): boolean {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  if (
    typeof value ===
    "number"
  ) {
    return value !== 0;
  }

  const normalized =
    normalizeString(
      value,
    ).toLocaleLowerCase(
      "it",
    );

  return [
    "1",
    "true",
    "si",
    "sì",
    "yes",
    "x",
  ].includes(
    normalized,
  );
}

export function normalizeFinalPlayers(
  value: unknown,
): HallOfChampionsFinalPlayer[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value.reduce<
    HallOfChampionsFinalPlayer[]
  >(
    (
      result,
      currentPlayer,
    ) => {
      if (
        !currentPlayer ||
        typeof currentPlayer !==
          "object"
      ) {
        return result;
      }

      const player =
        currentPlayer as Record<
          string,
          unknown
        >;

      const playerSeasonCode =
        normalizeString(
          player.playerSeasonCode,
        );

      if (
        !playerSeasonCode
      ) {
        return result;
      }

      const normalizedPlayer:
        HallOfChampionsFinalPlayer = {
        playerSeasonCode,

        firstName:
          normalizeString(
            player.firstName,
          ),

        lastName:
          normalizeString(
            player.lastName,
          ),

        withoutVote:
          normalizeBoolean(
            player.withoutVote,
          ),

        goals:
          normalizeNumber(
            player.goals,
          ),

        assists:
          normalizeNumber(
            player.assists,
          ),

        ownGoals:
          normalizeNumber(
            player.ownGoals,
          ),

        yellowCards:
          normalizeNumber(
            player.yellowCards,
          ),

        redCards:
          normalizeNumber(
            player.redCards,
          ),

        mvp:
          normalizeBoolean(
            player.mvp,
          ),

        goalMinutes:
          normalizeFinalGoalMinutes(
            player.goalMinutes,
          ),

        ownGoalMinutes:
          normalizeFinalGoalMinutes(
            player.ownGoalMinutes,
          ),
      };

      const role =
        normalizeOptionalString(
          player.role,
        );

      if (
        role
      ) {
        normalizedPlayer.role =
          role;
      }

      const playerId =
        normalizeOptionalString(
          player.playerId,
        );

      if (
        playerId
      ) {
        normalizedPlayer.playerId =
          playerId;
      }

      const shirtNumber =
        normalizeOptionalNumber(
          player.shirtNumber,
        );

      if (
        shirtNumber !==
        undefined
      ) {
        normalizedPlayer.shirtNumber =
          shirtNumber;
      }

      const vote =
        normalizeOptionalNumber(
          player.vote,
        );

      if (
        vote !==
        undefined
      ) {
        normalizedPlayer.vote =
          vote;
      }

      const goalsConceded =
        normalizeOptionalNumber(
          player.goalsConceded,
        );

      if (
        goalsConceded !==
        undefined
      ) {
        normalizedPlayer.goalsConceded =
          goalsConceded;
      }

      result.push(
        normalizedPlayer,
      );

      return result;
    },
    [],
  );
}

export function normalizeFinalPenaltyKicks(
  value: unknown,
): HallOfChampionsFinalPenaltyKick[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value.reduce<
    HallOfChampionsFinalPenaltyKick[]
  >(
    (
      result,
      currentKick,
    ) => {
      if (
        !currentKick ||
        typeof currentKick !==
          "object"
      ) {
        return result;
      }

      const kick =
        currentKick as Record<
          string,
          unknown
        >;

      const order =
        normalizeOptionalNumber(
          kick.order,
        );

      const playerSeasonCode =
        normalizeString(
          kick.playerSeasonCode,
        );

      const kickResult =
        normalizeString(
          kick.result,
        ).toLocaleLowerCase(
          "it",
        );

      if (
        order ===
          undefined ||
        order < 1 ||
        !Number.isInteger(
          order,
        ) ||
        !playerSeasonCode ||
        (
          kickResult !==
            "scored" &&
          kickResult !==
            "missed"
        )
      ) {
        return result;
      }

      result.push({
        order,

        playerSeasonCode,

        result:
          kickResult,
      });

      return result;
    },
    [],
  ).sort(
    (
      first,
      second,
    ) =>
      first.order -
      second.order,
  );
}

export function normalizeFinalGoalMinutes(
  value: unknown,
): HallOfChampionsFinalGoalMinute[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value.reduce<
    HallOfChampionsFinalGoalMinute[]
  >(
    (
      result,
      currentMinute,
    ) => {
      if (
        !currentMinute ||
        typeof currentMinute !==
          "object"
      ) {
        return result;
      }

      const minuteData =
        currentMinute as Record<
          string,
          unknown
        >;

      const minute =
        normalizeOptionalNumber(
          minuteData.minute,
        );

      if (
        minute ===
        undefined
      ) {
        return result;
      }

      const normalized:
        HallOfChampionsFinalGoalMinute = {
        minute,
      };

      const stoppageTime =
        normalizeOptionalNumber(
          minuteData.stoppageTime,
        );

      if (
        stoppageTime !==
        undefined
      ) {
        normalized.stoppageTime =
          stoppageTime;
      }

      result.push(
        normalized,
      );

      return result;
    },
    [],
  );
}
