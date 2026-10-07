import type {
  DisciplinarySuspension,
  PlayerDisciplinaryRecord,
} from "@/src/types/DisciplinaryRecord";

export type MatchweekDisciplinaryPlayer = {
  playerId: string;
  playerName: string;

  teamId: string;
  teamName: string;

  yellowCards: number;
  directRedCards: number;

  sourceMatchId: string;
};

export type DisciplinaryRoundReference =
  | {
      phase: "regularSeason";
      matchweek: number;
    }
  | {
      phase: "finalStage";
      finalStageWeek: number;
    };

export type DisciplinaryEngineResult = {
  updatedRecords: PlayerDisciplinaryRecord[];

  newSuspensions: Array<
    Omit<
      DisciplinarySuspension,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "completedAt"
    >
  >;

  suspendedByYellowAccumulation:
    PlayerDisciplinaryRecord[];

  suspendedByDirectRed:
    MatchweekDisciplinaryPlayer[];

  warnedPlayers:
    PlayerDisciplinaryRecord[];
};

const YELLOW_CARDS_FOR_WARNING = 4;
const YELLOW_CARDS_FOR_SUSPENSION = 5;

export const DisciplinaryEngine = {
  /*
   * ============================================================
   * NUOVO MOTORE GENERICO
   * ============================================================
   *
   * Non dipende più obbligatoriamente da una Matchweek.
   * La Regular Season passa:
   *
   *   { phase: "regularSeason", matchweek: 5 }
   *
   * La Final Stage passa:
   *
   *   { phase: "finalStage", finalStageWeek: 2 }
   *
   * L'idempotenza reale continua a essere basata sul matchId.
   * ============================================================
   */
  processRound({
    seasonId,
    round,
    players,
    existingRecords,
    existingSuspensions,
  }: {
    seasonId: string;

    round:
      DisciplinaryRoundReference;

    players:
      MatchweekDisciplinaryPlayer[];

    existingRecords:
      PlayerDisciplinaryRecord[];

    existingSuspensions:
      DisciplinarySuspension[];
  }): DisciplinaryEngineResult {
    const recordsByPlayerId =
      new Map<
        string,
        PlayerDisciplinaryRecord
      >();

    existingRecords.forEach(
      (record) => {
        recordsByPlayerId.set(
          record.playerId,
          {
            ...record,

            activeSuspensionIds: [
              ...record
                .activeSuspensionIds,
            ],

            processedSourceMatchIds: [
              ...(
                record
                  .processedSourceMatchIds ??
                []
              ),
            ],
          },
        );
      },
    );

    const newSuspensions:
      DisciplinaryEngineResult["newSuspensions"] =
      [];

    const suspendedByYellowAccumulation:
      PlayerDisciplinaryRecord[] =
      [];

    const suspendedByDirectRed:
      MatchweekDisciplinaryPlayer[] =
      [];

    players.forEach(
      (roundPlayer) => {
        const currentRecord =
          recordsByPlayerId.get(
            roundPlayer.playerId,
          ) ??
          createEmptyRecord({
            seasonId,
            player:
              roundPlayer,
          });

        const processedSourceMatchIds =
          currentRecord
            .processedSourceMatchIds ??
          [];

        if (
          processedSourceMatchIds.includes(
            roundPlayer
              .sourceMatchId,
          )
        ) {
          return;
        }

        const yellowCards =
          sanitizeCardCount(
            roundPlayer
              .yellowCards,
            2,
          );

        const directRedCards =
          sanitizeCardCount(
            roundPlayer
              .directRedCards,
          );

        const updatedRecord:
          PlayerDisciplinaryRecord =
          {
            ...currentRecord,

            playerName:
              roundPlayer
                .playerName,

            teamId:
              roundPlayer
                .teamId,

            teamName:
              roundPlayer
                .teamName,

            seasonYellowCards:
              currentRecord
                .seasonYellowCards +
              yellowCards,

            currentYellowCycle:
              currentRecord
                .currentYellowCycle +
              yellowCards,

            directRedCards:
              currentRecord
                .directRedCards +
              directRedCards,

            processedSourceMatchIds:
              Array.from(
                new Set([
                  ...processedSourceMatchIds,
                  roundPlayer
                    .sourceMatchId,
                ]),
              ),

            /*
             * Manteniamo questo campo legacy soltanto per
             * Regular Season. FS non lo altera.
             */
            lastProcessedMatchweek:
              round.phase ===
                "regularSeason"
                ? round
                    .matchweek
                : currentRecord
                    .lastProcessedMatchweek,
          };

        if (
          directRedCards >
            0 &&
          !hasExistingSourceSuspension({
            suspensions: [
              ...existingSuspensions,
              ...newSuspensions.map(
                (
                  suspension,
                  index,
                ) => ({
                  ...suspension,
                  id:
                    `new-${index}`,
                }),
              ),
            ],

            playerId:
              roundPlayer
                .playerId,

            sourceMatchId:
              roundPlayer
                .sourceMatchId,

            reason:
              "directRed",
          })
        ) {
          newSuspensions.push(
            createSuspension({
              seasonId,
              round,
              player:
                roundPlayer,
              reason:
                "directRed",
              totalMatches:
                1,
            }),
          );

          suspendedByDirectRed.push(
            roundPlayer,
          );
        }

        if (
          updatedRecord
            .currentYellowCycle >=
            YELLOW_CARDS_FOR_SUSPENSION &&
          !hasActiveYellowSuspension({
            playerId:
              updatedRecord
                .playerId,

            existingSuspensions,
            newSuspensions,
          })
        ) {
          newSuspensions.push(
            createSuspension({
              seasonId,
              round,
              player:
                roundPlayer,
              reason:
                "yellowAccumulation",
              totalMatches:
                1,
            }),
          );

          suspendedByYellowAccumulation.push(
            updatedRecord,
          );
        }

        recordsByPlayerId.set(
          updatedRecord
            .playerId,
          updatedRecord,
        );
      },
    );

    const updatedRecords =
      Array.from(
        recordsByPlayerId
          .values(),
      );

    const warnedPlayers =
      updatedRecords.filter(
        (record) =>
          record
            .currentYellowCycle ===
            YELLOW_CARDS_FOR_WARNING &&
          !hasActiveYellowSuspension({
            playerId:
              record.playerId,

            existingSuspensions,
            newSuspensions,
          }),
      );

    return {
      updatedRecords,
      newSuspensions,
      suspendedByYellowAccumulation,
      suspendedByDirectRed,
      warnedPlayers,
    };
  },

  /*
   * ============================================================
   * WRAPPER PER SINGOLA PARTITA
   * ============================================================
   *
   * Alcuni servizi più recenti (planner/processing service)
   * elaborano una partita alla volta e chiamano processMatch().
   *
   * Se viene fornita una matchweek, la partita appartiene alla
   * Regular Season. In assenza di matchweek viene trattata come
   * Final Stage, mantenendo l'idempotenza sul sourceMatchId.
   * ============================================================
   */
  processMatch(
    input: {
      seasonId:
        string;

      matchweek?:
        number;

      finalStageWeek?:
        number;

      players?:
        MatchweekDisciplinaryPlayer[];

      player?:
        MatchweekDisciplinaryPlayer;

      disciplinaryPlayers?:
        MatchweekDisciplinaryPlayer[];

      existingRecords:
        PlayerDisciplinaryRecord[];

      existingSuspensions:
        DisciplinarySuspension[];

      [key:
        string]:
        unknown;
    },
  ): DisciplinaryEngineResult {
    const players =
      input.players ??
      input.disciplinaryPlayers ??
      (
        input.player
          ? [
              input.player,
            ]
          : []
      );

    const isRegularSeason =
      typeof input.matchweek ===
        "number" &&
      Number.isInteger(
        input.matchweek,
      ) &&
      input.matchweek >
        0;

    return this.processRound({
      seasonId:
        input.seasonId,

      round:
        isRegularSeason
          ? {
              phase:
                "regularSeason",
              matchweek:
                input.matchweek as number,
            }
          : {
              phase:
                "finalStage",
              finalStageWeek:
                typeof input.finalStageWeek ===
                  "number" &&
                Number.isInteger(
                  input.finalStageWeek,
                ) &&
                input.finalStageWeek >
                  0
                  ? input.finalStageWeek
                  : 1,
            },

      players,

      existingRecords:
        input.existingRecords,

      existingSuspensions:
        input.existingSuspensions,
    });
  },

  /*
   * ============================================================
   * WRAPPER RETROCOMPATIBILE
   * ============================================================
   *
   * Tutto il codice Regular Season esistente può continuare
   * a chiamare processMatchweek() senza modifiche immediate.
   * ============================================================
   */
  processMatchweek({
    seasonId,
    matchweek,
    players,
    existingRecords,
    existingSuspensions,
  }: {
    seasonId: string;
    matchweek: number;

    players:
      MatchweekDisciplinaryPlayer[];

    existingRecords:
      PlayerDisciplinaryRecord[];

    existingSuspensions:
      DisciplinarySuspension[];
  }): DisciplinaryEngineResult {
    return this.processRound({
      seasonId,

      round: {
        phase:
          "regularSeason",

        matchweek,
      },

      players,
      existingRecords,
      existingSuspensions,
    });
  },

  resetYellowCycleAfterSuspension(
    record:
      PlayerDisciplinaryRecord,
  ): PlayerDisciplinaryRecord {
    return {
      ...record,

      currentYellowCycle:
        Math.max(
          0,

          record
            .currentYellowCycle -
            YELLOW_CARDS_FOR_SUSPENSION,
        ),
    };
  },

  serveSuspensionMatch(
    suspension:
      DisciplinarySuspension,
  ): DisciplinarySuspension {
    if (
      suspension.status !==
        "active" ||
      suspension
        .remainingMatches <=
        0
    ) {
      return suspension;
    }

    const servedMatches =
      suspension
        .servedMatches +
      1;

    const remainingMatches =
      Math.max(
        0,

        suspension
          .totalMatches -
          servedMatches,
      );

    return {
      ...suspension,

      servedMatches,

      remainingMatches,

      status:
        remainingMatches ===
          0
          ? "completed"
          : "active",
    };
  },
};

function createEmptyRecord({
  seasonId,
  player,
}: {
  seasonId:
    string;

  player:
    MatchweekDisciplinaryPlayer;
}): PlayerDisciplinaryRecord {
  return {
    id:
      `${seasonId}-${player.playerId}`,

    seasonId,

    playerId:
      player.playerId,

    playerName:
      player.playerName,

    teamId:
      player.teamId,

    teamName:
      player.teamName,

    seasonYellowCards:
      0,

    currentYellowCycle:
      0,

    directRedCards:
      0,

    activeSuspensionIds:
      [],

    processedSourceMatchIds:
      [],
  };
}

function createSuspension({
  seasonId,
  round,
  player,
  reason,
  totalMatches,
}: {
  seasonId:
    string;

  round:
    DisciplinaryRoundReference;

  player:
    MatchweekDisciplinaryPlayer;

  reason:
    | "directRed"
    | "yellowAccumulation";

  totalMatches:
    number;
}): Omit<
  DisciplinarySuspension,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "completedAt"
> {
  return {
    seasonId,

    playerId:
      player.playerId,

    playerName:
      player.playerName,

    teamId:
      player.teamId,

    teamName:
      player.teamName,

    reason,

    sourceMatchId:
      player.sourceMatchId,

    /*
     * Campo legacy disponibile soltanto per RS.
     */
    sourceMatchweek:
      round.phase ===
        "regularSeason"
        ? round
            .matchweek
        : undefined,

    totalMatches,

    servedMatches:
      0,

    servedMatchIds:
      [],

    remainingMatches:
      totalMatches,

    status:
      "active",

    note:
      reason ===
        "directRed"
        ? "Squalifica per cartellino rosso diretto"
        : "Squalifica per somma di ammonizioni",
  };
}

function sanitizeCardCount(
  value:
    number,

  maximum?:
    number,
): number {
  if (
    !Number.isFinite(
      value,
    ) ||
    value <=
      0
  ) {
    return 0;
  }

  const sanitizedValue =
    Math.floor(
      value,
    );

  return typeof maximum ===
    "number"
    ? Math.min(
        sanitizedValue,
        maximum,
      )
    : sanitizedValue;
}

function hasExistingSourceSuspension({
  suspensions,
  playerId,
  sourceMatchId,
  reason,
}: {
  suspensions:
    Array<
      Pick<
        DisciplinarySuspension,
        | "playerId"
        | "sourceMatchId"
        | "reason"
      >
    >;

  playerId:
    string;

  sourceMatchId:
    string;

  reason:
    | "directRed"
    | "yellowAccumulation";
}): boolean {
  return suspensions.some(
    (suspension) =>
      suspension.playerId ===
        playerId &&
      suspension
        .sourceMatchId ===
        sourceMatchId &&
      suspension.reason ===
        reason,
  );
}

function hasActiveYellowSuspension({
  playerId,
  existingSuspensions,
  newSuspensions,
}: {
  playerId:
    string;

  existingSuspensions:
    DisciplinarySuspension[];

  newSuspensions:
    DisciplinaryEngineResult["newSuspensions"];
}): boolean {
  return [
    ...existingSuspensions,
    ...newSuspensions,
  ].some(
    (suspension) =>
      suspension.playerId ===
        playerId &&
      suspension.reason ===
        "yellowAccumulation" &&
      suspension.status ===
        "active",
  );
}
