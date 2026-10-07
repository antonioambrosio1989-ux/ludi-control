"use client";

import {
  useMemo,
  useState,
  type FormEvent,
} from "react";

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

import {
  FirebaseSeasonPlayerRepository,
} from "@/src/services/player/FirebaseSeasonPlayerRepository";

import {
  FirebasePlayerRepository,
} from "@/src/services/player/FirebasePlayerRepository";

import type {
  PlayerProfile,
  PreferredFoot,
} from "@/src/types/PlayerProfile";

import type {
  SeasonPlayer,
  SeasonPlayerRole,
} from "@/src/types/SeasonPlayer";

/*
 * ============================================================
 * RUOLI
 * ============================================================
 */

export const SEASON_ROSTER_ROLES:
  SeasonPlayerRole[] = [
    "Portiere",
    "Difensore",
    "Attaccante",
  ];

/*
 * ============================================================
 * HOOK
 * ============================================================
 */

export function useSeasonRosterData() {
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

  /*
   * ==========================================================
   * SQUADRE ISCRITTE ALLA STAGIONE
   * ==========================================================
   */

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
      arePlayersLoading,

    error:
      playersError,

    refresh:
      refreshPlayers,
  } =
    usePlayers(
      currentSeason?.competitionId ??
        "__no-competition__",
    );

  /*
   * ==========================================================
   * ROSE STAGIONALI
   * ==========================================================
   */

  const {
    entries:
      seasonPlayers,

    isLoading:
      seasonPlayersLoading,

    error:
      seasonPlayersError,

    refresh:
      refreshSeasonPlayers,
  } =
    useSeasonPlayers(
      currentSeasonId,
    );

  /*
   * ==========================================================
   * SQUADRA SELEZIONATA
   * ==========================================================
   */

  const [
    selectedTeamId,
    setSelectedTeamId,
  ] =
    useState(
      "",
    );

  /*
   * ==========================================================
   * VISIBILITÀ FORM
   * ==========================================================
   */

  const [
    showAddForm,
    setShowAddForm,
  ] =
    useState(
      false,
    );

  /*
   * ==========================================================
   * MODALITÀ GIOCATORE
   * ==========================================================
   */

  const [
    playerFormMode,
    setPlayerFormMode,
  ] =
    useState<
      "existing" | "new"
    >(
      "existing",
    );

  /*
   * ==========================================================
   * MODALITÀ FORM
   * ==========================================================
   */

  const [
    formMode,
    setFormMode,
  ] =
    useState<
      "create" | "edit"
    >(
      "create",
    );

  /*
   * ==========================================================
   * ENTRY IN MODIFICA
   * ==========================================================
   */

  const [
    editingEntry,
    setEditingEntry,
  ] =
    useState<
      SeasonPlayer | null
    >(
      null,
    );

  /*
   * ==========================================================
   * PROFILO IN MODIFICA
   * ==========================================================
   */

  const [
    editingPlayer,
    setEditingPlayer,
  ] =
    useState<
      PlayerProfile | undefined
    >();

  /*
   * ==========================================================
   * PROFILO GIOCATORE
   * ==========================================================
   */

  const [
    newFirstName,
    setNewFirstName,
  ] =
    useState(
      "",
    );

  const [
    newLastName,
    setNewLastName,
  ] =
    useState(
      "",
    );

  const [
    newBirthYear,
    setNewBirthYear,
  ] =
    useState(
      "",
    );

  const [
    newPhotoUrl,
    setNewPhotoUrl,
  ] =
    useState(
      "",
    );

  const [
    newBaseRating,
    setNewBaseRating,
  ] =
    useState(
      "",
    );

  const [
    newPreferredFoot,
    setNewPreferredFoot,
  ] =
    useState<
      PreferredFoot | ""
    >(
      "",
    );

  /*
   * ==========================================================
   * DATI ROSA STAGIONALE
   * ==========================================================
   */

  const [
    selectedPlayerId,
    setSelectedPlayerId,
  ] =
    useState(
      "",
    );

  const [
    role,
    setRole,
  ] =
    useState<
      SeasonPlayerRole
    >(
      "Attaccante",
    );

  const [
    shirtNumber,
    setShirtNumber,
  ] =
    useState(
      "",
    );

  const [
    search,
    setSearch,
  ] =
    useState(
      "",
    );

  /*
   * ==========================================================
   * STATO OPERAZIONI
   * ==========================================================
   */

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(
      false,
    );

  const [
    removingEntryId,
    setRemovingEntryId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    formError,
    setFormError,
  ] =
    useState<
      string | null
    >(
      null,
    );

    /*
 * ============================================================
 * SQUADRE PARTECIPANTI
 * ============================================================
 */

  const participatingTeams =
    useMemo(() => {
      const participatingIds =
        new Set(
          seasonTeamEntries.map(
            (
              entry,
            ) =>
              entry.teamId,
          ),
        );

      return teams.filter(
        (
          team,
        ) =>
          participatingIds.has(
            team.id,
          ),
      );
    }, [
      seasonTeamEntries,
      teams,
    ]);

  /*
   * ============================================================
   * SQUADRA SELEZIONATA EFFETTIVA
   * ============================================================
   */

  const effectiveSelectedTeamId =
    selectedTeamId &&
    participatingTeams.some(
      (
        team,
      ) =>
        String(
          team.id,
        ) ===
        String(
          selectedTeamId,
        ),
    )
      ? selectedTeamId
      : participatingTeams[0]
          ?.id ?? "";

  const effectiveSelectedTeam =
    useMemo(
      () =>
        participatingTeams.find(
          (
            team,
          ) =>
            String(
              team.id,
            ) ===
            String(
              effectiveSelectedTeamId,
            ),
        ),
      [
        participatingTeams,
        effectiveSelectedTeamId,
      ],
    );

  /*
   * ============================================================
   * ROSA SQUADRA SELEZIONATA
   * ============================================================
   */

  const selectedTeamRoster =
    useMemo(
      () =>
        seasonPlayers.filter(
          (
            entry,
          ) =>
            String(
              entry.teamId,
            ) ===
              String(
                effectiveSelectedTeamId,
              ) &&
            entry.status !==
              "withdrawn",
        ),
      [
        seasonPlayers,
        effectiveSelectedTeamId,
      ],
    );

  /*
   * ============================================================
   * GIOCATORI GIÀ ISCRITTI
   * ============================================================
   */

  const registeredPlayerIds =
    useMemo(
      () =>
        new Set(
          seasonPlayers
            .filter(
              (
                entry,
              ) =>
                entry.status !==
                "withdrawn",
            )
            .map(
              (
                entry,
              ) =>
                entry.playerId,
            ),
        ),
      [
        seasonPlayers,
      ],
    );

  /*
   * ============================================================
   * GIOCATORI DISPONIBILI
   * ============================================================
   */

  const availablePlayers =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return players.filter(
        (
          player,
        ) => {
          if (
            registeredPlayerIds.has(
              player.id,
            )
          ) {
            return false;
          }

          if (
            !normalizedSearch
          ) {
            return true;
          }

          const fullName =
            `${player.firstName} ${player.lastName}`
              .trim()
              .toLowerCase();

          return fullName.includes(
            normalizedSearch,
          );
        },
      );
    }, [
      players,
      registeredPlayerIds,
      search,
    ]);

  /*
   * ============================================================
   * ROSA DIVISA PER RUOLO
   * ============================================================
   */

  const rosterByRole =
    useMemo(
      () =>
        Object.fromEntries(
          SEASON_ROSTER_ROLES.map(
            (
              currentRole,
            ) => [
              currentRole,

              selectedTeamRoster
                .filter(
                  (
                    entry,
                  ) =>
                    entry.role ===
                    currentRole,
                )
                .sort(
                  (
                    first,
                    second,
                  ) =>
                    (
                      first.shirtNumber ??
                      999
                    ) -
                    (
                      second.shirtNumber ??
                      999
                    ),
                ),
            ],
          ),
        ) as Record<
          SeasonPlayerRole,
          SeasonPlayer[]
        >,
      [
        selectedTeamRoster,
      ],
    );

  /*
   * ============================================================
   * LOADING / ERROR
   * ============================================================
   */

  const isLoading =
    competitionLoading ||
    teamsLoading ||
    seasonTeamsLoading ||
    arePlayersLoading ||
    seasonPlayersLoading;

  const loadingError =
    competitionError ||
    teamsError ||
    seasonTeamsError ||
    playersError ||
    seasonPlayersError;

    /*
 * ============================================================
 * RESET FORM
 * ============================================================
 */

  function resetAddForm() {
    setSelectedPlayerId(
      "",
    );

    setRole(
      "Attaccante",
    );

    setShirtNumber(
      "",
    );

    setSearch(
      "",
    );

    setFormError(
      null,
    );

    setPlayerFormMode(
      "existing",
    );

    setFormMode(
      "create",
    );

    setEditingEntry(
      null,
    );

    setEditingPlayer(
      undefined,
    );

    setNewFirstName(
      "",
    );

    setNewLastName(
      "",
    );

    setNewBirthYear(
      "",
    );

    setNewPhotoUrl(
      "",
    );

    setNewBaseRating(
      "",
    );

    setNewPreferredFoot(
      "",
    );
  }

  /*
   * ============================================================
   * CHIUSURA FORM
   * ============================================================
   */

  function closeAddForm() {
    resetAddForm();

    setShowAddForm(
      false,
    );
  }

  /*
   * ============================================================
   * APERTURA CREAZIONE
   * ============================================================
   */

  function openCreateForm() {
    resetAddForm();

    setFormMode(
      "create",
    );

    setPlayerFormMode(
      "existing",
    );

    setShowAddForm(
      true,
    );
  }

  /*
   * ============================================================
   * APERTURA MODIFICA
   * ============================================================
   */

  function openEditForm(
    entry:
      SeasonPlayer,

    player?:
      PlayerProfile,
  ) {
    resetAddForm();

    setFormMode(
      "edit",
    );

    setEditingEntry(
      entry,
    );

    setEditingPlayer(
      player,
    );

    setSelectedPlayerId(
      entry.playerId,
    );

    setRole(
      entry.role,
    );

    setShirtNumber(
      entry.shirtNumber?.toString() ??
        "",
    );

    if (
      player
    ) {
      setNewFirstName(
        player.firstName,
      );

      setNewLastName(
        player.lastName,
      );

      setNewBirthYear(
        player.birthYear?.toString() ??
          "",
      );

      setNewPhotoUrl(
        player.photoUrl ??
          "",
      );

      setNewBaseRating(
        player.baseRating?.toString() ??
          "",
      );

      setNewPreferredFoot(
        player.preferredFoot ??
          "",
      );
    }

    setShowAddForm(
      true,
    );
  }

  /*
 * ============================================================
 * CREA / AGGIUNGI GIOCATORE
 * ============================================================
 */

  async function handleAddPlayer(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
  !currentSeasonId ||
  !currentSeason?.competitionId ||
  !effectiveSelectedTeamId ||
  isSaving
) {
  return;
}

const seasonId =
  currentSeasonId;

const competitionId =
  currentSeason.competitionId;

    if (
      playerFormMode ===
        "existing" &&
      !selectedPlayerId
    ) {
      setFormError(
        "Seleziona un giocatore.",
      );

      return;
    }

    if (
      playerFormMode ===
        "new" &&
      (
        newFirstName
          .trim()
          .length < 2 ||
        newLastName
          .trim()
          .length < 2
      )
    ) {
      setFormError(
        "Inserisci nome e cognome del nuovo giocatore.",
      );

      return;
    }

    /*
     * ANNO DI NASCITA
     */

    const normalizedBirthYear =
      newBirthYear.trim()
        ? Number(
            newBirthYear,
          )
        : undefined;

    if (
      playerFormMode ===
        "new" &&
      normalizedBirthYear !==
        undefined &&
      (
        !Number.isInteger(
          normalizedBirthYear,
        ) ||
        normalizedBirthYear <
          1940 ||
        normalizedBirthYear >
          new Date().getFullYear()
      )
    ) {
      setFormError(
        "Inserisci un anno di nascita valido.",
      );

      return;
    }

    /*
     * RATING
     */

    const normalizedBaseRating =
      newBaseRating.trim()
        ? Number(
            newBaseRating,
          )
        : undefined;

    if (
      normalizedBaseRating !==
        undefined &&
      (
        !Number.isInteger(
          normalizedBaseRating,
        ) ||
        normalizedBaseRating <
          40 ||
        normalizedBaseRating >
          99
      )
    ) {
      setFormError(
        "Il rating deve essere compreso tra 40 e 99.",
      );

      return;
    }

    /*
     * NUMERO MAGLIA
     */

    const normalizedShirtNumber =
      shirtNumber.trim()
        ? Number(
            shirtNumber,
          )
        : undefined;

    if (
      normalizedShirtNumber !==
        undefined &&
      (
        !Number.isInteger(
          normalizedShirtNumber,
        ) ||
        normalizedShirtNumber <
          1 ||
        normalizedShirtNumber >
          99
      )
    ) {
      setFormError(
        "Il numero di maglia deve essere compreso tra 1 e 99.",
      );

      return;
    }

    const numberAlreadyUsed =
      normalizedShirtNumber !==
        undefined &&
      selectedTeamRoster.some(
        (
          entry,
        ) =>
          entry.shirtNumber ===
          normalizedShirtNumber,
      );

    if (
      numberAlreadyUsed
    ) {
      setFormError(
        "Questo numero di maglia è già utilizzato nella squadra.",
      );

      return;
    }

    setIsSaving(
      true,
    );

    setFormError(
      null,
    );

    try {
      let playerId =
        selectedPlayerId;

      /*
       * CREAZIONE NUOVO GIOCATORE
       */

      if (
        playerFormMode ===
        "new"
      ) {
        const createdPlayerId =
          await FirebasePlayerRepository.create({
            competitionId,

            firstName:
              newFirstName.trim(),

            lastName:
              newLastName.trim(),

            birthYear:
              normalizedBirthYear,

            photoUrl:
              newPhotoUrl.trim() ||
              undefined,

            baseRating:
              normalizedBaseRating,

            preferredFoot:
              newPreferredFoot ||
              undefined,
          });

        playerId =
          createdPlayerId;
      }

      /*
       * ISCRIZIONE ALLA ROSA
       */

      await FirebaseSeasonPlayerRepository.create({
        seasonId,

        teamId:
          effectiveSelectedTeamId,

        playerId,

        role,

        shirtNumber:
          normalizedShirtNumber,
      });

      await refreshPlayers();

      await refreshSeasonPlayers();

      closeAddForm();
    } catch (
      currentError
    ) {
      console.error(
        "Errore creazione/iscrizione giocatore:",
        currentError,
      );

      setFormError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile aggiungere il giocatore alla rosa.",
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }
  
/*
 * ============================================================
 * MODIFICA GIOCATORE
 * ============================================================
 */

  async function handleEditPlayer() {
    if (
      !editingEntry ||
      !effectiveSelectedTeamId ||
      isSaving
    ) {
      return;
    }

    const playerId =
      editingPlayer?.id ??
      editingEntry.playerId;

    if (
      !playerId
    ) {
      setFormError(
        "Impossibile identificare il giocatore da modificare.",
      );

      return;
    }

    if (
      newFirstName
        .trim()
        .length < 2 ||
      newLastName
        .trim()
        .length < 2
    ) {
      setFormError(
        "Inserisci nome e cognome validi.",
      );

      return;
    }

    /*
     * ANNO
     */

    const normalizedBirthYear =
      newBirthYear.trim()
        ? Number(
            newBirthYear,
          )
        : undefined;

    if (
      normalizedBirthYear !==
        undefined &&
      (
        !Number.isInteger(
          normalizedBirthYear,
        ) ||
        normalizedBirthYear <
          1940 ||
        normalizedBirthYear >
          new Date().getFullYear()
      )
    ) {
      setFormError(
        "Inserisci un anno di nascita valido.",
      );

      return;
    }

    /*
     * RATING
     *
     * null = torna NP
     */

    const normalizedBaseRating =
      newBaseRating.trim()
        ? Number(
            newBaseRating,
          )
        : null;

    if (
      normalizedBaseRating !==
        null &&
      (
        !Number.isInteger(
          normalizedBaseRating,
        ) ||
        normalizedBaseRating <
          40 ||
        normalizedBaseRating >
          99
      )
    ) {
      setFormError(
        "Il rating deve essere compreso tra 40 e 99.",
      );

      return;
    }

    /*
     * NUMERO
     */

    const normalizedShirtNumber =
      shirtNumber.trim()
        ? Number(
            shirtNumber,
          )
        : undefined;

    if (
      normalizedShirtNumber !==
        undefined &&
      (
        !Number.isInteger(
          normalizedShirtNumber,
        ) ||
        normalizedShirtNumber <
          1 ||
        normalizedShirtNumber >
          99
      )
    ) {
      setFormError(
        "Il numero di maglia deve essere compreso tra 1 e 99.",
      );

      return;
    }

    const numberAlreadyUsed =
      normalizedShirtNumber !==
        undefined &&
      selectedTeamRoster.some(
        (
          entry,
        ) =>
          entry.id !==
            editingEntry.id &&
          entry.shirtNumber ===
            normalizedShirtNumber,
      );

    if (
      numberAlreadyUsed
    ) {
      setFormError(
        "Questo numero di maglia è già utilizzato nella squadra.",
      );

      return;
    }

    setIsSaving(
      true,
    );

    setFormError(
      null,
    );

    try {
      /*
       * PROFILO GLOBALE
       */

      await FirebasePlayerRepository.update({
        playerId,

        firstName:
          newFirstName.trim(),

        lastName:
          newLastName.trim(),

        birthYear:
          normalizedBirthYear,

        photoUrl:
          newPhotoUrl.trim() ||
          undefined,

        baseRating:
          normalizedBaseRating,

        preferredFoot:
          newPreferredFoot ||
          undefined,
      });

      /*
       * DATI STAGIONALI
       */

      await FirebaseSeasonPlayerRepository.update({
        seasonPlayerId:
          editingEntry.id,

        teamId:
          effectiveSelectedTeamId,

        role,

        shirtNumber:
          normalizedShirtNumber,

        status:
          editingEntry.status,
      });

      await refreshPlayers();

      await refreshSeasonPlayers();

      closeAddForm();
    } catch (
      currentError
    ) {
      console.error(
        "Errore modifica giocatore:",
        currentError,
      );

      setFormError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile salvare le modifiche.",
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

/*
 * ============================================================
 * RIMOZIONE DALLA ROSA
 * ============================================================
 */

  async function handleRemovePlayer(
    entry:
      SeasonPlayer,
  ) {
    const player =
      getPlayerProfile(
        players,

        entry.playerId,
      );

    const playerName =
      player
        ? `${player.firstName} ${player.lastName}`
        : "questo giocatore";

    const teamName =
      effectiveSelectedTeam
        ?.aliasName ??
      effectiveSelectedTeam
        ?.name ??
      "questa squadra";

    const confirmed =
      window.confirm(
        `Vuoi rimuovere ${playerName} dalla rosa di ${teamName}?`,
      );

    if (
      !confirmed
    ) {
      return;
    }

    setRemovingEntryId(
      entry.id,
    );

    try {
      await FirebaseSeasonPlayerRepository.remove(
        entry.id,
      );

      await refreshSeasonPlayers();
    } catch (
      currentError
    ) {
      console.error(
        "Errore rimozione giocatore:",
        currentError,
      );

      window.alert(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile rimuovere il giocatore dalla rosa.",
      );
    } finally {
      setRemovingEntryId(
        null,
      );
    }
  }

/*
 * ============================================================
 * OUTPUT HOOK
 * ============================================================
 */

  return {
    currentSeason,

    teams,
    players,
    seasonPlayers,

    participatingTeams,

    selectedTeamId,
    setSelectedTeamId,

    effectiveSelectedTeamId,
    effectiveSelectedTeam,

    selectedTeamRoster,
    availablePlayers,
    rosterByRole,

    showAddForm,
    setShowAddForm,

    playerFormMode,
    setPlayerFormMode,

    formMode,
    setFormMode,

    editingEntry,
    editingPlayer,

    selectedPlayerId,
    setSelectedPlayerId,

    role,
    setRole,

    shirtNumber,
    setShirtNumber,

    search,
    setSearch,

    newFirstName,
    setNewFirstName,

    newLastName,
    setNewLastName,

    newBirthYear,
    setNewBirthYear,

    newPhotoUrl,
    setNewPhotoUrl,

    newBaseRating,
    setNewBaseRating,

    newPreferredFoot,
    setNewPreferredFoot,

    isSaving,

    removingEntryId,

    formError,
    setFormError,

    isLoading,
    loadingError,

    refreshPlayers,
    refreshSeasonPlayers,

    resetAddForm,
    closeAddForm,
    openCreateForm,
    openEditForm,

    handleAddPlayer,
    handleEditPlayer,
    handleRemovePlayer,
  };
}

/*
 * ============================================================
 * RECUPERO PROFILO GIOCATORE
 * ============================================================
 */

function getPlayerProfile(
  players:
    PlayerProfile[],

  playerId:
    string,
) {
  return players.find(
    (
      player,
    ) =>
      String(
        player.id,
      ) ===
      String(
        playerId,
      ),
  );
}