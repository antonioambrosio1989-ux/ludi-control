"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AppShell from "@/components/ui/AppShell";

import {
  FirebaseFinalStagePlayerRepository,
} from "@/src/services/final-stage/FirebaseFinalStagePlayerRepository";

import {
  usePlayers,
} from "@/src/hooks/usePlayers";

import {
  useSeasonPlayers,
} from "@/src/hooks/useSeasonPlayers";

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
  CreateFinalStagePlayerInput,
  FinalStagePlayer,
} from "@/src/types/FinalStagePlayer";

import type {
  SeasonPlayer,
} from "@/src/types/SeasonPlayer";

/*
 * ============================================================
 * SCREEN
 * ============================================================
 */

export default function AdminFinalStageRostersScreen() {
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
  } = useTeams();

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
   * GIOCATORI DELLA COMPETIZIONE
   * ==========================================================
   */

  const {
    players,

    isLoading:
      playersLoading,

    error:
      playersError,
  } = usePlayers(
      currentSeason?.competitionId ??
        "__no-competition__",
    );

  /*
   * ==========================================================
   * ROSE REGULAR SEASON
   * ==========================================================
   */

  const {
    seasonPlayers,

    isLoading:
      seasonPlayersLoading,

    error:
      seasonPlayersError,
  } = useSeasonPlayers(
    currentSeasonId,
  );

  /*
   * ==========================================================
   * STATE
   * ==========================================================
   */

  const [
    selectedTeamId,
    setSelectedTeamId,
  ] =
    useState("");

  const [
    selectedPlayerIds,
    setSelectedPlayerIds,
  ] =
    useState<
      Set<string>
    >(
      new Set(),
    );

  const [
    savedFinalStagePlayers,
    setSavedFinalStagePlayers,
  ] =
    useState<
      FinalStagePlayer[]
    >([]);

  const [
    rosterLoading,
    setRosterLoading,
  ] =
    useState(false);

  const [
    rosterError,
    setRosterError,
  ] =
    useState<
      string | null
    >(null);

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(false);

  const [
    saveMessage,
    setSaveMessage,
  ] =
    useState<
      string | null
    >(null);

  /*
   * ==========================================================
   * MAPPE
   * ==========================================================
   */

  const playersById =
    useMemo(() => {
      return new Map(
        players.map(
          (
            player,
          ) => [
            String(
              player.id,
            ),

            player,
          ],
        ),
      );
    }, [
      players,
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
   * SQUADRA SELEZIONATA
   * ==========================================================
   */

  const selectedTeam =
  useMemo(() => {
    return sortedTeams.find(
      (
        team,
      ) =>
        String(
          team.id,
        ) ===
        selectedTeamId,
    );
  }, [
    sortedTeams,
    selectedTeamId,
  ]);

  /*
   * ==========================================================
   * GIOCATORI DELLA SQUADRA
   * ==========================================================
   */

  const teamSeasonPlayers =
    useMemo(() => {
      if (
        !selectedTeamId
      ) {
        return [];
      }

      return seasonPlayers
        .filter(
          (
            seasonPlayer,
          ) =>
            String(
              seasonPlayer.teamId,
            ) ===
            selectedTeamId,
        )
        .sort(
          (
            first,
            second,
          ) => {
            const firstPlayer =
              playersById.get(
                String(
                  first.playerId,
                ),
              );

            const secondPlayer =
              playersById.get(
                String(
                  second.playerId,
                ),
              );

            const firstName =
              firstPlayer
                ? `${firstPlayer.lastName} ${firstPlayer.firstName}`.trim()
                : "";

            const secondName =
              secondPlayer
                ? `${secondPlayer.lastName} ${secondPlayer.firstName}`.trim()
                : "";

            return firstName.localeCompare(
              secondName,
              "it",
            );
          },
        );
    }, [
      seasonPlayers,
      selectedTeamId,
      playersById,
    ]);

  /*
   * ==========================================================
   * CARICAMENTO LISTA SALVATA
   * ==========================================================
   */

  useEffect(() => {
    let active =
      true;

    async function loadRoster() {
      await Promise.resolve();

      if (
        !active
      ) {
        return;
      }

      if (
        !currentSeason?.id ||
        !selectedTeamId
      ) {
        setSavedFinalStagePlayers(
          [],
        );

        setSelectedPlayerIds(
          new Set(),
        );

        setRosterError(
          null,
        );

        setRosterLoading(
          false,
        );

        return;
      }

      setRosterLoading(
        true,
      );

      setRosterError(
        null,
      );

      setSaveMessage(
        null,
      );

      try {
        const roster =
          await FirebaseFinalStagePlayerRepository.getByTeam({
            seasonId:
              currentSeason.id,

            teamId:
              selectedTeamId,
          });

        if (
          !active
        ) {
          return;
        }

        setSavedFinalStagePlayers(
          roster,
        );

        setSelectedPlayerIds(
          new Set(
            roster.map(
              (
                player,
              ) =>
                String(
                  player.playerId,
                ),
            ),
          ),
        );
      } catch (
        error
      ) {
        if (
          !active
        ) {
          return;
        }

        console.error(
          "Errore caricamento rosa fasi finali:",
          error,
        );

        setSavedFinalStagePlayers(
          [],
        );

        setSelectedPlayerIds(
          new Set(),
        );

        setRosterError(
          error instanceof
            Error
            ? error.message
            : "Impossibile caricare la lista degli ammessi.",
        );
      } finally {
        if (
          active
        ) {
          setRosterLoading(
            false,
          );
        }
      }
    }

    void loadRoster();

    return () => {
      active =
        false;
    };
  }, [
    currentSeason?.id,
    selectedTeamId,
  ]);

  /*
   * ==========================================================
   * CAMBIO SQUADRA
   * ==========================================================
   */

  function handleTeamChange(
    teamId:
      string,
  ) {
    setSelectedTeamId(
      teamId,
    );

    setSelectedPlayerIds(
      new Set(),
    );

    setSavedFinalStagePlayers(
      [],
    );

    setRosterError(
      null,
    );

    setSaveMessage(
      null,
    );
  }

  /*
   * ==========================================================
   * TOGGLE GIOCATORE
   * ==========================================================
   */

  function togglePlayer(
    playerId:
      string,
  ) {
    setSelectedPlayerIds(
      (
        current,
      ) => {
        const next =
          new Set(
            current,
          );

        if (
          next.has(
            playerId,
          )
        ) {
          next.delete(
            playerId,
          );
        } else {
          next.add(
            playerId,
          );
        }

        return next;
      },
    );

    setSaveMessage(
      null,
    );
  }

  /*
   * ==========================================================
   * SELEZIONA TUTTI
   * ==========================================================
   */

  function selectAll() {
    setSelectedPlayerIds(
      new Set(
        teamSeasonPlayers.map(
          (
            seasonPlayer,
          ) =>
            String(
              seasonPlayer.playerId,
            ),
        ),
      ),
    );

    setSaveMessage(
      null,
    );
  }

  /*
   * ==========================================================
   * DESELEZIONA TUTTI
   * ==========================================================
   */

  function clearSelection() {
    setSelectedPlayerIds(
      new Set(),
    );

    setSaveMessage(
      null,
    );
  }

  /*
   * ==========================================================
   * COSTRUZIONE INPUT
   * ==========================================================
   */

  function buildSelectedPlayers():
    CreateFinalStagePlayerInput[] {
    if (
      !currentSeason?.id ||
      !selectedTeamId
    ) {
      return [];
    }

    return teamSeasonPlayers
      .filter(
        (
          seasonPlayer,
        ) =>
          selectedPlayerIds.has(
            String(
              seasonPlayer.playerId,
            ),
          ),
      )
      .map(
        (
          seasonPlayer,
        ) =>
          mapSeasonPlayerToFinalStageInput({
            seasonId:
              currentSeason.id,

            teamId:
              selectedTeamId,

            seasonPlayer,
          }),
      );
  }

  /*
   * ==========================================================
   * SALVA
   * ==========================================================
   */

  async function saveRoster() {
    if (
      !currentSeason?.id
    ) {
      setRosterError(
        "Nessuna stagione attiva.",
      );

      return;
    }

    if (
      !selectedTeamId
    ) {
      setRosterError(
        "Seleziona una squadra.",
      );

      return;
    }

    const selectedPlayers =
      buildSelectedPlayers();

    const confirmed =
      window.confirm(
        selectedPlayers.length >
          0
          ? `Salvare ${selectedPlayers.length} giocatori come ammessi alle fasi finali per ${selectedTeam?.name ?? "la squadra selezionata"}?`
          : `La lista di ${selectedTeam?.name ?? "questa squadra"} verrà svuotata. Continuare?`,
      );

    if (
      !confirmed
    ) {
      return;
    }

    setIsSaving(
      true,
    );

    setRosterError(
      null,
    );

    setSaveMessage(
      null,
    );

    try {
      await FirebaseFinalStagePlayerRepository.replaceTeamPlayers({
        seasonId:
          currentSeason.id,

        teamId:
          selectedTeamId,

        players:
          selectedPlayers,
      });

      const saved =
        await FirebaseFinalStagePlayerRepository.getByTeam({
          seasonId:
            currentSeason.id,

          teamId:
            selectedTeamId,
        });

      setSavedFinalStagePlayers(
        saved,
      );

      setSelectedPlayerIds(
        new Set(
          saved.map(
            (
              player,
            ) =>
              String(
                player.playerId,
              ),
          ),
        ),
      );

      setSaveMessage(
        `Lista salvata: ${saved.length} giocatori ammessi.`,
      );
    } catch (
      error
    ) {
      console.error(
        "Errore salvataggio rosa fasi finali:",
        error,
      );

      setRosterError(
        error instanceof
          Error
          ? error.message
          : "Impossibile salvare la lista degli ammessi.",
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  /*
   * ==========================================================
   * MODIFICHE NON SALVATE
   * ==========================================================
   */

  const hasUnsavedChanges =
    useMemo(() => {
      const savedIds =
        new Set(
          savedFinalStagePlayers.map(
            (
              player,
            ) =>
              String(
                player.playerId,
              ),
          ),
        );

      if (
        savedIds.size !==
        selectedPlayerIds.size
      ) {
        return true;
      }

      for (
        const playerId of
          selectedPlayerIds
      ) {
        if (
          !savedIds.has(
            playerId,
          )
        ) {
          return true;
        }
      }

      return false;
    }, [
      savedFinalStagePlayers,
      selectedPlayerIds,
    ]);

  /*
   * ==========================================================
   * LOADING / ERROR
   * ==========================================================
   */

  const isLoading =
  competitionLoading ||
  teamsLoading ||
  seasonTeamsLoading ||
  playersLoading ||
  seasonPlayersLoading;

  const loadingError =
  competitionError ||
  teamsError ||
  seasonTeamsError ||
  playersError ||
  seasonPlayersError;

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

      <header className="mt-6 mb-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
          Centro di controllo
        </p>

        <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
          Giocatori ammessi
        </h1>

        <p className="mt-1 max-w-2xl text-sm font-bold leading-6 text-[#06142E]/50">
          Seleziona manualmente,
          squadra per squadra,
          i giocatori ammessi
          alle competizioni finali.
          La stessa lista viene
          utilizzata per Champions
          League, Europa League,
          Conference League e per
          l&apos;assegnazione dei
          titoli nel Palmarès.
        </p>
      </header>

      {/* ======================================================
          ERRORI CARICAMENTO
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
          STAGIONE
          ====================================================== */}

      {!isLoading &&
        !loadingError &&
        !currentSeason && (
          <section className="rounded-[20px] bg-white p-6 text-center shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
            <p className="text-sm font-bold text-[#06142E]/45">
              Nessuna stagione attiva.
            </p>
          </section>
        )}

      {!isLoading &&
        !loadingError &&
        currentSeason && (
          <>
            {/* ==================================================
                SELEZIONE SQUADRA
                ================================================== */}

            <section className="rounded-[20px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.10)] sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
                Stagione
              </p>

              <p className="mt-1 text-lg font-black uppercase text-[#06142E]">
                {
                  currentSeason.name
                }
              </p>

              <div className="mt-5">
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-[#06142E]/45">
                  Squadra
                </label>

                <select
                  value={
                    selectedTeamId
                  }
                  disabled={
                    isSaving
                  }
                  onChange={(
                    event,
                  ) =>
                    handleTeamChange(
                      event.target.value,
                    )
                  }
                  className="admin-input disabled:opacity-50"
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
              </div>
            </section>

            {/* ==================================================
                LISTA GIOCATORI
                ================================================== */}

            {selectedTeamId && (
              <section className="rounded-[20px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.10)] sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
                      Rosa Regular Season
                    </p>

                    <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">
                      {
                        selectedTeam?.name ??
                        "Squadra"
                      }
                    </h2>

                    <p className="mt-2 text-xs font-bold text-[#06142E]/45">
                      {
                        selectedPlayerIds.size
                      }{" "}
                      giocatori selezionati
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        isSaving ||
                        rosterLoading ||
                        teamSeasonPlayers.length ===
                          0
                      }
                      onClick={
                        selectAll
                      }
                      className="rounded-[10px] bg-[#06142E]/5 px-3 py-2 text-[10px] font-black uppercase text-[#06142E] disabled:opacity-40"
                    >
                      Seleziona tutti
                    </button>

                    <button
                      type="button"
                      disabled={
                        isSaving ||
                        rosterLoading ||
                        selectedPlayerIds.size ===
                          0
                      }
                      onClick={
                        clearSelection
                      }
                      className="rounded-[10px] bg-[#06142E]/5 px-3 py-2 text-[10px] font-black uppercase text-[#06142E] disabled:opacity-40"
                    >
                      Deseleziona
                    </button>
                  </div>
                </div>

                {/* LOADING */}

                {rosterLoading ? (
                  <p className="py-10 text-center text-sm font-bold text-[#06142E]/45">
                    Caricamento lista...
                  </p>
                ) : teamSeasonPlayers.length ===
                  0 ? (
                  <p className="py-10 text-center text-sm font-bold italic text-[#06142E]/40">
                    Nessun giocatore presente
                    nella rosa della squadra.
                  </p>
                ) : (
                  <div className="mt-6 divide-y divide-[#06142E]/8">
                    {teamSeasonPlayers.map(
                      (
                        seasonPlayer,
                      ) => {
                        const player =
                          playersById.get(
                            String(
                              seasonPlayer.playerId,
                            ),
                          );

                        const playerId =
                          String(
                            seasonPlayer.playerId,
                          );

                        const checked =
                          selectedPlayerIds.has(
                            playerId,
                          );

                        const playerName =
                          player
                            ? `${player.firstName} ${player.lastName}`.trim()
                            : "Giocatore non disponibile";

                        return (
                          <label
                            key={
                              seasonPlayer.id
                            }
                            className="flex cursor-pointer items-center gap-4 py-4 first:pt-0 last:pb-0"
                          >
                            {/* CHECKBOX */}

                            <input
                              type="checkbox"
                              checked={
                                checked
                              }
                              disabled={
                                isSaving
                              }
                              onChange={() =>
                                togglePlayer(
                                  playerId,
                                )
                              }
                              className="h-5 w-5 shrink-0 accent-[#0B5FFF]"
                            />

                            {/* GIOCATORE */}

                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-black text-[#06142E]">
                                {
                                  playerName
                                }
                              </p>

                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold uppercase text-[#06142E]/40">
                                <span>
                                  {
                                    seasonPlayer.role
                                  }
                                </span>

                                {seasonPlayer.shirtNumber !==
                                  undefined && (
                                  <span>
                                    N.{" "}
                                    {
                                      seasonPlayer.shirtNumber
                                    }
                                  </span>
                                )}

                                <span>
                                  {
                                    getSeasonPlayerStatusLabel(
                                      seasonPlayer.status,
                                    )
                                  }
                                </span>
                              </div>
                            </div>

                            {/* STATO */}

                            <span
                              className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-black uppercase ${
                                checked
                                  ? "bg-green-100 text-green-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {checked
                                ? "Ammesso"
                                : "Escluso"}
                            </span>
                          </label>
                        );
                      },
                    )}
                  </div>
                )}

                {/* ERROR */}

                {rosterError && (
                  <p className="mt-5 rounded-[12px] bg-red-50 p-3 text-sm font-bold text-red-700">
                    {
                      rosterError
                    }
                  </p>
                )}

                {/* SUCCESS */}

                {saveMessage && (
                  <p className="mt-5 rounded-[12px] bg-green-50 p-3 text-sm font-bold text-green-700">
                    {
                      saveMessage
                    }
                  </p>
                )}

                {/* SAVE */}

                <button
                  type="button"
                  disabled={
                    isSaving ||
                    rosterLoading ||
                    !hasUnsavedChanges
                  }
                  onClick={() => {
                    void saveRoster();
                  }}
                  className="mt-6 w-full rounded-[13px] bg-[#0B5FFF] px-5 py-4 text-sm font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSaving
                    ? "Salvataggio..."
                    : hasUnsavedChanges
                      ? "Salva lista ammessi"
                      : "Lista aggiornata"}
                </button>
              </section>
            )}
          </>
        )}
    </div>
    </AppShell>
  );
}

/*
 * ============================================================
 * MAPPING SEASON PLAYER → FINAL STAGE PLAYER
 * ============================================================
 */

function mapSeasonPlayerToFinalStageInput({
  seasonId,
  teamId,
  seasonPlayer,
}: {
  seasonId: string;

  teamId: string;

  seasonPlayer:
    SeasonPlayer;
}): CreateFinalStagePlayerInput {
  return {
    seasonId,

    teamId,

    playerId:
      String(
        seasonPlayer.playerId,
      ),

    role:
      seasonPlayer.role,

    ...(seasonPlayer.shirtNumber !==
    undefined
      ? {
          shirtNumber:
            seasonPlayer.shirtNumber,
        }
      : {}),
  };
}

/*
 * ============================================================
 * LABEL STATO SEASON PLAYER
 * ============================================================
 */

function getSeasonPlayerStatusLabel(
  status:
    SeasonPlayer["status"],
): string {
  switch (
    status
  ) {
    case "active":
      return "Attivo";

    case "inactive":
      return "Inattivo";

    case "transferred":
      return "Trasferito";

    case "withdrawn":
      return "Ritirato";

    default:
      return status;
  }
}