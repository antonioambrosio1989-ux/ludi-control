import type { Team } from "@/src/types/Team";

export function mapDocumentToTeam(
  documentId: string,
  data: Record<string, unknown>,
): Team {
  return {
    id: documentId,

    name:
      typeof data.name === "string"
        ? data.name
        : "Squadra senza nome",

    slug:
      typeof data.slug === "string"
        ? data.slug
        : documentId,

    shortName:
      getOptionalString(
        data.shortName,
      ),

    aliasName:
      getOptionalString(
        data.aliasName,
      ),

    nickname:
      getOptionalString(
        data.nickname,
      ),
    logoUrl:
      getOptionalString(
        data.logoUrl,
      ),

    teamPhotoUrl:
      getOptionalString(
        data.teamPhotoUrl,
      ),
    primaryColor:
      typeof data.primaryColor ===
      "string"
        ? data.primaryColor
        : "#06142E",

    secondaryColor:
      typeof data.secondaryColor ===
      "string"
        ? data.secondaryColor
        : "#F4C400",
    presidentName:
      getOptionalString(
        data.presidentName,
      ),

    captainPlayerId:
      getOptionalString(
        data.captainPlayerId,
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

export function getOptionalString(
  value: unknown,
): string | undefined {
  return typeof value === "string" &&
    value.trim()
    ? value
    : undefined;
}
