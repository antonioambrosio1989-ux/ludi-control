"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AppShell from "@/components/ui/AppShell";

import {
  FirebaseFinalStageMatchRepository,
} from "@/src/services/final-stage/FirebaseFinalStageMatchRepository";

import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

import {
  useSeasonTeams,
} from "@/src/hooks/useSeasonTeams";

import {
  useTeams,
} from "@/src/hooks/useTeams";

import type {
  FinalStageCompetition,
  FinalStageLeg,
  FinalStageMatch,
  FinalStageMatchStatus,
  FinalStageRound,
} from "@/src/types/FinalStageMatch";

type AdminFinalStageRound =
  | FinalStageRound
  | "playoff";

/*
 * ============================================================
 * FORM
 * ============================================================
 */

type FormState = {
  competition:
    FinalStageCompetition;

  round:
    AdminFinalStageRound;

  group:
    string;

  leg:
    FinalStageLeg;

  matchOrder:
    string;

  finalStageWeek:
    string;

  homeTeamId:
    string;

  awayTeamId:
    string;

  date:
    string;

  time:
    string;

  venue:
    string;

  status:
    FinalStageMatchStatus;

  published:
    boolean;

  homeScore:
    string;

  awayScore:
    string;

  homePenalties:
    string;

  awayPenalties:
    string;
};

const EMPTY_FORM:
  FormState = {
  competition:
    "championsLeague",

  round:
    "quarterfinal",

  group:
    "",

  leg:
    "single",

  matchOrder:
    "",

  finalStageWeek:
    "1",

  homeTeamId:
    "",

  awayTeamId:
    "",

  date:
    "",

  time:
    "",

  venue:
    "Centro Sportivo Ludi",

  status:
    "scheduled",

  published:
    false,

  homeScore:
    "",

  awayScore:
    "",

  homePenalties:
    "",

  awayPenalties:
    "",
};

/*
 * ============================================================
 * OPZIONI
 * ============================================================
 */

const COMPETITIONS: {
  value:
    FinalStageCompetition;

  label:
    string;
}[] = [
  {
    value:
      "championsLeague",

    label:
      "Champions League",
  },

  {
    value:
      "europaLeague",

    label:
      "Europa League",
  },

  {
    value:
      "conferenceLeague",

    label:
      "Conference League",
  },
];

const ROUNDS: {
  value:
    AdminFinalStageRound;

  label:
    string;
}[] = [
  {
    value:
      "group",

    label:
      "Girone",
  },

  {
    value:
      "playoff",

    label:
      "Playoff",
  },

  {
    value:
      "quarterfinal",

    label:
      "Quarti di finale",
  },

  {
    value:
      "semifinal",

    label:
      "Semifinale",
  },

  {
    value:
      "final",

    label:
      "Finale",
  },
];

const LEGS: {
  value:
    FinalStageLeg;

  label:
    string;
}[] = [
  {
    value:
      "single",

    label:
      "Unica",
  },

  {
    value:
      "first",

    label:
      "Andata",
  },

  {
    value:
      "second",

    label:
      "Ritorno",
  },
];

/*
 * ============================================================
 * SCREEN
 * ============================================================
 */

export default function AdminFinalStageCalendarScreen() {
  /*
   * ==========================================================
   * STAGIONE
   * ==========================================================
   */

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
   * ==========================================================
   * SQUADRE
   * ==========================================================
   */

  const {
    teams,

    isLoading:
      teamsLoading,

    error:
      teamsError,
  } =
    useTeams();

    const {
  entries:
    seasonTeamEntries,

  isLoading:
    seasonTeamsLoading,

  error:
    seasonTeamsError,
} =
  useSeasonTeams(
    currentSeasonId,
  );

  /*
   * ==========================================================
   * STATE
   * ==========================================================
   */

  const [
    matches,
    setMatches,
  ] =
    useState<
      FinalStageMatch[]
    >([]);

  const [
    selectedCompetition,
    setSelectedCompetition,
  ] =
    useState<
      FinalStageCompetition
    >(
      "championsLeague",
    );

  const [
    form,
    setForm,
  ] =
    useState<FormState>(
      EMPTY_FORM,
    );

  const [
    editingMatchId,
    setEditingMatchId,
  ] =
    useState<
      string | null
    >(null);

  const [
    matchesLoading,
    setMatchesLoading,
  ] =
    useState(
      true,
    );

  const [
    matchesError,
    setMatchesError,
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
    actionMessage,
    setActionMessage,
  ] =
    useState<
      string | null
    >(null);

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(
      false,
    );

  /*
   * ==========================================================
   * LISTENER PARTITE
   * ==========================================================
   */

  useEffect(() => {
  if (
    !currentSeasonId
  ) {
    return;
  }

  const unsubscribe =
    FirebaseFinalStageMatchRepository.subscribeBySeason(
      currentSeasonId,

      (
        nextMatches,
      ) => {
        setMatches(
          nextMatches,
        );

        setMatchesError(
          null,
        );

        setMatchesLoading(
          false,
        );
      },

      (
        error,
      ) => {
        console.error(
          "Errore caricamento calendario fasi finali:",
          error,
        );

        setMatchesError(
          error.message,
        );

        setMatchesLoading(
          false,
        );
      },
    );

  return unsubscribe;
}, [
  currentSeasonId,
]);

  /*
   * ==========================================================
   * SQUADRE ORDINATE
   * ==========================================================
   */

  const participatingTeamIds =
  useMemo(() => {
    return new Set(
      seasonTeamEntries.map(
        (
          entry,
        ) =>
          String(
            entry.teamId,
          ),
      ),
    );
  }, [
    seasonTeamEntries,
  ]);

const sortedTeams =
  useMemo(() => {
    return teams
      .filter(
        (
          team,
        ) =>
          participatingTeamIds.has(
            String(
              team.id,
            ),
          ),
      )
      .sort(
        (
          first,
          second,
        ) =>
          first.name.localeCompare(
            second.name,
            "it",
          ),
      );
  }, [
    teams,
    participatingTeamIds,
  ]);

  /*
   * ==========================================================
   * MAPPA SQUADRE
   * ==========================================================
   */

  const teamsById =
    useMemo(() => {
      return new Map(
        teams.map(
          (
            team,
          ) => [
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

  /*
   * ==========================================================
   * PARTITE DELLA COMPETIZIONE
   * ==========================================================
   */

  const visibleMatches =
    useMemo(() => {
      return matches
        .filter(
          (
            match,
          ) =>
            match.competition ===
            selectedCompetition,
        )
        .sort(
          (
            first,
            second,
          ) => {
            const firstRound =
              getRoundOrder(
                first.round,
              );

            const secondRound =
              getRoundOrder(
                second.round,
              );

            if (
              firstRound !==
              secondRound
            ) {
              return (
                firstRound -
                secondRound
              );
            }

            if (
              (
                first.matchOrder ??
                999
              ) !==
              (
                second.matchOrder ??
                999
              )
            ) {
              return (
                (
                  first.matchOrder ??
                  999
                ) -
                (
                  second.matchOrder ??
                  999
                )
              );
            }

            const dateComparison =
              first.date.localeCompare(
                second.date,
              );

            if (
              dateComparison !==
              0
            ) {
              return dateComparison;
            }

            return first.time.localeCompare(
              second.time,
            );
          },
        );
    }, [
      matches,
      selectedCompetition,
    ]);

  /*
   * ==========================================================
   * UPDATE FORM
   * ==========================================================
   */

  function updateForm<
    Key extends
      keyof FormState,
  >(
    key:
      Key,

    value:
      FormState[Key],
  ) {
    setForm(
      (
        current,
      ) => ({
        ...current,

        [key]:
          value,
      }),
    );

    setActionError(
      null,
    );

    setActionMessage(
      null,
    );
  }

  /*
   * ==========================================================
   * RESET FORM
   * ==========================================================
   */

  function resetForm() {
    setForm({
      ...EMPTY_FORM,

      competition:
        selectedCompetition,
    });

    setEditingMatchId(
      null,
    );

    setActionError(
      null,
    );

    setActionMessage(
      null,
    );
  }

  /*
   * ==========================================================
   * MODIFICA
   * ==========================================================
   */

  function startEditing(
    match:
      FinalStageMatch,
  ) {
    setEditingMatchId(
      match.id,
    );

    setSelectedCompetition(
      match.competition,
    );

    setForm({
      competition:
        match.competition,

      round:
        match.round,

      group:
        match.group ??
        "",

      leg:
        match.leg,

      matchOrder:
        match.matchOrder !==
        undefined
          ? String(
              match.matchOrder,
            )
          : "",

      finalStageWeek:
        match.finalStageWeek !==
        undefined
          ? String(
              match.finalStageWeek,
            )
          : "1",

      homeTeamId:
        String(
          match.homeTeamId,
        ),

      awayTeamId:
        String(
          match.awayTeamId,
        ),

      date:
        match.date,

      time:
        match.time,

      venue:
        match.venue,

      status:
        match.status,

      published:
        match.published,

      homeScore:
        match.homeScore !==
        undefined
          ? String(
              match.homeScore,
            )
          : "",

      awayScore:
        match.awayScore !==
        undefined
          ? String(
              match.awayScore,
            )
          : "",

      homePenalties:
        match.homePenalties !==
        undefined
          ? String(
              match.homePenalties,
            )
          : "",

      awayPenalties:
        match.awayPenalties !==
        undefined
          ? String(
              match.awayPenalties,
            )
          : "",
    });

    setActionError(
      null,
    );

    setActionMessage(
      null,
    );

    window.scrollTo({
      top:
        0,

      behavior:
        "smooth",
    });
  }

  /*
   * ==========================================================
   * SALVA
   * ==========================================================
   */

  async function saveMatch() {
    if (
      !currentSeasonId
    ) {
      setActionError(
        "Nessuna stagione attiva.",
      );

      return;
    }

    if (
      !form.homeTeamId ||
      !form.awayTeamId
    ) {
      setActionError(
        "Seleziona entrambe le squadre.",
      );

      return;
    }

    if (
      form.homeTeamId ===
      form.awayTeamId
    ) {
      setActionError(
        "Una squadra non può giocare contro sé stessa.",
      );

      return;
    }

    if (
      !form.date ||
      !form.time
    ) {
      setActionError(
        "Inserisci data e ora della partita.",
      );

      return;
    }

    const matchOrder =
      form.matchOrder
        ? Number(
            form.matchOrder,
          )
        : undefined;

    if (
      matchOrder !==
        undefined &&
      (
        !Number.isInteger(
          matchOrder,
        ) ||
        matchOrder <
          1
      )
    ) {
      setActionError(
        "Ordine partita non valido.",
      );

      return;
    }

    const finalStageWeek =
      Number(
        form.finalStageWeek,
      );

    if (
      !Number.isInteger(
        finalStageWeek,
      ) ||
      finalStageWeek <
        1
    ) {
      setActionError(
        "Inserisci una settimana Final Stage valida.",
      );

      return;
    }

    const homeScore =
      parseOptionalInteger(
        form.homeScore,
      );

    const awayScore =
      parseOptionalInteger(
        form.awayScore,
      );

    const homePenalties =
      parseOptionalInteger(
        form.homePenalties,
      );

    const awayPenalties =
      parseOptionalInteger(
        form.awayPenalties,
      );

    setIsSaving(
      true,
    );

    setActionError(
      null,
    );

    setActionMessage(
      null,
    );

    try {
      if (
        editingMatchId
      ) {
        await FirebaseFinalStageMatchRepository.update({
          matchId:
            editingMatchId,

          competition:
            form.competition,

          round:
            form.round as
              FinalStageRound,

          group:
            form.group.trim() ||
            undefined,

          leg:
            form.leg,

          matchOrder,

          finalStageWeek,

          homeTeamId:
            form.homeTeamId,

          awayTeamId:
            form.awayTeamId,

          date:
            form.date,

          time:
            form.time,

          venue:
            form.venue,

          status:
            form.status,

          published:
            form.published,

          homeScore,

          awayScore,

          homePenalties,

          awayPenalties,
        });

        setActionMessage(
          "Partita aggiornata correttamente.",
        );
      } else {
        await FirebaseFinalStageMatchRepository.create({
          seasonId:
            currentSeasonId,

          competition:
            form.competition,

          round:
            form.round as
              FinalStageRound,

          group:
            form.group.trim() ||
            undefined,

          leg:
            form.leg,

          matchOrder,

          finalStageWeek,

          homeTeamId:
            form.homeTeamId,

          awayTeamId:
            form.awayTeamId,

          date:
            form.date,

          time:
            form.time,

          venue:
            form.venue,
        });

        setActionMessage(
          "Partita creata correttamente.",
        );
      }

      setEditingMatchId(
        null,
      );

      setForm({
        ...EMPTY_FORM,

        competition:
          selectedCompetition,
      });
    } catch (
      error
    ) {
      console.error(
        "Errore salvataggio partita fasi finali:",
        error,
      );

      setActionError(
        error instanceof
          Error
          ? error.message
          : "Impossibile salvare la partita.",
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  /*
   * ==========================================================
   * ELIMINA
   * ==========================================================
   */

  async function removeMatch(
    match:
      FinalStageMatch,
  ) {
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

    const confirmed =
      window.confirm(
        `Eliminare ${homeTeam?.name ?? "Casa"} - ${awayTeam?.name ?? "Ospite"}?`,
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      await FirebaseFinalStageMatchRepository.remove(
        match.id,
      );

      if (
        editingMatchId ===
        match.id
      ) {
        resetForm();
      }
    } catch (
      error
    ) {
      console.error(
        "Errore eliminazione partita:",
        error,
      );

      setActionError(
        error instanceof
          Error
          ? error.message
          : "Impossibile eliminare la partita.",
      );
    }
  }

  /*
   * ==========================================================
   * LOADING
   * ==========================================================
   */

  const isLoading =
  competitionLoading ||
  teamsLoading ||
  seasonTeamsLoading ||
  matchesLoading;

  const loadingError =
  competitionError ||
  teamsError ||
  seasonTeamsError ||
  matchesError;

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <AppShell>
      <div className="space-y-6">
      {/* ======================================================
          HEADER
          ====================================================== */}

      <header className="mt-2 mb-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#06142E]/35">
          Centro di controllo
        </p>

        <h1 className="mt-1 text-3xl font-black uppercase tracking-[-0.03em] text-[#06142E] sm:text-4xl">
          Calendario fasi finali
        </h1>

        <p className="mt-1 max-w-2xl text-sm font-bold leading-6 text-[#06142E]/50">
          Gestisci calendario,
          turni, risultati e
          competizioni delle fasi
          finali.
        </p>
      </header>

      {/* ======================================================
          ERRORI
          ====================================================== */}

      {loadingError && (
        <section className="rounded-[16px] border border-red-200 bg-red-50 p-5">
          <p className="font-black text-red-700">
            Impossibile caricare i dati
          </p>

          <p className="mt-1 text-sm font-bold text-red-600/70">
            {
              loadingError
            }
          </p>
        </section>
      )}

      {/* ======================================================
          FORM
          ====================================================== */}

      {!isLoading &&
        currentSeason && (
          <section>
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
                  Gestione partita
                </p>

                <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">
                  {editingMatchId
                    ? "Modifica partita"
                    : "Nuova partita"}
                </h2>
              </div>

              {editingMatchId && (
                <button
                  type="button"
                  disabled={
                    isSaving
                  }
                  onClick={
                    resetForm
                  }
                  className="rounded-[10px] bg-[#06142E]/5 px-3 py-2 text-xs font-black uppercase text-[#06142E]"
                >
                  Annulla
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Competizione">
                <select
                  value={
                    form.competition
                  }
                  disabled={
                    isSaving
                  }
                  onChange={(
                    event,
                  ) => {
                    const competition =
                      event.target.value as FinalStageCompetition;

                    updateForm(
                      "competition",
                      competition,
                    );

                    setSelectedCompetition(
                      competition,
                    );
                  }}
                  className="admin-input"
                >
                  {COMPETITIONS.map(
                    (
                      competition,
                    ) => (
                      <option
                        key={
                          competition.value
                        }
                        value={
                          competition.value
                        }
                      >
                        {
                          competition.label
                        }
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field label="Turno">
                <select
                  value={
                    form.round
                  }
                  disabled={
                    isSaving
                  }
                  onChange={(
                    event,
                  ) => {
                    const nextRound =
                      event.target.value as
                        AdminFinalStageRound;

                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        round:
                          nextRound,

                        leg:
                          nextRound ===
                            "playoff" ||
                          nextRound ===
                            "final"
                            ? "single"
                            : current.leg,
                      }),
                    );

                    setActionError(
                      null,
                    );

                    setActionMessage(
                      null,
                    );
                  }}
                  className="admin-input"
                >
                  {ROUNDS.map(
                    (
                      round,
                    ) => (
                      <option
                        key={
                          round.value
                        }
                        value={
                          round.value
                        }
                      >
                        {
                          round.label
                        }
                      </option>
                    ),
                  )}
                </select>
              </Field>

              {form.round ===
                "group" && (
                <Field label="Girone">
                  <input
                    type="text"
                    value={
                      form.group
                    }
                    disabled={
                      isSaving
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "group",
                        event.target.value,
                      )
                    }
                    placeholder="Es. A"
                    className="admin-input"
                  />
                </Field>
              )}

              <Field label="Gara">
                <select
                  value={
                    form.leg
                  }
                  disabled={
                    isSaving
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "leg",
                      event.target.value as FinalStageLeg,
                    )
                  }
                  className="admin-input"
                >
                  {LEGS.map(
                    (
                      leg,
                    ) => (
                      <option
                        key={
                          leg.value
                        }
                        value={
                          leg.value
                        }
                      >
                        {
                          leg.label
                        }
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field label="Ordine partita">
                <input
                  type="number"
                  min={
                    1
                  }
                  value={
                    form.matchOrder
                  }
                  disabled={
                    isSaving
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "matchOrder",
                      event.target.value,
                    )
                  }
                  placeholder="Es. 1"
                  className="admin-input"
                />
              </Field>

              <Field label="Settimana Final Stage">
                <input
                  type="number"
                  min={
                    1
                  }
                  value={
                    form.finalStageWeek
                  }
                  disabled={
                    isSaving
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "finalStageWeek",
                      event.target.value,
                    )
                  }
                  placeholder="Es. 1"
                  className="admin-input"
                />

                <p className="mt-1 text-[10px] font-bold leading-4 text-[#06142E]/40">
                  Valore stabile per i link FS1, FS2… Non cambia se sposti la data della partita.
                </p>
              </Field>

              <Field label="Squadra casa">
                <select
                  value={
                    form.homeTeamId
                  }
                  disabled={
                    isSaving
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "homeTeamId",
                      event.target.value,
                    )
                  }
                  className="admin-input"
                >
                  <option value="">
                    Seleziona squadra
                  </option>

                  {sortedTeams.map(
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
                        {
                          team.name
                        }
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field label="Squadra ospite">
                <select
                  value={
                    form.awayTeamId
                  }
                  disabled={
                    isSaving
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "awayTeamId",
                      event.target.value,
                    )
                  }
                  className="admin-input"
                >
                  <option value="">
                    Seleziona squadra
                  </option>

                  {sortedTeams.map(
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
                        {
                          team.name
                        }
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field label="Data">
                <input
                  type="date"
                  value={
                    form.date
                  }
                  disabled={
                    isSaving
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "date",
                      event.target.value,
                    )
                  }
                  className="admin-input"
                />
              </Field>

              <Field label="Ora">
                <input
                  type="time"
                  value={
                    form.time
                  }
                  disabled={
                    isSaving
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "time",
                      event.target.value,
                    )
                  }
                  className="admin-input"
                />
              </Field>

              <Field label="Campo">
                <input
                  type="text"
                  value={
                    form.venue
                  }
                  disabled={
                    isSaving
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      "venue",
                      event.target.value,
                    )
                  }
                  className="admin-input"
                />
              </Field>
            </div>

            {/* RISULTATO SOLO MODIFICA */}

            {editingMatchId && (
              <div className="mt-6 border-t border-[#06142E]/8 pt-6">
                <p className="mb-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
                  Risultato
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Gol casa">
                    <input
                      type="number"
                      min={
                        0
                      }
                      value={
                        form.homeScore
                      }
                      onChange={(
                        event,
                      ) =>
                        updateForm(
                          "homeScore",
                          event.target.value,
                        )
                      }
                      className="admin-input"
                    />
                  </Field>

                  <Field label="Gol ospite">
                    <input
                      type="number"
                      min={
                        0
                      }
                      value={
                        form.awayScore
                      }
                      onChange={(
                        event,
                      ) =>
                        updateForm(
                          "awayScore",
                          event.target.value,
                        )
                      }
                      className="admin-input"
                    />
                  </Field>

                  <Field label="Rigori casa">
                    <input
                      type="number"
                      min={
                        0
                      }
                      value={
                        form.homePenalties
                      }
                      onChange={(
                        event,
                      ) =>
                        updateForm(
                          "homePenalties",
                          event.target.value,
                        )
                      }
                      className="admin-input"
                    />
                  </Field>

                  <Field label="Rigori ospite">
                    <input
                      type="number"
                      min={
                        0
                      }
                      value={
                        form.awayPenalties
                      }
                      onChange={(
                        event,
                      ) =>
                        updateForm(
                          "awayPenalties",
                          event.target.value,
                        )
                      }
                      className="admin-input"
                    />
                  </Field>

                  <Field label="Stato">
                    <select
                      value={
                        form.status
                      }
                      onChange={(
                        event,
                      ) =>
                        updateForm(
                          "status",
                          event.target.value as FinalStageMatchStatus,
                        )
                      }
                      className="admin-input"
                    >
                      <option value="scheduled">
                        Programmata
                      </option>

                      <option value="live">
                        Live
                      </option>

                      <option value="played">
                        Giocata
                      </option>

                      <option value="finished">
                        Terminata
                      </option>

                      <option value="postponed">
                        Rinviata
                      </option>

                      <option value="cancelled">
                        Annullata
                      </option>

                      <option value="walkover">
                        Tavolino
                      </option>
                    </select>
                  </Field>

                  <Field label="Pubblicazione">
                    <label className="flex min-h-[48px] items-center gap-3 rounded-[12px] border border-[#06142E]/10 px-4">
                      <input
                        type="checkbox"
                        checked={
                          form.published
                        }
                        onChange={(
                          event,
                        ) =>
                          updateForm(
                            "published",
                            event.target.checked,
                          )
                        }
                        className="h-5 w-5 accent-[#0B5FFF]"
                      />

                      <span className="text-sm font-black text-[#06142E]">
                        Partita pubblicata
                      </span>
                    </label>
                  </Field>
                </div>
              </div>
            )}

            {actionError && (
              <p className="mt-5 rounded-[12px] bg-red-50 p-3 text-sm font-bold text-red-700">
                {
                  actionError
                }
              </p>
            )}

            {actionMessage && (
              <p className="mt-5 rounded-[12px] bg-green-50 p-3 text-sm font-bold text-green-700">
                {
                  actionMessage
                }
              </p>
            )}

            <button
              type="button"
              disabled={
                isSaving
              }
              onClick={() => {
                void saveMatch();
              }}
              className="mt-6 w-full rounded-[13px] bg-[#0B5FFF] px-5 py-4 text-sm font-black uppercase text-white disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
            >
              {isSaving
                ? "Salvataggio..."
                : editingMatchId
                  ? "Salva modifiche"
                  : "Crea partita"}
            </button>
          </section>
        )}

      {/* ======================================================
          CALENDARIO
          ====================================================== */}

      <section className="rounded-[20px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.10)] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
              Calendario
            </p>

            <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">
              Partite inserite
            </h2>
          </div>

          <select
            value={
              selectedCompetition
            }
            onChange={(
              event,
            ) => {
              const competition =
                event.target.value as FinalStageCompetition;

              setSelectedCompetition(
                competition,
              );

              if (
                !editingMatchId
              ) {
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    competition,
                  }),
                );
              }
            }}
            className="admin-input max-w-[230px]"
          >
            {COMPETITIONS.map(
              (
                competition,
              ) => (
                <option
                  key={
                    competition.value
                  }
                  value={
                    competition.value
                  }
                >
                  {
                    competition.label
                  }
                </option>
              ),
            )}
          </select>
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-sm font-bold text-[#06142E]/45">
            Caricamento...
          </p>
        ) : visibleMatches.length ===
          0 ? (
          <p className="py-10 text-center text-sm font-bold italic text-[#06142E]/40">
            Nessuna partita inserita.
          </p>
        ) : (
          <div className="mt-6 grid min-w-0 gap-4 xl:grid-cols-2">
            {visibleMatches.map(
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

                return (
                  <article
                    key={
                      match.id
                    }
                    className="flex h-full min-w-0 flex-col rounded-[16px] border border-[#06142E]/8 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#0B5FFF]">
                          {getRoundLabel(
                            match.round,
                          )}

                          {match.group
                            ? ` · Girone ${match.group}`
                            : ""}

                          {" · "}

                          {getLegLabel(
                            match.leg,
                          )}
                        </p>

                        <p className="mt-2 text-base font-black text-[#06142E]">
                          {homeTeam?.name ??
                            "Squadra casa"}{" "}
                          {renderScore(
                            match,
                          )}{" "}
                          {awayTeam?.name ??
                            "Squadra ospite"}
                        </p>

                        <p className="mt-2 text-xs font-bold text-[#06142E]/45">
                          {
                            match.date
                          }{" "}
                          ·{" "}
                          {
                            match.time
                          }{" "}
                          ·{" "}
                          {
                            match.venue
                          }
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-[9px] font-black uppercase ${
                          match.published
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {match.published
                          ? "Pubblicata"
                          : "Bozza"}
                      </span>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          startEditing(
                            match,
                          )
                        }
                        className="flex-1 rounded-[10px] bg-[#06142E] px-4 py-3 text-xs font-black uppercase text-white"
                      >
                        Modifica
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void removeMatch(
                            match,
                          );
                        }}
                        className="rounded-[10px] bg-red-50 px-4 py-3 text-xs font-black uppercase text-red-700"
                      >
                        Elimina
                      </button>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>
    </div>
    </AppShell>
  );
}

/*
 * ============================================================
 * FIELD
 * ============================================================
 */

function Field({
  label,
  children,
}: {
  label:
    string;

  children:
    React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-2 block text-xs font-black uppercase tracking-wide text-[#06142E]/45">
        {
          label
        }
      </span>

      {
        children
      }
    </div>
  );
}

/*
 * ============================================================
 * INTEGER OPZIONALE
 * ============================================================
 */

function parseOptionalInteger(
  value:
    string,
): number | undefined {
  if (
    !value.trim()
  ) {
    return undefined;
  }

  const parsed =
    Number(
      value,
    );

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed <
      0
  ) {
    return undefined;
  }

  return parsed;
}

/*
 * ============================================================
 * ORDINE TURNI
 * ============================================================
 */

function getRoundOrder(
  round:
    AdminFinalStageRound,
): number {
  switch (
    String(
      round,
    )
  ) {
    case "group":
      return 1;

    case "playoff":
      return 2;

    case "quarterfinal":
      return 3;

    case "semifinal":
      return 4;

    case "final":
      return 5;

    default:
      return 99;
  }
}

/*
 * ============================================================
 * LABEL TURNO
 * ============================================================
 */

function getRoundLabel(
  round:
    AdminFinalStageRound,
): string {
  switch (
    String(
      round,
    )
  ) {
    case "group":
      return "Girone";

    case "playoff":
      return "Playoff";

    case "quarterfinal":
      return "Quarti di finale";

    case "semifinal":
      return "Semifinale";

    case "final":
      return "Finale";

    default:
      return String(
        round,
      );
  }
}

/*
 * ============================================================
 * LABEL GARA
 * ============================================================
 */

function getLegLabel(
  leg:
    FinalStageLeg,
): string {
  switch (
    leg
  ) {
    case "first":
      return "Andata";

    case "second":
      return "Ritorno";

    case "single":
      return "Unica";

    default:
      return leg;
  }
}

/*
 * ============================================================
 * RISULTATO
 * ============================================================
 */

function renderScore(
  match:
    FinalStageMatch,
): string {
  if (
    match.homeScore ===
      undefined ||
    match.awayScore ===
      undefined
  ) {
    return "vs";
  }

  const score =
    `${match.homeScore} - ${match.awayScore}`;

  if (
    match.homePenalties ===
      undefined ||
    match.awayPenalties ===
      undefined
  ) {
    return score;
  }

  return `${score} (${match.homePenalties}-${match.awayPenalties} rig.)`;
}