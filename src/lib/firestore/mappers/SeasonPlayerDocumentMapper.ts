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

    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}
