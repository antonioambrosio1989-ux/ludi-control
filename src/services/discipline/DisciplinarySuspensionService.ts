import {
  DisciplinaryEngine,
} from "@/src/services/discipline/DisciplinaryEngine";

import {
  FirebaseDisciplinaryRepository,
} from "@/src/services/discipline/FirebaseDisciplinaryRepository";

import type {
  PlayerDisciplinaryRecord,
} from "@/src/types/DisciplinaryRecord";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

export type ServeMatchweekSuspensionsResult = {
  servedSuspensionIds:
    string[];

  completedSuspensionIds:
    string[];

  resetYellowCyclePlayerIds:
    string[];
};

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

export const DisciplinarySuspensionService =
  {
    async serveForMatch({
  seasonId,
  matchId,
  matchweek,
  playedTeamIds,
}: {
  seasonId: string;

  matchId: string;

  /*
   * Presente in Regular Season / titlePlayoff.
   * Assente nelle fasi finali.
   */
  matchweek?: number;

  playedTeamIds:
    string[];
}): Promise<
  ServeMatchweekSuspensionsResult
> {
  const normalizedSeasonId =
    seasonId.trim();

  const normalizedMatchId =
    String(
      matchId,
    ).trim();

  if (
    !normalizedSeasonId
  ) {
    throw new Error(
      "La stagione disciplinare non è valida.",
    );
  }

  if (
    !normalizedMatchId
  ) {
    throw new Error(
      "La partita disciplinare non è valida.",
    );
  }

  if (
    matchweek !==
      undefined &&
    (
      !Number.isInteger(
        matchweek,
      ) ||
      matchweek < 1
    )
  ) {
    throw new Error(
      "La Matchweek disciplinare non è valida.",
    );
  }

  const normalizedPlayedTeamIds =
    new Set(
      playedTeamIds
        .map(
          (
            teamId,
          ) =>
            String(
              teamId,
            ).trim(),
        )
        .filter(
          Boolean,
        ),
    );

  const result:
    ServeMatchweekSuspensionsResult =
    {
      servedSuspensionIds:
        [],

      completedSuspensionIds:
        [],

      resetYellowCyclePlayerIds:
        [],
    };

  /*
   * Nessuna squadra ha disputato
   * realmente questa partita.
   */
  if (
    normalizedPlayedTeamIds.size ===
    0
  ) {
    return result;
  }

  const [
    records,
    activeSuspensions,
  ] =
    await Promise.all([
      FirebaseDisciplinaryRepository
        .getRecordsBySeason(
          normalizedSeasonId,
        ),

      FirebaseDisciplinaryRepository
        .getActiveSuspensionsBySeason(
          normalizedSeasonId,
        ),
    ]);

  const recordsByPlayerId =
    new Map<
      string,
      PlayerDisciplinaryRecord
    >(
      records.map(
        (
          record,
        ) => [
          record.playerId,
          record,
        ],
      ),
    );

  /*
   * Elaborazione sequenziale:
   * un giocatore può avere più
   * provvedimenti contemporaneamente.
   */
  for (
    const suspension
    of activeSuspensions
  ) {
    /*
     * La squadra del giocatore
     * non disputa questa partita.
     */
    if (
      !normalizedPlayedTeamIds.has(
        String(
          suspension.teamId,
        ),
      )
    ) {
      continue;
    }

    /*
     * Una squalifica nata dalla
     * partita corrente non può essere
     * scontata nella stessa partita.
     */
    if (
      suspension.sourceMatchId &&
      String(
        suspension.sourceMatchId,
      ) ===
        normalizedMatchId
    ) {
      continue;
    }

    /*
     * Regola specifica Regular Season:
     *
     * una squalifica maturata nella MW5
     * non può essere scontata da un'altra
     * partita appartenente ancora alla MW5.
     *
     * Per le fasi finali questo controllo
     * non viene applicato perché non esiste
     * la Matchweek.
     */
    if (
      matchweek !==
        undefined &&
      suspension
        .sourceMatchweek !==
        undefined &&
      suspension
        .sourceMatchweek >=
        matchweek
    ) {
      continue;
    }

    const servedMatchIds =
      suspension
        .servedMatchIds ??
      [];

    /*
     * Idempotenza per singola partita.
     */
    if (
      servedMatchIds.includes(
        normalizedMatchId,
      )
    ) {
      continue;
    }

    const servedMatchweeks =
      suspension
        .servedMatchweeks ??
      [];

    /*
     * Manteniamo anche l'idempotenza
     * storica per Matchweek.
     *
     * Serve soprattutto in Regular Season.
     */
    if (
      matchweek !==
        undefined &&
      servedMatchweeks.includes(
        matchweek,
      )
    ) {
      continue;
    }

    const updatedSuspension =
      DisciplinaryEngine
        .serveSuspensionMatch(
          suspension,
        );

    if (
      updatedSuspension
        .servedMatches ===
        suspension.servedMatches &&
      updatedSuspension
        .remainingMatches ===
        suspension.remainingMatches &&
      updatedSuspension.status ===
        suspension.status
    ) {
      continue;
    }

    const updatedServedMatchIds =
      Array.from(
        new Set([
          ...servedMatchIds,

          normalizedMatchId,
        ]),
      );

    const updatedServedMatchweeks =
      matchweek ===
        undefined
        ? servedMatchweeks
        : Array.from(
            new Set([
              ...servedMatchweeks,

              matchweek,
            ]),
          );

    await FirebaseDisciplinaryRepository
      .updateSuspension(
        suspension.id,
        {
          servedMatches:
            updatedSuspension
              .servedMatches,

          remainingMatches:
            updatedSuspension
              .remainingMatches,

          status:
            updatedSuspension
              .status,

          servedMatchIds:
            updatedServedMatchIds,

          servedMatchweeks:
            updatedServedMatchweeks,
        },
      );

    result
      .servedSuspensionIds
      .push(
        suspension.id,
      );

    if (
      updatedSuspension.status !==
      "completed"
    ) {
      continue;
    }

    result
      .completedSuspensionIds
      .push(
        suspension.id,
      );

    const currentRecord =
      recordsByPlayerId.get(
        suspension.playerId,
      );

    if (
      !currentRecord
    ) {
      continue;
    }

    let updatedRecord =
      currentRecord;

    /*
     * Solo la squalifica per somma
     * ammonizioni chiude il ciclo
     * dei cinque cartellini.
     */
    if (
      suspension.reason ===
      "yellowAccumulation"
    ) {
      updatedRecord =
        DisciplinaryEngine
          .resetYellowCycleAfterSuspension(
            updatedRecord,
          );

      result
        .resetYellowCyclePlayerIds
        .push(
          suspension.playerId,
        );
    }

    updatedRecord = {
      ...updatedRecord,

      activeSuspensionIds:
        updatedRecord
          .activeSuspensionIds
          .filter(
            (
              suspensionId,
            ) =>
              suspensionId !==
              suspension.id,
          ),
    };

    await FirebaseDisciplinaryRepository
      .upsertRecord({
        seasonId:
          updatedRecord.seasonId,

        playerId:
          updatedRecord.playerId,

        playerName:
          updatedRecord.playerName,

        teamId:
          updatedRecord.teamId,

        teamName:
          updatedRecord.teamName,

        seasonYellowCards:
          updatedRecord
            .seasonYellowCards,

        currentYellowCycle:
          updatedRecord
            .currentYellowCycle,

        directRedCards:
          updatedRecord
            .directRedCards,

        activeSuspensionIds: [
          ...updatedRecord
            .activeSuspensionIds,
        ],

        processedSourceMatchIds: [
          ...(
            updatedRecord
              .processedSourceMatchIds ??
            []
          ),
        ],

        lastProcessedMatchweek:
          updatedRecord
            .lastProcessedMatchweek,
      });

    recordsByPlayerId.set(
      updatedRecord.playerId,
      updatedRecord,
    );
  }

  return result;
},

async serveForMatchweek({
      seasonId,
      matchweek,
      playedTeamIds,
    }: {
      seasonId: string;

      matchweek: number;

      playedTeamIds:
        string[];
    }): Promise<
      ServeMatchweekSuspensionsResult
    > {
      validateInput({
        seasonId,
        matchweek,
      });

      const normalizedPlayedTeamIds =
        new Set(
          playedTeamIds
            .map(
              (
                teamId,
              ) =>
                String(
                  teamId,
                ).trim(),
            )
            .filter(
              Boolean,
            ),
        );

      const result:
        ServeMatchweekSuspensionsResult =
        {
          servedSuspensionIds:
            [],

          completedSuspensionIds:
            [],

          resetYellowCyclePlayerIds:
            [],
        };

      /*
       * Nessuna squadra ha effettivamente
       * giocato nella Matchweek.
       */
      if (
        normalizedPlayedTeamIds.size ===
        0
      ) {
        return result;
      }

      const [
        records,
        activeSuspensions,
      ] =
        await Promise.all([
          FirebaseDisciplinaryRepository
            .getRecordsBySeason(
              seasonId,
            ),

          FirebaseDisciplinaryRepository
            .getActiveSuspensionsBySeason(
              seasonId,
            ),
        ]);

      const recordsByPlayerId =
        new Map<
          string,
          PlayerDisciplinaryRecord
        >(
          records.map(
            (
              record,
            ) => [
              record.playerId,
              record,
            ],
          ),
        );

      /*
       * Elaborazione sequenziale:
       * evita race condition nel caso
       * lo stesso giocatore abbia più
       * provvedimenti attivi.
       */
      for (
        const suspension
        of activeSuspensions
      ) {
        /*
         * La squadra non ha disputato
         * alcuna gara in questa MW.
         */
        if (
          !normalizedPlayedTeamIds.has(
            String(
              suspension.teamId,
            ),
          )
        ) {
          continue;
        }

        /*
         * Una squalifica non può essere
         * scontata nella stessa Matchweek
         * nella quale è stata generata.
         */
        if (
  suspension.sourceMatchweek !==
    undefined &&
  suspension.sourceMatchweek >=
    matchweek
) {
  continue;
}

        const servedMatchweeks =
          suspension
            .servedMatchweeks ??
          [];

        /*
         * Idempotenza:
         * questa Matchweek è già stata
         * utilizzata per scontare la
         * squalifica.
         */
        if (
          servedMatchweeks.includes(
            matchweek,
          )
        ) {
          continue;
        }

        const updatedSuspension =
          DisciplinaryEngine
            .serveSuspensionMatch(
              suspension,
            );

        /*
         * Nessuna modifica:
         * sospensione non attiva oppure
         * già completamente scontata.
         */
        if (
          updatedSuspension
            .servedMatches ===
            suspension.servedMatches &&
          updatedSuspension
            .remainingMatches ===
            suspension.remainingMatches &&
          updatedSuspension.status ===
            suspension.status
        ) {
          continue;
        }

        const updatedServedMatchweeks =
          Array.from(
            new Set([
              ...servedMatchweeks,

              matchweek,
            ]),
          );

        await FirebaseDisciplinaryRepository
          .updateSuspension(
            suspension.id,
            {
              servedMatches:
                updatedSuspension
                  .servedMatches,

              remainingMatches:
                updatedSuspension
                  .remainingMatches,

              status:
                updatedSuspension
                  .status,

              servedMatchweeks:
                updatedServedMatchweeks,
            },
          );

        result
          .servedSuspensionIds
          .push(
            suspension.id,
          );

        /*
         * La squalifica ha ancora
         * giornate residue.
         */
        if (
          updatedSuspension.status !==
          "completed"
        ) {
          continue;
        }

        result
          .completedSuspensionIds
          .push(
            suspension.id,
          );

        const currentRecord =
          recordsByPlayerId.get(
            suspension.playerId,
          );

        if (
          !currentRecord
        ) {
          continue;
        }

        let updatedRecord =
          currentRecord;

        /*
         * Solo la squalifica per somma
         * di ammonizioni chiude il ciclo
         * disciplinare dei cinque gialli.
         */
        if (
          suspension.reason ===
          "yellowAccumulation"
        ) {
          updatedRecord =
            DisciplinaryEngine
              .resetYellowCycleAfterSuspension(
                updatedRecord,
              );

          result
            .resetYellowCyclePlayerIds
            .push(
              suspension.playerId,
            );
        }

        /*
         * Manteniamo coerente anche la
         * lista degli eventuali ID attivi.
         */
        updatedRecord = {
          ...updatedRecord,

          activeSuspensionIds:
            updatedRecord
              .activeSuspensionIds
              .filter(
                (
                  suspensionId,
                ) =>
                  suspensionId !==
                  suspension.id,
              ),
        };

        await FirebaseDisciplinaryRepository
          .upsertRecord({
            seasonId:
              updatedRecord.seasonId,

            playerId:
              updatedRecord.playerId,

            playerName:
              updatedRecord.playerName,

            teamId:
              updatedRecord.teamId,

            teamName:
              updatedRecord.teamName,

            seasonYellowCards:
              updatedRecord
                .seasonYellowCards,

            currentYellowCycle:
              updatedRecord
                .currentYellowCycle,

            directRedCards:
              updatedRecord
                .directRedCards,

            activeSuspensionIds: [
              ...updatedRecord
                .activeSuspensionIds,
            ],

            processedSourceMatchIds: [
              ...(
                updatedRecord
                  .processedSourceMatchIds ??
                []
              ),
            ],

            lastProcessedMatchweek:
              updatedRecord
                .lastProcessedMatchweek,
          });

        recordsByPlayerId.set(
          updatedRecord.playerId,
          updatedRecord,
        );
      }

      return result;
    },
  };

/*
 * ============================================================
 * VALIDATION
 * ============================================================
 */

function validateInput({
  seasonId,
  matchweek,
}: {
  seasonId: string;
  matchweek: number;
}): void {
  if (
    !seasonId.trim()
  ) {
    throw new Error(
      "La stagione disciplinare non è valida.",
    );
  }

  if (
    !Number.isInteger(
      matchweek,
    ) ||
    matchweek < 1
  ) {
    throw new Error(
      "La Matchweek disciplinare non è valida.",
    );
  }
}