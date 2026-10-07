import type {
  CommunicationClubFine,
  CommunicationSanction,
  CommunicationWarning,
  OfficialCommunication,
} from "@/src/types/OfficialCommunication";

import type {
  DisciplinarySuspension,
  PlayerDisciplinaryRecord,
} from "@/src/types/DisciplinaryRecord";

import { FirebaseDisciplinaryRepository } from "@/src/services/discipline/FirebaseDisciplinaryRepository";

export type GenerateDisciplinaryCommunicationInput = {
  seasonId: string;

  matchweek: number;

  judgeSanctions?:
    CommunicationSanction[];

  clubFines?:
    CommunicationClubFine[];
};

export type GenerateDisciplinaryCommunicationResult = {
  communication: OfficialCommunication;

  updatedRecords: PlayerDisciplinaryRecord[];

  activeSuspensions: DisciplinarySuspension[];
};

export const DisciplinaryCommunicationService =
  {
    /*
     * ========================================================
     * GENERAZIONE BOZZA
     * ========================================================
     *
     * IMPORTANTE:
     *
     * questo metodo è READ-ONLY.
     *
     * La disciplina automatica viene già
     * processata al momento della pubblicazione
     * ufficiale del Match Report.
     *
     * Generare o rigenerare un comunicato
     * NON deve:
     *
     * - scontare squalifiche;
     * - incrementare cartellini;
     * - creare squalifiche;
     * - modificare record disciplinari.
     *
     * Deve soltanto leggere lo stato ufficiale
     * corrente e trasformarlo in comunicato.
     * ========================================================
     */

    async generateDraft(
      input:
        GenerateDisciplinaryCommunicationInput,
    ): Promise<
      GenerateDisciplinaryCommunicationResult
    > {
      const {
        seasonId,
        matchweek,

        judgeSanctions =
          [],

        clubFines =
          [],
      } =
        input;

      validateInput({
        seasonId,
        matchweek,
      });

      /*
       * ======================================================
       * STATO DISCIPLINARE UFFICIALE
       * ======================================================
       *
       * Nessuna scrittura.
       * ======================================================
       */

      const [
        existingRecords,
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

      /*
       * ======================================================
       * DIFFIDATI
       * ======================================================
       */

      const warnedPlayers =
        getWarnedPlayers({
          records:
            existingRecords,

          activeSuspensions,
        });

      /*
       * ======================================================
       * COMUNICATO
       * ======================================================
       */

      const communication =
        createCommunication({
          seasonId,
          matchweek,

          judgeSanctions,

          clubFines,

          activeSuspensions,

          warnedPlayers,
        });

      return {
        communication,

        /*
         * Manteniamo temporaneamente questa
         * proprietà per compatibilità con
         * l'interfaccia già esistente.
         *
         * Non significa che questi record
         * siano stati modificati.
         */
        updatedRecords:
          existingRecords,

        activeSuspensions,
      };
    },
  };

/*
 * ============================================================
 * DIFFIDATI
 * ============================================================
 */

function getWarnedPlayers({
  records,
  activeSuspensions,
}: {
  records:
    PlayerDisciplinaryRecord[];

  activeSuspensions:
    DisciplinarySuspension[];
}): PlayerDisciplinaryRecord[] {
  const playersWithActiveYellowSuspension =
    new Set(
      activeSuspensions
        .filter(
          (
            suspension,
          ) =>
            suspension.reason ===
              "yellowAccumulation" &&
            suspension.status ===
              "active" &&
            suspension.remainingMatches >
              0,
        )
        .map(
          (
            suspension,
          ) =>
            suspension.playerId,
        ),
    );

  return records.filter(
    (
      record,
    ) =>
      record.currentYellowCycle ===
        4 &&
      !playersWithActiveYellowSuspension
        .has(
          record.playerId,
        ),
  );
}

function createCommunication({
  seasonId,
  matchweek,
  judgeSanctions,
  clubFines,
  activeSuspensions,
  warnedPlayers,
}: {
  seasonId: string;
  matchweek: number;

  judgeSanctions: CommunicationSanction[];
  clubFines: CommunicationClubFine[];
  activeSuspensions:
    DisciplinarySuspension[];

  warnedPlayers:
    PlayerDisciplinaryRecord[];
}): OfficialCommunication {
  const now =
    new Date().toISOString();

  return {
    id: `${seasonId}-mw${matchweek}`,

    seasonId,

    matchweek,

    title:
      `Comunicato disciplinare — Matchweek ${matchweek}`,

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
            suspension.remainingMatches > 0,
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
            suspension.remainingMatches > 0,
        )
        .map(
          mapSuspensionToCommunication,
        ),

    warnings:
      warnedPlayers
        .filter(
          (record) =>
            record.currentYellowCycle === 4,
        )
        .map(
          mapRecordToWarning,
        ),

    status: "draft",

    createdAt: now,
    updatedAt: now,
  };
}

function mapSuspensionToCommunication(
  suspension: DisciplinarySuspension,
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
      suspension.remainingMatches,

    reason:
      createSuspensionReason(
        suspension,
      ),
  };
}

function createSuspensionReason(
  suspension: DisciplinarySuspension,
): string {
  if (
    suspension.reason ===
    "directRed"
  ) {
    return suspension.remainingMatches ===
      suspension.totalMatches
      ? "Squalifica per cartellino rosso diretto"
      : "Squalifica residua per cartellino rosso diretto";
  }

  if (
    suspension.reason ===
    "yellowAccumulation"
  ) {
    return suspension.remainingMatches ===
      suspension.totalMatches
      ? "Squalifica per somma di ammonizioni"
      : "Squalifica residua per somma di ammonizioni";
  }

  return suspension.note?.trim() ||
    "Provvedimento del giudice sportivo";
}

function mapRecordToWarning(
  record: PlayerDisciplinaryRecord,
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
      record.currentYellowCycle,
  };
}

function normalizeManualSanction(
  sanction: CommunicationSanction,
): CommunicationSanction {
  return {
    ...sanction,

    suspensionMatches:
      sanitizeSuspensionMatches(
        sanction.suspensionMatches,
      ),

    reason:
      sanction.reason?.trim() ||
      "Provvedimento del giudice sportivo",
  };
}

function normalizeClubFine(
  fine: CommunicationClubFine,
): CommunicationClubFine {
  const amount =
    fine.amount !== undefined &&
    Number.isFinite(fine.amount) &&
    fine.amount >= 0
      ? fine.amount
      : undefined;

  return {
    id:
      fine.id,

    teamId:
      fine.teamId,

    teamName:
      fine.teamName.trim(),

    type:
      fine.type === "walkover" ||
      fine.type === "facilityDamage"
        ? fine.type
        : "other",

    amount,

    reason:
      fine.reason.trim(),
  };
}

function sanitizeSuspensionMatches(
  value: number,
): number {
  if (
    !Number.isFinite(value) ||
    value < 1
  ) {
    return 1;
  }

  return Math.floor(value);
}

function validateInput({
  seasonId,
  matchweek,
}: {
  seasonId: string;
  matchweek: number;
}): void {
  if (!seasonId.trim()) {
    throw new Error(
      "La stagione del comunicato non è valida.",
    );
  }

  if (
    !Number.isInteger(matchweek) ||
    matchweek < 1
  ) {
    throw new Error(
      "La Matchweek del comunicato non è valida.",
    );
  }
}