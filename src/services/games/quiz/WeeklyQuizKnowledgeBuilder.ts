

import type {
  FirebaseMatchRepository,
} from "@/src/services/match/FirebaseMatchRepository";

import type {
  FirebaseMatchReportRepository,
} from "@/src/services/match/FirebaseMatchReportRepository";

import type {
  FirebasePlayerRepository,
} from "@/src/services/player/FirebasePlayerRepository";

import type {
  FirebaseSeasonPlayerRepository,
} from "@/src/services/player/FirebaseSeasonPlayerRepository";

import type {
  FirebaseTeamRepository,
} from "@/src/services/team/FirebaseTeamRepository";

import type {
  FirebaseHallOfChampionsRepository,
} from "@/src/services/awards/FirebaseHallOfChampionsRepository";

import {
  calculateFirebasePlayerStats,
} from "@/src/services/stats/FirebasePlayerStatsCalculator";

import type {
  PlayerProfile,
} from "@/src/types/PlayerProfile";

import type {
  SeasonPlayer,
} from "@/src/types/SeasonPlayer";

import type {
  Match,
} from "@/src/types/Match";

import type {
  HallOfChampionsEntry,
} from "@/src/types/HallOfChampionsEntry";

import type {
  QuizCurrentPlayerStats,
  QuizHistoricalAwardFact,
  QuizHistoricalFinalFact,
  QuizHistoricalPlayerSeasonStats,
  QuizHistoricalPlayerPalmaresTitle,
  QuizHistoricalTeamTitleFact,
  QuizPlayerIdentity,
  QuizTeamIdentity,
  WeeklyQuizKnowledgeBase,
} from "@/src/types/GamesWeeklyQuiz";

import type {
  WeeklyQuizKnowledgeSource,
} from "@/src/services/games/quiz/WeeklyQuizKnowledgeSource";

export type QuizKnowledgeDocument = { id: string; data(): Record<string, unknown> };
export type WeeklyQuizKnowledgeDataSource = {
  getDocuments(collection: string): Promise<{ docs: QuizKnowledgeDocument[] }>;
  players: Pick<typeof FirebasePlayerRepository, "getAllWithPrivate">;
  teams: Pick<typeof FirebaseTeamRepository, "getAll">;
  champions: Pick<typeof FirebaseHallOfChampionsRepository, "getAll">;
  matches: Pick<typeof FirebaseMatchRepository, "getBySeason">;
  seasonPlayers: Pick<typeof FirebaseSeasonPlayerRepository, "getBySeasonId">;
  reports: Pick<typeof FirebaseMatchReportRepository, "getPublishedBySeason">;
};

type FirestoreSeason = {
  id:
    string;

  competitionId:
    string;

  name:
    string;

  status:
    string;

  isCurrent:
    boolean;
};

/*
 * ============================================================
 * FIREBASE WEEKLY QUIZ KNOWLEDGE SOURCE
 * ============================================================
 *
 * Traduce i dati REALI già presenti in Ludi OS nel formato
 * neutro richiesto dal WeeklyQuizEngine.
 *
 * Sorgenti:
 *
 * CURRENT
 * - seasons
 * - matches
 * - matchReports
 * - seasonPlayers
 * - players
 * - teams
 * - FirebasePlayerStatsCalculator
 *
 * HISTORY
 * - historicalPlayerSeasonStats
 * - hallOfChampions
 * - hallOfFame
 * ============================================================
 */

export class WeeklyQuizKnowledgeBuilder
  implements WeeklyQuizKnowledgeSource
{
  constructor(private readonly dependencies: WeeklyQuizKnowledgeDataSource) {}

  async buildKnowledgeBase():
    Promise<WeeklyQuizKnowledgeBase> {
    const dependencies = this.dependencies;
    const generatedAtMs =
      Date.now();

    const [
      players,
      teams,
      allSeasons,
      historicalStatsSnapshot,
      hallOfChampions,
      hallOfFameSnapshot,
    ] =
      await Promise.all([
        dependencies.players.getAllWithPrivate(),

        dependencies.teams.getAll(),

        loadAllSeasons(dependencies),

        dependencies.getDocuments("historicalPlayerSeasonStats"),

        dependencies.champions.getAll(),

        dependencies.getDocuments("hallOfFame"),
      ]);

    const activeSeasons =
      allSeasons.filter(
        (season) =>
          season.status === "active" ||
          season.isCurrent,
      );

    const playersById =
      new Map(
        players.map(
          (
            player,
          ) => [
            String(
              player.id,
            ),
            player,
          ],
        ),
      );

    const teamsById =
      new Map(
        teams.map(
          (
            team,
          ) => [
            String(
              team.id,
            ),
            team,
          ],
        ),
      );

    const currentPlayers =
      (
        await Promise.all(
          activeSeasons.map(
            async (
              season,
            ) =>
              buildCurrentSeasonStats({
                dependencies,
                season,
                playersById,
                teamsById,
              }),
          ),
        )
      ).flat();

    const historicalPlayerSeasons =
      historicalStatsSnapshot.docs
        .map(
          (
            document,
          ) =>
            mapHistoricalPlayerSeason({
              id:
                document.id,

              value:
                document.data(),

              playersById,
              teamsById,
            }),
        )
        .filter(
          (
            value,
          ): value is QuizHistoricalPlayerSeasonStats =>
            value !==
            null,
        );

    const seasonsById =
      new Map(
        allSeasons.map(
          (
            season,
          ) => [
            season.id,
            season,
          ],
        ),
      );

    const historicalFinals =
      hallOfChampions
        .map(
          (
            entry,
          ) =>
            mapHistoricalFinal({
              entry,
              seasonsById,
            }),
        )
        .filter(
          (
            value,
          ): value is QuizHistoricalFinalFact =>
            value !==
            null,
        );

    const historicalAwards =
      hallOfFameSnapshot.docs
        .map(
          (
            document,
          ) =>
            mapHistoricalAward({
              id:
                document.id,

              value:
                document.data(),

              seasonsById,
            }),
        )
        .filter(
          (
            value,
          ): value is QuizHistoricalAwardFact =>
            value !==
            null,
        );

    /*
     * Il Palmarès dei giocatori contiene anche i titoli di squadra
     * assegnati alla chiusura/importazione della stagione.
     * Li riduciamo a un solo fatto per squadra/stagione/fase: così il
     * quiz può usare, ad esempio, il Campione Regular Season come
     * distrattore della Champions/Europa della stessa famiglia.
     */
    const historicalTeamTitles =
      buildHistoricalTeamTitles(
        players,
      );

    const historicalPlayerPalmaresTitles =
      buildHistoricalPlayerPalmaresTitles(players);

    return {
      generatedAtMs,

      currentPlayers,

      historicalPlayerSeasons,

      historicalFinals,

      historicalAwards,

      historicalTeamTitles,
      historicalPlayerPalmaresTitles,
    };
  }
}

/*
 * ============================================================
 * CURRENT SEASONS
 * ============================================================
 */

async function buildCurrentSeasonStats({
  dependencies,
  season,
  playersById,
  teamsById,
}: {
  dependencies: WeeklyQuizKnowledgeDataSource;
  season:
    FirestoreSeason;

  playersById:
    Map<
      string,
      PlayerProfile
    >;

  teamsById:
    Map<
      string,
      Awaited<
        ReturnType<
          typeof FirebaseTeamRepository.getAll
        >
      >[number]
    >;

}): Promise<
  QuizCurrentPlayerStats[]
> {
  const [
    matches,
    seasonPlayers,
    seasonReports,
  ] =
    await Promise.all([
      dependencies.matches.getBySeason(
        season.id,
      ),

      dependencies.seasonPlayers.getBySeasonId(
        season.id,
      ),

      dependencies.reports.getPublishedBySeason(
        season.id,
      ),
    ]);

  const reportsByMatchId =
    new Map(
      seasonReports.map(
        (
          report,
        ) => [
          String(
            report.matchId,
          ),
          report,
        ],
      ),
    );

  const playedMatches =
    matches.filter(
      (
        match,
      ) =>
        reportsByMatchId.has(
          String(
            match.id,
          ),
        ),
    );

  const availableMatchesByTeamId =
    buildAvailableTeamMatches(
      playedMatches,
    );

  return seasonPlayers.flatMap(
    (
      seasonPlayer,
    ) => {
      const player =
        playersById.get(
          String(
            seasonPlayer.playerId,
          ),
        );

      const team =
        teamsById.get(
          String(
            seasonPlayer.teamId,
          ),
        );

      if (
        !player ||
        !team
      ) {
        return [];
      }

      const calculated =
        calculateFirebasePlayerStats({
          playerId:
            String(
              seasonPlayer.playerId,
            ),

          matches,

          reports:
            seasonReports,

          teams:
            Array.from(
              teamsById.values(),
            ),

          role:
            seasonPlayer.role,
        });

      const stats =
        calculated.stats;

      const playerIdentity =
        createPlayerIdentity({
          player,
          seasonPlayer,
        });

      const teamIdentity:
        QuizTeamIdentity = {
          teamId:
            String(
              team.id,
            ),

          teamName:
            team.aliasName ||
            team.name,

          competitionId:
            season.competitionId,

          seasonId:
            season.id,
        };

      return [
        {
          player:
            playerIdentity,

          team:
            teamIdentity,

          seasonName:
            season.name,

          appearances:
            stats.appearances,

          availableTeamMatches:
            availableMatchesByTeamId.get(
              String(
                team.id,
              ),
            ) ??
            0,

          goals:
            stats.goals,

          assists:
            stats.assists,

          mvp:
            stats.mvp,

          yellowCards:
            stats.yellowCards,

          redCards:
            stats.redCards,

          ownGoals:
            readFiniteNumber(
              stats,
              "ownGoals",
            ) ??
            0,

          averageVote:
            stats.averageVote,

          cleanSheets:
            stats.cleanSheets,

          goalsConceded:
            readFiniteNumber(
              stats,
              "goalsConceded",
            ),
        },
      ];
    },
  );
}

function buildAvailableTeamMatches(
  matches:
    Match[],
): Map<
  string,
  number
> {
  const result =
    new Map<
      string,
      number
    >();

  for (
    const match of
    matches
  ) {
    const teamIds =
      [
        String(
          match.homeTeamId,
        ),
        String(
          match.awayTeamId,
        ),
      ];

    for (
      const teamId of
      teamIds
    ) {
      result.set(
        teamId,
        (
          result.get(
            teamId,
          ) ??
          0
        ) +
          1,
      );
    }
  }

  return result;
}

/*
 * ============================================================
 * HISTORICAL PLAYER STATS
 * ============================================================
 */

function mapHistoricalPlayerSeason({
  value,
  playersById,
  teamsById,
}: {
  id:
    string;

  value:
    Record<
      string,
      unknown
    >;

  playersById:
    Map<
      string,
      PlayerProfile
    >;

  teamsById:
    Map<
      string,
      Awaited<
        ReturnType<
          typeof FirebaseTeamRepository.getAll
        >
      >[number]
    >;
}): QuizHistoricalPlayerSeasonStats | null {
  const storedPlayerId =
    normalizeString(
      value.playerId,
    );

  const storedPlayerName =
    firstString(
      value.playerName,
      value.displayName,
      value.fullName,
      value.name,
    );

  const storedBirthYear =
    firstFiniteNumber(
      value.birthYear,
      value.playerBirthYear,
      value.yearOfBirth,
    );

  const storedRole =
    firstString(
      value.role,
      value.position,
      value.playerRole,
    ) ||
    undefined;

  const playerId =
    storedPlayerId ||
    (
      storedPlayerName
        ? `historical:${normalizeKey(storedPlayerName)}${
            storedBirthYear !== undefined
              ? `:${storedBirthYear}`
              : ""
          }`
        : ""
    );

  const seasonId =
    normalizeString(
      value.seasonId,
    );

  const seasonName =
    normalizeString(
      value.seasonName,
    );

  const competitionId =
    normalizeString(
      value.competitionId,
    );

  if (
    !playerId ||
    !seasonId ||
    !seasonName ||
    !competitionId
  ) {
    return null;
  }

  const player =
    playersById.get(
      playerId,
    );

  if (
    !player &&
    !storedPlayerName
  ) {
    return null;
  }

  const teamId =
    normalizeOptionalString(
      value.teamId,
    );

  const historicalTeam =
    teamId
      ? teamsById.get(
          teamId,
        )
      : undefined;

  /*
   * Per gli archivi la fonte primaria è teamName, salvata
   * durante l'import Excel a partire da Squadre + teamCode.
   *
   * Il lookup tramite teamId è soltanto un fallback per
   * eventuali documenti storici creati con uno schema diverso.
   */
  const teamName =
    normalizeOptionalString(
      value.teamName,
    ) ??
    (
      historicalTeam
        ? historicalTeam.aliasName ||
          historicalTeam.name
        : undefined
    );

  return {
    player:
      player
        ? {
            ...createPlayerIdentity({
              player,
            }),
            ...(storedRole
              ? { role: storedRole }
              : {}),
            ...(player.birthYear === undefined && storedBirthYear !== undefined
              ? { birthYear: storedBirthYear }
              : {}),
          }
        : {
            playerId,
            displayName:
              storedPlayerName,
            ...(storedRole
              ? { role: storedRole }
              : {}),
            ...(storedBirthYear !== undefined
              ? { birthYear: storedBirthYear }
              : {}),
          },

    teamId,

    teamName,

    competitionId,

    seasonId,

    seasonName,

    appearances:
      normalizeInteger(
        value.appearances,
      ),

    goals:
      normalizeInteger(
        value.goals,
      ),

    assists:
      normalizeInteger(
        value.assists,
      ),

    ownGoals:
      normalizeInteger(
        value.ownGoals,
      ),

    yellowCards:
      normalizeInteger(
        value.yellowCards,
      ),

    redCards:
      normalizeInteger(
        value.redCards,
      ),

    averageVote:
      normalizeOptionalNumber(
        value.averageVote,
      ),
  };
}

/*
 * ============================================================
 * HISTORICAL FINALS
 * ============================================================
 */

function mapHistoricalFinal({
  entry,
  seasonsById,
}: {
  entry:
    HallOfChampionsEntry;

  seasonsById:
    Map<
      string,
      FirestoreSeason
    >;
}): QuizHistoricalFinalFact | null {
  const seasonId =
    entry.seasonId?.trim() ??
    "";

  if (
    !seasonId
  ) {
    return null;
  }

  const season =
    seasonsById.get(
      seasonId,
    );

  const competitionId =
    inferCompetitionIdFromName(
      entry.competitionName,
    ) ??
    (
      firstString(
        (
          entry as unknown as Record<string, unknown>
        ).competitionId,
      ) ||
      season?.competitionId ||
      ""
    );

  if (
    !competitionId
  ) {
    return null;
  }

  const championTeamId =
    entry.championTeamId ??
    entry.championTeamName;

  const runnerUpTeamId =
    entry.runnerUpTeamId ??
    entry.runnerUpTeamName;

  const finalReport =
    entry.finalReport;

  const championIsHome =
    finalReport
      ? normalizeTeamName(
          finalReport.homeTeamName,
        ) ===
        normalizeTeamName(
          entry.championTeamName,
        )
      : true;

  const homeTeamId =
    championIsHome
      ? championTeamId
      : runnerUpTeamId;

  const awayTeamId =
    championIsHome
      ? runnerUpTeamId
      : championTeamId;

  const homeTeamName =
    finalReport?.homeTeamName ??
    (
      championIsHome
        ? entry.championTeamName
        : entry.runnerUpTeamName
    );

  const awayTeamName =
    finalReport?.awayTeamName ??
    (
      championIsHome
        ? entry.runnerUpTeamName
        : entry.championTeamName
    );

  const homeScore =
    finalReport?.homeScore ??
    (
      championIsHome
        ? entry.championScore
        : entry.runnerUpScore
    );

  const awayScore =
    finalReport?.awayScore ??
    (
      championIsHome
        ? entry.runnerUpScore
        : entry.championScore
    );

  const validGoals =
    entry.finalGoals
      .filter(
        (
          goal,
        ) =>
          goal.isOwnGoal !==
          true,
      );

  const scorerNames =
    validGoals.map(
        (
          goal,
        ) =>
          goal.scorerName,
      )
      .filter(
        Boolean,
      );

  const scorerPlayerIds =
    validGoals
      .map(
        (
          goal,
        ) =>
          firstString(
            (
              goal as unknown as Record<string, unknown>
            ).playerId,
            (
              goal as unknown as Record<string, unknown>
            ).scorerPlayerId,
          ),
      )
      .filter(
        Boolean,
      );

  const scorerTotals =
    new Map<
      string,
      {
        playerId?: string;
        playerName: string;
        goals: number;
      }
    >();

  for (
    const goal of
    validGoals
  ) {
    const playerName =
      goal.scorerName?.trim();

    if (
      !playerName
    ) {
      continue;
    }

    const key =
      normalizeKey(
        playerName,
      );

    const goalRecord =
      goal as unknown as Record<string, unknown>;

    const playerId =
      firstString(
        goalRecord.playerId,
        goalRecord.scorerPlayerId,
      ) ||
      undefined;

    const previous =
      scorerTotals.get(
        key,
      );

    scorerTotals.set(
      key,
      {
        playerId:
          previous?.playerId ??
          playerId,
        playerName:
          previous?.playerName ??
          playerName,
        goals:
          (
            previous?.goals ??
            0
          ) +
          1,
      },
    );
  }

  const scorers =
    Array.from(
      scorerTotals.values(),
    ).sort(
      (
        first,
        second,
      ) =>
        second.goals -
        first.goals,
    );

  const decisiveScorerName =
    findDecisiveScorerName(
      entry,
    );

  return {
    id:
      entry.id,

    competitionId,

    seasonId,

    seasonName:
      entry.seasonName,

    competitionName:
      entry.competitionName,

    homeTeamId:
      String(
        homeTeamId,
      ),

    homeTeamName,

    awayTeamId:
      String(
        awayTeamId,
      ),

    awayTeamName,

    homeScore,

    awayScore,

    winnerTeamId:
      String(
        championTeamId,
      ),

    winnerTeamName:
      entry.championTeamName,

    scorerPlayerIds,

    scorerNames,

    scorers,

    hatTrickScorerNames:
      scorers
        .filter(
          (
            scorer,
          ) =>
            scorer.goals >=
            3,
        )
        .map(
          (
            scorer,
          ) =>
            scorer.playerName,
        ),

    decisiveScorerName,
  };
}

/*
 * Il "gol decisivo" viene definito solo quando la finale
 * è stata vinta nei tempi di gioco e possiamo ricostruire
 * in modo affidabile il gol che porta la squadra campione
 * oltre il totale finale della finalista sconfitta.
 *
 * Esempio 6-5: il sesto gol della squadra campione.
 *
 * Non assegniamo un marcatore decisivo:
 * - in caso di parità + rigori;
 * - se il gol decisivo è un'autorete;
 * - se lo storico non contiene minuti/marcatori sufficienti.
 */
function findDecisiveScorerName(
  entry:
    HallOfChampionsEntry,
): string | undefined {
  if (
    entry.championScore <=
    entry.runnerUpScore
  ) {
    return undefined;
  }

  const targetChampionGoal =
    entry.runnerUpScore +
    1;

  let championGoalCount =
    0;

  const orderedGoals =
    [...entry.finalGoals].sort(
      (
        first,
        second,
      ) => {
        if (
          first.minute !==
          second.minute
        ) {
          return (
            first.minute -
            second.minute
          );
        }

        return (
          (
            first.stoppageTime ??
            0
          ) -
          (
            second.stoppageTime ??
            0
          )
        );
      },
    );

  for (
    const goal of
    orderedGoals
  ) {
    if (
      goal.team !==
      "champion"
    ) {
      continue;
    }

    championGoalCount +=
      1;

    if (
      championGoalCount !==
      targetChampionGoal
    ) {
      continue;
    }

    if (
      goal.isOwnGoal
    ) {
      return undefined;
    }

    return (
      goal.scorerName ||
      undefined
    );
  }

  return undefined;
}

/*
 * PALMARÈS DEL SINGOLO GIOCATORE
 *
 * Non inferire i trofei di un giocatore dallo storico delle squadre:
 * il record deve appartenere esplicitamente a player.achievements.
 */
function buildHistoricalPlayerPalmaresTitles(
  players: PlayerProfile[],
): QuizHistoricalPlayerPalmaresTitle[] {
  const uniqueTitles = new Map<string, QuizHistoricalPlayerPalmaresTitle>();
  for (const player of players) {
    const playerId = String(player.id);
    for (const achievement of player.achievements ?? []) {
      const title = achievement.title?.trim() ?? "";
      if (!/^campione\b/i.test(title)) continue;
      const competitionId = achievement.competitionId?.trim() ?? "";
      const seasonId = achievement.seasonId?.trim() ?? "";
      if (!competitionId || !seasonId) continue;
      const phase: QuizHistoricalPlayerPalmaresTitle["phase"] =
        achievement.competition === "regularSeason" ? "regularSeason" : "finalStage";
      const value = { playerId, competitionId, seasonId, phase, title };
      const key = [playerId, competitionId, seasonId, phase, title.toLocaleLowerCase("it")].join("::");
      uniqueTitles.set(key, value);
    }
  }
  return [...uniqueTitles.values()];
}

/*
 * ============================================================
 * HISTORICAL TEAM TITLES (PALMARÈS GIOCATORI)
 * ============================================================
 */

function buildHistoricalTeamTitles(
  players:
    PlayerProfile[],
): QuizHistoricalTeamTitleFact[] {
  const byKey =
    new Map<
      string,
      QuizHistoricalTeamTitleFact
    >();

  for (
    const player of
      players
  ) {
    for (
      const achievement of
        player.achievements ?? []
    ) {
      const title =
        achievement.title?.trim() ??
        "";

      /*
       * Il Palmarès può contenere anche 2°/3° posto: per i distrattori
       * dei campioni ci interessano soltanto i titoli di campione.
       */
      if (
        !/^campione\b/i.test(
          title,
        )
      ) {
        continue;
      }

      const competitionId =
        achievement.competitionId?.trim();

      const seasonId =
        achievement.seasonId?.trim();

      const seasonName =
        achievement.seasonLabel?.trim();

      const teamId =
        achievement.teamId?.trim();

      const teamName =
        achievement.teamName?.trim();

      if (
        !competitionId ||
        !seasonId ||
        !seasonName ||
        !teamId ||
        !teamName
      ) {
        continue;
      }

      const phase:
        QuizHistoricalTeamTitleFact["phase"] =
          achievement.competition ===
          "regularSeason"
            ? "regularSeason"
            : "finalStage";

      const key =
        [
          competitionId,
          seasonId,
          phase,
          teamId,
        ].join(
          "::",
        );

      if (
        byKey.has(
          key,
        )
      ) {
        continue;
      }

      byKey.set(
        key,
        {
          id:
            achievement.id?.trim() ||
            key,

          competitionId,

          seasonId,

          seasonName,

          phase,

          title,

          teamId,

          teamName,
        },
      );
    }
  }

  return Array.from(
    byKey.values(),
  );
}

/*
 * ============================================================
 * HISTORICAL AWARDS
 * ============================================================
 */

function mapHistoricalAward({
  id,
  value,
  seasonsById,
}: {
  id:
    string;

  value:
    Record<
      string,
      unknown
    >;

  seasonsById:
    Map<
      string,
      FirestoreSeason
    >;
}): QuizHistoricalAwardFact | null {
  const seasonId =
    firstString(
      value.seasonId,
      value.seasonCode,
    );

  if (
    !seasonId
  ) {
    return null;
  }

  const season =
    seasonsById.get(
      seasonId,
    );

  const competitionId =
    firstString(
      value.competitionId,
      season?.competitionId,
    );

  if (
    !competitionId
  ) {
    return null;
  }

  const award =
    firstString(
      value.award,
      value.category,
      value.type,
    );

  const awardLabel =
    firstString(
      value.awardLabel,
      value.label,
      value.title,
      award,
    );

  if (
    !award ||
    !awardLabel
  ) {
    return null;
  }

  const winnerType =
    normalizeHistoricalAwardWinnerType(
      value.winnerType,
    );

  const winnerName =
    firstString(
      value.playerName,
      value.winnerName,
      value.name,
    );

  return {
    id,

    competitionId,

    competitionName:
      firstString(
        value.competitionName,
        value.competitionLabel,
      ) ||
      competitionNameFromId(
        competitionId,
      ),

    seasonId,

    seasonName:
      firstString(
        value.seasonName,
        value.seasonLabel,
        season?.name,
      ) ||
      seasonId,

    award,

    awardLabel,

    section:
      normalizeHistoricalAwardSection(
        value.section,
      ),

    sortOrder:
      firstFiniteNumber(
        value.sortOrder,
      ),

    winnerType,

    playerId:
      firstString(
        value.playerId,
        value.winnerPlayerId,
      ) ||
      undefined,

    playerName:
      winnerType === "team"
        ? undefined
        : winnerName ||
          undefined,

    birthYear:
      firstFiniteNumber(
        value.birthYear,
        value.playerBirthYear,
        value.winnerBirthYear,
      ),

    teamId:
      firstString(
        value.teamId,
        value.winnerTeamId,
      ) ||
      undefined,

    teamName:
      firstString(
        value.teamName,
        value.winnerTeamName,
        winnerType === "team"
          ? value.winnerName
          : undefined,
      ) ||
      undefined,

    value:
      firstFiniteNumber(
        value.value,
        value.goals,
        value.total,
        value.score,
      ),
  };
}


function normalizeHistoricalAwardSection(
  value: unknown,
): QuizHistoricalAwardFact["section"] {
  return value === "bestOfSeason" ||
    value === "teamOfSeason" ||
    value === "goalAndSave" ||
    value === "otherAwards"
    ? value
    : undefined;
}

function normalizeHistoricalAwardWinnerType(
  value: unknown,
): QuizHistoricalAwardFact["winnerType"] {
  return value === "player" ||
    value === "team" ||
    value === "custom"
    ? value
    : undefined;
}

/*
 * ============================================================
 * SEASONS
 * ============================================================
 */

async function loadAllSeasons(dependencies: WeeklyQuizKnowledgeDataSource):
  Promise<FirestoreSeason[]> {
  const snapshot =
    await dependencies.getDocuments("seasons");

  return snapshot.docs
    .map(
      (
        document,
      ) => {
        const value =
          document.data();

        return {
          id:
            document.id,

          competitionId:
            normalizeString(
              value.competitionId,
            ),

          name:
            normalizeString(
              value.name,
            ) ||
            document.id,

          status:
            normalizeString(
              value.status,
            ),

          isCurrent:
            value.isCurrent ===
            true,
        };
      },
    )
    .filter(
      (
        season,
      ) =>
        Boolean(
          season.competitionId,
        ),
    );
}

/*
 * ============================================================
 * PLAYER
 * ============================================================
 */

function createPlayerIdentity({
  player,
  seasonPlayer,
}: {
  player:
    PlayerProfile;

  seasonPlayer?:
    SeasonPlayer;
}): QuizPlayerIdentity {
  const displayName =
    `${player.firstName} ${player.lastName}`.trim();

  return {
    playerId:
      String(
        player.id,
      ),

    displayName,

    firstName:
      player.firstName,

    lastName:
      player.lastName,

    role:
      seasonPlayer?.role,

    birthYear:
      player.birthYear,

    photoUrl:
      player.photoUrl,
  };
}

/*
 * ============================================================
 * GENERIC NORMALIZATION
 * ============================================================
 */

function normalizeString(
  value:
    unknown,
): string {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function normalizeOptionalString(
  value:
    unknown,
): string | undefined {
  const normalized =
    normalizeString(
      value,
    );

  return normalized ||
    undefined;
}

function normalizeInteger(
  value:
    unknown,
): number {
  return typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
    ? Math.trunc(
        value,
      )
    : 0;
}

function normalizeOptionalNumber(
  value:
    unknown,
): number | undefined {
  return typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
    ? value
    : undefined;
}

function firstString(
  ...values:
    unknown[]
): string {
  for (
    const value of
    values
  ) {
    const normalized =
      normalizeString(
        value,
      );

    if (
      normalized
    ) {
      return normalized;
    }
  }

  return "";
}

function normalizeTeamName(
  value:
    string,
) {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " ",
    );
}

function normalizeKey(
  value:
    string,
): string {
  return value
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    );
}

function inferCompetitionIdFromName(
  value: string | undefined,
): string | undefined {
  const normalized =
    normalizeKey(
      value ?? "",
    );

  if (normalized.includes("championship")) {
    return "championship";
  }

  if (normalized.includes("europa")) {
    return "europa-league";
  }

  if (normalized.includes("champions")) {
    return "champions-league";
  }

  if (normalized.includes("premier")) {
    return "premier-league";
  }

  return undefined;
}

function competitionNameFromId(
  competitionId:
    string,
): string {
  const knownNames:
    Record<string, string> = {
      "premier-league":
        "Premier League",
      championship:
        "Championship",
      "league-one":
        "League One",
      "champions-league":
        "Champions League",
      "europa-league":
        "Europa League",
    };

  return knownNames[
    competitionId
  ] ??
    competitionId
      .split("-")
      .filter(Boolean)
      .map(
        (
          part,
        ) =>
          `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
      )
      .join(" ");
}

function firstFiniteNumber(
  ...values:
    unknown[]
): number | undefined {
  for (
    const value of
    values
  ) {
    if (
      typeof value ===
        "number" &&
      Number.isFinite(
        value,
      )
    ) {
      return value;
    }
  }

  return undefined;
}

function readFiniteNumber(
  value:
    unknown,
  key:
    string,
): number | undefined {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return undefined;
  }

  const current =
    (
      value as
        Record<
          string,
          unknown
        >
    )[
      key
    ];

  return typeof current ===
      "number" &&
    Number.isFinite(
      current,
    )
    ? current
    : undefined;
}
