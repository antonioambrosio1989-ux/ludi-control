"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FirebaseMatchRepository,
} from "@/src/services/match/FirebaseMatchRepository";

import {
  FirebaseMatchReportRepository,
  type CloudMatchReport,
} from "@/src/services/match/FirebaseMatchReportRepository";

import {
  calculateStandings,
  type StandingRow,
} from "@/src/services/standings/StandingsCalculator";

import {
  useSeasonTeams,
} from "@/src/hooks/useSeasonTeams";

import type {
  Match,
} from "@/src/types/Match";

/*
 * ============================================================
 * RESULT
 * ============================================================
 */

type UseStandingsResult = {
  standings:
    StandingRow[];

  matches:
    Match[];

  reports:
    CloudMatchReport[];

  liveTeamIds:
    string[];

  isLoading:
    boolean;

  isMatchDataLoading: boolean;
  matchDataError: string | null;

  error:
    string | null;
};

/*
 * ============================================================
 * HOOK
 * ============================================================
 */

export function useStandings(
  seasonId?: string,

  competitionId?:
    string,
): UseStandingsResult {
  const [
    matches,
    setMatches,
  ] =
    useState<
      Match[]
    >([]);

  const [
    reports,
    setReports,
  ] =
    useState<
      CloudMatchReport[]
    >([]);

  /*
   * Non utilizziamo più un semplice boolean
   * matchesLoaded.
   *
   * Memorizziamo invece PER QUALE stagione
   * abbiamo ricevuto i dati.
   *
   * Questo evita che cambiando competizione
   * i dati della stagione precedente risultino
   * erroneamente già caricati.
   */
  const [
    loadedSeasonId,
    setLoadedSeasonId,
  ] =
    useState<
      string | undefined
    >(
      undefined,
    );

  const [
    loadedReportsSeasonId,
    setLoadedReportsSeasonId,
  ] =
    useState<
      string | undefined
    >(
      undefined,
    );

  const [
    matchesError,
    setMatchesError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [reportsError, setReportsError] = useState<string | null>(null);

  const [
    currentTime,
    setCurrentTime,
  ] =
    useState(
      () =>
        new Date(),
    );

  useEffect(() => {
    const intervalId =
      window.setInterval(
        () => {
          setCurrentTime(
            new Date(),
          );
        },
        60_000,
      );

    return () => {
      window.clearInterval(
        intervalId,
      );
    };
  }, []);

  /*
 * ============================================================
 * SQUADRE DELLA STAGIONE
 * ============================================================
 */

const {
  entries:
    seasonTeams,

  isLoading:
    seasonTeamsLoading,

  error:
    seasonTeamsError,
} =
  useSeasonTeams(
    seasonId,
  );

const seasonTeamIds =
  useMemo(
    () =>
      seasonTeams.map(
        (
          entry,
        ) =>
          entry.teamId,
      ),

    [
      seasonTeams,
    ],
  );
  
  /*
   * ==========================================================
   * PARTITE DELLA STAGIONE
   * ==========================================================
   */

  useEffect(
    () => {
      if (!seasonId) {
        return;
      }

      const unsubscribe =
        FirebaseMatchRepository.subscribePublishedBySeason(
          seasonId,

          (
            nextMatches,
          ) => {
            setMatches(
              nextMatches,
            );

            setLoadedSeasonId(
              seasonId,
            );

            setMatchesError(
              null,
            );
          },

          (
            listenerError,
          ) => {
            console.error(
              "Errore caricamento partite classifica:",
              listenerError,
            );

            setMatchesError(
              listenerError instanceof
                Error
                ? listenerError.message
                : "Impossibile caricare le partite della classifica.",
            );

            /*
             * Segniamo comunque questa stagione
             * come processata per evitare loading
             * infinito in caso di errore.
             */
            setLoadedSeasonId(
              seasonId,
            );
          },
        );

      return unsubscribe;
    },

    [
      seasonId,
    ],
  );

  /*
   * ==========================================================
   * TABELLINI DELLA STAGIONE
   * ==========================================================
   *
   * I report nuovi contengono direttamente seasonId.
   * Dopo il backfill dei documenti legacy possiamo quindi
   * ascoltare esclusivamente la stagione corrente invece
   * dell'intera collection matchReports.
   * ==========================================================
   */

  useEffect(
    () => {
      if (!seasonId) {
        return;
      }

      const unsubscribe =
        FirebaseMatchReportRepository.subscribePublishedBySeason(
          seasonId,

          (
            nextReports,
          ) => {
            setReportsError(null);
            setReports(
              nextReports,
            );

            setLoadedReportsSeasonId(
              seasonId,
            );
          },

          (
            listenerError,
          ) => {
            console.error(
              "Errore caricamento tabellini classifica:",
              listenerError,
            );

            setReportsError(
              "Impossibile caricare i tabellini della classifica.",
            );

            setLoadedReportsSeasonId(
              seasonId,
            );
          },
        );

      return unsubscribe;
    },

    [
      seasonId,
    ],
  );

  /*
   * ==========================================================
   * PARTITE EFFETTIVE
   * ==========================================================
   *
   * Se non esiste una stagione corrente NON restituiamo
   * mai le partite eventualmente rimaste nello state
   * dalla competizione precedente.
   * ==========================================================
   */

  const seasonMatches =
    useMemo(
      () => {
        if (!seasonId) {
          return [];
        }

        /*
         * Finché non abbiamo ricevuto i dati
         * della stagione richiesta non esponiamo
         * quelli della stagione precedente.
         */
        if (
          loadedSeasonId !==
          seasonId
        ) {
          return [];
        }

        return matches;
      },

      [
        matches,
        seasonId,
        loadedSeasonId,
      ],
    );

  /*
   * ==========================================================
   * REPORT DELLA SOLA STAGIONE
   * ==========================================================
   */

  const seasonReports =
    useMemo(
      () => {
        if (!seasonId) {
          return [];
        }

        if (
          loadedReportsSeasonId !==
          seasonId
        ) {
          return [];
        }

        if (
          seasonMatches.length ===
          0
        ) {
          return [];
        }

        const matchIds =
          new Set(
            seasonMatches.map(
              (
                match,
              ) =>
                String(
                  match.id,
                ),
            ),
          );

        return reports.filter(
          (
            report,
          ) =>
            matchIds.has(
              String(
                report.matchId,
              ),
            ),
        );
      },

      [
        seasonId,
        seasonMatches,
        reports,
        loadedReportsSeasonId,
      ],
    );

  /*
   * ==========================================================
   * LIFECYCLE EFFETTIVO PER LA CLASSIFICA
   * ==========================================================
   *
   * La lista `matches` es lasciata invariata per non alterare
   * i consumer esistenti dell'hook.
   *
   * Per il solo calcolo della classifica proiettiamo però come
   * LIVE la prima partita scheduled arrivata a calendario +15,
   * se non esiste già una gara persistita in stato live.
   *
   * In questo modo la Home e la classifica completa mostrano
   * subito lo 0-0 provvisorio anche prima della prima scrittura
   * del manager Admin.
   * ==========================================================
   */

  const lifecycleMatches =
    useMemo(
      () =>
        buildLifecycleMatchesForStandings(
          seasonMatches,
          currentTime,
        ),
      [
        seasonMatches,
        currentTime,
      ],
    );

  const liveTeamIds =
    useMemo(
      () => {
        const ids =
          new Set<
            string
          >();

        for (
          const match of
          lifecycleMatches
        ) {
          if (
            match.status !==
              "live" ||
            (
              match.matchType ??
              "regularSeason"
            ) !==
              "regularSeason"
          ) {
            continue;
          }

          ids.add(
            String(
              match.homeTeamId,
            ),
          );

          ids.add(
            String(
              match.awayTeamId,
            ),
          );
        }

        return Array.from(
          ids,
        );
      },
      [
        lifecycleMatches,
      ],
    );

  /*
   * ==========================================================
   * CLASSIFICA
   * ==========================================================
   */

  const standings =
    useMemo(
      () => {
        if (!seasonId) {
          return [];
        }

        return calculateStandings(
  lifecycleMatches,
  seasonReports,
  {
    competitionId,

    teamIds:
      seasonTeamIds,
  },
);
      },

      [
  lifecycleMatches,
  seasonReports,
  seasonId,
  competitionId,
  seasonTeamIds,
],
    );

  /*
   * ==========================================================
   * LOADING
   * ==========================================================
   */

  const isLoading =
  Boolean(
    seasonId,
  ) &&
  (
    loadedSeasonId !==
      seasonId ||
    loadedReportsSeasonId !==
      seasonId ||
    seasonTeamsLoading
  );

  /*
   * ==========================================================
   * OUTPUT
   * ==========================================================
   */

  return {
    standings,

    matches:
      seasonMatches,

    reports:
      seasonReports,

    liveTeamIds,

    isLoading,
    matchDataError: matchesError || reportsError,
    isMatchDataLoading: Boolean(seasonId) &&
      (loadedSeasonId !== seasonId || loadedReportsSeasonId !== seasonId),

    error:
  matchesError || reportsError ||
  seasonTeamsError,
  };
}

/*
 * ============================================================
 * LIFECYCLE LOCALE CLASSIFICA
 * ============================================================
 */

const LIVE_KICKOFF_DELAY_MINUTES =
  15;

const MATCHDAY_CHANGE_HOUR =
  2;

function buildLifecycleMatchesForStandings(
  matches:
    Match[],
  currentTime:
    Date,
): Match[] {
  const regularSeasonMatches =
    matches.filter(
      (
        match,
      ) =>
        (
          match.matchType ??
          "regularSeason"
        ) ===
        "regularSeason",
    );

  if (
    regularSeasonMatches.some(
      (
        match,
      ) =>
        match.status ===
        "live",
    )
  ) {
    return matches;
  }

  const matchdayDate =
    getMatchdayDateKey(
      currentTime,
    );

  const matchdayMatches =
    regularSeasonMatches
      .filter(
        (
          match,
        ) =>
          match.date ===
          matchdayDate,
      )
      .slice()
      .sort(
        (
          first,
          second,
        ) =>
          first.time.localeCompare(
            second.time,
          ),
      );

  let effectiveLiveMatchId:
    string | null =
      null;

  for (
    const match of
    matchdayMatches
  ) {
    if (
      match.status ===
        "finished" ||
      match.status ===
        "played" ||
      match.status ===
        "walkover" ||
      match.status ===
        "cancelled" ||
      match.status ===
        "postponed"
    ) {
      continue;
    }

    if (
      match.status !==
      "scheduled"
    ) {
      break;
    }

    const scheduledTime =
      createLocalMatchDate(
        match.date,
        match.time,
      );

    if (
      !scheduledTime
    ) {
      break;
    }

    const liveStartsAt =
      new Date(
        scheduledTime.getTime() +
          LIVE_KICKOFF_DELAY_MINUTES *
            60 *
            1000,
      );

    if (
      currentTime >=
      liveStartsAt
    ) {
      effectiveLiveMatchId =
        String(
          match.id,
        );
    }

    /*
     * La prima partita ancora scheduled blocca sempre
     * tutte quelle successive, sia che sia già dovuta
     * sia che manchino ancora minuti al +15.
     */
    break;
  }

  if (
    !effectiveLiveMatchId
  ) {
    return matches;
  }

  return matches.map(
    (
      match,
    ) =>
      String(
        match.id,
      ) ===
      effectiveLiveMatchId
        ? {
            ...match,
            status:
              "live",
            homeScore:
              typeof match.homeScore ===
              "number"
                ? match.homeScore
                : 0,
            awayScore:
              typeof match.awayScore ===
              "number"
                ? match.awayScore
                : 0,
          }
        : match,
  );
}

function createLocalMatchDate(
  matchDate:
    string,
  matchTime:
    string,
): Date | null {
  const [
    yearValue,
    monthValue,
    dayValue,
  ] =
    matchDate.split(
      "-",
    );

  const [
    hourValue,
    minuteValue,
  ] =
    matchTime.split(
      ":",
    );

  const values = [
    Number(
      yearValue,
    ),
    Number(
      monthValue,
    ),
    Number(
      dayValue,
    ),
    Number(
      hourValue,
    ),
    Number(
      minuteValue,
    ),
  ];

  if (
    values.some(
      (
        value,
      ) =>
        !Number.isInteger(
          value,
        ),
    )
  ) {
    return null;
  }

  const [
    year,
    month,
    day,
    hour,
    minute,
  ] =
    values;

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    0,
    0,
  );
}

function getMatchdayDateKey(
  currentTime:
    Date,
): string {
  const effectiveDate =
    new Date(
      currentTime,
    );

  if (
    effectiveDate.getHours() <
    MATCHDAY_CHANGE_HOUR
  ) {
    effectiveDate.setDate(
      effectiveDate.getDate() -
        1,
    );
  }

  const year =
    effectiveDate.getFullYear();

  const month =
    String(
      effectiveDate.getMonth() +
        1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      effectiveDate.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}`;
}
