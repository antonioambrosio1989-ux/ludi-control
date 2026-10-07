import {
  DisciplinaryEngine,
  type MatchweekDisciplinaryPlayer,
} from "@/src/services/discipline/DisciplinaryEngine";

import {
  DisciplinarySuspensionService,
} from "@/src/services/discipline/DisciplinarySuspensionService";

import {
  FirebaseDisciplinaryRepository,
} from "@/src/services/discipline/FirebaseDisciplinaryRepository";

import type {
  DisciplinarySuspension,
  PlayerDisciplinaryRecord,
} from "@/src/types/DisciplinaryRecord";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

export type ProcessDisciplinaryMatchInput = {
  seasonId: string;

  matchId: string;

  /*
   * Regular Season / titlePlayoff:
   * valorizzata.
   *
   * Fasi finali:
   * undefined.
   */
  matchweek?: number;

  homeTeamId: string;
  awayTeamId: string;

  /*
   * Soltanto i giocatori che hanno
   * ricevuto almeno un cartellino.
   */
  players:
    MatchweekDisciplinaryPlayer[];
};

export type ProcessDisciplinaryMatchResult = {
  servedSuspensionIds:
    string[];

  completedSuspensionIds:
    string[];

  resetYellowCyclePlayerIds:
    string[];

  processedPlayerIds:
    string[];

  createdSuspensionIds:
    string[];
};

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

export const DisciplinaryMatchProcessingService =
  {
    async process({
      seasonId,
      matchId,
      matchweek,
      homeTeamId,
      awayTeamId,
      players,
    }: ProcessDisciplinaryMatchInput): Promise<
      ProcessDisciplinaryMatchResult
    > {
      const normalizedSeasonId =
        String(
          seasonId,
        ).trim();

      const normalizedMatchId =
        String(
          matchId,
        ).trim();

      const normalizedHomeTeamId =
        String(
          homeTeamId,
        ).trim();

      const normalizedAwayTeamId =
        String(
          awayTeamId,
        ).trim();

      /*
       * ======================================================
       * VALIDAZIONE
       * ======================================================
       */

      validateInput({
        seasonId:
          normalizedSeasonId,

        matchId:
          normalizedMatchId,

        matchweek,

        homeTeamId:
          normalizedHomeTeamId,

        awayTeamId:
          normalizedAwayTeamId,
      });

      const playedTeamIds = [
        normalizedHomeTeamId,
        normalizedAwayTeamId,
      ];

      const playedTeamIdSet =
        new Set(
          playedTeamIds,
        );

      /*
       * Ogni evento disciplinare deve
       * appartenere esattamente alla
       * partita che stiamo processando.
       */
      players.forEach(
        (
          player,
        ) => {
          if (
            String(
              player.sourceMatchId,
            ).trim() !==
            normalizedMatchId
          ) {
            throw new Error(
              `Il dato disciplinare del giocatore ${player.playerId} appartiene a una partita diversa.`,
            );
          }

          if (
            !playedTeamIdSet.has(
              String(
                player.teamId,
              ).trim(),
            )
          ) {
            throw new Error(
              `Il dato disciplinare del giocatore ${player.playerId} appartiene a una squadra non coinvolta nella partita.`,
            );
          }
        },
      );

      /*
       * ======================================================
       * 1. SCONTO SQUALIFICHE PREGRESSE
       * ======================================================
       *
       * Avviene PRIMA dei cartellini della
       * partita corrente.
       *
       * In questo modo:
       *
       * - una vecchia squalifica viene scontata;
       * - un eventuale nuovo 5° giallo viene
       *   elaborato soltanto dopo;
       * - una nuova squalifica non può essere
       *   scontata nella partita che l'ha generata.
       * ======================================================
       */

      const suspensionServingResult =
        await DisciplinarySuspensionService
          .serveForMatch({
            seasonId:
              normalizedSeasonId,

            matchId:
              normalizedMatchId,

            matchweek,

            playedTeamIds,
          });

      /*
       * ======================================================
       * 2. STATO DISCIPLINARE AGGIORNATO
       * ======================================================
       *
       * Rileggiamo dopo lo sconto delle
       * squalifiche, perché il ciclo gialli
       * potrebbe essere stato resettato.
       * ======================================================
       */

      const [
        existingRecords,
        existingSuspensions,
      ] =
        await Promise.all([
          FirebaseDisciplinaryRepository
            .getRecordsBySeason(
              normalizedSeasonId,
            ),

          FirebaseDisciplinaryRepository
            .getSuspensionsBySeason(
              normalizedSeasonId,
            ),
        ]);

      /*
       * ======================================================
       * 3. IDEMPOTENZA
       * ======================================================
       *
       * Il motore dispone già del controllo
       * sourceMatchId.
       *
       * Filtriamo anche qui per evitare
       * scritture inutili quando un tabellino
       * già pubblicato viene ripubblicato.
       * ======================================================
       */

      const playersToProcess =
        filterAlreadyProcessedPlayers({
          players,

          existingRecords,

          matchweek,
        });

      // Recover a direct red added after this player's first publication.
      // Previously counted yellows must not pass through the engine again.
      const newPlayerIds = new Set(playersToProcess.map(player => player.playerId));
      const recoveredPlayerIds: string[] = [];
      const recoveredSuspensionIds: string[] = [];
      for (const player of players) {
        if (newPlayerIds.has(player.playerId) || !(player.directRedCards > 0)) continue;
        if (existingSuspensions.some(suspension =>
          suspension.playerId === player.playerId &&
          suspension.sourceMatchId === normalizedMatchId &&
          suspension.reason === "directRed"
        )) continue;
        const record = existingRecords.find(item => item.playerId === player.playerId);
        if (!record || recoveredPlayerIds.includes(player.playerId)) continue;
        const suspension: Omit<DisciplinarySuspension, "id" | "createdAt" | "updatedAt" | "completedAt"> = {
          seasonId: normalizedSeasonId,
          playerId: player.playerId,
          playerName: player.playerName,
          teamId: player.teamId,
          teamName: player.teamName,
          reason: "directRed",
          sourceMatchId: normalizedMatchId,
          sourceMatchweek: matchweek,
          totalMatches: 1,
          servedMatches: 0,
          servedMatchIds: [],
          remainingMatches: 1,
          status: "active",
          note: "Squalifica per cartellino rosso diretto",
        };
        const suspensionId = createAutomaticSuspensionId({seasonId: normalizedSeasonId, suspension});
        await FirebaseDisciplinaryRepository.createSuspensionWithId(suspensionId, suspension);
        await saveRecord({
          record: {
            ...record,
            playerName: player.playerName,
            teamId: player.teamId,
            teamName: player.teamName,
            directRedCards: record.directRedCards + 1,
          },
          activeSuspensionIds: Array.from(new Set([...record.activeSuspensionIds, suspensionId])),
        });
        recoveredPlayerIds.push(player.playerId);
        recoveredSuspensionIds.push(suspensionId);
      }

      /*
       * Nessun nuovo cartellino da elaborare.
       *
       * Lo sconto di una squalifica pregressa
       * può comunque essere già avvenuto.
       */
      if (
        playersToProcess.length ===
        0
      ) {
        return {
          servedSuspensionIds: [
            ...suspensionServingResult
              .servedSuspensionIds,
          ],

          completedSuspensionIds: [
            ...suspensionServingResult
              .completedSuspensionIds,
          ],

          resetYellowCyclePlayerIds: [
            ...suspensionServingResult
              .resetYellowCyclePlayerIds,
          ],

          processedPlayerIds: recoveredPlayerIds,

          createdSuspensionIds: recoveredSuspensionIds,
        };
      }

      /*
       * ======================================================
       * 4. MOTORE DISCIPLINARE
       * ======================================================
       */

      const engineResult =
        matchweek !==
          undefined
          ? DisciplinaryEngine
              .processMatchweek({
                seasonId:
                  normalizedSeasonId,

                matchweek,

                players:
                  playersToProcess,

                existingRecords,

                existingSuspensions,
              })
          : DisciplinaryEngine
              .processMatch({
                seasonId:
                  normalizedSeasonId,

                players:
                  playersToProcess,

                existingRecords,

                existingSuspensions,
              });

      /*
       * ======================================================
       * 5. CREAZIONE SQUALIFICHE
       * ======================================================
       *
       * Utilizziamo ID deterministici.
       *
       * Questo permette:
       *
       * - idempotenza;
       * - collegamento record ↔ sospensione;
       * - nessun duplicato in caso di retry.
       * ======================================================
       */

      const createdSuspensionIds:
        string[] =
        [];

      const suspensionIdsByPlayer =
        new Map<
          string,
          string[]
        >();

      for (
        const suspension
        of engineResult
          .newSuspensions
      ) {
        const suspensionId =
          createAutomaticSuspensionId({
            seasonId:
              normalizedSeasonId,

            suspension,
          });

        await FirebaseDisciplinaryRepository
          .createSuspensionWithId(
            suspensionId,

            suspension,
          );

        createdSuspensionIds.push(
          suspensionId,
        );

        const currentIds =
          suspensionIdsByPlayer.get(
            suspension.playerId,
          ) ??
          [];

        suspensionIdsByPlayer.set(
          suspension.playerId,

          [
            ...currentIds,

            suspensionId,
          ],
        );
      }

      /*
       * ======================================================
       * 6. SALVATAGGIO RECORD
       * ======================================================
       *
       * Salviamo soltanto i giocatori
       * realmente processati in questa partita.
       * ======================================================
       */

      const processedPlayerIds =
        Array.from(
          new Set(
            playersToProcess.map(
              (
                player,
              ) =>
                player.playerId,
            ),
          ),
        );

      const processedPlayerIdSet =
        new Set(
          processedPlayerIds,
        );

      const recordsToPersist =
        engineResult
          .updatedRecords
          .filter(
            (
              record,
            ) =>
              processedPlayerIdSet.has(
                record.playerId,
              ),
          );

      for (
        const record
        of recordsToPersist
      ) {
        const newSuspensionIds =
          suspensionIdsByPlayer.get(
            record.playerId,
          ) ??
          [];

        const activeSuspensionIds =
          Array.from(
            new Set([
              ...record
                .activeSuspensionIds,

              ...newSuspensionIds,
            ]),
          );

        await saveRecord({
          record,

          activeSuspensionIds,
        });
      }

      /*
       * ======================================================
       * RESULT
       * ======================================================
       */

      return {
        servedSuspensionIds: [
          ...suspensionServingResult
            .servedSuspensionIds,
        ],

        completedSuspensionIds: [
          ...suspensionServingResult
            .completedSuspensionIds,
        ],

        resetYellowCyclePlayerIds: [
          ...suspensionServingResult
            .resetYellowCyclePlayerIds,
        ],

        processedPlayerIds: [...recoveredPlayerIds, ...processedPlayerIds],

        createdSuspensionIds: [...recoveredSuspensionIds, ...createdSuspensionIds],
      };
    },
  };

/*
 * ============================================================
 * FILTER IDEMPOTENZA
 * ============================================================
 */

function filterAlreadyProcessedPlayers({
  players,
  existingRecords,
  matchweek,
}: {
  players:
    MatchweekDisciplinaryPlayer[];

  existingRecords:
    PlayerDisciplinaryRecord[];

  matchweek?:
    number;
}): MatchweekDisciplinaryPlayer[] {
  const recordsByPlayerId =
    new Map(
      existingRecords.map(
        (
          record,
        ) => [
          record.playerId,

          record,
        ],
      ),
    );

  return players.filter(
    (
      player,
    ) => {
      const record =
        recordsByPlayerId.get(
          player.playerId,
        );

      if (
        !record
      ) {
        return true;
      }

      const processedSourceMatchIds =
        record
          .processedSourceMatchIds ??
        [];

      /*
       * Idempotenza moderna:
       * sourceMatchId.
       */
      if (
        processedSourceMatchIds.includes(
          player.sourceMatchId,
        )
      ) {
        return false;
      }

      /*
       * Compatibilità con record legacy
       * che non possedevano ancora
       * processedSourceMatchIds.
       *
       * Applicabile soltanto quando esiste
       * una Matchweek.
       */
      if (
        matchweek !==
          undefined &&
        processedSourceMatchIds.length ===
          0 &&
        record
          .lastProcessedMatchweek !==
          undefined &&
        record
          .lastProcessedMatchweek >=
          matchweek
      ) {
        return false;
      }

      return true;
    },
  );
}

/*
 * ============================================================
 * SAVE RECORD
 * ============================================================
 */

async function saveRecord({
  record,
  activeSuspensionIds,
}: {
  record:
    PlayerDisciplinaryRecord;

  activeSuspensionIds:
    string[];
}): Promise<void> {
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

      seasonYellowCards:
        record.seasonYellowCards,

      currentYellowCycle:
        record.currentYellowCycle,

      directRedCards:
        record.directRedCards,

      activeSuspensionIds: [
        ...activeSuspensionIds,
      ],

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
}

/*
 * ============================================================
 * DETERMINISTIC SUSPENSION ID
 * ============================================================
 */

function createAutomaticSuspensionId({
  seasonId,
  suspension,
}: {
  seasonId:
    string;

  suspension:
    Omit<
      DisciplinarySuspension,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "completedAt"
    >;
}): string {
  const sourceMatchId =
    String(
      suspension.sourceMatchId ??
      "unknown-match",
    );

  return [
    "auto",
    sanitizeIdPart(
      seasonId,
    ),
    sanitizeIdPart(
      sourceMatchId,
    ),
    sanitizeIdPart(
      suspension.playerId,
    ),
    sanitizeIdPart(
      suspension.reason,
    ),
  ].join(
    "-",
  );
}

function sanitizeIdPart(
  value:
    string,
): string {
  const normalized =
    String(
      value,
    )
      .trim()
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        "-",
      )
      .replace(
        /-+/g,
        "-",
      )
      .replace(
        /^-|-$/g,
        "",
      );

  return normalized ||
    "unknown";
}

/*
 * ============================================================
 * VALIDATION
 * ============================================================
 */

function validateInput({
  seasonId,
  matchId,
  matchweek,
  homeTeamId,
  awayTeamId,
}: {
  seasonId:
    string;

  matchId:
    string;

  matchweek?:
    number;

  homeTeamId:
    string;

  awayTeamId:
    string;
}): void {
  if (
    !seasonId
  ) {
    throw new Error(
      "La stagione disciplinare non è valida.",
    );
  }

  if (
    !matchId
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
      matchweek <
        1
    )
  ) {
    throw new Error(
      "La Matchweek disciplinare non è valida.",
    );
  }

  if (
    !homeTeamId ||
    !awayTeamId
  ) {
    throw new Error(
      "Le squadre della partita disciplinare non sono valide.",
    );
  }

  if (
    homeTeamId ===
    awayTeamId
  ) {
    throw new Error(
      "Una partita disciplinare non può avere la stessa squadra come casa e trasferta.",
    );
  }
}