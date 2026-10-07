import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  writeBatch,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";

import type {
  MatchweekAwardsLineup,
  MatchweekAwardsPlayerSnapshot,
  MatchweekAwardsPublication,
  SaveMatchweekAwardsInput,
} from "@/src/types/MatchweekAwardsPublication";

const COLLECTION_NAME =
  "matchweekAwards";

function createDocumentId({
  seasonId,
  matchweek,
}: {
  seasonId: string;
  matchweek: number;
}): string {
  return `${seasonId}-mw${matchweek}`;
}

function getStringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string",
    )
    .map((item) => item.trim())
    .filter(Boolean);
}

function getOptionalString(
  value: unknown,
): string | undefined {
  if (
    typeof value !== "string"
  ) {
    return undefined;
  }

  const normalized =
    value.trim();

  return normalized || undefined;
}

function mapLineup(
  value: unknown,
): MatchweekAwardsLineup {
  const data =
    value &&
    typeof value === "object"
      ? value as Record<
          string,
          unknown
        >
      : {};

  return {
    goalkeeperPlayerId:
      getOptionalString(
        data.goalkeeperPlayerId,
      ),

    defenderPlayerIds:
      getStringArray(
        data.defenderPlayerIds,
      ),

    forwardPlayerIds:
      getStringArray(
        data.forwardPlayerIds,
      ),

    outfieldPlayerIds:
      getStringArray(
        data.outfieldPlayerIds,
      ),
  };
}

function mapPlayerSnapshot(
  value: unknown,
): MatchweekAwardsPlayerSnapshot | undefined {
  const data =
    value &&
    typeof value === "object"
      ? value as Record<string, unknown>
      : {};

  const playerId =
    getOptionalString(
      data.playerId,
    );

  if (!playerId) {
    return undefined;
  }

  return {
    playerId,
    playerName:
      String(data.playerName ?? ""),
    teamId:
      String(data.teamId ?? ""),
    teamName:
      String(data.teamName ?? ""),
    role:
      String(data.role ?? ""),
  };
}

function mapPlayerSnapshots(
  value: unknown,
): MatchweekAwardsPlayerSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(mapPlayerSnapshot)
    .filter(
      (
        player,
      ): player is MatchweekAwardsPlayerSnapshot =>
        Boolean(player),
    );
}

function mapPublication(
  documentId: string,
  data: Record<string, unknown>,
): MatchweekAwardsPublication {
  return {
    id: documentId,

    seasonId:
      String(data.seasonId ?? ""),

    matchweek:
      typeof data.matchweek ===
        "number"
        ? data.matchweek
        : 0,

    suggestedMvpPlayerId:
      getOptionalString(
        data.suggestedMvpPlayerId,
      ),

    confirmedMvpPlayerId:
      getOptionalString(
        data.confirmedMvpPlayerId,
      ),

    confirmedMvpPlayer:
      mapPlayerSnapshot(
        data.confirmedMvpPlayer,
      ),

    suggestedLineup:
      mapLineup(
        data.suggestedLineup,
      ),

    confirmedLineup:
      mapLineup(
        data.confirmedLineup,
      ),

    confirmedTeamOfWeekPlayers:
      mapPlayerSnapshots(
        data.confirmedTeamOfWeekPlayers,
      ),

    status:
      data.status === "published"
        ? "published"
        : "draft",

    topFiveConfirmed:
      data.topFiveConfirmed === true,

    playerOfTheWeekConfirmed:
      data.playerOfTheWeekConfirmed === true,

    topFiveImageUrl:
      getOptionalString(
        data.topFiveImageUrl,
      ),

    topFiveImageKey:
      getOptionalString(
        data.topFiveImageKey,
      ),

    playerOfTheWeekImageUrl:
      getOptionalString(
        data.playerOfTheWeekImageUrl,
      ),

    playerOfTheWeekImageKey:
      getOptionalString(
        data.playerOfTheWeekImageKey,
      ),

    ludiWeekPublished:
      data.ludiWeekPublished === true,

    ludiWeekInstagramPostIds:
      data.ludiWeekInstagramPostIds &&
      typeof data.ludiWeekInstagramPostIds === "object"
        ? {
            gotw:
              getOptionalString(
                (
                  data.ludiWeekInstagramPostIds as Record<string, unknown>
                ).gotw,
              ),
          }
        : undefined,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

export const FirebaseMatchweekAwardsRepository =
  {
    async getByMatchweek({
      seasonId,
      matchweek,
    }: {
      seasonId: string;
      matchweek: number;
    }): Promise<
      MatchweekAwardsPublication | undefined
    > {
      const documentId =
        createDocumentId({
          seasonId,
          matchweek,
        });

      const snapshot =
        await getDoc(
          doc(
            db,
            COLLECTION_NAME,
            documentId,
          ),
        );

      if (!snapshot.exists()) {
        return undefined;
      }

      return mapPublication(
        snapshot.id,
        snapshot.data(),
      );
    },

    subscribePublishedBySeason(
      seasonId: string,
      onChange: (
        publications: MatchweekAwardsPublication[],
      ) => void,
      onError?: (error: Error) => void,
      ludiWeekOnly = false,
    ): Unsubscribe {
      const normalizedSeasonId =
        seasonId.trim();

      if (!normalizedSeasonId) {
        onChange([]);
        return () => undefined;
      }

      return onSnapshot(
        query(
          collection(
            db,
            COLLECTION_NAME,
          ),
          where(
            "seasonId",
            "==",
            normalizedSeasonId,
          ),
          where(
            "status",
            "==",
            "published",
          ),
          ...(ludiWeekOnly ? [where("ludiWeekPublished", "==", true)] : []),
        ),
        (snapshot) => {
          onChange(
            snapshot.docs
              .map((currentDocument) =>
                mapPublication(
                  currentDocument.id,
                  currentDocument.data(),
                ),
              )
              .sort(
                (first, second) =>
                  first.matchweek -
                  second.matchweek,
              ),
          );
        },
        (error) => {
          console.error(
            "Errore listener Matchweek Awards pubblicati:",
            error,
          );
          onError?.(error);
        },
      );
    },

    async save(
      input:
        SaveMatchweekAwardsInput,
    ): Promise<void> {
      const documentId =
        createDocumentId({
          seasonId:
            input.seasonId,

          matchweek:
            input.matchweek,
        });

      if (
        input.ludiWeekPublished &&
        (
          input.status !== "published" ||
          input.topFiveConfirmed !== true ||
          input.playerOfTheWeekConfirmed !== true ||
          !input.confirmedMvpPlayerId ||
          !input.confirmedMvpPlayer ||
          input.confirmedMvpPlayer.playerId !==
            input.confirmedMvpPlayerId ||
          input.confirmedTeamOfWeekPlayers.length !== 5 ||
          !input.confirmedTeamOfWeekPlayers.some(
            (player) =>
              player.playerId ===
              input.confirmedMvpPlayerId,
          ) ||
          !input.topFiveImageUrl ||
          !input.playerOfTheWeekImageUrl
        )
      ) {
        throw new Error(
          "La pubblicazione richiede Top Five confermata, Player of the Week scelto tra i cinque e le due immagini caricate.",
        );
      }

      const batch = writeBatch(db);
      batch.set(
        doc(
          db,
          COLLECTION_NAME,
          documentId,
        ),
        {
          seasonId:
            input.seasonId,

          matchweek:
            input.matchweek,

          suggestedMvpPlayerId:
            input
              .suggestedMvpPlayerId ??
            null,

          confirmedMvpPlayerId:
            input
              .confirmedMvpPlayerId ??
            null,

          confirmedMvpPlayer:
            input.confirmedMvpPlayer ??
            null,

          suggestedLineup: {
            goalkeeperPlayerId:
              input
                .suggestedLineup
                .goalkeeperPlayerId ??
              null,

            defenderPlayerIds:
              input
                .suggestedLineup
                .defenderPlayerIds,

            forwardPlayerIds:
              input
                .suggestedLineup
                .forwardPlayerIds,

            outfieldPlayerIds:
              input
                .suggestedLineup
                .outfieldPlayerIds ??
              [
                ...input.suggestedLineup.defenderPlayerIds,
                ...input.suggestedLineup.forwardPlayerIds,
              ],
          },

          confirmedLineup: {
            goalkeeperPlayerId:
              input
                .confirmedLineup
                .goalkeeperPlayerId ??
              null,

            defenderPlayerIds:
              input
                .confirmedLineup
                .defenderPlayerIds,

            forwardPlayerIds:
              input
                .confirmedLineup
                .forwardPlayerIds,

            outfieldPlayerIds:
              input
                .confirmedLineup
                .outfieldPlayerIds ??
              [
                ...input.confirmedLineup.defenderPlayerIds,
                ...input.confirmedLineup.forwardPlayerIds,
              ],
          },

          confirmedTeamOfWeekPlayers:
            input.confirmedTeamOfWeekPlayers ??
            [],

          topFiveConfirmed:
            input.topFiveConfirmed === true,

          playerOfTheWeekConfirmed:
            input.playerOfTheWeekConfirmed === true,

          topFiveImageUrl:
            input.topFiveImageUrl ??
            null,

          topFiveImageKey:
            input.topFiveImageKey ??
            null,

          playerOfTheWeekImageUrl:
            input.playerOfTheWeekImageUrl ??
            null,

          playerOfTheWeekImageKey:
            input.playerOfTheWeekImageKey ??
            null,

          ...(input.ludiWeekPublished ? {
            ludiWeekPublished: true,
            ...(input.ludiWeekInstagramPostIds?.gotw
              ? {
                  ludiWeekInstagramPostIds:
                    input.ludiWeekInstagramPostIds,
                }
              : {}),
          } : {}),

          status:
            input.status,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        },
      );
      await batch.commit();
    },
  };