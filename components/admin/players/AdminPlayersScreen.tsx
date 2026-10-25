"use client";

import {
  useRef,
  useState,
} from "react";

import Image from "next/image";

import AppShell from "@/components/ui/AppShell";

import { useCompetition } from "@/src/contexts/CompetitionContext";

import {
  useAdminPlayersData,
} from "@/src/hooks/useAdminPlayersData";

import type {
  PlayerProfile,
} from "@/src/types/PlayerProfile";

import {
  FirebasePlayerRepository,
} from "@/src/services/player/FirebasePlayerRepository";

import AdminPlayerMergePanel from "./AdminPlayerMergePanel";

import AdminPlayerForm from "./AdminPlayerForm";

import PlayerResidualCleanupPanel from "./PlayerResidualCleanupPanel";

import PlayerPublicPhotoAssociationPanel from "./PlayerPublicPhotoAssociationPanel";

/*
 * ============================================================
 * SCREEN
 * ============================================================
 */

export default function AdminPlayersScreen() {
  const {
    selectedCompetitionId,
    activeCompetitions,
  } =
    useCompetition();

  const editFormRef =
    useRef<HTMLFormElement | null>(
      null,
    );

  const [photoSharePlayer, setPhotoSharePlayer] =
    useState<PlayerProfile | null>(null);

  const [photoShareTargets, setPhotoShareTargets] =
    useState<PhotoShareTarget[]>([]);

  const [selectedPhotoShareTargetIds, setSelectedPhotoShareTargetIds] =
    useState<string[]>([]);

  const [isLoadingPhotoShareTargets, setIsLoadingPhotoShareTargets] =
    useState(false);

  const [isSharingPhoto, setIsSharingPhoto] =
    useState(false);

  const [photoShareError, setPhotoShareError] =
    useState<string | null>(null);

  const [photoShareSuccess, setPhotoShareSuccess] =
    useState<string | null>(null);

  const {
    players,
    filteredPlayers,

    isLoading,
    error,

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
  } =
    useAdminPlayersData();

  /*
   * ==========================================================
   * APRI MODIFICA + SCROLL
   * ==========================================================
   */

  function handleOpenEditForm(
    player:
      PlayerProfile,
  ) {
    openEditForm(
      player,
    );

    window.setTimeout(
      () => {
        editFormRef.current
          ?.scrollIntoView({
            behavior:
              "smooth",

            block:
              "nearest",
          });
      },

      100,
    );
  }

  /*
   * ==========================================================
   * CONDIVISIONE FOTO TRA COMPETIZIONI
   * ==========================================================
   */

  async function openPhotoShare(player: PlayerProfile) {
    const sourcePhotoUrl = player.photoUrl?.trim();

    if (!sourcePhotoUrl) {
      return;
    }

    setPhotoSharePlayer(player);
    setPhotoShareTargets([]);
    setSelectedPhotoShareTargetIds([]);
    setPhotoShareError(null);
    setPhotoShareSuccess(null);
    setIsLoadingPhotoShareTargets(true);

    try {
      const otherCompetitions = activeCompetitions.filter(
        (competition) => competition.id !== selectedCompetitionId,
      );

      const results = await Promise.all(
        otherCompetitions.map(async (competition) => {
          const competitionPlayers =
            await FirebasePlayerRepository.getAllWithPrivateByCompetition(
              competition.id,
            );

          const sameNamePlayers = competitionPlayers.filter(
            (candidate) =>
              normalizePlayerIdentityText(candidate.firstName) ===
                normalizePlayerIdentityText(player.firstName) &&
              normalizePlayerIdentityText(candidate.lastName) ===
                normalizePlayerIdentityText(player.lastName),
          );

          const matchedPlayers =
            player.birthYear !== undefined
              ? sameNamePlayers.filter(
                  (candidate) => candidate.birthYear === player.birthYear,
                )
              : sameNamePlayers.length === 1
                ? sameNamePlayers
                : [];

          return matchedPlayers.map((candidate) => ({
            player: candidate,
            competitionId: competition.id,
            competitionName: competition.name,
          }));
        }),
      );

      const nextTargets = results.flat();

      setPhotoShareTargets(nextTargets);
      setSelectedPhotoShareTargetIds(
        nextTargets
          .filter(
            (target) => target.player.photoUrl?.trim() !== sourcePhotoUrl,
          )
          .map((target) => target.player.id),
      );
    } catch (currentError) {
      console.error(
        "Errore ricerca profili per condivisione foto:",
        currentError,
      );

      setPhotoShareError(
        currentError instanceof Error
          ? currentError.message
          : "Impossibile cercare il giocatore nelle altre competizioni.",
      );
    } finally {
      setIsLoadingPhotoShareTargets(false);
    }
  }

  function closePhotoShare() {
    if (isSharingPhoto) {
      return;
    }

    setPhotoSharePlayer(null);
    setPhotoShareTargets([]);
    setSelectedPhotoShareTargetIds([]);
    setPhotoShareError(null);
    setPhotoShareSuccess(null);
  }

  function togglePhotoShareTarget(playerId: string) {
    setSelectedPhotoShareTargetIds((currentIds) =>
      currentIds.includes(playerId)
        ? currentIds.filter((currentId) => currentId !== playerId)
        : [...currentIds, playerId],
    );
  }

  async function handleSharePhoto() {
    const sourcePhotoUrl = photoSharePlayer?.photoUrl?.trim();

    if (
      !photoSharePlayer ||
      !sourcePhotoUrl ||
      selectedPhotoShareTargetIds.length === 0 ||
      isSharingPhoto
    ) {
      return;
    }

    const selectedTargets = photoShareTargets.filter((target) =>
      selectedPhotoShareTargetIds.includes(target.player.id),
    );

    const replacementCount = selectedTargets.filter((target) => {
      const currentPhotoUrl = target.player.photoUrl?.trim();
      return currentPhotoUrl && currentPhotoUrl !== sourcePhotoUrl;
    }).length;

    if (replacementCount > 0) {
      const confirmed = window.confirm(
        replacementCount === 1
          ? "Uno dei profili selezionati ha già una foto. Vuoi sostituirla con questa?"
          : `${replacementCount} profili selezionati hanno già una foto. Vuoi sostituirle con questa?`,
      );

      if (!confirmed) {
        return;
      }
    }

    setIsSharingPhoto(true);
    setPhotoShareError(null);
    setPhotoShareSuccess(null);

    try {
      await Promise.all(
        selectedTargets.map((target) =>
          FirebasePlayerRepository.update({
            playerId: target.player.id,
            photoUrl: sourcePhotoUrl,
          }),
        ),
      );

      setPhotoShareTargets((currentTargets) =>
        currentTargets.map((target) =>
          selectedPhotoShareTargetIds.includes(target.player.id)
            ? {
                ...target,
                player: {
                  ...target.player,
                  photoUrl: sourcePhotoUrl,
                },
              }
            : target,
        ),
      );

      setSelectedPhotoShareTargetIds([]);
      setPhotoShareSuccess(
        selectedTargets.length === 1
          ? "Foto condivisa con 1 profilo."
          : `Foto condivisa con ${selectedTargets.length} profili.`,
      );
    } catch (currentError) {
      console.error(
        "Errore condivisione foto giocatore:",
        currentError,
      );

      setPhotoShareError(
        currentError instanceof Error
          ? currentError.message
          : "Impossibile condividere la foto.",
      );
    } finally {
      setIsSharingPhoto(false);
    }
  }

  /*
   * ==========================================================
   * FORM GIOCATORE
   * ==========================================================
   */

  function renderPlayerForm() {
    if (
      !formMode
    ) {
      return null;
    }

    const editingPlayer =
      formMode.type ===
      "edit"
        ? players.find(
            (player) =>
              player.id ===
              formMode.playerId,
          )
        : undefined;

    return (
      <AdminPlayerForm
        formRef={
          editFormRef
        }

        formMode={
          formMode
        }

        firstName={
          firstName
        }
        setFirstName={
          setFirstName
        }

        lastName={
          lastName
        }
        setLastName={
          setLastName
        }

        photoUrl={
          photoUrl
        }
        setPhotoUrl={
          setPhotoUrl
        }

        birthYear={
          birthYear
        }
        setBirthYear={
          setBirthYear
        }

        coverImageUrl={
          coverImageUrl
        }
        setCoverImageUrl={
          setCoverImageUrl
        }

        nationality={nationality}
        setNationality={setNationality}

        baseRating={
          baseRating
        }
        setBaseRating={
          setBaseRating
        }

        historicalImportSources={
          editingPlayer
            ?.historicalImportSources ??
          []
        }

        role={
          role
        }
        setRole={
          setRole
        }

        shirtNumber={
          shirtNumber
        }
        setShirtNumber={
          setShirtNumber
        }

        editingSeasonPlayerId={
          editingSeasonPlayerId
        }

        isSaving={
          isSaving
        }

        formError={
          formError
        }

        onSubmit={
          handleSubmit
        }
      />
    );
  }

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <AppShell>

      {/* HEADER */}

      <header className="mt-2 mb-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
              Centro di controllo
            </p>

            <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
              Giocatori
            </h1>

            <p className="mt-1 text-sm font-bold text-[#06142E]/50">
              Gestisci l’anagrafica permanente.
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={
                formMode
                  ? closeForm
                  : openCreateForm
              }
              className="ludi-button-primary"
            >
              {formMode
                ? "Chiudi"
                : "+ Nuovo"}
            </button>

            <button
              type="button"
              onClick={
                toggleSelectionMode
              }
              className={`h-10 rounded-[13px] border px-4 text-[10px] font-black uppercase ${
                selectionMode
                  ? "border-red-200 bg-red-50 text-red-600"
                  : "border-[#06142E]/15 bg-white text-[#06142E]"
              }`}
            >
              {selectionMode
                ? "Annulla"
                : "Seleziona"}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={
            toggleMergeMode
          }
          className={`mt-4 inline-flex h-11 w-full items-center justify-center rounded-[13px] border px-4 text-xs font-black uppercase sm:w-auto ${
            mergeMode
              ? "border-red-200 bg-red-50 text-red-600"
              : "border-[#06142E]/15 bg-white text-[#06142E]"
          }`}
        >
          {mergeMode
            ? "Chiudi unione profili"
            : "🔗 Unisci profili duplicati"}
        </button>
      </header>

      {/* ======================================================
          MERGE PROFILI
          ====================================================== */}

      {mergeMode && (
  <AdminPlayerMergePanel
    players={
      players
    }

    targetPlayerId={
      targetPlayerId
    }
    setTargetPlayerId={
      setTargetPlayerId
    }

    sourcePlayerId={
      sourcePlayerId
    }
    setSourcePlayerId={
      setSourcePlayerId
    }

    targetPlayer={
      targetPlayer
    }

    sourcePlayer={
      sourcePlayer
    }

    isMerging={
      isMerging
    }

    mergeError={
      mergeError
    }
    setMergeError={
      setMergeError
    }

    mergeSuccess={
      mergeSuccess
    }
    setMergeSuccess={
      setMergeSuccess
    }

    onMerge={
      handleMerge
    }
  />
)}

      {/* ======================================================
          AUDIT RESIDUI
          ====================================================== */}

      {!mergeMode &&
        !selectionMode &&
        !formMode && (
        <PlayerResidualCleanupPanel
          competitionId={
            selectedCompetitionId
          }
          players={
            players
          }
          onChanged={() => {
            window.location.reload();
          }}
        />
      )}

      {/* ======================================================
          FOTO DA PUBLIC/PLAYERS
          ====================================================== */}

      {!mergeMode &&
        !selectionMode &&
        !formMode && (
        <PlayerPublicPhotoAssociationPanel
          players={
            players
          }
          onCompleted={() => {
            window.location.reload();
          }}
        />
      )}

      {/* ======================================================
          FORM CREAZIONE
          ====================================================== */}

      {formMode?.type ===
        "create" &&
        renderPlayerForm()}

      {/* ======================================================
          RICERCA
          ====================================================== */}

      <section className="mb-5">
        <input
          type="search"
          value={
            search
          }
          onChange={(
            event,
          ) =>
            setSearch(
              event.target.value,
            )
          }
          className="ludi-input"
          placeholder="Cerca per nome o cognome..."
        />
      </section>

      {selectionMode && (
        <section className="mb-5 rounded-[16px] border border-[#06142E]/10 bg-white p-4 shadow-[0_8px_24px_rgba(6,20,46,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#06142E]/40">
                Selezione multipla
              </p>

              <p className="mt-1 text-sm font-black text-[#06142E]">
                {selectedPlayerIds.length} selezionat{
                  selectedPlayerIds.length ===
                  1
                    ? "o"
                    : "i"
                }
              </p>
            </div>

            <button
              type="button"
              disabled={
                selectedPlayerIds.length ===
                  0 ||
                isRemovingSelected
              }
              onClick={() => {
                void handleRemoveSelected();
              }}
              className="rounded-[12px] bg-red-600 px-4 py-3 text-[10px] font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-35"
            >
              {isRemovingSelected
                ? "Elimino..."
                : `Elimina (${selectedPlayerIds.length})`}
            </button>
          </div>
        </section>
      )}

      {/* ERROR */}

      {error && (
        <div className="mb-5 rounded-[13px] border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-black text-red-700">
            Impossibile caricare i giocatori
          </p>

          <p className="mt-1 text-xs font-bold text-red-600/70">
            {
              error
            }
          </p>
        </div>
      )}

      {/* ======================================================
          LISTA GIOCATORI
          ====================================================== */}

      {isLoading ? (
        <PlayersLoading />
      ) : filteredPlayers.length >
        0 ? (
        <section className="grid min-w-0 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {filteredPlayers.map(
            (
              player,
            ) => {
              const isRemoving =
                removingPlayerId ===
                player.id;

              const isSelected =
                selectedPlayerIds.includes(
                  player.id,
                );

              const isEditing =
                formMode?.type ===
                  "edit" &&
                formMode.playerId ===
                  player.id;

              return (
                <div
                  key={
                    player.id
                  }
                  className="min-w-0 space-y-3"
                >
                  <article
                    onClick={
                      selectionMode
                        ? () => {
                            togglePlayerSelection(
                              player.id,
                            );
                          }
                        : undefined
                    }
                    className={`ludi-card p-4 ${
                      selectionMode
                        ? "cursor-pointer"
                        : ""
                    } ${
                      isSelected
                        ? "ring-2 ring-[#06142E]"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {selectionMode && (
                        <div
                          className="flex shrink-0 items-center"
                          onClick={(
                            event,
                          ) => {
                            event.stopPropagation();
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={
                              isSelected
                            }
                            onChange={() => {
                              togglePlayerSelection(
                                player.id,
                              );
                            }}
                            aria-label={`Seleziona ${player.firstName} ${player.lastName}`}
                            className="h-5 w-5 cursor-pointer accent-[#06142E]"
                          />
                        </div>
                      )}

                      <PlayerAvatar
                        firstName={
                          player.firstName
                        }
                        lastName={
                          player.lastName
                        }
                        photoUrl={
                          player.photoUrl
                        }
                      />

                      <div className="min-w-0 flex-1">
                        <h2 className="text-[16px] font-black text-[#06142E]">
                          {
                            player.firstName
                          }{" "}
                          {
                            player.lastName
                          }
                        </h2>

                        <p className="mt-1 text-xs font-black uppercase text-[#06142E]/45">
                          {player.birthYear
                            ? `${player.birthYear} · `
                            : ""}

                          Rating{" "}

                          {typeof player.baseRating ===
                          "number"
                            ? player.baseRating
                            : "NP"}
                        </p>
                      </div>

                      {!selectionMode && (
                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              handleOpenEditForm(
                                player,
                              );
                            }}
                            className="rounded-[11px] px-3 py-2 text-[10px] font-black uppercase text-[#06142E]"
                          >
                            {isEditing
                              ? "Modifica aperta"
                              : "Modifica"}
                          </button>

                          {player.photoUrl?.trim() && (
                            <button
                              type="button"
                              onClick={() => {
                                void openPhotoShare(
                                  player,
                                );
                              }}
                              className="rounded-[11px] px-3 py-2 text-[10px] font-black uppercase text-[#0B5FFF]"
                            >
                              Condividi foto
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={
                              isRemoving
                            }
                            onClick={() => {
                              void handleRemove(
                                player,
                              );
                            }}
                            className="rounded-[11px] px-3 py-2 text-[10px] font-black uppercase text-red-600 disabled:opacity-35"
                          >
                            {isRemoving
                              ? "Elimino..."
                              : "Elimina"}
                          </button>
                        </div>
                      )}
                    </div>
                  </article>

                  {isEditing &&
                    renderPlayerForm()}
                </div>
              );
            },
          )}
        </section>
      ) : (
        <section className="ludi-card p-8 text-center">
          <p className="text-4xl">
            👤
          </p>

          <h2 className="mt-3 text-xl font-black text-[#06142E]">
            {search.trim()
              ? "Nessun risultato"
              : "Nessun giocatore"}
          </h2>

          <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/45">
            {search.trim()
              ? "Nessun giocatore corrisponde alla ricerca."
              : "Crea la prima anagrafica giocatore."}
          </p>
        </section>
      )}

      {photoSharePlayer && (
        <PhotoShareDialog
          sourcePlayer={photoSharePlayer}
          targets={photoShareTargets}
          selectedTargetIds={selectedPhotoShareTargetIds}
          isLoading={isLoadingPhotoShareTargets}
          isSaving={isSharingPhoto}
          error={photoShareError}
          successMessage={photoShareSuccess}
          onToggleTarget={togglePhotoShareTarget}
          onShare={() => {
            void handleSharePhoto();
          }}
          onClose={closePhotoShare}
        />
      )}
    </AppShell>
  );
}

/*
 * ============================================================
 * CONDIVISIONE FOTO
 * ============================================================
 */

type PhotoShareTarget = {
  player: PlayerProfile;
  competitionId: string;
  competitionName: string;
};

function PhotoShareDialog({
  sourcePlayer,
  targets,
  selectedTargetIds,
  isLoading,
  isSaving,
  error,
  successMessage,
  onToggleTarget,
  onShare,
  onClose,
}: {
  sourcePlayer: PlayerProfile;
  targets: PhotoShareTarget[];
  selectedTargetIds: string[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  successMessage: string | null;
  onToggleTarget: (playerId: string) => void;
  onShare: () => void;
  onClose: () => void;
}) {
  const sourcePhotoUrl = sourcePlayer.photoUrl?.trim() ?? "";

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-[#020816]/55 p-4 sm:items-center">
      <section className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-[24px] bg-white p-5 shadow-[0_24px_70px_rgba(2,8,22,0.35)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#06142E]/40">Foto profilo</p>
            <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]">Condividi foto</h2>
            <p className="mt-2 text-xs font-bold leading-5 text-[#06142E]/50">
              La stessa immagine verrà collegata ai profili selezionati senza effettuare un nuovo upload.
            </p>
          </div>

          <button type="button" disabled={isSaving} onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#06142E]/5 text-lg font-black text-[#06142E] disabled:opacity-35" aria-label="Chiudi">×</button>
        </div>

        <div className="mt-5 flex items-center gap-4 rounded-[16px] bg-[#06142E]/5 p-3">
          <PlayerAvatar firstName={sourcePlayer.firstName} lastName={sourcePlayer.lastName} photoUrl={sourcePlayer.photoUrl} />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[#06142E]">{sourcePlayer.firstName} {sourcePlayer.lastName}</p>
            <p className="mt-1 text-xs font-bold text-[#06142E]/45">{sourcePlayer.birthYear ?? "Anno non disponibile"}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-10 text-center">
            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-4 border-[#06142E]/10 border-t-[#06142E]" />
            <p className="mt-3 text-xs font-black uppercase text-[#06142E]/40">Cerco nelle altre competizioni...</p>
          </div>
        ) : targets.length > 0 ? (
          <div className="mt-5 space-y-2">
            {targets.map((target) => {
              const alreadyShared = Boolean(sourcePhotoUrl) && target.player.photoUrl?.trim() === sourcePhotoUrl;
              const selected = selectedTargetIds.includes(target.player.id);
              return (
                <label key={`${target.competitionId}:${target.player.id}`} className={`flex items-center gap-3 rounded-[14px] border p-3 ${alreadyShared ? "border-emerald-200 bg-emerald-50" : selected ? "border-[#06142E] bg-[#06142E]/5" : "border-[#06142E]/10 bg-white"}`}>
                  <input type="checkbox" checked={alreadyShared || selected} disabled={alreadyShared || isSaving} onChange={() => onToggleTarget(target.player.id)} className="h-5 w-5 shrink-0 accent-[#06142E]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.10em] text-[#06142E]/40">{target.competitionName}</p>
                    <p className="mt-1 truncate text-sm font-black text-[#06142E]">{target.player.firstName} {target.player.lastName}</p>
                    <p className="mt-1 text-[10px] font-bold text-[#06142E]/45">{alreadyShared ? "Foto già condivisa" : target.player.photoUrl?.trim() ? "Ha già una foto: verrà chiesta conferma prima di sostituirla" : "Nessuna foto presente"}</p>
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-[14px] bg-[#06142E]/5 p-4">
            <p className="text-sm font-bold leading-6 text-[#06142E]/55">Nessun profilo corrispondente trovato nelle altre competizioni.</p>
            {!sourcePlayer.birthYear && <p className="mt-2 text-xs font-bold leading-5 text-amber-700">Senza anno di nascita il collegamento viene proposto solo quando esiste un unico giocatore con lo stesso nome e cognome.</p>}
          </div>
        )}

        {error && <div className="mt-4 rounded-[13px] border border-red-200 bg-red-50 p-3"><p className="text-xs font-bold text-red-700">{error}</p></div>}
        {successMessage && <div className="mt-4 rounded-[13px] border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-700">{successMessage}</p></div>}

        <button type="button" disabled={selectedTargetIds.length === 0 || isSaving || isLoading} onClick={onShare} className="mt-5 h-12 w-full rounded-[13px] bg-[#06142E] px-5 text-xs font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-35">
          {isSaving ? "Condivisione..." : selectedTargetIds.length > 0 ? `Condividi con ${selectedTargetIds.length}` : "Seleziona i profili"}
        </button>
      </section>
    </div>
  );
}

function normalizePlayerIdentityText(value: string): string {
  return value.trim().toLocaleLowerCase("it").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

/*
 * ============================================================
 * AVATAR
 * ============================================================
 */

function PlayerAvatar({
  firstName,
  lastName,
  photoUrl,
  size = "normal",
}: {
  firstName:
    string;

  lastName:
    string;

  photoUrl?:
    string;

  size?:
    | "normal"
    | "large";
}) {
  const sizeClass =
    size ===
    "large"
      ? "h-20 w-20 text-xl"
      : "h-16 w-16 text-base";

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-[17px] bg-[#06142E] font-black text-white ${sizeClass}`}
    >
      {photoUrl ? (
        <Image
          src={
            photoUrl
          }
          alt={`${firstName} ${lastName}`}
          fill
          unoptimized
          sizes={
            size ===
            "large"
              ? "80px"
              : "64px"
          }
          className="object-cover"
        />
      ) : (
        getInitials(
          firstName,
          lastName,
        )
      )}
    </div>
  );
}

/*
 * ============================================================
 * LOADING
 * ============================================================
 */

function PlayersLoading() {
  return (
    <section className="space-y-3">
      {[
        1,
        2,
        3,
      ].map(
        (
          item,
        ) => (
          <div
            key={
              item
            }
            className="ludi-card flex items-center gap-4 p-4"
          >
            <div className="h-16 w-16 animate-pulse rounded-[17px] bg-[#06142E]/8" />

            <div className="flex-1">
              <div className="h-4 w-36 animate-pulse rounded-full bg-[#06142E]/8" />

              <div className="mt-3 h-3 w-28 animate-pulse rounded-full bg-[#06142E]/5" />
            </div>
          </div>
        ),
      )}
    </section>
  );
}

/*
 * ============================================================
 * INIZIALI
 * ============================================================
 */

function getInitials(
  firstName:
    string,

  lastName:
    string,
) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}