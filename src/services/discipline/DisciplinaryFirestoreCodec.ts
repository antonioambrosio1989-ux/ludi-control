import type {
  DisciplinarySuspension,
  PlayerDisciplinaryRecord,
} from "@/src/types/DisciplinaryRecord";

/*
 * ============================================================
 * COLLECTIONS
 * ============================================================
 */

export const DISCIPLINARY_RECORDS_COLLECTION =
  "disciplinaryRecords";

export const DISCIPLINARY_SUSPENSIONS_COLLECTION =
  "disciplinarySuspensions";

/*
 * ============================================================
 * RECORD DOCUMENT ID
 * ============================================================
 */

export function getDisciplinaryRecordDocumentId({
  seasonId,
  playerId,
}: {
  seasonId:
    string;

  playerId:
    string;
}): string {
  return `${seasonId}-${playerId}`;
}

/*
 * ============================================================
 * MAP RECORD
 * ============================================================
 */

export function mapDisciplinaryRecord(
  id:
    string,

  data:
    Record<
      string,
      unknown
    >,
): PlayerDisciplinaryRecord {
  return {
    id,

    seasonId:
      String(
        data.seasonId ??
        "",
      ),

    playerId:
      String(
        data.playerId ??
        "",
      ),

    playerName:
      String(
        data.playerName ??
        "",
      ),

    teamId:
      String(
        data.teamId ??
        "",
      ),

    teamName:
      String(
        data.teamName ??
        "",
      ),

    seasonYellowCards:
      Number(
        data.seasonYellowCards ??
        0,
      ),

    currentYellowCycle:
      Number(
        data.currentYellowCycle ??
        0,
      ),

    directRedCards:
      Number(
        data.directRedCards ??
        0,
      ),

    activeSuspensionIds:
      Array.isArray(
        data.activeSuspensionIds,
      )
        ? data
            .activeSuspensionIds
            .map(
              String,
            )
        : [],

    processedSourceMatchIds:
      Array.isArray(
        data.processedSourceMatchIds,
      )
        ? data
            .processedSourceMatchIds
            .map(
              String,
            )
        : [],

    lastProcessedMatchweek:
      typeof data
        .lastProcessedMatchweek ===
        "number"
        ? data
            .lastProcessedMatchweek
        : undefined,

    createdAt:
      typeof data.createdAt ===
      "string"
        ? data.createdAt
        : undefined,

    updatedAt:
      typeof data.updatedAt ===
      "string"
        ? data.updatedAt
        : undefined,
  };
}

/*
 * ============================================================
 * MAP SUSPENSION
 * ============================================================
 */

export function mapDisciplinarySuspension(
  id:
    string,

  data:
    Record<
      string,
      unknown
    >,
): DisciplinarySuspension {
  const status =
    data.status ===
      "completed" ||
    data.status ===
      "cancelled"
      ? data.status
      : "active";

  const reason =
    data.reason ===
      "yellowAccumulation" ||
    data.reason ===
      "sportsJudge"
      ? data.reason
      : "directRed";

  return {
    id,

    seasonId:
      String(
        data.seasonId ??
        "",
      ),

    playerId:
      String(
        data.playerId ??
        "",
      ),

    playerName:
      String(
        data.playerName ??
        "",
      ),

    teamId:
      String(
        data.teamId ??
        "",
      ),

    teamName:
      String(
        data.teamName ??
        "",
      ),

    reason,

    sourceMatchId:
      typeof data.sourceMatchId ===
      "string"
        ? data.sourceMatchId
        : undefined,

    sourceMatchweek:
      typeof data
        .sourceMatchweek ===
        "number" &&
      Number.isInteger(
        data.sourceMatchweek,
      ) &&
      data.sourceMatchweek >
        0
        ? data.sourceMatchweek
        : undefined,

    sourceCommunicationId:
      typeof data
        .sourceCommunicationId ===
        "string"
        ? data
            .sourceCommunicationId
        : undefined,

    sourceCommunicationSanctionId:
      typeof data
        .sourceCommunicationSanctionId ===
        "string"
        ? data
            .sourceCommunicationSanctionId
        : undefined,

    totalMatches:
      Number(
        data.totalMatches ??
        0,
      ),

    servedMatches:
      Number(
        data.servedMatches ??
        0,
      ),

    remainingMatches:
      Number(
        data.remainingMatches ??
        0,
      ),

    servedMatchweeks:
      Array.isArray(
        data.servedMatchweeks,
      )
        ? data
            .servedMatchweeks
            .map(
              Number,
            )
            .filter(
              (
                matchweek,
              ) =>
                Number.isInteger(
                  matchweek,
                ) &&
                matchweek >
                  0,
            )
        : [],

    servedMatchIds:
      Array.isArray(
        data.servedMatchIds,
      )
        ? data
            .servedMatchIds
            .map(
              String,
            )
            .map(
              (
                matchId,
              ) =>
                matchId.trim(),
            )
            .filter(
              Boolean,
            )
        : [],

    note:
      typeof data.note ===
      "string"
        ? data.note
        : undefined,

    status,

    createdAt:
      typeof data.createdAt ===
      "string"
        ? data.createdAt
        : undefined,

    updatedAt:
      typeof data.updatedAt ===
      "string"
        ? data.updatedAt
        : undefined,

    completedAt:
      typeof data.completedAt ===
      "string"
        ? data.completedAt
        : undefined,
  };
}