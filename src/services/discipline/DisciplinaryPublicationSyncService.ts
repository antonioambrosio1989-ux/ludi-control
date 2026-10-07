import {
  FirebaseDisciplinaryRepository,
} from "@/src/services/discipline/FirebaseDisciplinaryRepository";

import type {
  DisciplinarySuspension,
  SuspensionReason,
} from "@/src/types/DisciplinaryRecord";

import type {
  CommunicationSanction,
  OfficialCommunication,
} from "@/src/types/OfficialCommunication";

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

export const DisciplinaryPublicationSyncService =
  {
    async sync({
      communication,
    }: {
      communication:
        OfficialCommunication;
    }): Promise<void> {
      validateCommunication(
        communication,
      );

      const existingSuspensions =
        await FirebaseDisciplinaryRepository
          .getSuspensionsBySeason(
            communication.seasonId,
          );

      const suspensionsById =
        new Map(
          existingSuspensions.map(
            (
              suspension,
            ) => [
              suspension.id,
              suspension,
            ],
          ),
        );

      /*
       * ======================================================
       * SANZIONI AUTOMATICHE
       * ======================================================
       */

      await syncAutomaticSanctions({
  sanctions:
    communication
      .directRedSanctions,

  reason:
    "directRed",

  communicationMatchweek:
    communication.matchweek,

  suspensionsById,
});

      await syncAutomaticSanctions({
  sanctions:
    communication
      .accumulationSanctions,

  reason:
    "yellowAccumulation",

  communicationMatchweek:
    communication.matchweek,

  suspensionsById,
});

      /*
       * ======================================================
       * GIUDICE SPORTIVO
       * ======================================================
       */

      await syncJudgeSanctions({
        communication,

        existingSuspensions,
      });
    },
  };

/*
 * ============================================================
 * AUTOMATIC SANCTIONS
 * ============================================================
 */

async function syncAutomaticSanctions({
  sanctions,
  reason,
  communicationMatchweek,
  suspensionsById,
}: {
  sanctions:
    CommunicationSanction[];

  reason:
    SuspensionReason;

  communicationMatchweek:
    number;

  suspensionsById:
    Map<
      string,
      DisciplinarySuspension
    >;
}): Promise<void> {
  for (
    const sanction
    of sanctions
  ) {
    const suspension =
      suspensionsById.get(
        sanction.id,
      );

    if (
      !suspension
    ) {
      throw new Error(
        `La squalifica di ${sanction.playerName} non è più presente nell'archivio disciplinare.`,
      );
    }

    /*
 * ======================================================
 * PROTEZIONE COMUNICATI STORICI
 * ======================================================
 *
 * Un vecchio comunicato non può modificare
 * una squalifica che nel frattempo è già
 * evoluta attraverso Matchweek successive.
 *
 * Esempio:
 *
 * - squalifica generata in MW5;
 * - giornata scontata in MW6;
 * - ripubblicazione del comunicato MW5.
 *
 * In quel caso dobbiamo bloccare la sync,
 * altrimenti il vecchio comunicato potrebbe
 * riattivare una squalifica già scontata.
 * ======================================================
 */

assertAutomaticSuspensionCanBeSynced({
  suspension,

  communicationMatchweek,

  playerName:
    sanction.playerName,
});

    if (
      suspension.reason !==
      reason
    ) {
      throw new Error(
        `La squalifica di ${sanction.playerName} non corrisponde al provvedimento disciplinare atteso.`,
      );
    }

    const remainingMatches =
      sanitizeSuspensionMatches(
        sanction.suspensionMatches,
      );

    await FirebaseDisciplinaryRepository
      .updateSuspension(
        suspension.id,
        {
          totalMatches:
            suspension.servedMatches +
            remainingMatches,

          remainingMatches,

          status:
            "active",

          note:
            sanction.reason?.trim() ||
            suspension.note,
        },
      );
  }
}

/*
 * ============================================================
 * JUDGE SANCTIONS
 * ============================================================
 */

async function syncJudgeSanctions({
  communication,
  existingSuspensions,
}: {
  communication:
    OfficialCommunication;

  existingSuspensions:
    DisciplinarySuspension[];
}): Promise<void> {
  const existingJudgeSuspensions =
    existingSuspensions.filter(
      (
        suspension,
      ) =>
        suspension.reason ===
          "sportsJudge" &&
        suspension
          .sourceCommunicationId ===
          communication.id,
    );

  const desiredSuspensionIds =
    new Set<string>();

  for (
    const sanction
    of communication
      .judgeSanctions
  ) {
    validateJudgeSanction(
      sanction,
    );

    const suspensionId =
      createJudgeSuspensionId({
        communicationId:
          communication.id,

        sanctionId:
          sanction.id,
      });

    desiredSuspensionIds.add(
      suspensionId,
    );

    const existing =
      existingJudgeSuspensions.find(
        (
          suspension,
        ) =>
          suspension.id ===
          suspensionId,
      );

    const totalMatches =
      sanitizeSuspensionMatches(
        sanction.suspensionMatches,
      );

    if (
      !existing
    ) {
      await FirebaseDisciplinaryRepository
        .createSuspensionWithId(
          suspensionId,
          {
            seasonId:
              communication.seasonId,

            playerId:
              sanction.playerId,

            playerName:
              sanction.playerName,

            teamId:
              sanction.teamId!,

            teamName:
              sanction.teamName,

            reason:
              "sportsJudge",

            sourceMatchweek:
              communication.matchweek,

            sourceCommunicationId:
              communication.id,

            sourceCommunicationSanctionId:
              sanction.id,

            totalMatches,

            servedMatches:
              0,

            remainingMatches:
              totalMatches,

            servedMatchweeks:
              [],

            servedMatchIds:
  [],

            note:
              sanction.reason?.trim() ||
              "Provvedimento del giudice sportivo",

            status:
              "active",
          },
        );

      continue;
    }

    const remainingMatches =
      Math.max(
        0,

        totalMatches -
          existing.servedMatches,
      );

    await FirebaseDisciplinaryRepository
      .updateSuspension(
        existing.id,
        {
          playerId:
            sanction.playerId,

          playerName:
            sanction.playerName,

          teamId:
            sanction.teamId!,

          teamName:
            sanction.teamName,

          totalMatches,

          remainingMatches,

          note:
            sanction.reason?.trim() ||
            "Provvedimento del giudice sportivo",

          status:
            remainingMatches > 0
              ? "active"
              : "completed",
        },
      );
  }

  /*
   * Un provvedimento precedentemente
   * pubblicato ma successivamente rimosso
   * viene annullato.
   */
  for (
    const existing
    of existingJudgeSuspensions
  ) {
    if (
      desiredSuspensionIds.has(
        existing.id,
      )
    ) {
      continue;
    }

    await FirebaseDisciplinaryRepository
      .updateSuspension(
        existing.id,
        {
          remainingMatches:
            0,

          status:
            "cancelled",
        },
      );
  }
}

/*
 * ============================================================
 * AUTOMATIC SUSPENSION HISTORY GUARD
 * ============================================================
 */

function assertAutomaticSuspensionCanBeSynced({
  suspension,
  communicationMatchweek,
  playerName,
}: {
  suspension:
    DisciplinarySuspension;

  communicationMatchweek:
    number;

  playerName:
    string;
}): void {
  const servedMatchweeks =
    suspension
      .servedMatchweeks ??
    [];

  const wasServedAfterCommunication =
    servedMatchweeks.some(
      (
        servedMatchweek,
      ) =>
        Number.isInteger(
          servedMatchweek,
        ) &&
        servedMatchweek >
          communicationMatchweek,
    );

  if (
    wasServedAfterCommunication
  ) {
    throw new Error(
      `Il comunicato della Matchweek ${communicationMatchweek} è storico: la squalifica di ${playerName} è già stata scontata in una Matchweek successiva e non può essere modificata.`,
    );
  }

  /*
   * Compatibilità fail-closed con eventuali
   * vecchie sospensioni che registravano
   * servedMatches ma non servedMatchweeks.
   *
   * Non conoscendo quando siano state
   * effettivamente scontate, evitiamo di
   * riattivarle accidentalmente.
   */
  if (
    suspension.servedMatches >
      0 &&
    servedMatchweeks.length ===
      0
  ) {
    throw new Error(
      `La squalifica di ${playerName} contiene giornate già scontate ma non possiede uno storico sufficiente per essere modificata in sicurezza.`,
    );
  }
}

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function createJudgeSuspensionId({
  communicationId,
  sanctionId,
}: {
  communicationId: string;
  sanctionId: string;
}): string {
  return `judge-${communicationId}-${sanctionId}`
    .replace(
      /\//g,
      "_",
    );
}

function validateJudgeSanction(
  sanction:
    CommunicationSanction,
): void {
  if (
    !sanction.playerId.trim() ||
    !sanction.teamId?.trim()
  ) {
    throw new Error(
      `Il provvedimento del giudice sportivo per ${sanction.playerName || "un giocatore"} non è associato a un giocatore reale della rosa.`,
    );
  }
}

function sanitizeSuspensionMatches(
  value: number,
): number {
  if (
    !Number.isFinite(
      value,
    ) ||
    value < 1
  ) {
    return 1;
  }

  return Math.floor(
    value,
  );
}

function validateCommunication(
  communication:
    OfficialCommunication,
): void {
  if (
    !communication.id.trim() ||
    !communication.seasonId.trim() ||
    !Number.isInteger(
      communication.matchweek,
    ) ||
    communication.matchweek < 1
  ) {
    throw new Error(
      "Il comunicato disciplinare non è valido.",
    );
  }
}