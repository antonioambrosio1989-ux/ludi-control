import type {
  CloudMatchReport,
} from "@/src/services/match/FirebaseMatchReportRepository";

import type {
  AdminActivity,
  AdminTask,
} from "@/src/types/AdminTask";

import type {
  Match,
} from "@/src/types/Match";

import type {
  Team,
} from "@/src/types/Team";

/*
 * ============================================================
 * DASHBOARD DATA
 * ============================================================
 */

export type OrganizerDashboardData = {
  currentMatchweek:
    number;

  totalMatches:
    number;

  publishedMatches:
    number;

  draftMatches:
    number;

  tasks:
    AdminTask[];

  activities:
    AdminActivity[];

  completedTasks:
    number;

  totalTasks:
    number;

  completionPercentage:
    number;
};

/*
 * ============================================================
 * INPUT
 * ============================================================
 */

export type OrganizerDashboardInput = {
  currentMatchweek:
    number;

  matches:
    Match[];

  reports:
    CloudMatchReport[];

  teams:
    Team[];

  isMatchweekComplete:
    boolean;

  now?:
    Date;
};

/*
 * ============================================================
 * MATCH TASKS
 * ============================================================
 */

function getMatchTasks({
  matches,
  reports,
  teams,
  now,
}: {
  matches:
    Match[];

  reports:
    CloudMatchReport[];

  teams:
    Team[];

  now:
    Date;
}): AdminTask[] {
  /*
   * Consideriamo completata una partita
   * solamente quando esiste un Match Report
   * pubblicato.
   */

  const publishedMatchIds =
    new Set(
      reports
        .filter(
          (
            report,
          ) =>
            report.status ===
            "published",
        )
        .map(
          (
            report,
          ) =>
            String(
              report.matchId,
            ),
        ),
    );

  const teamsById =
    new Map(
      teams.map(
        (
          team,
        ) => [
          String(team.id),
          team,
        ],
      ),
    );

  return matches
  .filter(
    (
      match,
    ) =>
      match.status !==
        "postponed" &&
      !publishedMatchIds.has(
        String(
          match.id,
        ),
      ) &&
      isMatchReportAvailable(
        match,
        now,
      ),
  )
    .map(
      (
        match,
      ) => {
        const homeTeam =
          teamsById.get(
            String(
              match.homeTeamId,
            ),
          );

        const awayTeam =
          teamsById.get(
            String(
              match.awayTeamId,
            ),
          );

        const matchName =
          `${getTeamDisplayName(homeTeam, "Casa")} v ${getTeamDisplayName(awayTeam, "Ospite")}`;

        return {
        id:
          `compile-match-${match.id}`,

        title:
          `Compila il Match Report: ${matchName}`,

        description:
          "Il tabellino non è stato ancora pubblicato.",

        priority:
          "high" as const,

        category:
          "matches" as const,

        dueLabel:
          "Priorità alta",

        actionLabel:
          "Compila",

        actionUrl:
          `/admin/partite/${match.id}`,

        completed:
          false,
        };
      },
    );
}

function isMatchReportAvailable(
  match: Match,
  now: Date,
): boolean {
  const kickoff =
    getMatchKickoffDate(
      match.date,
      match.time,
    );

  if (!kickoff) {
    return false;
  }

  const oneHourAfterKickoff =
    kickoff.getTime() +
    60 * 60 * 1000;

  return (
    now.getTime() >=
    oneHourAfterKickoff
  );
}

function getMatchKickoffDate(
  date: string,
  time: string,
): Date | null {
  const normalizedDate =
    date.trim();

  const normalizedTime =
    time.trim() || "00:00";

  if (!normalizedDate) {
    return null;
  }

  const italianDateMatch =
    normalizedDate.match(
      /^(\d{2})\/(\d{2})\/(\d{4})$/,
    );

  const isoDate =
    italianDateMatch
      ? `${italianDateMatch[3]}-${italianDateMatch[2]}-${italianDateMatch[1]}`
      : normalizedDate;

  const [hours = "00", minutes = "00"] =
    normalizedTime.split(":");

  const kickoff =
    new Date(
      `${isoDate}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00`,
    );

  return Number.isNaN(
    kickoff.getTime(),
  )
    ? null
    : kickoff;
}

function getTeamDisplayName(
  team: Team | undefined,
  fallback: string,
): string {
  return (
    team?.aliasName?.trim() ||
    team?.shortName?.trim() ||
    team?.name?.trim() ||
    fallback
  );
}

/*
 * ============================================================
 * MATCHWEEK HUB TASKS
 * ============================================================
 */

function getMatchweekHubTasks({
  isMatchweekComplete,
}: {
  isMatchweekComplete:
    boolean;
}): AdminTask[] {
  /*
   * Attualmente non esistono task automatici
   * aggiuntivi del Matchweek Hub.
   *
   * Manteniamo questo punto di estensione
   * per eventuali attività future.
   */

  if (
    !isMatchweekComplete
  ) {
    return [];
  }

  return [];
}

/*
 * ============================================================
 * ADMIN ACTIVITIES
 * ============================================================
 */

function getAdminActivities():
  AdminActivity[] {
  /*
   * Le attività amministrative non vengono
   * recuperate da dati mock.
   *
   * Resteranno vuote finché non verrà
   * aggiunta una collection Firestore
   * dedicata agli audit log.
   */

  return [];
}

/*
 * ============================================================
 * ORGANIZER ENGINE
 * ============================================================
 */

export const OrganizerEngine = {
  getDashboardData({
    currentMatchweek,
    matches,
    reports,
    teams,
    isMatchweekComplete,
    now = new Date(),
  }: OrganizerDashboardInput):
    OrganizerDashboardData {
    /*
     * ========================================================
     * PARTITE MATCHWEEK CORRENTE
     * ========================================================
     */

    const currentMatches =
      matches.filter(
        (
          match,
        ) =>
          Number(
            match.matchweek,
          ) ===
          currentMatchweek,
      );

    const actionableMatches =
  currentMatches.filter(
    (
      match,
    ) =>
      match.status !==
      "postponed",
  );

    const publishedMatchIds =
      new Set(
        reports
          .filter(
            (
              report,
            ) =>
              report.status ===
              "published",
          )
          .map(
            (
              report,
            ) =>
              String(
                report.matchId,
              ),
          ),
      );

    const totalMatches =
      actionableMatches.length;

    const publishedMatches =
      actionableMatches.filter(
        (
          match,
        ) =>
          publishedMatchIds.has(
            String(
              match.id,
            ),
          ),
      ).length;

    const draftMatches =
      Math.max(
        totalMatches -
          publishedMatches,
        0,
      );

    /*
     * ========================================================
     * TASK PARTITE
     * ========================================================
     */

    const matchTasks =
      getMatchTasks({
        matches:
          actionableMatches,

        reports,

        teams,

        now,
      });

    /*
     * ========================================================
     * TASK MATCHWEEK HUB
     * ========================================================
     */

    const matchweekHubTasks =
      getMatchweekHubTasks({
        isMatchweekComplete,
      });

    const tasks = [
      ...matchTasks,
      ...matchweekHubTasks,
    ];

    /*
     * ========================================================
     * ATTIVITÀ
     * ========================================================
     */

    const activities =
      getAdminActivities();

    /*
     * ========================================================
     * COMPLETAMENTO
     * ========================================================
     */

    const completedTasks =
      tasks.filter(
        (
          task,
        ) =>
          task.completed,
      ).length;

    const totalTasks =
      tasks.length;

    const completionPercentage =
      totalTasks ===
      0
        ? 100
        : Math.round(
            (
              completedTasks /
              totalTasks
            ) *
              100,
          );

    return {
      currentMatchweek,

      totalMatches,

      publishedMatches,

      draftMatches,

      tasks,

      activities,

      completedTasks,

      totalTasks,

      completionPercentage,
    };
  },
};
