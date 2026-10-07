export type MatchweekAwardRole =
  | "Portiere"
  | "Difensore"
  | "Attaccante";

export type MatchweekAwardPlayer = {
  playerId: string;
  playerName: string;

  teamId: string;
  teamName: string;

  role?: string;
  photoUrl?: string;
  appearances: number;
  goals: number;
  assists: number;
  mvp: number;
  cleanSheets: number;

  voteTotal: number;
  voteCount: number;

  /**
   * Valore assegnato in base
   * all’importanza della partita.
   *
   * Esempio:
   * 1 = partita ordinaria
   * 2 = partita importante
   * 3 = scontro diretto
   * 4 = playoff/finale
   */
  matchImportance?: number;
};

/**
 * Mantenuto per compatibilità con
 * il codice già presente nel Matchweek Hub.
 */

export type MatchweekAwardsInput = {
  players: MatchweekAwardPlayer[];
};

export type MatchweekAwardWinner = {
  id: string;

  label: string;
  icon: string;

  playerId?: string;
  playerName?: string;

  teamId: string;
  teamName: string;

  value: string;
  description: string;
};

export type MatchweekAwardCandidate = {
  playerId: string;
  playerName: string;

  teamId: string;
  teamName: string;

  role: MatchweekAwardRole;

  appearances: number;
  mvp: number;

  averageVote: number;
  matchImportance: number;

  goals: number;
  assists: number;
  cleanSheets: number;

  /**
   * Indica che il giocatore non ha
   * ottenuto l’MVP della propria gara
   * ed è stato usato soltanto per
   * completare un ruolo mancante.
   */
  isRoleFallback: boolean;

  rankingReason: string;
};

export type SuggestedTeamOfTheWeek = {
  goalkeeper?: MatchweekAwardCandidate;

  defenders: MatchweekAwardCandidate[];

  forwards: MatchweekAwardCandidate[];

  players: MatchweekAwardCandidate[];

  isComplete: boolean;

  fallbackPlayerIds: string[];
};

export type MatchweekRoleRankings = {
  goalkeepers: MatchweekAwardCandidate[];
  defenders: MatchweekAwardCandidate[];
  forwards: MatchweekAwardCandidate[];
};

export type MatchweekAwardsResult = {
  /**
   * Campi già utilizzati dal Matchweek Hub.
   */
  topScorer?: MatchweekAwardWinner;
  topAssist?: MatchweekAwardWinner;
  bestGoalkeeper?: MatchweekAwardWinner;

  /**
   * Nuovo sistema di suggerimento.
   */
  suggestedMvp?: MatchweekAwardCandidate;

  suggestedTeamOfTheWeek:
    SuggestedTeamOfTheWeek;

  rankingsByRole:
    MatchweekRoleRankings;
};

export class MatchweekAwardsEngine {
  static generate({
    players,
  }: MatchweekAwardsInput): MatchweekAwardsResult {
    const rankedPlayers =
      buildRankedCandidates(players);

    const rankingsByRole =
      buildRoleRankings(
        rankedPlayers,
      );

    const suggestedMvp =
      buildSuggestedMvp(
        rankedPlayers,
      );

    const suggestedTeamOfTheWeek =
      buildSuggestedTeamOfTheWeek(
        rankingsByRole,
      );

    return {
      topScorer:
        buildTopScorer(players),

      topAssist:
        buildTopAssist(players),

      bestGoalkeeper:
        buildBestGoalkeeper(
          rankingsByRole
            .goalkeepers,
        ),

      suggestedMvp,

      suggestedTeamOfTheWeek,

      rankingsByRole,
    };
  }
}

function buildRankedCandidates(
  players: MatchweekAwardPlayer[],
): MatchweekAwardCandidate[] {
  return players
    .filter(
      (player) =>
        player.appearances > 0,
    )
    .map(mapPlayerToCandidate)
    .filter(
      (
        candidate,
      ): candidate is MatchweekAwardCandidate =>
        candidate !== undefined,
    )
    .sort(compareCandidates);
}

function mapPlayerToCandidate(
  player: MatchweekAwardPlayer,
): MatchweekAwardCandidate | undefined {
  const role =
    normalizeRole(player.role);

  if (!role) {
    return undefined;
  }

  const averageVote =
    player.voteCount > 0
      ? player.voteTotal /
        player.voteCount
      : 0;

  const matchImportance =
    typeof player.matchImportance ===
      "number" &&
    Number.isFinite(
      player.matchImportance,
    )
      ? player.matchImportance
      : 0;

  return {
    playerId:
      player.playerId,

    playerName:
      player.playerName,

    teamId:
      player.teamId,

    teamName:
      player.teamName,

    role,

    appearances:
      player.appearances,

    mvp:
      player.mvp,

    averageVote:
      roundValue(averageVote),

    matchImportance,

    goals:
      player.goals,

    assists:
      player.assists,

    cleanSheets:
      player.cleanSheets,

    isRoleFallback:
      player.mvp === 0,

    rankingReason:
      buildRankingReason({
        ...player,
        averageVote,
        matchImportance,
        role,
      }),
  };
}

/**
 * Ordine definitivo:
 *
 * 1. MVP della partita
 * 2. Voto
 * 3. Importanza dell’incontro
 * 4. Gol oppure clean sheet
 * 5. Assist
 */
function compareCandidates(
  first: MatchweekAwardCandidate,
  second: MatchweekAwardCandidate,
): number {
  if (second.mvp !== first.mvp) {
    return second.mvp - first.mvp;
  }

  if (
    second.averageVote !==
    first.averageVote
  ) {
    return (
      second.averageVote -
      first.averageVote
    );
  }

  if (
    second.matchImportance !==
    first.matchImportance
  ) {
    return (
      second.matchImportance -
      first.matchImportance
    );
  }

  const firstRoleValue =
    getRolePerformanceValue(first);

  const secondRoleValue =
    getRolePerformanceValue(second);

  if (
    secondRoleValue !==
    firstRoleValue
  ) {
    return (
      secondRoleValue -
      firstRoleValue
    );
  }

  if (
    second.assists !==
    first.assists
  ) {
    return (
      second.assists -
      first.assists
    );
  }

  if (
    second.goals !==
    first.goals
  ) {
    return (
      second.goals -
      first.goals
    );
  }

  return first.playerName.localeCompare(
    second.playerName,
    "it",
  );
}

function getRolePerformanceValue(
  player: MatchweekAwardCandidate,
): number {
  if (
    player.role === "Portiere"
  ) {
    return player.cleanSheets;
  }

  return player.goals;
}

function buildSuggestedMvp(
  rankedPlayers:
    MatchweekAwardCandidate[],
): MatchweekAwardCandidate | undefined {
  const matchMvps =
    rankedPlayers.filter(
      (player) =>
        player.mvp > 0,
    );

  /**
   * L’MVP of the Week viene scelto
   * prioritariamente tra gli MVP
   * delle singole partite.
   */
  if (matchMvps.length > 0) {
    return matchMvps[0];
  }

  /**
   * Protezione nel caso in cui nessun
   * tabellino abbia ancora un MVP.
   */
  return rankedPlayers[0];
}

function buildRoleRankings(
  rankedPlayers:
    MatchweekAwardCandidate[],
): MatchweekRoleRankings {
  return {
    goalkeepers:
      rankedPlayers.filter(
        (player) =>
          player.role ===
          "Portiere",
      ),

    defenders:
      rankedPlayers.filter(
        (player) =>
          player.role ===
          "Difensore",
      ),

    forwards:
      rankedPlayers.filter(
        (player) =>
          player.role ===
          "Attaccante",
      ),
  };
}

function buildSuggestedTeamOfTheWeek(
  rankings:
    MatchweekRoleRankings,
): SuggestedTeamOfTheWeek {
  const goalkeeper =
    selectPlayersForRole(
      rankings.goalkeepers,
      1,
    )[0];

  const defenders =
    selectPlayersForRole(
      rankings.defenders,
      2,
    );

  const forwards =
    selectPlayersForRole(
      rankings.forwards,
      2,
    );

  const players = [
    ...(goalkeeper
      ? [goalkeeper]
      : []),

    ...defenders,
    ...forwards,
  ];

  return {
    goalkeeper,
    defenders,
    forwards,
    players,

    isComplete:
      Boolean(goalkeeper) &&
      defenders.length === 2 &&
      forwards.length === 2,

    fallbackPlayerIds:
      players
        .filter(
          (player) =>
            player.isRoleFallback,
        )
        .map(
          (player) =>
            player.playerId,
        ),
  };
}

function selectPlayersForRole(
  ranking:
    MatchweekAwardCandidate[],
  requiredPlayers: number,
): MatchweekAwardCandidate[] {
  const matchMvps =
    ranking.filter(
      (player) =>
        player.mvp > 0,
    );

  const nonMvps =
    ranking.filter(
      (player) =>
        player.mvp === 0,
    );

  const selected =
    matchMvps.slice(
      0,
      requiredPlayers,
    );

  if (
    selected.length <
    requiredPlayers
  ) {
    const missingPlayers =
      requiredPlayers -
      selected.length;

    selected.push(
      ...nonMvps
        .slice(
          0,
          missingPlayers,
        )
        .map((player) => ({
          ...player,
          isRoleFallback: true,
        })),
    );
  }

  return selected;
}
function buildTopScorer(
  players: MatchweekAwardPlayer[],
): MatchweekAwardWinner | undefined {
  const winner = [...players]
    .filter(
      (player) =>
        player.appearances > 0 &&
        player.goals > 0,
    )
    .sort((first, second) => {
      if (
        second.goals !==
        first.goals
      ) {
        return (
          second.goals -
          first.goals
        );
      }

      if (
        second.mvp !==
        first.mvp
      ) {
        return (
          second.mvp -
          first.mvp
        );
      }

      return getAverageVote(
        second,
      ) - getAverageVote(first);
    })[0];

  if (!winner) {
    return undefined;
  }

  return {
    id: "top-scorer",

    label:
      "Bomber della giornata",

    icon: "⚽",

    playerId:
      winner.playerId,

    playerName:
      winner.playerName,

    teamId:
      winner.teamId,

    teamName:
      winner.teamName,

    value:
      `${winner.goals} gol`,

    description:
      `Miglior marcatore della giornata per ${winner.teamName}.`,
  };
}

function buildTopAssist(
  players: MatchweekAwardPlayer[],
): MatchweekAwardWinner | undefined {
  const winner = [...players]
    .filter(
      (player) =>
        player.appearances > 0 &&
        player.assists > 0,
    )
    .sort((first, second) => {
      if (
        second.assists !==
        first.assists
      ) {
        return (
          second.assists -
          first.assists
        );
      }

      if (
        second.mvp !==
        first.mvp
      ) {
        return (
          second.mvp -
          first.mvp
        );
      }

      return getAverageVote(
        second,
      ) - getAverageVote(first);
    })[0];

  if (!winner) {
    return undefined;
  }

  return {
    id: "top-assist",

    label:
      "Assistman della giornata",

    icon: "🅰️",

    playerId:
      winner.playerId,

    playerName:
      winner.playerName,

    teamId:
      winner.teamId,

    teamName:
      winner.teamName,

    value:
      `${winner.assists} assist`,

    description:
      `Miglior assistman della giornata per ${winner.teamName}.`,
  };
}

function buildBestGoalkeeper(
  goalkeepers:
    MatchweekAwardCandidate[],
): MatchweekAwardWinner | undefined {
  const winner =
    goalkeepers[0];

  if (!winner) {
    return undefined;
  }

  return {
    id: "best-goalkeeper",

    label:
      "Miglior portiere",

    icon: "🧤",

    playerId:
      winner.playerId,

    playerName:
      winner.playerName,

    teamId:
      winner.teamId,

    teamName:
      winner.teamName,

    value:
      winner.cleanSheets > 0
        ? `${winner.cleanSheets} clean sheet`
        : winner.averageVote > 0
          ? `Voto ${formatVote(
              winner.averageVote,
            )}`
          : "Miglior portiere",

    description:
      buildRankingReason(winner, false),
  };
}

function buildRankingReason({
  mvp,
  averageVote,
  matchImportance,
  goals,
  assists,
  cleanSheets,
  role,
  teamName,
}: Pick<MatchweekAwardPlayer, "mvp" | "goals" | "assists" | "cleanSheets" | "teamName"> & {
  averageVote: number;
  matchImportance: number;
  role: MatchweekAwardRole;
}, includeMatchContext = true): string {
  const details: string[] = [];

  if (mvp > 0) {
    details.push(
      mvp === 1
        ? "MVP della partita"
        : `${mvp} riconoscimenti MVP`,
    );
  }

  if (averageVote > 0) {
    details.push(
      `voto ${formatVote(
        averageVote,
      )}`,
    );
  }

  if (includeMatchContext && matchImportance > 0) {
    details.push(
      `importanza incontro ${matchImportance}`,
    );
  }

  if (
    role === "Portiere" &&
    cleanSheets > 0
  ) {
    details.push(
      cleanSheets === 1
        ? "clean sheet"
        : `${cleanSheets} clean sheet`,
    );
  }

  if (
    role !== "Portiere" &&
    goals > 0
  ) {
    details.push(
      `${goals} gol`,
    );
  }

  if (assists > 0) {
    details.push(
      `${assists} assist`,
    );
  }

  if (details.length === 0) {
    return includeMatchContext ? `Prestazione positiva con ${teamName}.` : "Prestazione positiva.";
  }

  const description = details.join(" · ");
  return includeMatchContext ? `${description} con ${teamName}.` : description;
}

function normalizeRole(
  role?: string,
): MatchweekAwardRole | undefined {
  const normalizedRole =
    role
      ?.trim()
      .toLowerCase();

  if (
    normalizedRole ===
      "portiere" ||
    normalizedRole ===
      "goalkeeper" ||
    normalizedRole === "por"
  ) {
    return "Portiere";
  }

  if (
    normalizedRole ===
      "difensore" ||
    normalizedRole ===
      "defender" ||
    normalizedRole === "dif"
  ) {
    return "Difensore";
  }

  if (
    normalizedRole ===
      "attaccante" ||
    normalizedRole ===
      "forward" ||
    normalizedRole === "att"
  ) {
    return "Attaccante";
  }

  return undefined;
}

function getAverageVote(
  player: MatchweekAwardPlayer,
): number {
  if (player.voteCount <= 0) {
    return 0;
  }

  return (
    player.voteTotal /
    player.voteCount
  );
}

function formatVote(
  value: number,
): string {
  return new Intl.NumberFormat(
    "it-IT",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    },
  ).format(value);
}

function roundValue(
  value: number,
): number {
  return (
    Math.round(value * 100) /
    100
  );
}