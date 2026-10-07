"use client"

import Link from "next/link";
import { useMemo } from "react";


import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

import {
  buildCompletedMatchweeks,
} from "@/src/application/ludi-week/buildCompletedMatchweeks";

import { useStandings } from "@/src/hooks/useStandings";
import { useTeams } from "@/src/hooks/useTeams";
import LineupRosterSuggestionsCard from "./LineupRosterSuggestionsCard";
import AdminGamesNotificationsCard from "./AdminGamesNotificationsCard";
import AppShell from "../ui/AppShell";
import { OrganizerEngine } from "@/src/services/organizer/OrganizerEngine";
import type { AdminTask, AdminTaskCategory, AdminTaskPriority, } from "@/src/types/AdminTask";

type QuickActionFeature =
  | "ludiWeek"
  | "ludiTv"
  | "canvaStudio";

type QuickAction = {
  title: string;
  icon: string;
  href: string;
  feature?: QuickActionFeature;

  /*
   * Azione disponibile esclusivamente
   * per una specifica competizione.
   */
  competitionOnly?:
    | "championship";
};

const quickActions: QuickAction[] = [
  {
    title: "Match Report",
    icon: "🆚",
    href: "/admin/partite",
  },
  {
    title: "Ludi Studio",
    icon: "📱",
    href: "/admin/ludi-studio",
  },
  {
    title: "News",
    icon: "📰",
    href: "/admin/news",
  },
  {
   title: "Ludi TV",
   icon: "📺",
   href: "/admin/ludi-tv",
  },
  {
    title: "Calendario",
    icon: "📅",
    href: "/admin/calendario",
  },
  {
    title: "Ludi Week",
    icon: "🏅",
    href: "/admin/ludi-week",
    feature: "ludiWeek",
  },
{
    title: "Comunicati",
    icon: "📄",
    href: "/admin/comunicati",
  },
{
   title: "Video",
   icon: "🎥",
   href: "/admin/video",
},
  {
    title: "Calendario final stage",
    icon: "🗓️",
    href: "/admin/fasi-finali/calendario",
  },
  {
    title: "Rose",
    icon: "👥",
    href: "/admin/rose",
  },
  {
    title: "Rose fasi finali",
    icon: "🔜",
    href: "/admin/fasi-finali/rose",
  },
  {
    title: "Giocatori",
    icon: "👤",
    href: "/admin/giocatori",
  },
{
    title: "Sponsor",
    icon: "🤝",
    href: "/admin/sponsor",
  },
  {
  title: "Games",
  icon: "🎮",
  href: "/admin/games",
},
{
    title: "Regolamento",
    icon: "📖",
    href: "/admin/regolamento",
  },
  {
    title: "Best Of The Month",
    icon: "⭐",
    href: "/admin/best-of-the-month",
},
{
    title: "Stagioni",
    icon: "🏅",
    href: "/admin/stagioni",
  },
  {
    title: "Hall Of Fame",
    icon: "👑",
    href: "/admin/hall-of-fame",
  },
  {
    title: "Albo d'oro",
    icon: "🏆",
    href: "/admin/albo-doro",
  },
  {
    title: "All Times Goalscorers",
    icon: "🎯",
    href: "/admin/all-times-goalscorers",
 },
  {
    title: "FUT Card",
    icon: "🃏",
    href: "/admin/fut-card-editor",
  },
  {
    title: "Utenti",
    icon: "📧",
    href: "/admin/utenti",
  },
  {
    title: "Squadre",
    icon: "🛡️",
    href: "/admin/squadre",
  },
  {
  title: "Chiusura stagione",
  icon: "✅",
  href: "/admin/stagioni/chiusura",
},

];

export default function AdminDashboard() {
  const {
  activeCompetitions,

  selectedCompetition,
  selectedCompetitionId,
  setSelectedCompetitionId,

  currentSeason,

  isLoading:
    competitionLoading,
} =
  useCompetition();

const currentSeasonId =
  currentSeason?.id;

const competitionSwitchItems =
  useMemo(() => {
    const definitions = [
      {
        key: "premier",
        label: "Premier League",
        match: "premier",
      },
      {
        key: "championship",
        label: "Championship",
        match: "championship",
      },
      {
        key: "league-one",
        label: "League One",
        match: "league one",
      },
    ];

    return definitions.map(
      (definition) => {
        const competition =
          activeCompetitions.find(
            (candidate) => {
              const searchableName =
                [
                  candidate.name,
                  candidate.shortName,
                  candidate.id,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();

              return searchableName.includes(
                definition.match,
              );
            },
          );

        return {
          ...definition,
          competition,
        };
      },
    );
  }, [
    activeCompetitions,
  ]);

const visibleQuickActions =
  useMemo(() => {
    const selectedCompetitionSearchable =
      [
        selectedCompetition?.id,
        selectedCompetition?.name,
        selectedCompetition?.shortName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    return quickActions.filter(
      (
        action,
      ) => {
        /*
         * Le azioni vincolate a una competizione
         * vengono mostrate soltanto quando quella
         * competizione è attualmente selezionata.
         */
        if (
          action.competitionOnly &&
          !selectedCompetitionSearchable.includes(
            action.competitionOnly,
          )
        ) {
          return false;
        }

        /*
         * Le feature già esistenti continuano
         * a rispettare la configurazione della
         * competizione selezionata.
         */
        if (
          !action.feature
        ) {
          return true;
        }

        return (
          selectedCompetition
            ?.features[
              action.feature
            ] === true
        );
      },
    );
  }, [
    selectedCompetition,
  ]);

const {
  matches,
  reports,
  isLoading: standingsLoading,
} = useStandings(
  currentSeasonId,
  currentSeason?.competitionId,
);

const {
  teams,
  isLoading: teamsLoading,
} = useTeams();

const currentMatchweek =
  useMemo(() => {
    if (matches.length === 0) {
      return 1;
    }

    const now = new Date();

    const startedMatchweeks =
      matches
        .filter((match) => {
          const kickoff =
            getMatchKickoffDate(
              match.date,
              match.time,
            );

          return (
            kickoff !== null &&
            kickoff.getTime() <=
              now.getTime()
          );
        })
        .map((match) =>
          Number(
            match.matchweek,
          ),
        )
        .filter(
          Number.isFinite,
        );

    if (
      startedMatchweeks.length > 0
    ) {
      return Math.max(
        ...startedMatchweeks,
      );
    }

    const availableMatchweeks =
      matches
        .map((match) =>
          Number(
            match.matchweek,
          ),
        )
        .filter(
          Number.isFinite,
        );

    return (
      Math.min(
        ...availableMatchweeks,
      ) || 1
    );
  }, [matches]);

const completedMatchweeks =
  useMemo(() => {
    return buildCompletedMatchweeks({
      matches,
      reports,
    });
  }, [
    matches,
    reports,
  ]);

const isMatchweekComplete =
  completedMatchweeks.includes(
    currentMatchweek,
  );

const dashboard =
  OrganizerEngine.getDashboardData({
    currentMatchweek,

    matches,

    reports,

    teams,

    isMatchweekComplete,
  });

const isLoading =
  competitionLoading ||
  standingsLoading ||
  teamsLoading;

  if (isLoading) {
    return (
      <AppShell>
        <section className="rounded-[18px] border border-[#06142E]/8 bg-white p-7 text-center">
          <p className="text-sm font-bold text-[#06142E]/45">
            Caricamento dashboard...
          </p>
        </section>
      </AppShell>
    );
  }

  const publicationPercentage =
    dashboard.totalMatches ===
    0
      ? 0
      : Math.round(
          (
            dashboard.publishedMatches /
            dashboard.totalMatches
          ) *
            100,
        );

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#06142E]/35">
              Centro di Controllo
            </p>

            <h1 className="mt-1 text-3xl font-black uppercase tracking-[-0.03em] text-[#06142E] sm:text-4xl">
              Dashboard
            </h1>

            <p className="mt-2 text-sm font-bold capitalize text-[#06142E]/45">
              {getFormattedDate()}
            </p>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-3 xl:w-auto xl:min-w-[560px]">
            {competitionSwitchItems.map(
              (item) => {
                const competition =
                  item.competition;

                const isSelected =
                  Boolean(
                    competition &&
                    competition.id ===
                      selectedCompetitionId,
                  );

                return (
                  <button
                    key={
                      item.key
                    }
                    type="button"
                    disabled={
                      !competition
                    }
                    onClick={() => {
                      if (
                        !competition
                      ) {
                        return;
                      }

                      setSelectedCompetitionId(
                        competition.id,
                      );
                    }}
                    className={[
                      "min-h-12 rounded-[13px] border px-4 py-3 text-center text-[10px] font-black uppercase leading-tight tracking-[0.06em] transition",
                      isSelected
                        ? "border-transparent shadow-[0_8px_20px_rgba(6,20,46,0.10)]"
                        : "border-[#06142E]/10 bg-white text-[#06142E]",
                      !competition
                        ? "cursor-not-allowed opacity-35"
                        : "",
                    ].join(
                      " ",
                    )}
                    style={
                      isSelected &&
                      competition
                        ? {
                            backgroundColor:
                              competition.primaryColor ||
                              "#06142E",
                            color:
                              competition.textColor ||
                              "#FFFFFF",
                          }
                        : undefined
                    }
                  >
                    {
                      item.label
                    }
                  </button>
                );
              },
            )}
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardMetric
            label="Matchweek"
            value={
              dashboard.currentMatchweek
            }
            detail={
              isMatchweekComplete
                ? "Giornata completata"
                : "Giornata in corso"
            }
          />

          <DashboardMetric
            label="Partite pubblicate"
            value={`${dashboard.publishedMatches}/${dashboard.totalMatches}`}
            detail={`${publicationPercentage}% della giornata`}
          />

          <DashboardMetric
            label="Attività"
            value={
              dashboard.tasks.length
            }
            detail={`${dashboard.completedTasks}/${dashboard.totalTasks} completate`}
          />

          <DashboardMetric
            label="Bozze"
            value={
              dashboard.draftMatches
            }
            detail="Partite da completare"
          />
        </section>

        <section className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
          <div className="min-w-0 space-y-6">
            <article className="overflow-hidden rounded-[20px] bg-[#06142E] p-5 text-white sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
                    Avanzamento giornata
                  </p>

                  <div className="mt-2 flex items-end gap-3">
                    <p className="text-5xl font-black">
                      {publicationPercentage}%
                    </p>

                    <p className="pb-1 text-xs font-black uppercase text-white/45">
                      pubblicato
                    </p>
                  </div>
                </div>

                <Link
                  href="/admin/partite"
                  className="inline-flex min-h-11 items-center justify-center rounded-[13px] bg-white px-5 text-xs font-black uppercase text-[#06142E]"
                >
                  Gestisci partite
                </Link>
              </div>

              <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-yellow-300 transition-all"
                  style={{
                    width:
                      `${publicationPercentage}%`,
                  }}
                />
              </div>
            </article>

            <section>
              <div className="mb-3 flex items-end justify-between gap-3">
                <SectionTitle
                  title="Attività operative"
                />

                <span className="text-xs font-black text-[#06142E]/40">
                  {
                    dashboard.tasks.length
                  }{" "}
                  da completare
                </span>
              </div>

              {dashboard.tasks.length >
              0 ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {dashboard.tasks.map(
                    (task) => (
                      <TaskCard
                        key={
                          task.id
                        }
                        task={
                          task
                        }
                      />
                    ),
                  )}
                </div>
              ) : (
                <div className="rounded-[18px] border border-[#06142E]/8 bg-white p-7 text-center">
                  <span
                    aria-hidden
                    className="text-[32px]"
                  >
                    ✅
                  </span>

                  <p className="mt-3 text-lg font-black text-[#06142E]">
                    Tutto completato
                  </p>

                  <p className="mt-1 text-sm font-bold text-[#06142E]/45">
                    Non ci sono attività in sospeso.
                  </p>
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <SectionTitle
                  title="Azioni rapide"
                />

                <Link
                  href="/admin/operativo"
                  className="text-xs font-black uppercase text-[#06142E]/45 hover:text-[#06142E]"
                >
                  Centro operativo →
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {visibleQuickActions.map(
                  (
                    action,
                  ) => (
                    <Link
                      key={
                        action.title
                      }
                      href={
                        action.href
                      }
                      className="group flex min-h-[112px] min-w-0 flex-col justify-between rounded-[17px] border border-[#06142E]/8 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#06142E]/18"
                    >
                      <span
                        aria-hidden
                        className="text-[28px] leading-none"
                      >
                        {
                          action.icon
                        }
                      </span>

                      <span className="mt-4 min-w-0 text-[11px] font-black uppercase leading-tight text-[#06142E]">
                        {
                          action.title
                        }
                      </span>
                    </Link>
                  ),
                )}
              </div>
            </section>
          </div>

          <aside className="min-w-0 space-y-5">
            <LineupRosterSuggestionsCard
              seasonId={
                currentSeasonId
              }
            />

            <AdminGamesNotificationsCard />

            <Link
              href="/admin/operativo"
              className="block rounded-[18px] border border-[#06142E]/10 bg-white p-5 transition hover:border-[#06142E]/20"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#06142E]/35">
                Organizzazione
              </p>

              <h2 className="mt-2 text-xl font-black text-[#06142E]">
                Apri il centro operativo
              </h2>

              <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/45">
                Scadenze, promemoria, priorità e prossime iniziative.
              </p>
            </Link>

            <section className="rounded-[18px] border border-[#06142E]/8 bg-white p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
                    Completamento operativo
                  </p>

                  <p className="mt-2 text-4xl font-black text-[#06142E]">
                    {
                      dashboard.completionPercentage
                    }%
                  </p>
                </div>

                <p className="text-right text-xs font-bold text-[#06142E]/45">
                  {
                    dashboard.completedTasks
                  }{" "}
                  di{" "}
                  {
                    dashboard.totalTasks
                  }
                  <br />
                  attività
                </p>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#06142E]/8">
                <div
                  className="h-full rounded-full bg-[#06142E] transition-all"
                  style={{
                    width:
                      `${dashboard.completionPercentage}%`,
                  }}
                />
              </div>
            </section>
          </aside>
        </section>

        <section className="grid min-w-0 gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-[18px] border border-[#06142E]/8 bg-white p-5">
            <SectionTitle
              title="Stato torneo"
            />

            <div className="mt-4 grid grid-cols-3 gap-2">
              <DashboardStat
                label="Matchweek"
                value={
                  dashboard.currentMatchweek
                }
              />

              <DashboardStat
                label="Pubblicate"
                value={`${dashboard.publishedMatches}/${dashboard.totalMatches}`}
              />

              <DashboardStat
                label="Bozze"
                value={
                  dashboard.draftMatches
                }
              />
            </div>
          </article>

          <article className="rounded-[18px] border border-[#06142E]/8 bg-white p-5">
            <SectionTitle
              title="Attività recenti"
            />

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {dashboard.activities.map(
                (
                  activity,
                ) => (
                  <div
                    key={
                      activity.id
                    }
                    className="flex min-w-0 gap-3 rounded-[14px] bg-[#06142E]/[0.035] p-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#06142E] text-white">
                      ✓
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#06142E]">
                        {
                          activity.title
                        }
                      </p>

                      <p className="mt-1 text-xs font-bold text-[#06142E]/40">
                        {
                          activity.timeLabel
                        }
                      </p>
                    </div>
                  </div>
                ),
              )}
            </div>
          </article>
        </section>
      </div>
    </AppShell>
  );
}

function DashboardMetric({
  label,
  value,
  detail,
}: {
  label:
    string;
  value:
    string | number;
  detail:
    string;
}) {
  return (
    <article className="min-w-0 rounded-[18px] border border-[#06142E]/8 bg-white p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
        {label}
      </p>

      <p className="mt-2 truncate text-3xl font-black text-[#06142E]">
        {value}
      </p>

      <p className="mt-1 truncate text-xs font-bold text-[#06142E]/40">
        {detail}
      </p>
    </article>
  );
}

function TaskCard({ task }: { task: AdminTask }) {
  return (
    <article className="rounded-[13px] bg-white p-4 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[13px] bg-[#06142E]/5">
          <TaskCategoryIcon
            category={task.category}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge
              priority={task.priority}
            />

            {task.dueLabel && (
              <span className="text-[10px] font-black uppercase text-[#06142E]/40">
                {task.dueLabel}
              </span>
            )}
          </div>

          <h3 className="mt-2 text-base font-black text-[#06142E]">
            {task.title}
          </h3>

          {task.description && (
            <p className="mt-1 text-xs font-bold leading-relaxed text-[#06142E]/45">
              {task.description}
            </p>
          )}
        </div>
      </div>

      <Link
        href={task.actionUrl}
        className="mt-4 flex h-11 w-full items-center justify-center rounded-[13px] bg-[#06142E] text-xs font-black uppercase text-white transition-transform active:scale-[0.98]"
      >
        {task.actionLabel}
      </Link>
    </article>
  );
}

function PriorityBadge({
  priority,
}: {
  priority: AdminTaskPriority;
}) {
  const label =
    priority === "high"
      ? "Alta priorità"
      : priority === "medium"
        ? "Priorità media"
        : "Priorità bassa";

  return (
    <span className="rounded-[13px] bg-[#06142E]/5 px-2.5 py-1 text-[9px] font-black uppercase text-[#06142E]/60">
      {label}
    </span>
  );
}

function DashboardStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[13px] bg-[#06142E]/5 px-2 py-4 text-center">
      <p className="text-2xl font-black text-[#06142E]">
        {value}
      </p>

      <p className="mt-1 text-[9px] font-black uppercase text-[#06142E]/45">
        {label}
      </p>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="text-lg font-black uppercase text-[#06142E]">
      {title}
    </h2>
  );
}

function TaskCategoryIcon({
  category,
}: {
  category: AdminTaskCategory;
}) {
  const emojiByCategory: Record<AdminTaskCategory, string> = {
    matches: "🎯",
    news: "📰",
    awards: "🏆",
    polls: "🗳️",
    calendar: "📅",
  };

  return (
    <span aria-hidden="true" className="text-xl leading-none">
      {emojiByCategory[category] ?? "📌"}
    </span>
  );
}

function getFormattedDate() {
  const formatter = new Intl.DateTimeFormat(
    "it-IT",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
    },
  );

  return formatter.format(new Date());
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

  const timeParts =
    normalizedTime.split(":");

  const hours =
    timeParts[0]?.padStart(
      2,
      "0",
    ) ?? "00";

  const minutes =
    timeParts[1]?.padStart(
      2,
      "0",
    ) ?? "00";

  const dateTime =
    new Date(
      `${normalizedDate}T${hours}:${minutes}:00`,
    );

  if (
    Number.isNaN(
      dateTime.getTime(),
    )
  ) {
    return null;
  }

  return dateTime;
}
