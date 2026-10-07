import type {
  SeasonPlayer,
} from "@/src/types/SeasonPlayer";

export type FantasySourcePlayer = {
  playerSeasonCode:
    string;

  playerId:
    string;

  teamId:
    string;

  teamCode:
    string;

  firstName:
    string;

  lastName:
    string;
};

export type FantasySourceTeam = {
  id:
    string;

  teamCode:
    string;

  name:
    string;
};

export type FantasyPlayerPoolSource = {
  players:
    FantasySourcePlayer[];

  teams:
    FantasySourceTeam[];

  validPlayerSeasonCodes:
    Set<string>;

  validTeamCodes:
    Set<string>;
};

export type BuildFantasyPlayerPoolSourceInput = {
  seasonId:
    string;

  seasonCode:
    string;

  seasonPlayers:
    SeasonPlayer[];

  players:
    Array<{
      id:
        string | number;

      firstName:
        string;

      lastName:
        string;

      birthYear?:
        number;
    }>;

  teams:
    Array<{
      id:
        string | number;

      name:
        string;

      aliasName?:
        string;

      code?:
        string;

      teamCode?:
        string;
    }>;
};

export class FantasyPlayerPoolSourceService {
  static build(
    input:
      BuildFantasyPlayerPoolSourceInput,
  ): FantasyPlayerPoolSource {
    if (
      !input.seasonId.trim()
    ) {
      throw new Error(
        "seasonId non valido.",
      );
    }

    if (
      !input.seasonCode.trim()
    ) {
      throw new Error(
        "seasonCode non valido.",
      );
    }

    const playersById =
      new Map(
        input.players.map(
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
        input.teams.map(
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

    const sourceTeams:
      FantasySourceTeam[] =
      input.teams.map(
        (
          team,
        ) => {
          const teamCode =
            this.resolveTeamCode(
              team,
            );

          return {
            id:
              String(
                team.id,
              ),

            teamCode,

            name:
              team.aliasName ||
              team.name,
          };
        },
      );

    const sourcePlayers:
      FantasySourcePlayer[] =
      [];

    for (
      const seasonPlayer
      of input.seasonPlayers
    ) {
      if (
        seasonPlayer.seasonId !==
        input.seasonId
      ) {
        continue;
      }

      if (
        seasonPlayer.status !==
        "active"
      ) {
        continue;
      }

      const player =
        playersById.get(
          String(
            seasonPlayer.playerId,
          ),
        );

      if (
        !player
      ) {
        continue;
      }

      const team =
        teamsById.get(
          String(
            seasonPlayer.teamId,
          ),
        );

      if (
        !team
      ) {
        continue;
      }

      const teamCode =
        this.resolveTeamCode(
          team,
        );

      const playerSeasonCode =
        this.buildPlayerSeasonCode({
          firstName:
            player.firstName,

          lastName:
            player.lastName,

          birthYear:
            player.birthYear,

          seasonCode:
            input.seasonCode,
        });

      sourcePlayers.push({
        playerSeasonCode,

        playerId:
          String(
            player.id,
          ),

        teamId:
          String(
            team.id,
          ),

        teamCode,

        firstName:
          player.firstName,

        lastName:
          player.lastName,
      });
    }

    return {
      players:
        sourcePlayers,

      teams:
        sourceTeams,

      validPlayerSeasonCodes:
        new Set(
          sourcePlayers.map(
            (
              player,
            ) =>
              player.playerSeasonCode,
          ),
        ),

      validTeamCodes:
        new Set(
          sourceTeams.map(
            (
              team,
            ) =>
              team.teamCode,
          ),
        ),
    };
  }

  private static buildPlayerSeasonCode(
    input: {
      firstName:
        string;

      lastName:
        string;

      birthYear?:
        number;

      seasonCode:
        string;
    },
  ): string {
    const firstName =
      this.slugify(
        input.firstName,
      );

    const lastName =
      this.slugify(
        input.lastName,
      );

    const birthYear =
      typeof input.birthYear ===
        "number"
        ? String(
            input.birthYear,
          )
        : "unknown";

    const seasonCode =
      this.slugify(
        input.seasonCode,
      );

    return [
      lastName,
      firstName,
      birthYear,
      seasonCode,
    ].join(
      "-",
    );
  }

  private static resolveTeamCode(
    team: {
      id:
        string | number;

      name:
        string;

      aliasName?:
        string;

      code?:
        string;

      teamCode?:
        string;
    },
  ): string {
    const explicitCode =
      team.teamCode?.trim() ||
      team.code?.trim();

    if (
      explicitCode
    ) {
      return this.slugify(
        explicitCode,
      );
    }

    /*
     * Nel modello corrente delle squadre
     * l'identificativo Firestore è già
     * l'identificativo stabile utilizzato
     * nelle relazioni della stagione.
     *
     * Se non esiste un teamCode esplicito,
     * usiamo quindi l'id della squadra.
     */
    return String(
      team.id,
    ).trim();
  }

  private static slugify(
    value:
      string,
  ): string {
    return value
      .trim()
      .toLocaleLowerCase(
        "it-IT",
      )
      .normalize(
        "NFD",
      )
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
}