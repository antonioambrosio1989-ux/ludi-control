import type { SeasonPlayer } from "@/src/types/SeasonPlayer";

export function mapSeasonPlayer(
  documentId: string,
  data: Record<string, unknown>,
): SeasonPlayer {
  return {
    id: documentId,

    seasonId:
      typeof data.seasonId === "string"
        ? data.seasonId
        : "",

    playerId:
      typeof data.playerId === "string"
        ? data.playerId
        : "",

    teamId:
      typeof data.teamId === "string"
        ? data.teamId
        : "",

    role:
      data.role === "Portiere" ||
      data.role === "Difensore" ||
      data.role === "Attaccante"
        ? data.role
        : "Attaccante",

    shirtNumber:
      typeof data.shirtNumber === "number"
        ? data.shirtNumber
        : undefined,

    status:
      data.status === "inactive" ||
      data.status === "transferred" ||
      data.status === "withdrawn"
        ? data.status
        : "active",

    joinedAt: typeof data.joinedAt === "string" ? data.joinedAt : undefined,
    leftAt: typeof data.leftAt === "string" ? data.leftAt : undefined,
    inactivePeriods: Array.isArray(data.inactivePeriods)
      ? data.inactivePeriods.filter((item): item is { from: string; to?: string } =>
          !!item && typeof item === "object" &&
          typeof (item as { from?: unknown }).from === "string" &&
          ((item as { to?: unknown }).to === undefined || typeof (item as { to?: unknown }).to === "string"))
      : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}
