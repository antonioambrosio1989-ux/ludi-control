import {
  FirebasePlayerRepository,
} from "@/src/services/player/FirebasePlayerRepository";

import type {
  PlayerAchievement,
  PlayerAchievementCompetition,
} from "@/src/types/PlayerAchievement";

import type {
  FinalStagePlayer,
} from "@/src/types/FinalStagePlayer";

/*
 * ============================================================
 * INPUT
 * ============================================================
 */

type AssignTeamAchievementInput = {
  seasonId: string;
  seasonLabel: string;

  competitionId: string;
  competition:
    PlayerAchievementCompetition;

  teamId: string;
  teamName: string;

  eligiblePlayers:
    FinalStagePlayer[];
};

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

export class PlayerAchievementsService {
  /*
   * ==========================================================
   * REGULAR SEASON
   * ==========================================================
   */

  static async assignRegularSeasonChampion({
    seasonId,
    seasonLabel,
    competitionId,
    teamId,
    teamName,
    eligiblePlayers,
  }: Omit<
    AssignTeamAchievementInput,
    "competition"
  >): Promise<void> {
    await assignTeamAchievement({
      seasonId,
      seasonLabel,
      competitionId,
      competition:
        "regularSeason",

      teamId,
      teamName,

      eligiblePlayers,
    });
  }

  /*
   * ==========================================================
   * CHAMPIONS LEAGUE
   * ==========================================================
   */

  static async assignChampionsLeagueWinner({
    seasonId,
    seasonLabel,
    competitionId,
    teamId,
    teamName,
    eligiblePlayers,
  }: Omit<
    AssignTeamAchievementInput,
    "competition"
  >): Promise<void> {
    await assignTeamAchievement({
      seasonId,
      seasonLabel,
      competitionId,
      competition:
        "championsLeague",

      teamId,
      teamName,

      eligiblePlayers,
    });
  }
}

/*
 * ============================================================
 * ASSEGNAZIONE TITOLO DI SQUADRA
 * ============================================================
 */

async function assignTeamAchievement({
  seasonId,
  seasonLabel,
  competitionId,
  competition,
  teamId,
  teamName,
  eligiblePlayers,
}: AssignTeamAchievementInput): Promise<void> {
  const normalizedSeasonId =
    seasonId.trim();

  const normalizedSeasonLabel =
    seasonLabel.trim();

  const normalizedCompetitionId =
  competitionId.trim();

  const normalizedTeamId =
    String(
      teamId,
    ).trim();

  const normalizedTeamName =
    teamName.trim();

  if (
    !normalizedSeasonId ||
    !normalizedSeasonLabel ||
    !normalizedCompetitionId ||
    !normalizedTeamId ||
    !normalizedTeamName
  ) {
    throw new Error(
      "Dati achievement non validi.",
    );
  }

  /*
   * ==========================================================
   * GIOCATORI ELEGIBILI DELLA SQUADRA CAMPIONE
   * ==========================================================
   *
   * Questo service non decide chi è ammesso
   * alla fase finale.
   *
   * Riceve una lista già filtrata dal livello
   * applicativo/amministrativo.
   * ==========================================================
   */

  const playerIds =
    Array.from(
      new Set(
        eligiblePlayers
          .filter(
            (
              seasonPlayer,
            ) =>
              String(
                seasonPlayer.teamId,
              ) ===
              normalizedTeamId,
          )
          .map(
            (
              seasonPlayer,
            ) =>
              String(
                seasonPlayer.playerId,
              ),
          ),
      ),
    );

  if (
    playerIds.length ===
    0
  ) {
    return;
  }

  /*
   * ==========================================================
   * ACHIEVEMENT
   * ==========================================================
   */

  const achievement:
    PlayerAchievement = {
    id:
      `${normalizedSeasonId}-${competition}`,

    seasonId:
      normalizedSeasonId,

    seasonLabel:
      normalizedSeasonLabel,

    competitionId:
  normalizedCompetitionId,

    competition,

    title:
      competition ===
      "regularSeason"
        ? "Campione Regular Season"
        : "Campione Champions League",

    teamId:
      normalizedTeamId,

    teamName:
      normalizedTeamName,
  };

  /*
   * ==========================================================
   * SALVATAGGIO
   * ==========================================================
   */

  for (
    const playerId of
      playerIds
  ) {
    await FirebasePlayerRepository.upsertAchievement({
      playerId,

      achievement,
    });
  }
}