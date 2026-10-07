"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AppShell from "@/components/ui/AppShell";
import TeamLogo from "@/components/common/TeamLogo";

import { MATCH_TIMES } from "@/src/constants/matchTimes";

import {
  useSeasonTeams,
} from "@/src/hooks/useSeasonTeams";

import { useMatches } from "@/src/hooks/useMatches";

import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

import { useTeams } from "@/src/hooks/useTeams";

import { FirebaseMatchRepository } from "@/src/services/match/FirebaseMatchRepository";

import {
  FirebaseMatchLifecycleService,
} from "@/src/services/match/FirebaseMatchLifecycleService";

import type { Match } from "@/src/types/Match";

type AdminMatchDisplayStatus =
  | "completed"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled"
  | "waiting"
  | "scheduled";

function formatItalianDate(
  value?: string,
): string {
  if (!value) {
    return "Data da definire";
  }

  const parts =
    value.split("-");

  if (parts.length !== 3) {
    return value;
  }

  const [
    year,
    month,
    day,
  ] = parts;

  return `${day}/${month}/${year}`;
}

function getTodayDateString(): string {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      now.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}`;
}

function getAdminMatchDisplayStatus(
  match: Match,
): AdminMatchDisplayStatus {
  const normalizedStatus =
    String(
      match.status ?? "",
    ).toLowerCase();

    if (
  normalizedStatus ===
  "postponed"
) {
  return "postponed";
}

if (
  normalizedStatus ===
  "cancelled"
) {
  return "cancelled";
}

  if (
    normalizedStatus ===
    "live"
  ) {
    return "live";
  }

  if (
    normalizedStatus ===
    "finished"
  ) {
    return "finished";
  }

  if (
    normalizedStatus === "played" ||
    normalizedStatus === "completed"
  ) {
    return "completed";
  }

  const today =
    getTodayDateString();

  if (
    match.date &&
    match.date > today
  ) {
    return "scheduled";
  }

  return "waiting";
}

function getAdminMatchStatusStyle(
  status:
    AdminMatchDisplayStatus,
): {
  label: string;
  className: string;
} {
  switch (status) {
    case "completed":
      return {
        label:
          "Completato",

        className:
          "border border-green-200 bg-green-50 text-green-700",
      };

    case "live":
      return {
        label:
          "Live",

        className:
          "border border-red-200 bg-red-50 text-red-600",
      };

    case "finished":
      return {
        label:
          "Tabellino in elaborazione",

        className:
          "border border-slate-200 bg-slate-100 text-slate-600",
      };

      case "postponed":
  return {
    label:
      "Rinviata",

    className:
      "border border-slate-200 bg-slate-100 text-slate-600",
  };

    case "cancelled":
  return {
    label:
      "Annullata",

    className:
      "border border-slate-300 bg-slate-100 text-slate-500",
  };

    case "waiting":
      return {
        label:
          "In attesa",

        className:
          "border border-orange-200 bg-orange-50 text-orange-700",
      };

    case "scheduled":
    default:
      return {
        label:
          "Da giocare",

        className:
          "border border-red-200 bg-red-50 text-red-600",
      };
  }
}

export default function AdminMatchesScreen() {
  const {
  currentSeason,

  isLoading:
    competitionLoading,

  error:
    competitionError,
} =
  useCompetition();

const currentSeasonId =
  currentSeason?.id;

  /*
   * Mantiene persistito lo start automatico del LIVE quando
   * un Admin ha aperto la gestione partite.
   *
   * Il resolver pubblico del Matchday resta comunque autonomo
   * per la visualizzazione temporale; questa sync serve a rendere
   * subito disponibile il manager punteggio in Firestore.
   */
  useEffect(() => {
    if (
      !currentSeasonId
    ) {
      return;
    }

    let active =
      true;

    async function syncLive() {
      try {
        await FirebaseMatchLifecycleService.syncAutomaticLiveState({
          seasonId:
            currentSeasonId!,
        });
      } catch (
        currentError
      ) {
        if (
          active
        ) {
          console.error(
            "Errore sincronizzazione lifecycle LIVE:",
            currentError,
          );
        }
      }
    }

    void syncLive();

    const intervalId =
      window.setInterval(
        () => {
          void syncLive();
        },
        60_000,
      );

    return () => {
      active =
        false;

      window.clearInterval(
        intervalId,
      );
    };
  }, [
    currentSeasonId,
  ]);

  const {
    teams,
    isLoading:
      teamsLoading,
    error:
      teamsError,
  } = useTeams();

  const {
  entries:
    seasonTeams,

  isLoading:
    seasonTeamsLoading,

  error:
    seasonTeamsError,
} =
  useSeasonTeams(
    currentSeasonId,
  );

  const registeredTeamIds =
  useMemo(() => {
    return new Set(
      seasonTeams.map(
        (
          entry,
        ) =>
          String(
            entry.teamId,
          ),
      ),
    );
  }, [
    seasonTeams,
  ]);

const seasonTeamOptions =
  useMemo(() => {
    return teams.filter(
      (
        team,
      ) =>
        registeredTeamIds.has(
          String(
            team.id,
          ),
        ),
    );
  }, [
    teams,
    registeredTeamIds,
  ]);

  const {
    matches,
    isLoading:
      matchesLoading,
    error:
      matchesError,
  } = useMatches(
  currentSeasonId,
);

  const [
    selectedMatchweek,
    setSelectedMatchweek,
  ] =
    useState<
      number | "all" | null
    >(null);

  const [
  editStatus,
  setEditStatus,
] =
  useState<
    "scheduled" |
    "postponed" |
    "cancelled"
  >(
    "scheduled",
  );

  const latestMatchweek =
  useMemo(() => {
    if (matches.length === 0) {
      return undefined;
    }

    return Math.max(
      ...matches.map(
        (match) =>
          match.matchweek,
      ),
    );
  }, [matches]);

const effectiveSelectedMatchweek =
  selectedMatchweek ??
  latestMatchweek ??
  "all";

  const [
    deletingMatchId,
    setDeletingMatchId,
  ] =
    useState<
      string | null
    >(null);

  const [
    actionError,
    setActionError,
  ] =
    useState<
      string | null
    >(null);

  const [
    actionSuccess,
    setActionSuccess,
  ] =
    useState<
      string | null
    >(null);

  /*
 * ==========================================================
 * NUOVA PARTITA
 * ==========================================================
 */

const [
  isCreatingMatch,
  setIsCreatingMatch,
] =
  useState(false);

const [
  createMatchweek,
  setCreateMatchweek,
] =
  useState("");

const [
  createDate,
  setCreateDate,
] =
  useState("");

const [
  createTime,
  setCreateTime,
] =
  useState(
    "20:30",
  );

const [
  createVenue,
  setCreateVenue,
] =
  useState(
    "Centro Sportivo Ludi",
  );

const [
  createHomeTeamId,
  setCreateHomeTeamId,
] =
  useState("");

const [
  createAwayTeamId,
  setCreateAwayTeamId,
] =
  useState("");

const [
  isSavingCreate,
  setIsSavingCreate,
] =
  useState(false);

const createPanelRef =
  useRef<HTMLElement | null>(
    null,
  );

  const [
    editingMatch,
    setEditingMatch,
  ] =
    useState<
      Match | null
    >(null);

  const [
    editMatchweek,
    setEditMatchweek,
  ] =
    useState("");

  const [
    editDate,
    setEditDate,
  ] =
    useState("");

  const [
    editTime,
    setEditTime,
  ] =
    useState("");

  const [
    editVenue,
    setEditVenue,
  ] =
    useState("");

  const [
    editHomeTeamId,
    setEditHomeTeamId,
  ] =
    useState("");

  const [
    editAwayTeamId,
    setEditAwayTeamId,
  ] =
    useState("");

  const [
    isSavingEdit,
    setIsSavingEdit,
  ] =
    useState(false);

  const editPanelRef =
    useRef<HTMLElement | null>(
      null,
    );

  const matchweeks =
    useMemo(() => {
      return Array.from(
        new Set(
          matches.map(
            (match) =>
              match.matchweek,
          ),
        ),
      ).sort(
        (
          first,
          second,
        ) =>
          first - second,
      );
    }, [
      matches,
    ]);

  const filteredMatches =
    useMemo(() => {
      if (
        selectedMatchweek ===
        "all"
      ) {
        return matches;
      }

      return matches.filter(
        (match) =>
          match.matchweek ===
          effectiveSelectedMatchweek,
      );
    }, [
      matches,
      effectiveSelectedMatchweek,
      selectedMatchweek,
    ]);

  const teamById =
    useMemo(() => {
      return new Map(
        teams.map(
          (team) => [
            String(
              team.id,
            ),
            team,
          ],
        ),
      );
    }, [
      teams,
    ]);

  const isLoading =
    competitionLoading ||
    teamsLoading ||
    seasonTeamsLoading ||
    matchesLoading;

  const error =
    competitionError ||
    teamsError ||
    seasonTeamsError ||
    matchesError;

  function getTeam(
    match: Match,
    side:
      | "home"
      | "away",
  ) {
    const teamId =
      side === "home"
        ? match.homeTeamId
        : match.awayTeamId;

    return teamById.get(
      String(
        teamId,
      ),
    );
  }

  async function handleDeleteMatch(
    match: Match,
  ) {
    if (
      deletingMatchId
    ) {
      return;
    }

    const homeTeam =
      getTeam(
        match,
        "home",
      );

    const awayTeam =
      getTeam(
        match,
        "away",
      );

    const confirmed =
      window.confirm(
        `Vuoi eliminare definitivamente ${
          homeTeam?.name ??
          "Squadra casa"
        } - ${
          awayTeam?.name ??
          "Squadra ospite"
        }?\n\nQuesta operazione non può essere annullata.`,
      );

    if (!confirmed) {
      return;
    }

    setDeletingMatchId(
      match.id,
    );

    setActionError(
      null,
    );

    setActionSuccess(
      null,
    );

    try {
      await FirebaseMatchRepository.remove(
        match.id,
        {
          allowPublishedFinalReportOverride:
            getAdminMatchDisplayStatus(
              match,
            ) ===
              "scheduled" ||
            getAdminMatchDisplayStatus(
              match,
            ) ===
              "waiting" ||
            getAdminMatchDisplayStatus(
              match,
            ) ===
              "postponed",
        },
      );

      setActionSuccess(
        "Partita eliminata correttamente.",
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore eliminazione partita:",
        currentError,
      );

      setActionError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile eliminare la partita.",
      );
    } finally {
      setDeletingMatchId(
        null,
      );
    }
  }

  function openEditMatch(
    match: Match,
  ) {
    setIsCreatingMatch(
  false,
);

setEditStatus(
  match.status ===
    "postponed" ||
  match.status ===
    "cancelled"
    ? match.status
    : "scheduled",
);

    setEditingMatch(
      match,
    );

    setEditMatchweek(
      String(
        match.matchweek,
      ),
    );

    setEditDate(
      match.date,
    );

    setEditTime(
      match.time,
    );

    setEditVenue(
      match.venue ||
        "Centro Sportivo Ludi",
    );

    setEditHomeTeamId(
      String(
        match.homeTeamId,
      ),
    );

    setEditAwayTeamId(
      String(
        match.awayTeamId,
      ),
    );

    setActionError(
      null,
    );

    setActionSuccess(
      null,
    );

    window.setTimeout(
      () => {
        editPanelRef.current
          ?.scrollIntoView({
            behavior:
              "smooth",
            block:
              "start",
          });
      },
      0,
    );
  }

  /*
 * ==========================================================
 * CREAZIONE PARTITA
 * ==========================================================
 */

async function handleCreateMatch() {
  if (
    !currentSeasonId ||
    isSavingCreate
  ) {
    return;
  }

  const normalizedMatchweek =
    Number(
      createMatchweek,
    );

  if (
    !Number.isInteger(
      normalizedMatchweek,
    ) ||
    normalizedMatchweek <
      1
  ) {
    setActionError(
      "Inserisci una matchweek valida.",
    );

    return;
  }

  if (
    !createDate
  ) {
    setActionError(
      "Inserisci la data della partita.",
    );

    return;
  }

  if (
    !createTime
  ) {
    setActionError(
      "Inserisci l’orario della partita.",
    );

    return;
  }

  if (
    !createHomeTeamId ||
    !createAwayTeamId
  ) {
    setActionError(
      "Seleziona entrambe le squadre.",
    );

    return;
  }

  if (
    createHomeTeamId ===
    createAwayTeamId
  ) {
    setActionError(
      "Una squadra non può giocare contro sé stessa.",
    );

    return;
  }

  setIsSavingCreate(
    true,
  );

  setActionError(
    null,
  );

  setActionSuccess(
    null,
  );

  try {
    await FirebaseMatchRepository
      .create({
        seasonId:
          currentSeasonId,

        matchType:
          "regularSeason",

        matchweek:
          normalizedMatchweek,

        matchweekId:
          `mw${normalizedMatchweek}`,

        homeTeamId:
          createHomeTeamId,

        awayTeamId:
          createAwayTeamId,

        date:
          createDate,

        time:
          createTime,

        venue:
          createVenue.trim() ||
          "Centro Sportivo Ludi",
      });

    setActionSuccess(
      "Partita creata correttamente.",
    );

    /*
     * Portiamo automaticamente
     * l'admin sulla giornata appena
     * utilizzata.
     */

    setSelectedMatchweek(
      normalizedMatchweek,
    );

    setIsCreatingMatch(
      false,
    );

    setCreateHomeTeamId("");

    setCreateAwayTeamId("");

    setCreateDate("");
  } catch (
    currentError
  ) {
    console.error(
      "Errore creazione partita:",
      currentError,
    );

    setActionError(
      currentError instanceof
        Error
        ? currentError.message
        : "Impossibile creare la partita.",
    );
  } finally {
    setIsSavingCreate(
      false,
    );
  }
}

  async function handleSaveEdit() {
    if (
      !editingMatch ||
      isSavingEdit
    ) {
      return;
    }

    const normalizedMatchweek =
      Number(
        editMatchweek,
      );

    if (
      !Number.isInteger(
        normalizedMatchweek,
      ) ||
      normalizedMatchweek <
        1
    ) {
      setActionError(
        "Inserisci una matchweek valida.",
      );

      return;
    }

    if (
      !editDate
    ) {
      setActionError(
        "Inserisci la data della partita.",
      );

      return;
    }

    if (
      !editTime
    ) {
      setActionError(
        "Inserisci l’orario della partita.",
      );

      return;
    }

    if (
      !editHomeTeamId ||
      !editAwayTeamId
    ) {
      setActionError(
        "Seleziona entrambe le squadre.",
      );

      return;
    }

    if (
      editHomeTeamId ===
      editAwayTeamId
    ) {
      setActionError(
        "Una squadra non può giocare contro sé stessa.",
      );

      return;
    }

    setIsSavingEdit(
      true,
    );

    setActionError(
      null,
    );

    const editingDisplayStatus =
      getAdminMatchDisplayStatus(
        editingMatch,
      );

    try {
      await FirebaseMatchRepository.update(
        {
          matchId:
            editingMatch.id,

          matchweek:
            normalizedMatchweek,

          matchweekId:
            `mw${normalizedMatchweek}`,

          date:
            editDate,

          time:
            editTime,

          venue:
            editVenue.trim() ||
            "Centro Sportivo Ludi",

          homeTeamId:
            editHomeTeamId,

          awayTeamId:
            editAwayTeamId,

          status:
  editStatus,

          published:
            editingMatch.published,
        },
        {
          allowPublishedFinalReportOverride:
            editingDisplayStatus ===
              "scheduled" ||
            editingDisplayStatus ===
              "waiting" ||
            editingDisplayStatus ===
              "postponed",
        },
      );

      setActionSuccess(
        "Partita modificata correttamente.",
      );

      setEditingMatch(
        null,
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore modifica partita:",
        currentError,
      );

      setActionSuccess(
        null,
      );

      setActionError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile modificare la partita.",
      );
    } finally {
      setIsSavingEdit(
        false,
      );
    }
  }

  const completedMatches =
    filteredMatches.filter(
      (match) =>
        getAdminMatchDisplayStatus(
          match,
        ) ===
        "completed",
    ).length;

  const liveMatches =
    filteredMatches.filter(
      (match) =>
        getAdminMatchDisplayStatus(
          match,
        ) ===
        "live",
    ).length;

  const pendingMatches =
    filteredMatches.length -
    completedMatches -
    liveMatches;

  return (
    <AppShell>
      <div className="space-y-6">
      {/* ======================================================
          HEADER
          ====================================================== */}
      <header className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#06142E]/35">
            Centro di controllo
          </p>

          <h1 className="mt-1 text-3xl font-black uppercase tracking-[-0.03em] text-[#06142E] sm:text-4xl">
            Partite
          </h1>

          <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-[#06142E]/45">
            Gestisci programma, stato e tabellini della stagione corrente.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/calendario"
            className="inline-flex min-h-11 items-center justify-center rounded-[13px] border border-[#06142E]/10 bg-white px-5 text-xs font-black uppercase text-[#06142E]"
          >
            Calendario
          </Link>

          <button
            type="button"
            onClick={() => {
              setEditingMatch(
                null,
              );

              setCreateMatchweek(
                String(
                  effectiveSelectedMatchweek ===
                    "all"
                    ? latestMatchweek ??
                        1
                    : effectiveSelectedMatchweek,
                ),
              );

              setIsCreatingMatch(
                true,
              );
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-[13px] bg-[#06142E] px-5 text-xs font-black uppercase text-white"
          >
            + Nuova partita
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-[17px] border border-[#06142E]/8 bg-white p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
            Partite visualizzate
          </p>

          <p className="mt-1 text-3xl font-black text-[#06142E]">
            {filteredMatches.length}
          </p>
        </article>

        <article className="rounded-[17px] border border-[#06142E]/8 bg-white p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
            Completate
          </p>

          <p className="mt-1 text-3xl font-black text-[#06142E]">
            {completedMatches}
          </p>
        </article>

        <article className="rounded-[17px] border border-[#06142E]/8 bg-white p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
            Da gestire
          </p>

          <p className="mt-1 text-3xl font-black text-[#06142E]">
            {pendingMatches}
            {liveMatches > 0 ? (
              <span className="ml-2 text-xs font-black uppercase text-red-600">
                {liveMatches} live
              </span>
            ) : null}
          </p>
        </article>
      </section>

      {isCreatingMatch && (
  <section
    ref={
      createPanelRef
    }
    className="ludi-card p-5 sm:p-6"
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.15em] opacity-45">
          Nuova partita
        </p>

        <h2 className="mt-2 text-2xl font-black uppercase text-[#06142E]">
          Crea partita
        </h2>
      </div>

      <button
        type="button"
        disabled={
          isSavingCreate
        }
        onClick={() => {
          setIsCreatingMatch(
            false,
          );
        }}
        className="text-xs font-black uppercase text-[#06142E]/50 disabled:opacity-40"
      >
        Chiudi
      </button>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
          Matchweek
        </span>

        <input
          type="number"
          min={1}
          value={
            createMatchweek
          }
          onChange={(
            event,
          ) => {
            setCreateMatchweek(
              event.target
                .value,
            );
          }}
          className="ludi-input"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
          Data
        </span>

        <input
          type="date"
          value={
            createDate
          }
          onChange={(
            event,
          ) => {
            setCreateDate(
              event.target
                .value,
            );
          }}
          className="ludi-input"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
          Ora
        </span>

        <select
          value={
            createTime
          }
          onChange={(
            event,
          ) => {
            setCreateTime(
              event.target
                .value,
            );
          }}
          className="ludi-input"
        >
          {MATCH_TIMES.map(
            (time) => (
              <option
                key={time}
                value={time}
              >
                {time}
              </option>
            ),
          )}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
          Impianto
        </span>

        <input
          type="text"
          value={
            createVenue
          }
          onChange={(
            event,
          ) => {
            setCreateVenue(
              event.target
                .value,
            );
          }}
          className="ludi-input"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
          Casa
        </span>

        <select
          value={
            createHomeTeamId
          }
          onChange={(
            event,
          ) => {
            setCreateHomeTeamId(
              event.target
                .value,
            );
          }}
          className="ludi-input"
        >
          <option value="">
            Seleziona squadra
          </option>

          {seasonTeamOptions.map(
            (
              team,
            ) => (
              <option
                key={
                  team.id
                }
                value={
                  String(
                    team.id,
                  )
                }
              >
                {team.name}
              </option>
            ),
          )}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
          Ospite
        </span>

        <select
          value={
            createAwayTeamId
          }
          onChange={(
            event,
          ) => {
            setCreateAwayTeamId(
              event.target
                .value,
            );
          }}
          className="ludi-input"
        >
          <option value="">
            Seleziona squadra
          </option>

          {seasonTeamOptions.map(
            (
              team,
            ) => (
              <option
                key={
                  team.id
                }
                value={
                  String(
                    team.id,
                  )
                }
              >
                {team.name}
              </option>
            ),
          )}
        </select>
      </label>
    </div>

    <button
      type="button"
      disabled={
        isSavingCreate
      }
      onClick={() => {
        void handleCreateMatch();
      }}
      className="ludi-button-primary mt-5 w-full sm:w-auto sm:min-w-[220px] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {isSavingCreate
        ? "Creazione..."
        : "Crea partita"}
    </button>
  </section>
)}

      {editingMatch && (
        <section
          ref={
            editPanelRef
          }
          className="ludi-card p-5 sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] opacity-45">
                Modifica partita
              </p>

              <h2 className="mt-2 text-2xl font-black uppercase text-[#06142E]">
                Aggiorna programma
              </h2>
            </div>

            <label className="block">
  <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
    Stato
  </span>

  <select
    value={
      editStatus
    }
    onChange={(
      event,
    ) => {
      setEditStatus(
        event.target
          .value as
          | "scheduled"
          | "postponed"
          | "cancelled",
      );
    }}
    className="ludi-input"
  >
    <option value="scheduled">
      Programmata
    </option>

    <option value="postponed">
      Rinviata
    </option>

    <option value="cancelled">
      Annullata
    </option>
  </select>
</label>

            <button
              type="button"
              onClick={() => {
                setEditingMatch(
                  null,
                );
              }}
              disabled={
                isSavingEdit
              }
              
              className="text-xs font-black uppercase text-[#06142E]/50"
            >
              Chiudi
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                Matchweek
              </span>

              <input
                type="number"
                min={1}
                value={
                  editMatchweek
                }
                onChange={(
                  event,
                ) => {
                  setEditMatchweek(
                    event.target
                      .value,
                  );
                }}
                className="ludi-input"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                Data
              </span>

              <input
                type="date"
                value={
                  editDate
                }
                onChange={(
                  event,
                ) => {
                  setEditDate(
                    event.target
                      .value,
                  );
                }}
                className="ludi-input"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                Ora
              </span>

              <select
                value={
                  editTime
                }
                onChange={(
                  event,
                ) => {
                  setEditTime(
                    event.target
                      .value,
                  );
                }}
                className="ludi-input"
              >
                {MATCH_TIMES.map(
                  (time) => (
                    <option
                      key={time}
                      value={time}
                    >
                      {time}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                Impianto
              </span>

              <input
                type="text"
                value={
                  editVenue
                }
                onChange={(
                  event,
                ) => {
                  setEditVenue(
                    event.target
                      .value,
                  );
                }}
                className="ludi-input"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                Casa
              </span>

              <select
                value={
                  editHomeTeamId
                }
                onChange={(
                  event,
                ) => {
                  setEditHomeTeamId(
                    event.target
                      .value,
                  );
                }}
                disabled={
                  editingMatch
                    ?.matchType ===
                  "titlePlayoff"
                }
                className="ludi-input disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">
                  Seleziona squadra
                </option>

                {seasonTeamOptions.map(
                  (
                    team,
                  ) => (
                    <option
                      key={
                        team.id
                      }
                      value={String(
                        team.id,
                      )}
                    >
                      {
                        team.name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase text-[#06142E]/50">
                Ospite
              </span>

              <select
                value={
                  editAwayTeamId
                }
                onChange={(
                  event,
                ) => {
                  setEditAwayTeamId(
                    event.target
                      .value,
                  );
                }}
                className="ludi-input"
              >
                <option value="">
                  Seleziona squadra
                </option>

                {seasonTeamOptions.map(
                  (
                    team,
                  ) => (
                    <option
                      key={
                        team.id
                      }
                      value={String(
                        team.id,
                      )}
                    >
                      {
                        team.name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={() => {
              void handleSaveEdit();
            }}
            disabled={
              isSavingEdit
            }
            className="ludi-button-primary mt-5 w-full sm:w-auto sm:min-w-[220px] disabled:opacity-40"
          >
            {isSavingEdit
              ? "Salvataggio..."
              : "Salva modifiche"}
          </button>
        </section>
      )}

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        {currentSeason ? (
          <article className="rounded-[20px] bg-[var(--competition-primary)] p-5 text-[var(--competition-text)] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-45">
                  Stagione corrente
                </p>

                <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                  {currentSeason.name}
                </h2>
              </div>

              <p className="text-sm font-black opacity-60">
                {matches.length}{" "}
                {matches.length ===
                1
                  ? "partita"
                  : "partite"}
              </p>
            </div>
          </article>
        ) : (
          <div />
        )}

        <article className="rounded-[20px] border border-[#06142E]/8 bg-white p-5">
          <label className="block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.15em] text-[#06142E]/40">
              Filtra per matchweek
            </span>

            <select
              value={
                effectiveSelectedMatchweek
              }
              onChange={(
                event,
              ) => {
                const value =
                  event.target
                    .value;

                setSelectedMatchweek(
                  value ===
                  "all"
                    ? "all"
                    : Number(
                        value,
                      ),
                );
              }}
              className="ludi-input"
            >
              <option value="all">
                Tutte le giornate
              </option>

              {matchweeks.map(
                (
                  matchweek,
                ) => (
                  <option
                    key={
                      matchweek
                    }
                    value={
                      matchweek
                    }
                  >
                    Matchweek{" "}
                    {
                      matchweek
                    }
                  </option>
                ),
              )}
            </select>
          </label>
        </article>
      </section>

      {actionSuccess && (
        <div className="mb-5 rounded-[16px] border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
          {
            actionSuccess
          }
        </div>
      )}

      {actionError && (
        <div className="mb-5 rounded-[16px] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {
            actionError
          }
        </div>
      )}

      {isLoading ? (
        <div className="ludi-card p-6 text-center text-sm font-bold text-[#06142E]/50">
          Caricamento partite...
        </div>
      ) : error ? (
        <div className="rounded-[16px] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : !currentSeason ? (
        <div className="ludi-card p-6 text-center">
          <p className="text-lg font-black text-[#06142E]">
            Nessuna stagione attiva
          </p>

          <p className="mt-2 text-sm font-bold text-[#06142E]/45">
            Attiva una stagione prima di creare il calendario.
          </p>
        </div>
      ) : filteredMatches.length ===
        0 ? (
        <div className="ludi-card p-8 text-center">
          <div className="text-4xl">
            📅
          </div>

          <p className="mt-4 text-xl font-black text-[#06142E]">
            Nessuna partita
          </p>

          <p className="mt-2 text-sm font-bold text-[#06142E]/45">
            Crea la prima partita della stagione corrente.
          </p>
        </div>
      ) : (
        <section className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filteredMatches.map(
            (
              match,
            ) => {
              const homeTeam =
                getTeam(
                  match,
                  "home",
                );

              const awayTeam =
                getTeam(
                  match,
                  "away",
                );

              const displayStatus =
                getAdminMatchDisplayStatus(
                  match,
                );

              const statusStyle =
                getAdminMatchStatusStyle(
                  displayStatus,
                );

              return (
                <article
                  key={
                    match.id
                  }
                  className="ludi-card flex h-full min-w-0 flex-col p-5"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#06142E]/40">
                        Matchweek{" "}
                        {
                          match.matchweek
                        }
                      </p>

                      <p className="mt-1 text-sm font-bold text-[#06142E]/55">
                        {formatItalianDate(
                          match.date,
                        )}

                        {match.time
                          ? ` · ${match.time}`
                          : ""}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] ${statusStyle.className}`}
                    >
                      {
                        statusStyle.label
                      }
                    </span>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                    <div className="min-w-0 text-center">
                      <div className="mx-auto flex w-fit justify-center">
                        <TeamLogo
                          logoUrl={
                            homeTeam
                              ?.logoUrl
                          }
                          teamName={
                            homeTeam
                              ?.name
                          }
                          size={
                            56
                          }
                        />
                      </div>

                      <p className="mt-3 truncate text-sm font-black uppercase text-[#06142E]">
  {homeTeam?.aliasName ||
    homeTeam?.name ||
    "Squadra casa"}
</p>
                    </div>

                    <div className="text-center">
                      <p className="text-xs font-black uppercase text-[#06142E]/35">
                        VS
                      </p>
                    </div>

                    <div className="min-w-0 text-center">
                      <div className="mx-auto flex w-fit justify-center">
                        <TeamLogo
                          logoUrl={
                            awayTeam
                              ?.logoUrl
                          }
                          teamName={
                            awayTeam
                              ?.name
                          }
                          size={
                            56
                          }
                        />
                      </div>

                      <p className="mt-3 truncate text-sm font-black uppercase text-[#06142E]">
  {awayTeam?.aliasName ||
    awayTeam?.name ||
    "Squadra ospite"}
</p>
                    </div>
                  </div>

                  <div className="mt-auto grid grid-cols-3 gap-2 pt-5">
                    <button
                      type="button"
                      onClick={() => {
                        openEditMatch(
                          match,
                        );
                      }}
                      className="min-h-11 rounded-[12px] border border-[#06142E]/10 text-xs font-black uppercase text-[#06142E]"
                    >
                      Modifica
                    </button>

                    {match.status ===
                    "cancelled" ? (
                      <div className="flex min-h-11 cursor-not-allowed items-center justify-center rounded-[12px] bg-[#06142E]/10 text-xs font-black uppercase text-[#06142E]/30">
                        Tabellino
                      </div>
                    ) : (
                      <Link
                        href={`/admin/partite/${match.id}`}
                        className="flex min-h-11 items-center justify-center rounded-[12px] bg-[#06142E] text-xs font-black uppercase text-white"
                      >
                        Tabellino
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteMatch(
                          match,
                        );
                      }}
                      disabled={
  deletingMatchId !==
    null ||
  (
    displayStatus !==
      "scheduled" &&
    displayStatus !==
      "waiting" &&
    displayStatus !==
      "postponed"
  )
}
                      className="min-h-11 rounded-[12px] border border-red-200 text-xs font-black uppercase text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {deletingMatchId ===
                      match.id
                        ? "Eliminazione..."
                        : "Elimina"}
                    </button>
                  </div>
                </article>
              );
            },
          )}
        </section>
      )}
      </div>
    </AppShell>
  );
}
