import {
  FirebaseHallOfFameRepository,
} from "@/src/services/awards/FirebaseHallOfFameRepository";

import type {
  HistoricalSeasonArchiveImport,
} from "@/src/services/season/HistoricalSeasonArchiveExcelParser";

import type {
  AggregatedHistoricalPlayer,
} from "@/src/services/season/HistoricalArchivePlayerAggregator";

import type {
  PlayerProfile,
} from "@/src/types/PlayerProfile";

/*
 * ============================================================
 * PREMIO STORICO
 * ============================================================
 */

export type DerivedHistoricalAward = {
  playerId?: string;

  firstName: string;
  lastName: string;

  birthYear?: number;

  teamName?: string;

  section:
    | "bestOfSeason"
    | "teamOfSeason"
    | "goalAndSave"
    | "otherAwards";

  award: string;

  awardDescription?: string;

  awardLabel?: string;

  notes?: string;
};

/*
 * ============================================================
 * BUILD HALL OF FAME
 * ============================================================
 */

export function buildHistoricalHallOfFameAwards({
  archive,
  aggregatedPlayers,
  existingPlayers,
}: {
  archive:
    HistoricalSeasonArchiveImport;

  aggregatedPlayers:
    Map<
      string,
      AggregatedHistoricalPlayer
    >;

  existingPlayers:
    PlayerProfile[];
}): DerivedHistoricalAward[] {
  return archive.awards.map(
    (
      award,
    ) => {
      const aggregated =
        findAggregatedPlayerByIdentity({
          result:
            aggregatedPlayers,

          firstName:
            award.firstName,

          lastName:
            award.lastName,

          birthYear:
            award.birthYear,
        });

      let playerId =
        aggregated?.playerId;

      if (
        !playerId
      ) {
        playerId =
          findPlayerProfileId({
            players:
              existingPlayers,

            firstName:
              award.firstName,

            lastName:
              award.lastName,

            birthYear:
              award.birthYear,
          });
      }

      return {
        playerId,

        firstName:
          award.firstName,

        lastName:
          award.lastName,

        birthYear:
          award.birthYear,

        teamName:
          award.teamCode
            ? getTeamName(
                archive,

                award.teamCode,
              )
            : undefined,

        section:
          award.section,

        award:
          award.award,

        awardDescription:
          award.awardDescription,

        awardLabel:
          award.awardLabel,

        notes:
          award.notes,
      };
    },
  );
}

/*
 * ============================================================
 * SALVATAGGIO HALL OF FAME
 * ============================================================
 */

export async function saveHistoricalHallOfFameAwards({
  competitionId,
  seasonId,
  seasonName,
  awards,
}: {
  competitionId: string;
  
  seasonId: string;

  seasonName: string;

  awards:
    DerivedHistoricalAward[];
}) {
  const normalizedCompetitionId =
    competitionId.trim();

    if (
    !normalizedCompetitionId
  ) {
    throw new Error(
      "competitionId non valido per la Hall of Fame storica.",
    );
  }

  if (
    awards.length ===
    0
  ) {
    return;
  }

  const existingItems =
    await FirebaseHallOfFameRepository.getAll();

  for (
    let index = 0;
    index <
    awards.length;
    index += 1
  ) {
    const award =
      awards[index];

    const category =
      award.award.trim();

    const winnerName =
      `${award.firstName} ${award.lastName}`.trim();

    const description =
      buildHallOfFameDescription(
        award,
      );

    const matchingItems =
      existingItems.filter(
        (item) => {
          const sameCompetition =
            item.competitionId ===
            normalizedCompetitionId;

          const sameSeasonId =
            item.seasonId.trim() ===
            seasonId.trim();

          const sameSeasonLabel =
            normalizeSeasonLabel(
              item.seasonLabel,
            ) ===
            normalizeSeasonLabel(
              seasonName,
            );

          const sameCategory =
            normalizeText(
              item.category,
            ) ===
            normalizeText(
              category,
            );

          const sameWinner =
            normalizeText(
              item.winnerName,
            ) ===
            normalizeText(
              winnerName,
            );

          return (
  sameCompetition &&
  (
    sameSeasonId ||
    sameSeasonLabel
  ) &&
  sameCategory &&
  sameWinner
);
        },
      );

    /*
     * ========================================================
     * PREMIO ESISTENTE
     * ========================================================
     */

    if (
      matchingItems.length >
      0
    ) {
      const sortedMatchingItems =
        [...matchingItems].sort(
          (
            first,
            second,
          ) => {
            const getScore = (
              item:
                typeof matchingItems[number],
            ) => {
              let score =
                0;

              if (
                item.imageUrl
              ) {
                score +=
                  4;
              }

              if (
                item.imageKey
              ) {
                score +=
                  2;
              }

              if (
                item.teamId
              ) {
                score +=
                  1;
              }

              if (
                item.description
              ) {
                score +=
                  1;
              }

              return score;
            };

            return (
              getScore(
                second,
              ) -
              getScore(
                first,
              )
            );
          },
        );

      const [
        mainItem,
        ...duplicateItems
      ] =
        sortedMatchingItems;

      await FirebaseHallOfFameRepository.update({
        itemId:
          mainItem.id,

        competitionId:
        normalizedCompetitionId,

        seasonId,

        seasonLabel:
          seasonName,

        section:
          award.section,

        category,

        awardDescription:
          award.awardDescription,

        winnerType:
          "player",

        winnerName,

        playerId:
          award.playerId,

        teamId:
          mainItem.teamId,

        imageUrl:
          mainItem.imageUrl,

        imageKey:
          mainItem.imageKey,

        description,

        sortOrder:
          index + 1,

        status:
  "published",
      });

      for (
        const duplicate of
          duplicateItems
      ) {
        await FirebaseHallOfFameRepository.remove(
          duplicate.id,
        );
      }

      continue;
    }

    /*
     * ========================================================
     * NUOVO PREMIO
     * ========================================================
     */

    await FirebaseHallOfFameRepository.create({
      competitionId:
    normalizedCompetitionId,
      
      seasonId,

      seasonLabel:
        seasonName,

      section:
        award.section,

      category,

      awardDescription:
          award.awardDescription,

      winnerType:
        "player",

      winnerName,

      playerId:
        award.playerId,

      description,

      sortOrder:
        index + 1,

      status:
        "published",
    });
  }
}

/*
 * ============================================================
 * DESCRIZIONE HALL OF FAME
 * ============================================================
 */

function buildHallOfFameDescription(
  award:
    DerivedHistoricalAward,
) {
  const parts:
    string[] = [];

  if (
    award.teamName
  ) {
    parts.push(
      award.teamName,
    );
  }

  if (
    award.notes
  ) {
    parts.push(
      award.notes,
    );
  }

  return parts.length >
    0
    ? parts.join(
        " · ",
      )
    : undefined;
}

/*
 * ============================================================
 * TEAM NAME
 * ============================================================
 */

function getTeamName(
  archive:
    HistoricalSeasonArchiveImport,

  teamCode:
    string,
) {
  return archive.teams.find(
    (
      team,
    ) =>
      team.teamCode ===
      teamCode,
  )?.name;
}

/*
 * ============================================================
 * RICERCA PLAYER PROFILE ID
 * ============================================================
 */

function findPlayerProfileId({
  players,
  firstName,
  lastName,
  birthYear,
}: {
  players:
    PlayerProfile[];

  firstName:
    string;

  lastName:
    string;

  birthYear?: number;
}) {
  const sameName =
    players.filter(
      (
        player,
      ) =>
        createNameKey(
          player.firstName,

          player.lastName,
        ) ===
        createNameKey(
          firstName,

          lastName,
        ),
    );

  if (
    birthYear !==
    undefined
  ) {
    return sameName.find(
      (
        player,
      ) =>
        player.birthYear ===
        birthYear,
    )?.id;
  }

  return sameName.length ===
    1
    ? sameName[0].id
    : undefined;
}

/*
 * ============================================================
 * RICERCA GIOCATORE ARCHIVIO PER IDENTITÀ
 * ============================================================
 */

function findAggregatedPlayerByIdentity({
  result,
  firstName,
  lastName,
  birthYear,
}: {
  result:
    Map<
      string,
      AggregatedHistoricalPlayer
    >;

  firstName:
    string;

  lastName:
    string;

  birthYear?: number;
}) {
  const nameKey =
    createNameKey(
      firstName,

      lastName,
    );

  const candidates =
    Array.from(
      result.values(),
    ).filter(
      (
        player,
      ) =>
        createNameKey(
          player.firstName,

          player.lastName,
        ) ===
        nameKey,
    );

  if (
    birthYear !==
    undefined
  ) {
    return candidates.find(
      (
        player,
      ) =>
        player.birthYear ===
        birthYear,
    );
  }

  if (
    candidates.length ===
    1
  ) {
    return candidates[0];
  }

  return undefined;
}

/*
 * ============================================================
 * CHIAVE NOME
 * ============================================================
 */

function createNameKey(
  firstName:
    string,

  lastName:
    string,
) {
  return `${normalizeText(firstName)}::${normalizeText(lastName)}`;
}

/*
 * ============================================================
 * NORMALIZZAZIONE STAGIONE
 * ============================================================
 */

function normalizeSeasonLabel(
  value:
    string,
) {
  const normalized =
    normalizeText(
      value,
    );

  const match =
    normalized.match(
      /(20\d{2})\s*[/-]\s*(\d{2,4})/,
    );

  if (
    !match
  ) {
    return normalized;
  }

  return `${match[1]}/${match[2].slice(-2)}`;
}

/*
 * ============================================================
 * NORMALIZZAZIONE TESTO
 * ============================================================
 */

function normalizeText(
  value:
    string,
) {
  return value
    .trim()
    .toLocaleLowerCase(
      "it",
    )
    .normalize(
      "NFD",
    )
    .replace(
      /[\u0300-\u036f]/g,

      "",
    )
    .replace(
      /\s+/g,

      " ",
    );
}