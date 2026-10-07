import type {
  CloudMatchReport,
} from "@/src/services/match/FirebaseMatchReportRepository";

import {
  calculateStandings,
  type StandingRow,
} from "@/src/services/standings/StandingsCalculator";

import type {
  Match,
} from "@/src/types/Match";

/*
 * ============================================================
 * MOVIMENTO CLASSIFICA
 * ============================================================
 */

export type StandingsMovement =
  | "up"
  | "down"
  | "same";

/*
 * ============================================================
 * BUILD MOVEMENT MAP
 * ============================================================
 *
 * Confronta la classifica corrente con quella precedente
 * all'ultima matchweek che contiene risultati pubblicati.
 *
 * up   = posizione migliorata
 * down = posizione peggiorata
 * same = posizione invariata
 *
 * Alla prima matchweek restituiamo "same", perché non esiste
 * ancora una classifica precedente significativa.
 * ============================================================
 */

export function buildStandingsMovementMap({
  standings,
  matches,
  reports,
  competitionId,
}: {
  standings:
    StandingRow[];

  matches:
    Match[];

  reports:
    CloudMatchReport[];

  competitionId?:
    string;
}): Map<
  string,
  StandingsMovement
> {
  const movements =
    new Map<
      string,
      StandingsMovement
    >();

  /*
   * Tutte le squadre partono come stabili.
   */

  for (
    const standing
    of standings
  ) {
    movements.set(
      String(
        standing.teamId,
      ),
      "same",
    );
  }

  if (
    standings.length ===
    0
  ) {
    return movements;
  }

  /*
   * ==========================================================
   * REPORT PUBBLICATI
   * ==========================================================
   */

  const publishedReports =
    reports.filter(
      (
        report,
      ) =>
        report.status ===
        "published",
    );

  const publishedMatchIds =
    new Set(
      publishedReports.map(
        (
          report,
        ) =>
          String(
            report.matchId,
          ),
      ),
    );

  /*
   * ==========================================================
   * MATCHWEEK CON RISULTATI PUBBLICATI
   * ==========================================================
   */

  const publishedMatchweeks =
    Array.from(
      new Set(
        matches
          .filter(
            (
              match,
            ) =>
              (
                match.matchType ??
                "regularSeason"
              ) ===
                "regularSeason" &&
              publishedMatchIds.has(
                String(
                  match.id,
                ),
              ) &&
              (
                match.status ===
                  "played" ||
                match.status ===
                  "walkover"
              ),
          )
          .map(
            (
              match,
            ) =>
              Number(
                match.matchweek,
              ),
          )
          .filter(
            (
              matchweek,
            ) =>
              Number.isFinite(
                matchweek,
              ),
          ),
      ),
    ).sort(
      (
        first,
        second,
      ) =>
        first -
        second,
    );

  /*
   * Nessuna giornata o soltanto la prima:
   * non esiste un confronto precedente.
   */

  if (
    publishedMatchweeks.length <
    2
  ) {
    return movements;
  }

  const previousMatchweek =
    publishedMatchweeks[
      publishedMatchweeks.length -
        2
    ];

  /*
   * ==========================================================
   * CLASSIFICA ALLA GIORNATA PRECEDENTE
   * ==========================================================
   */

  const previousMatches =
    matches.filter(
      (
        match,
      ) =>
        (
          match.matchType ??
          "regularSeason"
        ) ===
          "regularSeason" &&
        Number(
          match.matchweek,
        ) <=
          previousMatchweek,
    );

  const previousMatchIds =
    new Set(
      previousMatches.map(
        (
          match,
        ) =>
          String(
            match.id,
          ),
      ),
    );

  const previousReports =
    publishedReports.filter(
      (
        report,
      ) =>
        previousMatchIds.has(
          String(
            report.matchId,
          ),
        ),
    );

  /*
   * Manteniamo tutte le squadre presenti
   * nella classifica attuale.
   */

  const teamIds =
    standings.map(
      (
        standing,
      ) =>
        String(
          standing.teamId,
        ),
    );

  const previousStandings =
    calculateStandings(
      previousMatches,
      previousReports,
      {
        competitionId,

        teamIds,
      },
    );

  const previousPositions =
    new Map<
      string,
      number
    >(
      previousStandings.map(
        (
          standing,
          index,
        ) => [
          String(
            standing.teamId,
          ),

          index + 1,
        ],
      ),
    );

  /*
   * ==========================================================
   * CONFRONTO
   * ==========================================================
   */

  standings.forEach(
    (
      standing,
      index,
    ) => {
      const teamId =
        String(
          standing.teamId,
        );

      const currentPosition =
        index + 1;

      const previousPosition =
        previousPositions.get(
          teamId,
        );

      if (
        previousPosition ===
        undefined
      ) {
        movements.set(
          teamId,
          "same",
        );

        return;
      }

      if (
        currentPosition <
        previousPosition
      ) {
        movements.set(
          teamId,
          "up",
        );

        return;
      }

      if (
        currentPosition >
        previousPosition
      ) {
        movements.set(
          teamId,
          "down",
        );

        return;
      }

      movements.set(
        teamId,
        "same",
      );
    },
  );

  return movements;
}