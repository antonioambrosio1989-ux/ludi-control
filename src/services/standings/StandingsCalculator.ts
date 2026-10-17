import type {
  Match,
} from "@/src/types/Match";

import type {
  CloudMatchReport,
} from "@/src/services/match/FirebaseMatchReportRepository";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

export type StandingRow = {
  teamId: string;

  played: number;
  won: number;
  drawn: number;
  lost: number;

  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;

  points: number;
};

export type CalculateStandingsOptions = {
  competitionId?:
    string;

  teamIds?:
    Array<
      string | number
    >;
};

type StandingMatchResult = {
  homeTeamId:
    string;

  awayTeamId:
    string;

  homeScore:
    number;

  awayScore:
    number;
};

/*
 * ============================================================
 * EMPTY STANDING
 * ============================================================
 */

function createEmptyStanding(
  teamId:
    string,
): StandingRow {
  return {
    teamId,

    played:
      0,

    won:
      0,

    drawn:
      0,

    lost:
      0,

    goalsFor:
      0,

    goalsAgainst:
      0,

    goalDifference:
      0,

    points:
      0,
  };
}

/*
 * ============================================================
 * GET OR CREATE
 * ============================================================
 */

function getOrCreateStanding(
  standings:
    Map<
      string,
      StandingRow
    >,

  teamId:
    string | number,
): StandingRow {
  const normalizedTeamId =
    String(
      teamId,
    );

  const existing =
    standings.get(
      normalizedTeamId,
    );

  if (
    existing
  ) {
    return existing;
  }

  const created =
    createEmptyStanding(
      normalizedTeamId,
    );

  standings.set(
    normalizedTeamId,
    created,
  );

  return created;
}

/*
 * ============================================================
 * GROUP BY METRIC
 * ============================================================
 */

function groupByDescendingMetric(
  rows:
    StandingRow[],

  getMetric:
    (
      row:
        StandingRow,
    ) => number,
): StandingRow[][] {
  const sorted =
    [
      ...rows,
    ].sort(
      (
        first,
        second,
      ) => {
        const difference =
          getMetric(
            second,
          ) -
          getMetric(
            first,
          );

        if (
          difference !==
          0
        ) {
          return difference;
        }

        return first.teamId.localeCompare(
          second.teamId,
        );
      },
    );

  const groups:
    StandingRow[][] =
    [];

  for (
    const row
    of sorted
  ) {
    const lastGroup =
      groups[
        groups.length -
          1
      ];

    if (
      !lastGroup
    ) {
      groups.push(
        [
          row,
        ],
      );

      continue;
    }

    const referenceRow =
      lastGroup[0];

    if (
      getMetric(
        referenceRow,
      ) ===
      getMetric(
        row,
      )
    ) {
      lastGroup.push(
        row,
      );

      continue;
    }

    groups.push(
      [
        row,
      ],
    );
  }

  return groups;
}

/*
 * ============================================================
 * HEAD TO HEAD
 * ============================================================
 *
 * Per "scontro diretto" utilizziamo i punti ottenuti nelle
 * sole partite disputate tra le squadre ancora a pari merito.
 *
 * 3 = vittoria
 * 1 = pareggio
 * 0 = sconfitta
 *
 * Con più squadre a pari merito si crea quindi una
 * mini-classifica limitata ai loro scontri diretti.
 * ============================================================
 */

function calculateHeadToHeadPoints(
  rows:
    StandingRow[],

  results:
    StandingMatchResult[],
): Map<
  string,
  number
> {
  const teamIds =
    new Set(
      rows.map(
        (
          row,
        ) =>
          row.teamId,
      ),
    );

  const points =
    new Map<
      string,
      number
    >();

  for (
    const teamId
    of teamIds
  ) {
    points.set(
      teamId,
      0,
    );
  }

  for (
    const result
    of results
  ) {
    if (
      !teamIds.has(
        result.homeTeamId,
      ) ||
      !teamIds.has(
        result.awayTeamId,
      )
    ) {
      continue;
    }

    if (
      result.homeScore >
      result.awayScore
    ) {
      points.set(
        result.homeTeamId,
        (
          points.get(
            result.homeTeamId,
          ) ??
          0
        ) +
          3,
      );

      continue;
    }

    if (
      result.awayScore >
      result.homeScore
    ) {
      points.set(
        result.awayTeamId,
        (
          points.get(
            result.awayTeamId,
          ) ??
          0
        ) +
          3,
      );

      continue;
    }

    points.set(
      result.homeTeamId,
      (
        points.get(
          result.homeTeamId,
        ) ??
        0
      ) +
        1,
    );

    points.set(
      result.awayTeamId,
      (
        points.get(
          result.awayTeamId,
        ) ??
        0
      ) +
        1,
    );
  }

  return points;
}

/*
 * ============================================================
 * HEAD TO HEAD GROUPS
 * ============================================================
 */

function groupByHeadToHead(
  rows:
    StandingRow[],

  results:
    StandingMatchResult[],
): StandingRow[][] {
  if (
    rows.length <=
    1
  ) {
    return [
      rows,
    ];
  }

  const points =
    calculateHeadToHeadPoints(
      rows,
      results,
    );

  return groupByDescendingMetric(
    rows,

    (
      row,
    ) =>
      points.get(
        row.teamId,
      ) ??
      0,
  );
}

/*
 * ============================================================
 * FINAL FALLBACK
 * ============================================================
 */

function sortByGoalsForAndTeamId(
  rows:
    StandingRow[],
): StandingRow[] {
  return groupByDescendingMetric(
    rows,

    (
      row,
    ) =>
      row.goalsFor,
  ).flatMap(
    (
      group,
    ) =>
      [
        ...group,
      ].sort(
        (
          first,
          second,
        ) =>
          first.teamId.localeCompare(
            second.teamId,
          ),
      ),
  );
}

/*
 * ============================================================
 * TUTTE LE COMPETIZIONI
 * ============================================================
 *
 * 1. Punti
 * 2. Differenza reti
 * 3. Scontri diretti
 * 4. Gol fatti
 * ============================================================
 */

function sortGoalDifferenceFirst(
  rows:
    StandingRow[],

  results:
    StandingMatchResult[],
): StandingRow[] {
  return groupByDescendingMetric(
    rows,

    (
      row,
    ) =>
      row.goalDifference,
  ).flatMap(
    (
      goalDifferenceGroup,
    ) =>
      groupByHeadToHead(
        goalDifferenceGroup,
        results,
      ).flatMap(
        (
          headToHeadGroup,
        ) =>
          sortByGoalsForAndTeamId(
            headToHeadGroup,
          ),
      ),
  );
}

/*
 * ============================================================
 * SORT STANDINGS
 * ============================================================
 */

function sortStandings(
  rows: StandingRow[],
  results: StandingMatchResult[],
): StandingRow[] {
  // Regola uniforme per tutte le competizioni:
  // 1. Punti; 2. Differenza reti; 3. Scontri diretti; 4. Gol fatti;
  // 5. ID squadra (ordinamento stabile).
  return groupByDescendingMetric(rows, (row) => row.points).flatMap(
    (pointsGroup) => sortGoalDifferenceFirst(pointsGroup, results),
  );
}

/*
 * ============================================================
 * CALCULATE STANDINGS
 * ============================================================
 */

export function calculateStandings(
  matches:
    Match[],

  reports:
    CloudMatchReport[],

  options:
    CalculateStandingsOptions =
      {},
): StandingRow[] {
  const standings =
    new Map<
      string,
      StandingRow
    >();

  /*
   * ==========================================================
   * SQUADRE ISCRITTE
   * ==========================================================
   *
   * Permette di mostrare anche squadre con:
   *
   * G 0
   * PT 0
   *
   * senza aspettare il primo tabellino pubblicato.
   * ==========================================================
   */

  for (
    const teamId
    of options.teamIds ??
      []
  ) {
    getOrCreateStanding(
      standings,
      teamId,
    );
  }

  /*
   * ==========================================================
   * REPORT PUBBLICATI
   * ==========================================================
   */

  const publishedReportsByMatchId =
    new Map<
      string,
      CloudMatchReport
    >();

  for (
    const report
    of reports
  ) {
    if (
      report.status !==
      "published"
    ) {
      continue;
    }

    publishedReportsByMatchId.set(
      String(
        report.matchId,
      ),

      report,
    );
  }

  /*
   * Risultati utilizzati anche per gli
   * scontri diretti.
   */
  const results:
    StandingMatchResult[] =
    [];

  /*
   * ==========================================================
   * PARTITE
   * ==========================================================
   */

  for (
    const match
    of matches
  ) {
    if (
  (
    match.matchType ??
    "regularSeason"
  ) !==
  "regularSeason"
) {
  continue;
}
    const report =
      publishedReportsByMatchId.get(
        String(
          match.id,
        ),
      );

    /*
     * ========================================================
     * SORGENTE RISULTATO
     * ========================================================
     *
     * Priorità assoluta al tabellino pubblicato.
     * Se il tabellino non esiste ancora:
     *
     * - live     -> risultato provvisorio salvato sul match
     * - finished -> risultato definitivo in attesa di report
     *
     * In questo modo lo stesso match viene conteggiato una sola
     * volta e, quando arriva il report pubblicato, i valori del
     * report sostituiscono automaticamente quelli del lifecycle.
     * ========================================================
     */

    let homeScore:
      number;

    let awayScore:
      number;

    if (
      report &&
      (
        match.status ===
          "played" ||
        match.status ===
          "walkover" ||
        match.status ===
          "finished"
      )
    ) {
      homeScore =
        Number(
          report.data.homeScore,
        );

      awayScore =
        Number(
          report.data.awayScore,
        );
    } else if (
      !report &&
      (
        match.status ===
          "live" ||
        match.status ===
          "finished"
      )
    ) {
      /*
       * Una gara LIVE appena iniziata può non avere ancora
       * homeScore / awayScore persistiti. In quel caso lo 0-0
       * è il risultato provvisorio corretto.
       */
      homeScore =
        typeof match.homeScore ===
        "number"
          ? match.homeScore
          : match.status ===
              "live"
            ? 0
            : Number.NaN;

      awayScore =
        typeof match.awayScore ===
        "number"
          ? match.awayScore
          : match.status ===
              "live"
            ? 0
            : Number.NaN;
    } else {
      continue;
    }

    if (
      !Number.isFinite(
        homeScore,
      ) ||
      !Number.isFinite(
        awayScore,
      )
    ) {
      continue;
    }

    const homeTeamId =
      String(
        match.homeTeamId,
      );

    const awayTeamId =
      String(
        match.awayTeamId,
      );

    const homeStanding =
      getOrCreateStanding(
        standings,
        homeTeamId,
      );

    const awayStanding =
      getOrCreateStanding(
        standings,
        awayTeamId,
      );

    results.push({
      homeTeamId,
      awayTeamId,
      homeScore,
      awayScore,
    });

    homeStanding.played +=
      1;

    awayStanding.played +=
      1;

    homeStanding.goalsFor +=
      homeScore;

    homeStanding.goalsAgainst +=
      awayScore;

    awayStanding.goalsFor +=
      awayScore;

    awayStanding.goalsAgainst +=
      homeScore;

    if (
      homeScore >
      awayScore
    ) {
      homeStanding.won +=
        1;

      homeStanding.points +=
        3;

      awayStanding.lost +=
        1;
    } else if (
      awayScore >
      homeScore
    ) {
      awayStanding.won +=
        1;

      awayStanding.points +=
        3;

      homeStanding.lost +=
        1;
    } else {
      homeStanding.drawn +=
        1;

      awayStanding.drawn +=
        1;

      homeStanding.points +=
        1;

      awayStanding.points +=
        1;
    }
  }

  /*
   * ==========================================================
   * DIFFERENZA RETI
   * ==========================================================
   */

  const rows =
    Array.from(
      standings.values(),
    ).map(
      (
        standing,
      ) => ({
        ...standing,

        goalDifference:
          standing.goalsFor -
          standing.goalsAgainst,
      }),
    );

  /*
   * ==========================================================
   * ORDINAMENTO
   * ==========================================================
   */

  return sortStandings(
    rows,
    results,
  );
}