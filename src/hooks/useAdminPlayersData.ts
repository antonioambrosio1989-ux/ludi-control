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
  useCompetition,
} from "@/src/contexts/CompetitionContext";

import {
  useSeasonPlayers,
} from "@/src/hooks/useSeasonPlayers";

import {
  FirebasePlayerRepository,
} from "@/src/services/player/FirebasePlayerRepository";

import {
  FirebaseSeasonPlayerRepository,
} from "@/src/services/player/FirebaseSeasonPlayerRepository";

import {
  PlayerMergeService,
} from "@/src/services/player/PlayerMergeService";

import type {
  PlayerProfile,
} from "@/src/types/PlayerProfile";

import type {
  SeasonPlayerRole,
} from "@/src/types/SeasonPlayer";

/*
 * ============================================================
 * FORM MODE
 * ============================================================
 */

export type AdminPlayerFormMode =
  | {
      type: "create";
    }
  | {
      type: "edit";
      playerId: string;
    };

/*
 * ============================================================
 * HOOK
 * ============================================================
 */

export function useAdminPlayersData() {
  /*
   * ==========================================================
   * COMPETIZIONE / STAGIONE
   * ==========================================================
   */

  const {
    selectedCompetitionId,
    currentSeason,

    isLoading:
      competitionLoading,

    error:
      competitionError,
  } =
    useCompetition();

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

    refresh,
  } =
    usePlayers(
      selectedCompetitionId ??
        "__no-competition__",
    );

  /*
   * ==========================================================
   * GIOCATORI STAGIONALI
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
    currentSeason?.id,
  );

  /*
 * ==========================================================
 * LOADING / ERROR
 * ==========================================================
 */

const isLoading =
  playersLoading ||
  competitionLoading ||
  seasonPlayersLoading;

const error =
  playersError ||
  competitionError ||
  seasonPlayersError;

  /*
   * ==========================================================
   * RICERCA
   * ==========================================================
   */

  const [
    search,
    setSearch,
  ] =
    useState(
      "",
    );

  /*
   * ==========================================================
   * FORM MODE
   * ==========================================================
   */

  const [
    formMode,
    setFormMode,
  ] =
    useState<
      AdminPlayerFormMode | null
    >(
      null,
    );

  /*
   * ==========================================================
   * DATI PROFILO
   * ==========================================================
   */

  const [
    firstName,
    setFirstName,
  ] =
    useState(
      "",
    );

  const [
    lastName,
    setLastName,
  ] =
    useState(
      "",
    );

  const [
    photoUrl,
    setPhotoUrl,
  ] =
    useState(
      "",
    );

  const [
    birthYear,
    setBirthYear,
  ] =
    useState(
      "",
    );

  const [
    coverImageUrl,
    setCoverImageUrl,
  ] =
    useState(
      "",
    );

  const [nationality, setNationality] = useState("IT");

  const [
    baseRating,
    setBaseRating,
  ] =
    useState(
      "",
    );

  /*
   * ==========================================================
   * DATI STAGIONALI
   * ==========================================================
   */

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
    editingSeasonPlayerId,
    setEditingSeasonPlayerId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    editingTeamId,
    setEditingTeamId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    editingSeasonPlayerStatus,
    setEditingSeasonPlayerStatus,
  ] =
    useState<
      | "active"
      | "inactive"
      | "transferred"
      | "withdrawn"
    >(
      "active",
    );

  /*
   * ==========================================================
   * SALVATAGGIO / RIMOZIONE
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
    removingPlayerId,
    setRemovingPlayerId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    selectionMode,
    setSelectionMode,
  ] =
    useState(
      false,
    );

  const [
    selectedPlayerIds,
    setSelectedPlayerIds,
  ] =
    useState<
      string[]
    >(
      [],
    );

  const [
    isRemovingSelected,
    setIsRemovingSelected,
  ] =
    useState(
      false,
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
   * ==========================================================
   * MERGE PROFILI
   * ==========================================================
   */

  const [
    mergeMode,
    setMergeMode,
  ] =
    useState(
      false,
    );

  const [
    targetPlayerId,
    setTargetPlayerId,
  ] =
    useState(
      "",
    );

  const [
    sourcePlayerId,
    setSourcePlayerId,
  ] =
    useState(
      "",
    );

  const [
    isMerging,
    setIsMerging,
  ] =
    useState(
      false,
    );

  const [
    mergeError,
    setMergeError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    mergeSuccess,
    setMergeSuccess,
  ] =
    useState<
      string | null
    >(
      null,
    );

  /*
   * ==========================================================
   * GIOCATORI FILTRATI
   * ==========================================================
   */

  const filteredPlayers =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      if (
        !normalizedSearch
      ) {
        return players;
      }

      return players.filter(
        (
          player,
        ) => {
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
      search,
    ]);

  /*
   * ==========================================================
   * TARGET MERGE
   * ==========================================================
   */

  const targetPlayer =
    useMemo(
      () =>
        players.find(
          (
            player,
          ) =>
            String(
              player.id,
            ) ===
            String(
              targetPlayerId,
            ),
        ),
      [
        players,
        targetPlayerId,
      ],
    );

  /*
   * ==========================================================
   * SOURCE MERGE
   * ==========================================================
   */

  const sourcePlayer =
    useMemo(
      () =>
        players.find(
          (
            player,
          ) =>
            String(
              player.id,
            ) ===
            String(
              sourcePlayerId,
            ),
        ),
      [
        players,
        sourcePlayerId,
      ],
    );

  /*
   * ==========================================================
   * RESET FORM
   * ==========================================================
   */

  function resetForm() {
    setFirstName(
      "",
    );

    setLastName(
      "",
    );

    setPhotoUrl(
      "",
    );

    setBirthYear(
      "",
    );

    setCoverImageUrl(
      "",
    );

    setNationality("IT");

    setBaseRating(
      "",
    );

    setFormError(
      null,
    );

    setRole(
      "Attaccante",
    );

    setShirtNumber(
      "",
    );

    setEditingSeasonPlayerId(
      null,
    );

    setEditingTeamId(
      null,
    );

    setEditingSeasonPlayerStatus(
      "active",
    );
  }

  /*
   * ==========================================================
   * RESET MERGE
   * ==========================================================
   */

  function resetMerge() {
    setTargetPlayerId(
      "",
    );

    setSourcePlayerId(
      "",
    );

    setMergeError(
      null,
    );

    setMergeSuccess(
      null,
    );
  }

  /*
   * ==========================================================
   * RESET SELEZIONE
   * ==========================================================
   */

  function resetSelection() {
    setSelectedPlayerIds(
      [],
    );
  }

  /*
   * ==========================================================
   * CREA
   * ==========================================================
   */

  function openCreateForm() {
    resetForm();

    setMergeMode(
      false,
    );

    resetMerge();

    setSelectionMode(
      false,
    );

    resetSelection();

    setFormMode({
      type:
        "create",
    });
  }

  /*
   * ==========================================================
   * MODIFICA
   * ==========================================================
   */

  function openEditForm(
    player:
      PlayerProfile,
  ) {
    setMergeMode(
      false,
    );

    resetMerge();

    setSelectionMode(
      false,
    );

    resetSelection();

    const seasonPlayer =
      seasonPlayers.find(
        (
          entry,
        ) =>
          String(
            entry.playerId,
          ) ===
            String(
              player.id,
            ) &&
          entry.status !==
            "withdrawn",
      );

    setFirstName(
      player.firstName,
    );

    setLastName(
      player.lastName,
    );

    setPhotoUrl(
      player.photoUrl ??
      "",
    );

    setBirthYear(
      player.birthYear
        ?.toString() ??
      "",
    );

    setCoverImageUrl(
      player.coverImageUrl ??
      "",
    );

    setNationality(player.nationality || "IT");

    setBaseRating(
      player.baseRating
        ?.toString() ??
      "",
    );

    setFormError(
      null,
    );

    if (
      seasonPlayer
    ) {
      setRole(
        seasonPlayer.role,
      );

      setShirtNumber(
        seasonPlayer.shirtNumber
          ?.toString() ??
        "",
      );

      setEditingSeasonPlayerId(
        seasonPlayer.id,
      );

      setEditingTeamId(
        seasonPlayer.teamId,
      );

      setEditingSeasonPlayerStatus(
        seasonPlayer.status,
      );
    } else {
      setRole(
        "Attaccante",
      );

      setShirtNumber(
        "",
      );

      setEditingSeasonPlayerId(
        null,
      );

      setEditingTeamId(
        null,
      );
    }

    setFormMode({
      type:
        "edit",

      playerId:
        player.id,
    });
  }

  /*
   * ==========================================================
   * CHIUDI FORM
   * ==========================================================
   */

  function closeForm() {
    resetForm();

    setFormMode(
      null,
    );
  }

  /*
   * ==========================================================
   * TOGGLE MERGE
   * ==========================================================
   */

  function toggleMergeMode() {
    if (
      mergeMode
    ) {
      setMergeMode(
        false,
      );

      resetMerge();

      return;
    }

    closeForm();

    setSelectionMode(
      false,
    );

    resetSelection();

    resetMerge();

    setMergeMode(
      true,
    );
  }

  /*
   * ==========================================================
   * SELEZIONE MULTIPLA
   * ==========================================================
   */

  function toggleSelectionMode() {
    if (
      selectionMode
    ) {
      setSelectionMode(
        false,
      );

      resetSelection();

      return;
    }

    closeForm();

    setMergeMode(
      false,
    );

    resetMerge();

    resetSelection();

    setSelectionMode(
      true,
    );
  }

  function togglePlayerSelection(
    playerId:
      string,
  ) {
    setSelectedPlayerIds(
      (current) =>
        current.includes(
          playerId,
        )
          ? current.filter(
              (id) =>
                id !==
                playerId,
            )
          : [
              ...current,
              playerId,
            ],
    );
  }

  /*
   * ==========================================================
   * SALVA
   * ==========================================================
   */

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !formMode ||
      isSaving
    ) {
      return;
    }

    const normalizedFirstName =
      firstName.trim();

    const normalizedLastName =
      lastName.trim();

    if (
      normalizedFirstName.length <
        2 ||
      normalizedLastName.length <
        2
    ) {
      setFormError(
        "Inserisci nome e cognome validi.",
      );

      return;
    }

    const normalizedShirtNumber =
      shirtNumber.trim()
        ? Number(
            shirtNumber,
          )
        : undefined;

    const normalizedBirthYear =
      birthYear.trim()
        ? Number(
            birthYear,
          )
        : undefined;

    const normalizedBaseRating =
      baseRating.trim()
        ? Number(
            baseRating,
          )
        : null;

    const currentYear =
      new Date()
        .getFullYear();

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
          currentYear
      )
    ) {
      setFormError(
        "Inserisci un anno di nascita valido.",
      );

      return;
    }

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
        "Il rating deve essere un numero intero compreso tra 40 e 99.",
      );

      return;
    }

    if (
      !selectedCompetitionId
    ) {
      setFormError(
        "Seleziona una competizione prima di creare o modificare un giocatore.",
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
      if (
        formMode.type ===
        "create"
      ) {
        await FirebasePlayerRepository.create({
          competitionId:
            selectedCompetitionId,

          firstName:
            normalizedFirstName,

          lastName:
            normalizedLastName,

          birthYear:
            normalizedBirthYear,

          photoUrl:
            photoUrl.trim() ||
            undefined,

          coverImageUrl:
            coverImageUrl.trim() ||
            undefined,

          nationality,

          baseRating:
            normalizedBaseRating ??
            undefined,
        });
      } else {
        await FirebasePlayerRepository.update({
          playerId:
            formMode.playerId,

          firstName:
            normalizedFirstName,

          lastName:
            normalizedLastName,

          birthYear:
            normalizedBirthYear,

          photoUrl:
            photoUrl.trim(),

          coverImageUrl:
            coverImageUrl.trim(),

          nationality,

          baseRating:
            normalizedBaseRating,
        });

        if (
          editingSeasonPlayerId &&
          editingTeamId
        ) {
          await FirebaseSeasonPlayerRepository.update({
            seasonPlayerId:
              editingSeasonPlayerId,

            teamId:
              editingTeamId,

            role,

            shirtNumber:
              normalizedShirtNumber,

            status:
              editingSeasonPlayerStatus,
          });
        }
      }

      await refresh();

      await refreshSeasonPlayers();

      closeForm();
    } catch (
      currentError
    ) {
      console.error(
        "Errore salvataggio giocatore:",
        currentError,
      );

      setFormError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile salvare il giocatore.",
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  /*
   * ==========================================================
   * MERGE
   * ==========================================================
   */

  async function handleMerge() {
    if (
      isMerging
    ) {
      return;
    }

    setMergeError(
      null,
    );

    setMergeSuccess(
      null,
    );

    if (
      !targetPlayer ||
      !sourcePlayer
    ) {
      setMergeError(
        "Seleziona entrambi i profili.",
      );

      return;
    }

    if (
      targetPlayer.id ===
      sourcePlayer.id
    ) {
      setMergeError(
        "Il profilo da mantenere e quello da eliminare devono essere diversi.",
      );

      return;
    }

    const targetIsCurrent =
      seasonPlayers.some(
        (
          seasonPlayer,
        ) =>
          String(
            seasonPlayer.playerId,
          ) ===
          String(
            targetPlayer.id,
          ),
      );

    const sourceIsCurrent =
      seasonPlayers.some(
        (
          seasonPlayer,
        ) =>
          String(
            seasonPlayer.playerId,
          ) ===
          String(
            sourcePlayer.id,
          ),
      );

    let effectiveTarget =
      targetPlayer;

    let effectiveSource =
      sourcePlayer;

    if (
      !targetIsCurrent &&
      sourceIsCurrent
    ) {
      effectiveTarget =
        sourcePlayer;

      effectiveSource =
        targetPlayer;
    }

    const targetName =
      `${effectiveTarget.firstName} ${effectiveTarget.lastName}`.trim();

    const sourceName =
      `${effectiveSource.firstName} ${effectiveSource.lastName}`.trim();

    const automaticSelection =
      !targetIsCurrent &&
      sourceIsCurrent;

    const confirmed =
      window.confirm(
        [
          "UNIONE PROFILI GIOCATORE",
          "",

          ...(automaticSelection
            ? [
                "⚠️ Il profilo della stagione corrente è stato selezionato automaticamente come principale.",
                "",
              ]
            : []),

          `Profilo da mantenere: ${targetName}`,
          `Profilo da eliminare: ${sourceName}`,
          "",

          "Verranno trasferiti:",
          "• statistiche storiche",
          "• associazioni stagionali",
          "• premi Hall of Fame",
          "• riferimenti nell'Albo d'Oro",
          "• eventuali dati mancanti del profilo",
          "",

          `Il profilo "${sourceName}" verrà eliminato definitivamente.`,
          "",

          "Vuoi continuare?",
        ].join(
          "\n",
        ),
      );

    if (
      !confirmed
    ) {
      return;
    }

    setIsMerging(
      true,
    );

    try {
      const result =
        await PlayerMergeService.merge({
          targetPlayerId:
            effectiveTarget.id,

          sourcePlayerId:
            effectiveSource.id,

          currentSeasonId:
            currentSeason?.id,
        });

      await refresh();

      await refreshSeasonPlayers();

      setTargetPlayerId(
        "",
      );

      setSourcePlayerId(
        "",
      );

      setMergeSuccess(
        `${result.sourcePlayerName} è stato unito correttamente a ${result.targetPlayerName}.`,
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore unione profili:",
        currentError,
      );

      setMergeError(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile unire i profili.",
      );
    } finally {
      setIsMerging(
        false,
      );
    }
  }

  /*
   * ==========================================================
   * ELIMINA
   * ==========================================================
   */

  async function handleRemove(
    player:
      PlayerProfile,
  ) {
    const fullName =
      `${player.firstName} ${player.lastName}`;

    const confirmed =
      window.confirm(
        `Vuoi eliminare ${fullName} dall’archivio giocatori?`,
      );

    if (
      !confirmed
    ) {
      return;
    }

    setRemovingPlayerId(
      player.id,
    );

    try {
      await FirebasePlayerRepository.remove(
        player.id,
      );

      await refresh();
    } catch (
      currentError
    ) {
      console.error(
        "Errore eliminazione giocatore:",
        currentError,
      );

      window.alert(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile eliminare il giocatore.",
      );
    } finally {
      setRemovingPlayerId(
        null,
      );
    }
  }

  /*
   * ==========================================================
   * ELIMINA SELEZIONATI
   * ==========================================================
   */

  async function handleRemoveSelected() {
    if (
      isRemovingSelected ||
      selectedPlayerIds.length ===
        0
    ) {
      return;
    }

    const selectedPlayers =
      players.filter(
        (player) =>
          selectedPlayerIds.includes(
            player.id,
          ),
      );

    const playerNames =
      selectedPlayers
        .map(
          (player) =>
            `${player.firstName} ${player.lastName}`.trim(),
        )
        .filter(
          Boolean,
        );

    const confirmed =
      window.confirm(
        [
          `Vuoi eliminare ${selectedPlayerIds.length} giocator${
            selectedPlayerIds.length ===
            1
              ? "e"
              : "i"
          } dall’archivio?`,
          "",
          ...playerNames.map(
            (name) =>
              `• ${name}`,
          ),
          "",
          "L’operazione non può essere annullata.",
        ].join(
          "\n",
        ),
      );

    if (
      !confirmed
    ) {
      return;
    }

    setIsRemovingSelected(
      true,
    );

    try {
      const results =
        await Promise.allSettled(
          selectedPlayerIds.map(
            (playerId) =>
              FirebasePlayerRepository.remove(
                playerId,
              ),
          ),
        );

      const failedCount =
        results.filter(
          (result) =>
            result.status ===
            "rejected",
        ).length;

      await refresh();

      setSelectedPlayerIds(
        [],
      );

      setSelectionMode(
        false,
      );

      if (
        failedCount >
        0
      ) {
        window.alert(
          `Eliminazione completata solo in parte: ${failedCount} giocator${
            failedCount ===
            1
              ? "e"
              : "i"
          } non ${
            failedCount ===
            1
              ? "è stato eliminato"
              : "sono stati eliminati"
          }.`,
        );
      }
    } catch (
      currentError
    ) {
      console.error(
        "Errore eliminazione multipla giocatori:",
        currentError,
      );

      window.alert(
        currentError instanceof
          Error
          ? currentError.message
          : "Impossibile eliminare i giocatori selezionati.",
      );
    } finally {
      setIsRemovingSelected(
        false,
      );
    }
  }

  /*
   * ==========================================================
   * OUTPUT
   * ==========================================================
   */

  return {
    players,
    filteredPlayers,

    isLoading,
    error,

    selectedCompetitionId,
    currentSeason,
    seasonPlayers,

    search,
    setSearch,

    formMode,

    firstName,
    setFirstName,

    lastName,
    setLastName,

    photoUrl,
    setPhotoUrl,

    birthYear,
    setBirthYear,

    coverImageUrl,
    setCoverImageUrl,

    baseRating,
    setBaseRating,

    nationality,
    setNationality,

    role,
    setRole,

    shirtNumber,
    setShirtNumber,

    editingSeasonPlayerId,

    isSaving,

    removingPlayerId,

    selectionMode,
    selectedPlayerIds,
    isRemovingSelected,

    formError,
    setFormError,

    mergeMode,

    targetPlayerId,
    setTargetPlayerId,

    sourcePlayerId,
    setSourcePlayerId,

    targetPlayer,
    sourcePlayer,

    isMerging,

    mergeError,
    setMergeError,

    mergeSuccess,
    setMergeSuccess,

    openCreateForm,
    openEditForm,
    closeForm,

    toggleMergeMode,
    toggleSelectionMode,
    togglePlayerSelection,

    handleSubmit,
    handleMerge,
    handleRemove,
    handleRemoveSelected,
  };
}