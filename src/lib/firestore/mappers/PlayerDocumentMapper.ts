import type { HistoricalImportSource, PlayerProfile, PreferredFoot } from "@/src/types/PlayerProfile";
import type { PlayerAchievement } from "@/src/types/PlayerAchievement";

export function mapPlayerWithPrivateData(
  document: {
    id: string;

    data: () => Record<
      string,
      unknown
    >;
  },

  privateData?:
    Record<
      string,
      unknown
    >,
): PlayerProfile {
  const player =
    mapPlayer(
      document,
    );

  const birthYear =
    getOptionalNumber(
      privateData?.birthYear,
    );

  return {
    ...player,

    birthYear,
  };
}

export function mapPlayer(
  document: {
    id: string;

    data: () => Record<
      string,
      unknown
    >;
  },
): PlayerProfile {
  const data =
    document.data();

  return {
    id:
      document.id,

    competitionId:
      getOptionalString(
        data.competitionId,
      ) ??
      "",

    firstName:
      typeof data.firstName ===
      "string"
        ? data.firstName
        : "",

    lastName:
      typeof data.lastName ===
      "string"
        ? data.lastName
        : "",

    photoUrl:
      getOptionalString(
        data.photoUrl,
      ),

    coverImageUrl:
      getOptionalString(
        data.coverImageUrl,
      ),

    historicalImportSources:
      getHistoricalImportSources(
        data.historicalImportSources,
      ),

    nationality: getOptionalString(data.nationality)?.toUpperCase() ?? "IT",

    preferredFoot:
      getPreferredFoot(
        data.preferredFoot,
      ),

    baseRating:
      getOptionalNumber(
        data.baseRating,
      ),

    achievements:
      getPlayerAchievements(
        data.achievements,
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

export function getOptionalNumber(
  value: unknown,
): number | undefined {
  return typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
    ? value
    : undefined;
}

export function getOptionalString(
  value: unknown,
): string | undefined {
  if (
    typeof value !==
    "string"
  ) {
    return undefined;
  }

  const normalized =
    value.trim();

  return normalized ||
    undefined;
}

export function getHistoricalImportSources(
  value: unknown,
): HistoricalImportSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const bySeason =
    new Map<string, HistoricalImportSource>();

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const data =
      item as Record<string, unknown>;

    const seasonId =
      getOptionalString(data.seasonId);
    const seasonName =
      getOptionalString(data.seasonName);
    const fileName =
      getOptionalString(data.fileName);

    if (!seasonId || !seasonName || !fileName) {
      continue;
    }

    bySeason.set(seasonId, {
      seasonId,
      seasonName,
      fileName,
    });
  }

  return Array.from(bySeason.values());
}

export function getPreferredFoot(
  value: unknown,
): PreferredFoot | undefined {
  if (
    value === "Destro" ||
    value === "Sinistro" ||
    value === "Ambidestro"
  ) {
    return value;
  }

  return undefined;
}

export function getPlayerAchievements(
  value: unknown,
): PlayerAchievement[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(
    (item) => {
      if (
        !item ||
        typeof item !==
          "object"
      ) {
        return [];
      }

      const data =
        item as Record<
          string,
          unknown
        >;

      const id =
        getOptionalString(
          data.id,
        );

      const seasonId =
        getOptionalString(
          data.seasonId,
        );

      const seasonLabel =
        getOptionalString(
          data.seasonLabel,
        );

      const competitionId =
  getOptionalString(
    data.competitionId,
  );

      const competition =
        data.competition ===
          "regularSeason" ||
        data.competition ===
          "championsLeague"
          ? data.competition
          : undefined;

      const title =
        getOptionalString(
          data.title,
        );

      const teamId =
        getOptionalString(
          data.teamId,
        );

      const teamName =
        getOptionalString(
          data.teamName,
        );

      if (
        !id ||
        !seasonId ||
        !seasonLabel ||
        !competitionId ||
        !competition ||
        !title ||
        !teamId ||
        !teamName
      ) {
        return [];
      }

      return [
        {
          id,
          seasonId,
          seasonLabel,
          competitionId,
          competition,
          title,
          teamId,
          teamName,

          createdAt:
            data.createdAt,
        },
      ];
    },
  );
}
