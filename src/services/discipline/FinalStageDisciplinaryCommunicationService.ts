import type {
  CommunicationClubFine,
  CommunicationSanction,
  CommunicationWarning,
} from "@/src/types/OfficialCommunication";

import type {
  DisciplinarySuspension,
  PlayerDisciplinaryRecord,
} from "@/src/types/DisciplinaryRecord";

import {
  DisciplinaryEngine,
  type MatchweekDisciplinaryPlayer,
} from "@/src/services/discipline/DisciplinaryEngine";

import {
  FirebaseDisciplinaryRepository,
} from "@/src/services/discipline/FirebaseDisciplinaryRepository";

import type {
  FinalStageOfficialCommunication,
} from "@/src/types/FinalStageOfficialCommunication";

/*
 * ============================================================
 * FINAL STAGE DISCIPLINARY COMMUNICATION SERVICE
 * ============================================================
 *
 * Step 7:
 * il motore disciplinare è ora phase-aware nativamente.
 *
 * Nessun numero tecnico negativo.
 * Nessun cleanup successivo.
 * Nessuna contaminazione tra MW e FS.
 * ============================================================
 */

export type GenerateFinalStageCommunicationInput = {
  seasonId:
    string;

  finalStageWeek:
    number;

  players:
    MatchweekDisciplinaryPlayer[];

  judgeSanctions?:
    CommunicationSanction[];

  clubFines?:
    CommunicationClubFine[];
};

export type GenerateFinalStageCommunicationResult = {
  communication:
    FinalStageOfficialCommunication;

  updatedRecords:
    PlayerDisciplinaryRecord[];

  activeSuspensions:
    DisciplinarySuspension[];
};

export const FinalStageDisciplinaryCommunicationService =
  {
    async generateDraft({
      seasonId,
      finalStageWeek,
      players,
      judgeSanctions = [],
      clubFines = [],
    }: GenerateFinalStageCommunicationInput): Promise<
      GenerateFinalStageCommunicationResult
    > {
      validateInput({
        seasonId,
        finalStageWeek,
      });

      const [
        existingRecords,
        existingSuspensions,
      ] =
        await Promise.all([
          FirebaseDisciplinaryRepository
            .getRecordsBySeason(
              seasonId,
            ),

          FirebaseDisciplinaryRepository
            .getSuspensionsBySeason(
              seasonId,
            ),
        ]);

      const engineResult =
        DisciplinaryEngine
          .processRound({
            seasonId,

            round: {
              phase:
                "finalStage",

              finalStageWeek,
            },

            players,

            existingRecords,

            existingSuspensions,
          });

      await saveUpdatedRecords(
        engineResult
          .updatedRecords,
      );

      await saveNewSuspensions(
        engineResult
          .newSuspensions,
      );

      const activeSuspensions =
        await FirebaseDisciplinaryRepository
          .getActiveSuspensionsBySeason(
            seasonId,
          );

      const communication =
        createCommunication({
          seasonId,
          finalStageWeek,
          judgeSanctions,
          clubFines,

          activeSuspensions,

          warnedPlayers:
            engineResult
              .warnedPlayers,
        });

      return {
        communication,

        updatedRecords:
          engineResult
            .updatedRecords,

        activeSuspensions,
      };
    },
  };

async function saveUpdatedRecords(
  records:
    PlayerDisciplinaryRecord[],
) {
  await Promise.all(
    records.map(
      (record) =>
        FirebaseDisciplinaryRepository
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
              record
                .seasonYellowCards,

            currentYellowCycle:
              record
                .currentYellowCycle,

            directRedCards:
              record
                .directRedCards,

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

            lastProcessedMatchweek:
              record
                .lastProcessedMatchweek,
          }),
    ),
  );
}

async function saveNewSuspensions(
  suspensions:
    Array<
      Omit<
        DisciplinarySuspension,
        | "id"
        | "createdAt"
        | "updatedAt"
        | "completedAt"
      >
    >,
) {
  await Promise.all(
    suspensions.map(
      (suspension) =>
        FirebaseDisciplinaryRepository
          .createSuspension(
            suspension,
          ),
    ),
  );
}

function createCommunication({
  seasonId,
  finalStageWeek,
  judgeSanctions,
  clubFines,
  activeSuspensions,
  warnedPlayers,
}: {
  seasonId:
    string;

  finalStageWeek:
    number;

  judgeSanctions:
    CommunicationSanction[];

  clubFines:
    CommunicationClubFine[];

  activeSuspensions:
    DisciplinarySuspension[];

  warnedPlayers:
    PlayerDisciplinaryRecord[];
}): FinalStageOfficialCommunication {
  const now =
    new Date()
      .toISOString();

  return {
    id:
      `${seasonId}-fs${finalStageWeek}`,

    seasonId,

    phase:
      "finalStage",

    finalStageWeek,

    roundSlug:
      `fs${finalStageWeek}`,

    title:
      `Comunicato disciplinare — FS${finalStageWeek}`,

    judgeSanctions:
      judgeSanctions.map(
        normalizeManualSanction,
      ),

    clubFines:
      clubFines.map(
        normalizeClubFine,
      ),

    directRedSanctions:
      activeSuspensions
        .filter(
          (suspension) =>
            suspension.reason ===
              "directRed" &&
            suspension
              .remainingMatches >
              0,
        )
        .map(
          mapSuspensionToCommunication,
        ),

    accumulationSanctions:
      activeSuspensions
        .filter(
          (suspension) =>
            suspension.reason ===
              "yellowAccumulation" &&
            suspension
              .remainingMatches >
              0,
        )
        .map(
          mapSuspensionToCommunication,
        ),

    warnings:
      warnedPlayers
        .filter(
          (record) =>
            record
              .currentYellowCycle ===
            4,
        )
        .map(
          mapRecordToWarning,
        ),

    status:
      "draft",

    createdAt:
      now,

    updatedAt:
      now,
  };
}

function mapSuspensionToCommunication(
  suspension:
    DisciplinarySuspension,
): CommunicationSanction {
  return {
    id:
      suspension.id,

    playerId:
      suspension.playerId,

    playerName:
      suspension.playerName,

    teamId:
      suspension.teamId,

    teamName:
      suspension.teamName,

    suspensionMatches:
      suspension
        .remainingMatches,

    reason:
      createSuspensionReason(
        suspension,
      ),
  };
}

function createSuspensionReason(
  suspension:
    DisciplinarySuspension,
): string {
  if (
    suspension.reason ===
    "directRed"
  ) {
    return suspension
      .remainingMatches ===
      suspension
        .totalMatches
      ? "Squalifica per cartellino rosso diretto"
      : "Squalifica residua per cartellino rosso diretto";
  }

  if (
    suspension.reason ===
    "yellowAccumulation"
  ) {
    return suspension
      .remainingMatches ===
      suspension
        .totalMatches
      ? "Squalifica per somma di ammonizioni"
      : "Squalifica residua per somma di ammonizioni";
  }

  return suspension
    .note
    ?.trim() ||
    "Provvedimento del giudice sportivo";
}

function mapRecordToWarning(
  record:
    PlayerDisciplinaryRecord,
): CommunicationWarning {
  return {
    id:
      `${record.seasonId}-${record.playerId}-warning`,

    playerId:
      record.playerId,

    playerName:
      record.playerName,

    teamId:
      record.teamId,

    teamName:
      record.teamName,

    yellowCards:
      record
        .currentYellowCycle,
  };
}

function normalizeManualSanction(
  sanction:
    CommunicationSanction,
): CommunicationSanction {
  return {
    ...sanction,

    playerId:
      String(
        sanction.playerId ??
        "",
      ).trim(),

    playerName:
      String(
        sanction.playerName ??
        "",
      ).trim(),

    teamName:
      String(
        sanction.teamName ??
        "",
      ).trim(),

    reason:
      String(
        sanction.reason ??
        "",
      ).trim(),

    suspensionMatches:
      Number.isFinite(
        sanction
          .suspensionMatches,
      )
        ? Math.max(
            1,

            Math.floor(
              sanction
                .suspensionMatches,
            ),
          )
        : 1,
  };
}

function normalizeClubFine(
  fine:
    CommunicationClubFine,
): CommunicationClubFine {
  return {
    ...fine,

    teamName:
      String(
        fine.teamName ??
        "",
      ).trim(),

    reason:
      String(
        fine.reason ??
        "",
      ).trim(),
  };
}

function validateInput({
  seasonId,
  finalStageWeek,
}: {
  seasonId:
    string;

  finalStageWeek:
    number;
}) {
  if (
    !seasonId.trim()
  ) {
    throw new Error(
      "La stagione disciplinare non è valida.",
    );
  }

  if (
    !Number.isInteger(
      finalStageWeek,
    ) ||
    finalStageWeek <
      1
  ) {
    throw new Error(
      "La settimana Final Stage non è valida.",
    );
  }
}
