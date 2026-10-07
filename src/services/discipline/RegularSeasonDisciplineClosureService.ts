import {
  FirebaseDisciplinaryRepository,
} from "@/src/services/discipline/FirebaseDisciplinaryRepository";

import type {
  DisciplinarySuspension,
} from "@/src/types/DisciplinaryRecord";

/*
 * ============================================================
 * RESULT
 * ============================================================
 */

export type RegularSeasonDisciplineClosureResult = {
  cancelledSuspensionIds:
    string[];

  preservedSportsJudgeSuspensionIds:
    string[];

  resetPlayerIds:
    string[];
};

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

export const RegularSeasonDisciplineClosureService =
  {
    async close({
      seasonId,
    }: {
      seasonId: string;
    }): Promise<
      RegularSeasonDisciplineClosureResult
    > {
      const normalizedSeasonId =
        seasonId.trim();

      if (
        !normalizedSeasonId
      ) {
        throw new Error(
          "La stagione disciplinare non è valida.",
        );
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

      const result:
        RegularSeasonDisciplineClosureResult =
        {
          cancelledSuspensionIds:
            [],

          preservedSportsJudgeSuspensionIds:
            [],

          resetPlayerIds:
            [],
        };

      /*
       * ======================================================
       * SOSPENSIONI
       * ======================================================
       *
       * Regular Season:
       *
       * - directRed            → si azzera
       * - yellowAccumulation   → si azzera
       * - sportsJudge          → resta attiva
       * ======================================================
       */

      for (
        const suspension
        of activeSuspensions
      ) {
        if (
          suspension.reason ===
          "sportsJudge"
        ) {
          result
            .preservedSportsJudgeSuspensionIds
            .push(
              suspension.id,
            );

          continue;
        }

        await FirebaseDisciplinaryRepository
          .updateSuspension(
            suspension.id,
            {
              remainingMatches:
                0,

              status:
                "cancelled",
            },
          );

        result
          .cancelledSuspensionIds
          .push(
            suspension.id,
          );
      }

      /*
       * ======================================================
       * SOSPENSIONI GIUDICE SPORTIVO PER GIOCATORE
       * ======================================================
       *
       * Non ci fidiamo esclusivamente di activeSuspensionIds
       * già salvato nel record.
       *
       * Ricostruiamo gli ID attivi direttamente dalle vere
       * sospensioni persistenti.
       * ======================================================
       */

      const activeSportsJudgeIdsByPlayer =
        createSportsJudgeIdsByPlayer(
          activeSuspensions,
        );

      /*
       * ======================================================
       * RESET RECORD GIOCATORI
       * ======================================================
       *
       * seasonYellowCards e directRedCards sono statistiche
       * stagionali e NON devono essere azzerate.
       *
       * currentYellowCycle invece riparte da zero per le
       * fasi finali.
       * ======================================================
       */

      for (
        const record
        of records
      ) {
        const preservedSuspensionIds =
          activeSportsJudgeIdsByPlayer.get(
            record.playerId,
          ) ??
          [];

        await FirebaseDisciplinaryRepository
          .upsertRecord({
            seasonId:
              record.seasonId,

            playerId:
              record.playerId,

            playerName:
              record.playerName,

            teamId:
              record.teamId,

            teamName:
              record.teamName,

            /*
             * Statistiche stagionali:
             * rimangono inalterate.
             */
            seasonYellowCards:
              record.seasonYellowCards,

            directRedCards:
              record.directRedCards,

            /*
             * Nuovo ciclo disciplinare
             * per le fasi finali.
             */
            currentYellowCycle:
              0,

            /*
             * Sopravvivono esclusivamente
             * le squalifiche del giudice
             * sportivo.
             */
            activeSuspensionIds: [
              ...preservedSuspensionIds,
            ],

            /*
             * Manteniamo lo storico delle
             * partite già processate.
             */
            processedSourceMatchIds: [
              ...(
                record
                  .processedSourceMatchIds ??
                []
              ),
            ],

            lastProcessedMatchweek:
              record
                .lastProcessedMatchweek,
          });

        result
          .resetPlayerIds
          .push(
            record.playerId,
          );
      }

      return result;
    },
  };

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function createSportsJudgeIdsByPlayer(
  suspensions:
    DisciplinarySuspension[],
): Map<
  string,
  string[]
> {
  const result =
    new Map<
      string,
      string[]
    >();

  suspensions
    .filter(
      (
        suspension,
      ) =>
        suspension.status ===
          "active" &&
        suspension.reason ===
          "sportsJudge" &&
        suspension.remainingMatches >
          0,
    )
    .forEach(
      (
        suspension,
      ) => {
        const existing =
          result.get(
            suspension.playerId,
          ) ??
          [];

        result.set(
          suspension.playerId,
          [
            ...existing,
            suspension.id,
          ],
        );
      },
    );

  return result;
}