import type {
  CloudMatchReport,
} from "@/src/services/match/FirebaseMatchReportRepository";

import type {
  Match,
} from "@/src/types/Match";

import type {
  Team,
} from "@/src/types/Team";

import type {
  CloudFinalStageMatchReport,
} from "@/src/services/final-stage/FirebaseFinalStageMatchReportRepository";

import type {
  FinalStageMatch,
} from "@/src/types/FinalStageMatch";

export type FirebasePlayerSeasonStats = {
  appearances: number;
  goals: number;
  assists: number;
  mvp: number;

  averageVote?: number;

  ratingVariation: number;

  yellowCards: number;
  redCards: number;
  directRedCards: number;

  cleanSheets: number;
};

export type FirebasePlayerMatchHistoryItem = {
  matchId: string;

  phase:
    | "regularSeason"
    | "finalStage";

  matchweek?: number;

  /*
   * Timestamp reale della partita.
   * Usato da PlayerActiveAchievementsEngine per ordinare e
   * validare i traguardi temporanei/settimanali.
   */
  playedAtMs: number;

  label: string;

  status:
    | "rated"
    | "sv"
    | "walkover";

  vote?: number;

  goals: number;
  assists: number;

  yellowCards: number;
  redCards: number;
  directRedCards: number;

  /*
   * true solamente quando:
   * - il giocatore è un Portiere
   * - la partita non è a tavolino
   * - la sua squadra non ha subito gol
   */
  cleanSheet: boolean;

  isMvp: boolean;
};

type CalculateInput = {
  playerId: string;

  matches:
    Match[];

  reports:
    CloudMatchReport[];

  finalStageMatches?:
    FinalStageMatch[];

  finalStageReports?:
    CloudFinalStageMatchReport[];

  teams:
    Team[];

  role?:
    string;
};

type CalculateResult = {
  stats:
    FirebasePlayerSeasonStats;

  history:
    FirebasePlayerMatchHistoryItem[];
};

function roundAverage(
  value: number,
): number {
  return (
    Math.round(
      value * 100,
    ) / 100
  );
}

function calculateRatingVariation({
  vote,
  isMvp,
}: {
  vote?: number;
  isMvp: boolean;
}): number {
  const variation =
    isMvp ? 1 : 0;

  if (
    vote === undefined ||
    !Number.isFinite(vote)
  ) {
    return variation;
  }

  if (vote >= 9) {
    return variation + 1;
  }

  if (vote >= 8) {
    return variation + 0.75;
  }

  if (vote >= 7) {
    return variation + 0.5;
  }

  if (vote === 6.5) {
    return variation + 0.25;
  }

  if (vote === 5.5) {
    return variation - 0.25;
  }

  if (vote === 5) {
    return variation - 0.5;
  }

  if (vote === 4.5) {
    return variation - 0.75;
  }

  if (vote <= 4) {
    return variation - 1;
  }

  return variation;
}

function getMatchTimestamp(
  match:
    | Match
    | FinalStageMatch,
): number {
  const value =
    Date.parse(
      `${match.date}T${match.time || "00:00"}`,
    );

  return Number.isFinite(
    value,
  )
    ? value
    : 0;
}

export function calculateFirebasePlayerStats({
  playerId,
  matches,
  reports,
  finalStageMatches = [],
  finalStageReports = [],
  teams,
  role,
}: CalculateInput): CalculateResult {
  const normalizedPlayerId =
    String(
      playerId,
    );

  const matchesById =
    new Map(
      matches.map(
        (match) => [
          String(
            match.id,
          ),
          match,
        ],
      ),
    );

  const finalStageMatchesById =
  new Map(
    finalStageMatches.map(
      (
        match,
      ) => [
        String(
          match.id,
        ),
        match,
      ],
    ),
  );

  const teamsById =
    new Map(
      teams.map(
        (team) => [
          String(
            team.id,
          ),
          team,
        ],
      ),
    );

  let appearances = 0;

  let goals = 0;
  let assists = 0;
  let mvp = 0;

  let ratingVariation = 0;

  let ratingTotal = 0;
  let ratingCount = 0;

  let yellowCards = 0;
  let redCards = 0;
  let directRedCards = 0;

  let cleanSheets = 0;

  const history: Array<
    FirebasePlayerMatchHistoryItem & {
      sortTimestamp: number;
    }
  > = [];

  const reportEntries = [
  ...reports.map(
    (
      report,
    ) => ({
      report,

      match:
        matchesById.get(
          String(
            report.matchId,
          ),
        ),

      phase:
        "regularSeason" as const,
    }),
  ),

  ...finalStageReports.map(
    (
      report,
    ) => ({
      report,

      match:
        finalStageMatchesById.get(
          String(
            report.matchId,
          ),
        ),

      phase:
        "finalStage" as const,
    }),
  ),
];

  for (
  const entry of
    reportEntries
) {
  const {
    report,
    match,
    phase,
  } =
    entry;
    if (
      report.status !==
      "published"
    ) {
      continue;
    }

    if (!match) {
      continue;
    }

    const data =
      report.data;

    const homePresent =
      data.homePresentPlayerIds
        .map(
          String,
        )
        .includes(
          normalizedPlayerId,
        );

    const awayPresent =
      data.awayPresentPlayerIds
        .map(
          String,
        )
        .includes(
          normalizedPlayerId,
        );

    const isPresent =
      homePresent ||
      awayPresent;

    if (!isPresent) {
      continue;
    }

    appearances += 1;

    const homeTeamId =
      String(
        match.homeTeamId,
      );

    const awayTeamId =
      String(
        match.awayTeamId,
      );

    const homeTeamName =
      teamsById.get(
        homeTeamId,
      )?.name ??
      "Squadra di casa";

    const awayTeamName =
      teamsById.get(
        awayTeamId,
      )?.name ??
      "Squadra ospite";

    const isWalkover =
      data.status ===
      "walkover";

    /*
     * Vittoria a tavolino:
     *
     * assegna solamente la presenza.
     *
     * Non assegna:
     * - voto
     * - gol
     * - assist
     * - MVP
     * - cartellini
     * - clean sheet
     * - variazione rating
     */
    if (isWalkover) {
      history.push({
  matchId:
    String(
      match.id,
    ),

  phase,

  ...(
    phase ===
      "regularSeason" &&
          "matchweek" in
          match
          ? {
            matchweek:
            match.matchweek,
          }
      : {}
  ),

  playedAtMs:
    getMatchTimestamp(
      match,
    ),

  label:
          `${homeTeamName} ${data.homeScore}-${data.awayScore} ${awayTeamName}`,

        status:
          "walkover",

        goals: 0,
        assists: 0,

        yellowCards: 0,
        redCards: 0,
        directRedCards: 0,

        cleanSheet:
          false,

        isMvp:
          false,

        sortTimestamp:
          getMatchTimestamp(
            match,
          ),
      });

      continue;
    }

    const playerGoals =
      data.goals.filter(
        (goal) =>
          goal.type !==
            "ownGoal" &&
          String(
            goal.scorerPlayerId,
          ) ===
            normalizedPlayerId,
      ).length;

    /*
     * La classifica Assist usa il campo `performance.assists`
     * salvato nel tabellino. Il profilo giocatore deve usare la
     * stessa sorgente, altrimenti può mostrare 0 mentre la classifica
     * mostra correttamente l'assist.
     *
     * Manteniamo il conteggio dagli eventi-gol solo come fallback
     * per eventuali vecchi tabellini che non abbiano ancora
     * `performance.assists`.
     */
    const performance =
      Object.values(
        data.performances,
      ).find(
        (
          currentPerformance,
        ) =>
          String(
            currentPerformance.playerId,
          ) ===
          normalizedPlayerId,
      );

    const performanceAssists =
      Number(
        performance?.assists ??
          Number.NaN,
      );

    const goalEventAssists =
      data.goals.filter(
        (goal) =>
          goal.type !==
            "ownGoal" &&
          goal.assistPlayerId !==
            undefined &&
          String(
            goal.assistPlayerId,
          ) ===
            normalizedPlayerId,
      ).length;

    const playerAssists =
      Number.isFinite(
        performanceAssists,
      )
        ? Math.max(
            0,
            performanceAssists,
          )
        : goalEventAssists;

    goals +=
      playerGoals;

    assists +=
      playerAssists;

    const isMvp =
      data.mvpPlayerId !==
        undefined &&
      String(
        data.mvpPlayerId,
      ) ===
        normalizedPlayerId;

    if (isMvp) {
      mvp += 1;
    }

    const currentYellowCards =
      performance
        ?.yellowCards ??
      0;

    const currentRedCards =
      performance
        ?.redCards ??
      0;

    const currentDirectRedCards =
      performance
        ?.directRedCards ??
      0;

    yellowCards +=
      currentYellowCards;

    redCards +=
      currentRedCards;

    directRedCards +=
      currentDirectRedCards;

    if (
      performance?.status ===
        "rated" &&
      typeof performance.vote ===
        "number" &&
      Number.isFinite(
        performance.vote,
      )
    ) {
      ratingTotal +=
        performance.vote;

      ratingCount += 1;
    }

    ratingVariation +=
      calculateRatingVariation({
        vote:
          performance?.status ===
          "rated"
            ? performance.vote
            : undefined,

        isMvp,
      });

    /*
     * Clean sheet della singola partita.
     *
     * Viene conteggiato soltanto
     * per i portieri.
     */
    const currentCleanSheet =
      role === "Portiere" &&
      (
        homePresent
          ? data.awayScore ===
            0
          : data.homeScore ===
            0
      );

    if (
      currentCleanSheet
    ) {
      cleanSheets += 1;
    }

   history.push({
  matchId:
    String(
      match.id,
    ),

  phase,

  ...(
    phase ===
      "regularSeason" &&
          "matchweek" in
          match
          ? {
            matchweek:
            match.matchweek,
          }
      : {}
  ),

  playedAtMs:
    getMatchTimestamp(
      match,
    ),

  label:
        `${homeTeamName} ${data.homeScore}-${data.awayScore} ${awayTeamName}`,

      status:
        performance?.status ===
        "rated"
          ? "rated"
          : "sv",

      vote:
        performance?.status ===
        "rated"
          ? performance.vote
          : undefined,

      goals:
        playerGoals,

      assists:
        playerAssists,

      yellowCards:
        currentYellowCards,

      redCards:
        currentRedCards,

      directRedCards:
        currentDirectRedCards,

      cleanSheet:
        currentCleanSheet,

      isMvp,

      sortTimestamp:
        getMatchTimestamp(
          match,
        ),
    });
  }

  const sortedHistory =
    history
      .sort(
        (
          first,
          second,
        ) => {
          if (
            second.sortTimestamp !==
            first.sortTimestamp
          ) {
            return (
              second.sortTimestamp -
              first.sortTimestamp
            );
          }

          return (
  (
    second.matchweek ??
    0
  ) -
  (
    first.matchweek ??
    0
  )
);
        },
      )
      .map(
        (item) => {
          const {
            sortTimestamp,
            ...cleanItem
          } = item;

          void sortTimestamp;

          return cleanItem;
        },
      );

  return {
    stats: {
      appearances,

      goals,
      assists,
      mvp,

      averageVote:
        ratingCount > 0
          ? roundAverage(
              ratingTotal /
                ratingCount,
            )
          : undefined,

      /*
       * NON arrotondiamo qui.
       *
       * +0.25, +0.50, +0.75 ecc.
       * devono rimanere disponibili
       * fino al calcolo finale
       * del Ludi Rating.
       */
      ratingVariation,

      yellowCards,
      redCards,
      directRedCards,

      cleanSheets,
    },

    history:
      sortedHistory,
  };
}