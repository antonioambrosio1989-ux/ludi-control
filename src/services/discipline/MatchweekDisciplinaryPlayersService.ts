import type { MatchweekDisciplinaryPlayer } from "@/src/services/discipline/DisciplinaryEngine";
import { FirebasePlayerRepository } from "@/src/services/player/FirebasePlayerRepository";
import { FirebaseTeamRepository } from "@/src/services/team/FirebaseTeamRepository";

export type DisciplinaryMatchEvent = {
  id?: string;

  type:
    | "yellowCard"
    | "redCard"
    | "secondYellowCard"
    | "goal"
    | "assist"
    | string;

  playerId?: string;
  playerName?: string;

  teamId?: string;
  teamName?: string;
};

export type DisciplinaryPlayerPerformance = {
  playerId: string;

  teamId: string | number;

  yellowCards?: number;
  redCards?: number;

  /**
   * Da impostare a true soltanto quando
   * il rosso è stato assegnato direttamente.
   */
  directRedCards?: number;
};

export type PublishedMatchReportForDiscipline = {
  id: string;

  seasonId: string;
  matchweek: number;

  status?: string;
  isPublished?: boolean;

  events?: DisciplinaryMatchEvent[];

  /**
   * Supporto per i Match Report nei quali
   * i cartellini sono salvati direttamente
   * nelle prestazioni dei giocatori.
   */
  performances?: DisciplinaryPlayerPerformance[];
};

export const MatchweekDisciplinaryPlayersService = {
  extract({
    seasonId,
    matchweek,
    reports,
  }: {
    seasonId: string;
    matchweek: number;
    reports: PublishedMatchReportForDiscipline[];
  }): MatchweekDisciplinaryPlayer[] {
    const validReports = reports.filter(
      (report) =>
        report.seasonId === seasonId &&
        report.matchweek === matchweek &&
        isPublishedReport(report),
    );

    const playersByMatchAndPlayer =
      new Map<
        string,
        MatchweekDisciplinaryPlayer
      >();

    validReports.forEach((report) => {
      extractFromPerformances({
        report,
        playersByMatchAndPlayer,
      });

      extractFromEvents({
        report,
        playersByMatchAndPlayer,
      });
    });

    return Array.from(
      playersByMatchAndPlayer.values(),
    ).filter(
      (player) =>
        player.yellowCards > 0 ||
        player.directRedCards > 0,
    );
  },

  async resolveNames(
    disciplinaryPlayers:
      MatchweekDisciplinaryPlayer[],
  ): Promise<
    MatchweekDisciplinaryPlayer[]
  > {
    if (
      disciplinaryPlayers.length === 0
    ) {
      return [];
    }

    const [players, teams] =
      await Promise.all([
        FirebasePlayerRepository.getAll(),
        FirebaseTeamRepository.getAll(),
      ]);

    const playersById =
      new Map(
        players.map((player) => [
          String(player.id),
          player,
        ]),
      );

    const teamsById =
      new Map(
        teams.map((team) => [
          String(team.id),
          team,
        ]),
      );

    return disciplinaryPlayers.map(
      (disciplinaryPlayer) => {
        const player =
          playersById.get(
            String(
              disciplinaryPlayer.playerId,
            ),
          );

        const team =
          teamsById.get(
            String(
              disciplinaryPlayer.teamId,
            ),
          );

        return {
          ...disciplinaryPlayer,

          playerName: player
            ? `${player.firstName} ${player.lastName}`.trim()
            : "Giocatore non trovato",

          teamName:
            team?.name ??
            "Squadra non trovata",
        };
      },
    );
  },
};

function extractFromPerformances({
  report,
  playersByMatchAndPlayer,
}: {
  report: PublishedMatchReportForDiscipline;

  playersByMatchAndPlayer: Map<
    string,
    MatchweekDisciplinaryPlayer
  >;
}): void {
  const performances =
    Array.isArray(report.performances)
      ? report.performances
      : [];

  performances.forEach((performance) => {
    const playerId =
  String(
    performance.playerId ?? "",
  ).trim();

const teamId =
  String(
    performance.teamId ?? "",
  ).trim();

if (!playerId || !teamId) {
  return;
}

    const yellowCards = sanitizeYellowCards(
      performance.yellowCards,
    );

    const directRedCards =
      sanitizeDirectRedCards(
            performance.directRedCards,
          );

    if (
      yellowCards === 0 &&
      directRedCards === 0
    ) {
      return;
    }

    mergePlayerCards({
      playersByMatchAndPlayer,

      player: {
        playerId,
      playerName:
          playerId,

        teamId,
        teamName:
          teamId,

        yellowCards,
        directRedCards,

        sourceMatchId: report.id,
      },
    });
  });
}

function extractFromEvents({
  report,
  playersByMatchAndPlayer,
}: {
  report: PublishedMatchReportForDiscipline;

  playersByMatchAndPlayer: Map<
    string,
    MatchweekDisciplinaryPlayer
  >;
}): void {
  const events =
    Array.isArray(report.events)
      ? report.events
      : [];

  const eventCardsByPlayer = new Map<
    string,
    MatchweekDisciplinaryPlayer
  >();

  events.forEach((event) => {
    if (
      !event.playerId?.trim() ||
      !event.playerName?.trim() ||
      !event.teamId?.trim()
    ) {
      return;
    }

    const normalizedType =
      normalizeEventType(event.type);

    const isYellow =
      normalizedType === "yellowcard";

    const isSecondYellow =
      normalizedType ===
      "secondyellowcard";

    const isDirectRed =
      normalizedType === "redcard";

    if (
      !isYellow &&
      !isSecondYellow &&
      !isDirectRed
    ) {
      return;
    }

    const playerKey = createPlayerKey({
      sourceMatchId: report.id,
      playerId: event.playerId,
    });

    const current =
      eventCardsByPlayer.get(playerKey) ?? {
        playerId: event.playerId,
        playerName: event.playerName,

        teamId: event.teamId,
        teamName: event.teamName ?? "",

        yellowCards: 0,
        redCards: 0,
        directRedCards: 0,

        sourceMatchId: report.id,
      };

    /*
     * Un evento secondYellowCard rappresenta
     * il secondo giallo della partita.
     *
     * Viene quindi conteggiato come un altro
     * cartellino giallo, ma non come rosso
     * diretto.
     */
    if (isYellow || isSecondYellow) {
      current.yellowCards = Math.min(
        2,
        current.yellowCards + 1,
      );
    }

    if (isDirectRed) {
      current.directRedCards = Math.max(
        1,
        current.directRedCards,
      );
    }

    eventCardsByPlayer.set(
      playerKey,
      current,
    );
  });

  eventCardsByPlayer.forEach((player) => {
    /*
     * Se la prestazione del giocatore è già
     * presente, non aggiungiamo nuovamente
     * gli stessi cartellini letti dagli eventi.
     */
    const existingKey = createPlayerKey({
      sourceMatchId:
        player.sourceMatchId,

      playerId:
        player.playerId,
    });

    if (
      playersByMatchAndPlayer.has(
        existingKey,
      )
    ) {
      return;
    }

    playersByMatchAndPlayer.set(
      existingKey,
      player,
    );
  });
}

function mergePlayerCards({
  playersByMatchAndPlayer,
  player,
}: {
  playersByMatchAndPlayer: Map<
    string,
    MatchweekDisciplinaryPlayer
  >;

  player: MatchweekDisciplinaryPlayer;
}): void {
  const key = createPlayerKey({
    sourceMatchId:
      player.sourceMatchId,

    playerId:
      player.playerId,
  });

  const existing =
    playersByMatchAndPlayer.get(key);

  if (!existing) {
    playersByMatchAndPlayer.set(
      key,
      {
        ...player,

        yellowCards:
          sanitizeYellowCards(
            player.yellowCards,
          ),

        directRedCards:
          sanitizeDirectRedCards(
            player.directRedCards,
          ),
      },
    );

    return;
  }

  playersByMatchAndPlayer.set(
    key,
    {
      ...existing,

      playerName:
        player.playerName ||
        existing.playerName,

      teamId:
        player.teamId ||
        existing.teamId,

      teamName:
        player.teamName ||
        existing.teamName,

      yellowCards: Math.min(
        2,
        Math.max(
          existing.yellowCards,
          sanitizeYellowCards(
            player.yellowCards,
          ),
        ),
      ),

      directRedCards: Math.max(
        existing.directRedCards,
        sanitizeDirectRedCards(
          player.directRedCards,
        ),
      ),
    },
  );
}

function isPublishedReport(
  report: PublishedMatchReportForDiscipline,
): boolean {
  if (report.isPublished === true) {
    return true;
  }

  const normalizedStatus =
    String(report.status ?? "")
      .trim()
      .toLowerCase();

  return [
    "published",
    "completed",
    "final",
  ].includes(normalizedStatus);
}

function normalizeEventType(
  value: string,
): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");
}

function sanitizeYellowCards(
  value: unknown,
): number {
  const numericValue =
    Number(value);

  if (
    !Number.isFinite(numericValue) ||
    numericValue <= 0
  ) {
    return 0;
  }

  return Math.min(
    2,
    Math.floor(numericValue),
  );
}

function sanitizeDirectRedCards(
  value: unknown,
): number {
  const numericValue =
    Number(value);

  if (
    !Number.isFinite(numericValue) ||
    numericValue <= 0
  ) {
    return 0;
  }

  return 1;
}

function createPlayerKey({
  sourceMatchId,
  playerId,
}: {
  sourceMatchId: string;
  playerId: string;
}): string {
  return `${sourceMatchId}::${playerId}`;
}