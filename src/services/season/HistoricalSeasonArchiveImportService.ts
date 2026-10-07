import { FirebaseHistoricalPlayerStatsRepository } from "@/src/services/player/FirebaseHistoricalPlayerStatsRepository";

import { FirebasePlayerRepository } from "@/src/services/player/FirebasePlayerRepository";

import type {
  HistoricalSeasonArchiveImport,
} from "@/src/services/season/HistoricalSeasonArchiveExcelParser";

import type {
  PlayerProfile,
} from "@/src/types/PlayerProfile";

import {
  buildHistoricalHallOfChampions,
  saveHistoricalHallOfChampions,
  type DerivedHallOfChampions,
} from "@/src/services/season/HistoricalArchiveHallOfChampionsService";

import {
  buildHistoricalSeasonAchievements,
} from "@/src/application/player-achievement/buildHistoricalSeasonAchievement";

import {
  aggregateArchivePlayers,
  type AggregatedHistoricalPlayer as AggregatedPlayer,
} from "@/src/services/season/HistoricalArchivePlayerAggregator";

import {
  buildHistoricalHallOfFameAwards,
  saveHistoricalHallOfFameAwards,
  type DerivedHistoricalAward,
} from "@/src/services/season/HistoricalArchiveHallOfFameService";

/*
 * ============================================================
 * RISULTATO IMPORT
 * ============================================================
 */

export type HistoricalArchiveImportResult = {
  seasonId: string;
  seasonName: string;

  createdPlayers: number;
  reusedPlayers: number;

  importedPlayerStats: number;

  playerStats:
    ImportedHistoricalPlayerStats[];

  hallOfFameAwards:
    DerivedHistoricalAward[];

  hallOfChampions?:
    DerivedHallOfChampions;

  warnings: string[];
};

/*
 * ============================================================
 * STATISTICHE STORICHE REGULAR SEASON
 * ============================================================
 */

export type ImportedHistoricalPlayerStats = {
  playerId: string;

  firstName: string;
  lastName: string;

  birthYear?: number;

  appearances: number;

  goals: number;
  assists: number;
  ownGoals: number;

  averageVote?: number;

  yellowCards: number;
  redCards: number;

  teamNames: string[];
};

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

export class HistoricalSeasonArchiveImportService {
  static async importArchive({
    seasonId,
    seasonName,
    fileName,
    archive,
  }: {
    seasonId: string;
    seasonName: string;
    fileName: string;

    archive:
      HistoricalSeasonArchiveImport;
  }): Promise<HistoricalArchiveImportResult> {
    if (
      !seasonId.trim()
    ) {
      throw new Error(
        "seasonId non valido.",
      );
    }

    if (
      !seasonName.trim()
    ) {
      throw new Error(
        "Nome stagione non valido.",
      );
    }

    if (
      !fileName.trim()
    ) {
      throw new Error(
        "Nome file archivio non valido.",
      );
    }

    const historicalImportSource = {
      seasonId:
        seasonId.trim(),

      seasonName:
        seasonName.trim(),

      fileName:
        fileName.trim(),
    };

    const competitionId =
      getHistoricalCompetitionId(
        archive.season.competitionName,
      );

    /*
     * ========================================================
     * 1. GIOCATORI DELLA COMPETIZIONE
     * ========================================================
     */

    const existingPlayers =
      await FirebasePlayerRepository
        .getAllWithPrivateByCompetition(
          competitionId,
        );

    const playersByIdentity =
      createPlayersByIdentity(
        existingPlayers,
      );

    const playersByName =
      createPlayersByName(
        existingPlayers,
      );

    /*
     * ========================================================
     * 2. AGGREGAZIONE DATI EXCEL
     * ========================================================
     */

    const aggregatedPlayers =
      aggregateArchivePlayers(
        archive,
      );

    let createdPlayers =
      0;

    let reusedPlayers =
      0;

    let importedPlayerStats =
      0;

    const warnings:
      string[] = [];

    /*
     * ========================================================
     * 3. IDENTIFICAZIONE / CREAZIONE GIOCATORI
     * ========================================================
     */

    for (
      const aggregated of
        aggregatedPlayers.values()
    ) {
      let player =
        findExistingPlayer({
          aggregated,

          playersByIdentity,

          playersByName,
        });

      if (
        !player
      ) {
        const nameKey =
          createNameKey(
            aggregated.firstName,

            aggregated.lastName,
          );

        const sameNamePlayers =
          playersByName.get(
            nameKey,
          ) ?? [];

        /*
         * Più omonimi e anno di nascita
         * assente.
         */
        if (
          aggregated.birthYear ===
            undefined &&
          sameNamePlayers.length >
            1
        ) {
          warnings.push(
            `${aggregated.firstName} ${aggregated.lastName}: più omonimi nel database. Inserisci l'anno di nascita nel file storico.`,
          );

          continue;
        }

        const playerId =
          await FirebasePlayerRepository.create({
            competitionId,

            firstName:
              aggregated.firstName,

            lastName:
              aggregated.lastName,

            ...(aggregated.birthYear !==
            undefined
              ? {
                  birthYear:
                    aggregated.birthYear,
                }
              : {}),

            historicalImportSources: [
              historicalImportSource,
            ],
          });

        player = {
          id:
            playerId,

          competitionId,

          firstName:
            aggregated.firstName,

          lastName:
            aggregated.lastName,

          ...(aggregated.birthYear !==
          undefined
            ? {
                birthYear:
                  aggregated.birthYear,
              }
            : {}),

          historicalImportSources: [
            historicalImportSource,
          ],
        };

        addPlayerToIndexes({
          player,

          playersByIdentity,

          playersByName,
        });

        createdPlayers +=
          1;
      } else {
        reusedPlayers +=
          1;
      }

      await FirebasePlayerRepository.update({
        playerId:
          player.id,

        historicalImportSources: [
          historicalImportSource,
        ],
      });

      aggregated.playerId =
        player.id;

      /*
       * ======================================================
       * 4. STATISTICHE STORICHE
       *
       * historicalPlayerSeasonStats contiene
       * esclusivamente la Regular Season.
       * ======================================================
       */

      if (
        aggregated.hasRegularSeasonData
      ) {
        const averageVote =
          aggregated.regularRatedMatches >
          0
            ? roundToTwo(
                aggregated.regularWeightedVoteTotal /
                  aggregated.regularRatedMatches,
              )
            : undefined;

        const teamNames =
          Array.from(
            aggregated.regularTeamCodes,
          )
            .map(
              (
                teamCode,
              ) =>
                getTeamName(
                  archive,

                  teamCode,
                ),
            )
            .filter(
              (
                value,
              ): value is string =>
                Boolean(
                  value,
                ),
            );

        await FirebaseHistoricalPlayerStatsRepository.upsert({
          seasonId,

          seasonName,

          competitionId,

          playerId:
            player.id,

          teamName:
            teamNames.join(
              " / ",
            ) ||
            undefined,

          appearances:
            aggregated.regularAppearances,

          goals:
            aggregated.regularGoals,

          assists:
            aggregated.regularAssists,

          ownGoals:
            aggregated.regularOwnGoals,

          averageVote,

          yellowCards:
            aggregated.regularYellowCards,

          redCards:
            aggregated.regularRedCards,
        });

        importedPlayerStats +=
          1;
      }
    }

    /*
 * ========================================================
 * 5. PALMARÈS GIOCATORI
 *
 * Regular Season:
 * badge solo ai giocatori della squadra campione
 * presenti in Rose_Statistiche_Champions.
 *
 * Champions League:
 * badge a tutti i giocatori della squadra campione
 * presenti in Rose_Statistiche_Champions.
 * ========================================================
 */

await saveHistoricalPlayerAchievements({
  competitionId,
  seasonId,
  seasonName,
  archive,
  aggregatedPlayers,
});

    /*
     * ========================================================
     * 6. OUTPUT STATISTICHE REGULAR SEASON
     * ========================================================
     */

    const playerStats =
      buildImportedPlayerStats({
        archive,

        aggregatedPlayers,
      });

    /*
     * ========================================================
     * 7. PREMIAZIONI → HALL OF FAME
     * ========================================================
     */

    const hallOfFameAwards =
      buildHistoricalHallOfFameAwards({
        archive,

        aggregatedPlayers,

        existingPlayers:
          Array.from(
            playersByName.values(),
          ).flat(),
      });

await saveHistoricalHallOfFameAwards({
  competitionId,
  seasonId,
  seasonName,
  awards: hallOfFameAwards,
});

    /*
     * ========================================================
     * 8. CHAMPIONS → ALBO D'ORO
     * ========================================================
     */

    const hallOfChampions =
      buildHistoricalHallOfChampions({
        archive,

        aggregatedPlayers,
      });

    if (
      hallOfChampions
    ) {
      await saveHistoricalHallOfChampions({
        seasonId,

        hallOfChampions,
      });
    }

    return {
      seasonId,

      seasonName,

      createdPlayers,

      reusedPlayers,

      importedPlayerStats,

      playerStats,

      hallOfFameAwards,

      hallOfChampions,

      warnings,
    };
  }
}

/*
 * ============================================================
 * OUTPUT REGULAR SEASON
 * ============================================================
 */

function buildImportedPlayerStats({
  archive,
  aggregatedPlayers,
}: {
  archive:
    HistoricalSeasonArchiveImport;

  aggregatedPlayers:
    Map<
      string,
      AggregatedPlayer
    >;
}): ImportedHistoricalPlayerStats[] {
  const result:
    ImportedHistoricalPlayerStats[] =
    [];

  for (
    const player of
      aggregatedPlayers.values()
  ) {
    if (
      !player.playerId ||
      !player.hasRegularSeasonData
    ) {
      continue;
    }

    const averageVote =
      player.regularRatedMatches >
      0
        ? roundToTwo(
            player.regularWeightedVoteTotal /
              player.regularRatedMatches,
          )
        : undefined;

    result.push({
      playerId:
        player.playerId,

      firstName:
        player.firstName,

      lastName:
        player.lastName,

      birthYear:
        player.birthYear,

      appearances:
        player.regularAppearances,

      goals:
        player.regularGoals,

      assists:
        player.regularAssists,

      ownGoals:
        player.regularOwnGoals,

      averageVote,

      yellowCards:
        player.regularYellowCards,

      redCards:
        player.regularRedCards,

      teamNames:
        Array.from(
          player.regularTeamCodes,
        )
          .map(
            (
              teamCode,
            ) =>
              getTeamName(
                archive,

                teamCode,
              ),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(
                value,
              ),
          ),
    });
  }

  return result.sort(
    (
      first,
      second,
    ) => {
      if (
        first.goals !==
        second.goals
      ) {
        return (
          second.goals -
          first.goals
        );
      }

      if (
        first.appearances !==
        second.appearances
      ) {
        return (
          first.appearances -
          second.appearances
        );
      }

      return `${first.lastName} ${first.firstName}`.localeCompare(
        `${second.lastName} ${second.firstName}`,

        "it",
      );
    },
  );
}

/*
 * ============================================================
 * GIOCATORI DELLA COMPETIZIONE
 * ============================================================
 */

function findExistingPlayer({
  aggregated,
  playersByIdentity,
  playersByName,
}: {
  aggregated:
    AggregatedPlayer;

  playersByIdentity:
    Map<
      string,
      PlayerProfile
    >;

  playersByName:
    Map<
      string,
      PlayerProfile[]
    >;
}) {
  if (
    aggregated.birthYear !==
    undefined
  ) {
    const identityKey =
      createIdentityKey(
        aggregated.firstName,

        aggregated.lastName,

        aggregated.birthYear,
      );

    const exact =
      playersByIdentity.get(
        identityKey,
      );

    if (
      exact
    ) {
      return exact;
    }

    /*
     * Se esiste anno di nascita,
     * non usiamo il solo nome come fallback.
     */

    return undefined;
  }

  const sameName =
    playersByName.get(
      createNameKey(
        aggregated.firstName,

        aggregated.lastName,
      ),
    ) ?? [];

  if (
    sameName.length ===
    1
  ) {
    return sameName[0];
  }

  return undefined;
}

/*
 * ============================================================
 * INDICE IDENTITÀ
 * ============================================================
 */

function createPlayersByIdentity(
  players:
    PlayerProfile[],
) {
  const map =
    new Map<
      string,
      PlayerProfile
    >();

  for (
    const player of
      players
  ) {
    if (
      player.birthYear ===
      undefined
    ) {
      continue;
    }

    map.set(
      createIdentityKey(
        player.firstName,

        player.lastName,

        player.birthYear,
      ),

      player,
    );
  }

  return map;
}

/*
 * ============================================================
 * INDICE NOMI
 * ============================================================
 */

function createPlayersByName(
  players:
    PlayerProfile[],
) {
  const map =
    new Map<
      string,
      PlayerProfile[]
    >();

  for (
    const player of
      players
  ) {
    const key =
      createNameKey(
        player.firstName,

        player.lastName,
      );

    const current =
      map.get(
        key,
      ) ?? [];

    current.push(
      player,
    );

    map.set(
      key,

      current,
    );
  }

  return map;
}

/*
 * ============================================================
 * AGGIUNTA AGLI INDICI
 * ============================================================
 */

function addPlayerToIndexes({
  player,
  playersByIdentity,
  playersByName,
}: {
  player:
    PlayerProfile;

  playersByIdentity:
    Map<
      string,
      PlayerProfile
    >;

  playersByName:
    Map<
      string,
      PlayerProfile[]
    >;
}) {
  const nameKey =
    createNameKey(
      player.firstName,

      player.lastName,
    );

  const current =
    playersByName.get(
      nameKey,
    ) ?? [];

  current.push(
    player,
  );

  playersByName.set(
    nameKey,

    current,
  );

  if (
    player.birthYear !==
    undefined
  ) {
    playersByIdentity.set(
      createIdentityKey(
        player.firstName,

        player.lastName,

        player.birthYear,
      ),

      player,
    );
  }
}

/*
 * ============================================================
 * RICERCA PER PLAYER SEASON CODE
 * ============================================================
 */

function findAggregatedPlayerByPlayerSeasonCode({
  result,
  playerSeasonCode,
}: {
  result:
    Map<
      string,
      AggregatedPlayer
    >;

  playerSeasonCode:
    string;
}) {
  const normalizedCode =
    normalizeText(
      playerSeasonCode,
    );

  return Array.from(
    result.values(),
  ).find(
    (
      player,
    ) =>
      normalizeText(
        player.playerSeasonCode,
      ) ===
      normalizedCode,
  );
}

/*
 * ============================================================
 * NOME SQUADRA
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
 * CHIAVE IDENTITÀ
 * ============================================================
 */

function createIdentityKey(
  firstName:
    string,

  lastName:
    string,

  birthYear:
    number,
) {
  return `${createNameKey(firstName, lastName)}::${birthYear}`;
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

/*
 * ============================================================
 * ARROTONDAMENTO
 * ============================================================
 */

function roundToTwo(
  value:
    number,
) {
  return (
    Math.round(
      value *
      100,
    ) /
    100
  );
}

/*
 * ============================================================
 * NORMALIZZAZIONE STAGIONE
 * ============================================================
 *
 * Esempi equivalenti:
 *
 * Stagione 2024/25
 * 2024/25
 * 2024-25
 * Stagione 2024/2025
 *
 * diventano:
 *
 * 2024/25
 * ============================================================
 */

async function saveHistoricalPlayerAchievements({
  competitionId,
  seasonId,
  seasonName,
  archive,
  aggregatedPlayers,
}: {
  competitionId: string;

  seasonId: string;
  seasonName: string;

  archive:
    HistoricalSeasonArchiveImport;

  aggregatedPlayers:
    Map<
      string,
      AggregatedPlayer
    >;
}) {
  const assignments =
    buildHistoricalSeasonAchievements({
      archive,
    });

  for (
    const assignment of
      assignments
  ) {
    const aggregated =
      findAggregatedPlayerByPlayerSeasonCode({
        result:
          aggregatedPlayers,

        playerSeasonCode:
          assignment.playerSeasonCode,
      });

    /*
     * Il giocatore potrebbe non essere stato
     * riconciliato, per esempio in presenza
     * di omonimi senza anno di nascita.
     */
    if (
      !aggregated?.playerId
    ) {
      continue;
    }

    /*
     * IMPORTANTE:
     *
     * Il builder storico utilizza seasonCode,
     * perché lavora esclusivamente sul file Excel.
     *
     * Qui invece conosciamo il vero seasonId
     * persistito nell'applicazione.
     */
    const achievement = {
      ...assignment.achievement,

      seasonId,

      seasonLabel:
        seasonName,

      competitionId,

      /*
       * Rendiamo anche l'id coerente
       * con il vero seasonId.
       */
      id:
        `${seasonId}-${assignment.achievement.competition}`,
    };

    await FirebasePlayerRepository.upsertAchievement({
      playerId:
        aggregated.playerId,

      achievement,
    });
  }
}

function getHistoricalCompetitionId(
  competitionName: string,
): string {
  const normalized =
    normalizeText(
      competitionName,
    );

  if (
    normalized.includes(
      "premier",
    )
  ) {
    return "premier-league";
  }

  if (
    normalized.includes(
      "championship",
    )
  ) {
    return "championship";
  }

  if (
    normalized.includes(
      "league one",
    )
  ) {
    return "league-one";
  }

  throw new Error(
    `Competizione storica non riconosciuta: ${competitionName}`,
  );
}