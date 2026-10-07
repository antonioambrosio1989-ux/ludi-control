type MatchInput = {
  id:
    string | number;

  matchweek:
    string | number;

  status:
    string;
};

type ReportInput = {
  matchId:
    string | number;

  status:
    string;
};

/*
 * ============================================================
 * MATCHWEEK COMPLETATE
 * ============================================================
 *
 * Una Matchweek viene considerata completa quando:
 *
 * - contiene almeno una partita;
 *
 * - ogni partita NON rinviata possiede
 *   un Match Report pubblicato;
 *
 * - le partite rinviate vengono considerate
 *   chiuse esclusivamente ai fini dello
 *   sblocco di MATCHWEEK HUB
 * ============================================================
 */

export function buildCompletedMatchweeks({
  matches,
  reports,
}: {
  matches:
    MatchInput[];

  reports:
    ReportInput[];
}): number[] {
  const publishedReportMatchIds =
    new Set(
      reports
        .filter(
          (report) =>
            report.status ===
            "published",
        )
        .map(
          (report) =>
            String(
              report.matchId,
            ),
        ),
    );

  const matchweeks =
    Array.from(
      new Set(
        matches
          .map(
            (match) =>
              Number(
                match.matchweek,
              ),
          )
          .filter(
            Number.isFinite,
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

  return matchweeks.filter(
    (matchweek) => {
      const matchweekMatches =
        matches.filter(
          (match) =>
            Number(
              match.matchweek,
            ) ===
            matchweek,
        );

      if (
        matchweekMatches.length ===
        0
      ) {
        return false;
      }

      return matchweekMatches.every(
        (match) => {
          /*
           * Una partita rinviata
           * non blocca MATCHWEEK HUB.
           */
          if (
            match.status ===
            "postponed"
          ) {
            return true;
          }

          return publishedReportMatchIds.has(
            String(
              match.id,
            ),
          );
        },
      );
    },
  );
}