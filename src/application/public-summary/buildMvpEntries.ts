import { buildPlayerRatings } from "@/src/services/rating/RatingPlayerBuilder";
import { calculateFirebasePlayerStats } from "@/src/services/stats/FirebasePlayerStatsCalculator";
import type { PlayerSeasonStatistics } from "@/src/capabilities/analytics";
import type { SeasonPlayer } from "@/src/types/SeasonPlayer";
import type { PlayerProfile } from "@/src/types/PlayerProfile";
import type { Match } from "@/src/types/Match";
import type { Team } from "@/src/types/Team";
import type { CloudMatchReport } from "@/src/services/match/FirebaseMatchReportRepository";
import type { MvpCarouselEntry } from "@/src/types/MvpCarouselEntry";
function compute<T>(factory: () => T, dependencies: unknown[] = []): T {
  void dependencies;
  return factory();
}
export function buildMvpEntries({
  seasonId,
  seasonPlayers,
  players,
  matches,
  reports,
  teams,
}: {
  seasonId: string;
  seasonPlayers: SeasonPlayer[];
  players: PlayerProfile[];
  matches: Match[];
  reports: CloudMatchReport[];
  teams: Team[];
}): MvpCarouselEntry[] {
  const currentSeason = { id: seasonId };
  const playerStatistics = compute<PlayerSeasonStatistics[]>(() => {
    if (!currentSeason?.id) {
      return [];
    }

    return seasonPlayers.map((seasonPlayer) => {
      const result = calculateFirebasePlayerStats({
        playerId: String(seasonPlayer.playerId),

        matches,

        reports,

        teams,

        role: seasonPlayer.role,
      });

      return {
        playerId: String(seasonPlayer.playerId),

        teamId: String(seasonPlayer.teamId),

        goals: result.stats.goals,

        assists: result.stats.assists,

        mvp: result.stats.mvp,

        appearances: result.stats.appearances,

        averageRating: result.stats.averageVote ?? 0,

        yellowCards: result.stats.yellowCards,

        redCards: result.stats.redCards,

        cleanSheetCount: result.stats.cleanSheets,

        /*
         * Il sistema Ludi Rating
         * attualmente non utilizza
         * goalsConceded.
         */
        goalsConceded: 0,

        ratingVariation: result.stats.ratingVariation,
      };
    });
  }, [currentSeason?.id, seasonPlayers, matches, reports, teams]);

  /*
   * Colleghiamo il baseRating salvato
   * nell'anagrafica globale del giocatore
   * alla sua presenza stagionale.
   */
  const ratedPlayers = compute(() => {
    const playerProfilesById = new Map(
      players.map((player) => [String(player.id), player]),
    );

    const seasonPlayersWithRating = seasonPlayers.map((seasonPlayer) => {
      const playerProfile = playerProfilesById.get(
        String(seasonPlayer.playerId),
      );

      return {
        ...seasonPlayer,

        baseRating: playerProfile?.baseRating,
      };
    });

    return buildPlayerRatings({
      seasonPlayers: seasonPlayersWithRating,

      statistics: playerStatistics,
    });
  }, [seasonPlayers, players, playerStatistics]);

  /*
   * Lookup veloce:
   *
   * playerId -> Ludi Rating attuale
   */
  const ratingsByPlayerId = compute(() => {
    return new Map(
      ratedPlayers.map((ratedPlayer) => [
        String(ratedPlayer.playerId),

        ratedPlayer.hasRating && typeof ratedPlayer.currentRating === "number"
          ? ratedPlayer.currentRating
          : undefined,
      ]),
    );
  }, [ratedPlayers]);

  const mvps = compute<MvpCarouselEntry[]>(() => {
    if (!currentSeason?.id) {
      return [];
    }
    const matchesById = new Map(
      matches.map((match) => [String(match.id), match]),
    );

    const validReports = reports.filter((report) => {
      if (report.status !== "published") {
        return false;
      }

      if (report.data.status === "walkover") {
        return false;
      }

      if (!report.data.mvpPlayerId) {
        return false;
      }

      return matchesById.has(String(report.matchId));
    });

    if (validReports.length === 0) {
      return [];
    }

    const latestMatchweek = Math.max(
      ...validReports.map((report) => {
        const match = matchesById.get(String(report.matchId));

        return Number(match?.matchweek ?? 0);
      }),
    );

    return validReports
      .filter((report) => {
        const match = matchesById.get(String(report.matchId));

        return Number(match?.matchweek) === latestMatchweek;
      })
      .map((report) => {
        const match = matchesById.get(String(report.matchId));

        const homeTeam = teams.find(
          (currentTeam) => String(currentTeam.id) === String(match?.homeTeamId),
        );

        const awayTeam = teams.find(
          (currentTeam) => String(currentTeam.id) === String(match?.awayTeamId),
        );

        const playerId = String(report.data.mvpPlayerId);

        const player = players.find(
          (currentPlayer) => String(currentPlayer.id) === playerId,
        );

        return {
          playerId,

          matchId: String(report.matchId),

          firstName: player?.firstName ?? "Giocatore",

          lastName: player?.lastName ?? "non disponibile",

          /*
           * Continuiamo a utilizzare
           * esclusivamente la foto MVP
           * caricata nel Match Report.
           */
          photoUrl: report.data.mvpPhotoUrl,

          /*
           * NUOVO:
           * rating attuale calcolato
           * dal sistema Ludi Rating.
           */
          rating: ratingsByPlayerId.get(playerId),

          homeTeamName: homeTeam?.name ?? "Squadra casa",

          awayTeamName: awayTeam?.name ?? "Squadra ospite",

          homeTeamLogoUrl: homeTeam?.logoUrl,

          awayTeamLogoUrl: awayTeam?.logoUrl,

          homeScore: report.data.homeScore,

          awayScore: report.data.awayScore,

          matchweek: match?.matchweek ?? latestMatchweek,
        };
      })
      .sort((first, second) => {
        const firstRating = first.rating ?? -1;

        const secondRating = second.rating ?? -1;

        if (secondRating !== firstRating) {
          return secondRating - firstRating;
        }

        return first.lastName.localeCompare(second.lastName, "it", {
          sensitivity: "base",
        });
      });
  }, [currentSeason?.id, matches, reports, players, teams, ratingsByPlayerId]);

  return mvps;
}
