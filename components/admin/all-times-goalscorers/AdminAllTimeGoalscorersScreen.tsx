"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AppShell from "@/components/ui/AppShell";

import {
  useCompetition,
} from "@/src/contexts/CompetitionContext";

import PlayerPhotoUploader from "@/components/admin/players/PlayerPhotoUploader";

import { FirebaseHistoricalPlayerStatsRepository } from "@/src/services/player/FirebaseHistoricalPlayerStatsRepository";

import { FirebasePlayerRepository } from "@/src/services/player/FirebasePlayerRepository";

import {
  buildAllTimeGoalscorers,
  type AllTimeGoalscorer,
} from "@/src/services/player/AllTimeGoalscorersService";

import type {
  HistoricalPlayerSeasonStats,
} from "@/src/types/HistoricalPlayerSeasonStats";

import type {
  PlayerProfile,
} from "@/src/types/PlayerProfile";

export default function AdminAllTimeGoalscorersScreen() {
  const {
    selectedCompetitionId,
  } =
    useCompetition();

  const [
    players,
    setPlayers,
  ] =
    useState<
      PlayerProfile[]
    >([]);

  const [
    historicalStats,
    setHistoricalStats,
  ] =
    useState<
      HistoricalPlayerSeasonStats[]
    >([]);

  const [
    playersLoading,
    setPlayersLoading,
  ] =
    useState(true);

  const [
    loadedCompetitionId,
    setLoadedCompetitionId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    savingPlayerId,
    setSavingPlayerId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    let isMounted =
      true;

    async function loadPlayers() {
      try {
        const nextPlayers =
          selectedCompetitionId
            ? await FirebasePlayerRepository
                .getByCompetition(
                  selectedCompetitionId,
                )
            : [];

        if (!isMounted) {
          return;
        }

        setPlayers(
          nextPlayers,
        );

        setPlayersLoading(
          false,
        );
      } catch (currentError) {
        console.error(
          "Errore caricamento giocatori:",
          currentError,
        );

        if (!isMounted) {
          return;
        }

        setError(
          currentError instanceof Error
            ? currentError.message
            : "Impossibile caricare i giocatori.",
        );

        setPlayersLoading(
          false,
        );
      }
    }

    void loadPlayers();

    return () => {
      isMounted =
        false;
    };
  }, [
    selectedCompetitionId,
  ]);

  useEffect(() => {
    /*
     * ========================================================
     * ALL-TIME DELLA COMPETIZIONE SELEZIONATA
     * ========================================================
     *
     * Nessun setState sincrono nel corpo dell'effect:
     * gli aggiornamenti avvengono esclusivamente nelle
     * callback della subscription Firestore.
     * ========================================================
     */

    if (
      !selectedCompetitionId
    ) {
      return;
    }

    const competitionId =
      selectedCompetitionId;

    const unsubscribe =
      FirebaseHistoricalPlayerStatsRepository.subscribeByCompetition(
        competitionId,

        (
          nextStats,
        ) => {
          setHistoricalStats(
            nextStats,
          );

          setLoadedCompetitionId(
            competitionId,
          );

          setError(
            null,
          );

          setSuccessMessage(
            null,
          );
        },

        (
          currentError,
        ) => {
          console.error(
            "Errore caricamento statistiche storiche della competizione:",
            currentError,
          );

          setHistoricalStats(
            [],
          );

          setLoadedCompetitionId(
            competitionId,
          );

          setError(
            currentError instanceof Error
              ? currentError.message
              : "Impossibile caricare le statistiche storiche della competizione.",
          );

          setSuccessMessage(
            null,
          );
        },
      );

    return unsubscribe;
  }, [
    selectedCompetitionId,
  ]);

  const statsLoading =
    Boolean(
      selectedCompetitionId,
    ) &&
    loadedCompetitionId !==
      selectedCompetitionId;

  const ranking =
    useMemo(
      () =>
        buildAllTimeGoalscorers({
          players,

          historicalStats:
            selectedCompetitionId &&
            loadedCompetitionId ===
              selectedCompetitionId
              ? historicalStats
              : [],

          limit: 20,
        }),
      [
        players,
        historicalStats,
        selectedCompetitionId,
        loadedCompetitionId,
      ],
    );

  const isLoading =
    playersLoading ||
    statsLoading;

  async function refreshPlayers() {
    const nextPlayers =
      selectedCompetitionId
        ? await FirebasePlayerRepository
            .getByCompetition(
              selectedCompetitionId,
            )
        : [];

    setPlayers(
      nextPlayers,
    );
  }

  async function updatePlayerPhoto(
    playerId: string,
    photoUrl: string,
  ) {
    if (
      savingPlayerId
    ) {
      return;
    }

    setSavingPlayerId(
      playerId,
    );

    setError(
      null,
    );

    setSuccessMessage(
      null,
    );

    try {
      await FirebasePlayerRepository.update({
        playerId,
        photoUrl,
      });

      await refreshPlayers();

      setSuccessMessage(
        "Foto giocatore aggiornata.",
      );
    } catch (currentError) {
      console.error(
        "Errore aggiornamento foto giocatore:",
        currentError,
      );

      setError(
        currentError instanceof Error
          ? currentError.message
          : "Impossibile aggiornare la foto.",
      );
    } finally {
      setSavingPlayerId(
        null,
      );
    }
  }

  async function removePlayerPhoto(
    playerId: string,
  ) {
    if (
      savingPlayerId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Rimuovere la foto di questo giocatore?",
      );

    if (!confirmed) {
      return;
    }

    setSavingPlayerId(
      playerId,
    );

    setError(
      null,
    );

    setSuccessMessage(
      null,
    );

    try {
      await FirebasePlayerRepository.update({
        playerId,
        photoUrl: "",
      });

      await refreshPlayers();

      setSuccessMessage(
        "Foto giocatore rimossa.",
      );
    } catch (currentError) {
      console.error(
        "Errore rimozione foto giocatore:",
        currentError,
      );

      setError(
        currentError instanceof Error
          ? currentError.message
          : "Impossibile rimuovere la foto.",
      );
    } finally {
      setSavingPlayerId(
        null,
      );
    }
  }

  async function updatePlayerCoverImage(
    playerId: string,
    coverImageUrl: string,
  ) {
    if (savingPlayerId) {
      return;
    }

    setSavingPlayerId(playerId);
    setError(null);
    setSuccessMessage(null);

    try {
      await FirebasePlayerRepository.update({
        playerId,
        coverImageUrl,
      });

      await refreshPlayers();

      setSuccessMessage(
        "Immagine copertina aggiornata.",
      );
    } catch (currentError) {
      console.error(
        "Errore aggiornamento immagine copertina:",
        currentError,
      );

      setError(
        currentError instanceof Error
          ? currentError.message
          : "Impossibile aggiornare l'immagine copertina.",
      );
    } finally {
      setSavingPlayerId(null);
    }
  }

  async function removePlayerCoverImage(
    playerId: string,
  ) {
    if (savingPlayerId) {
      return;
    }

    const confirmed =
      window.confirm(
        "Rimuovere l'immagine copertina del primo classificato?",
      );

    if (!confirmed) {
      return;
    }

    setSavingPlayerId(playerId);
    setError(null);
    setSuccessMessage(null);

    try {
      await FirebasePlayerRepository.update({
        playerId,
        coverImageUrl: "",
      });

      await refreshPlayers();

      setSuccessMessage(
        "Immagine copertina rimossa.",
      );
    } catch (currentError) {
      console.error(
        "Errore rimozione immagine copertina:",
        currentError,
      );

      setError(
        currentError instanceof Error
          ? currentError.message
          : "Impossibile rimuovere l'immagine copertina.",
      );
    } finally {
      setSavingPlayerId(null);
    }
  }


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
          All-Time Goalscorers
        </h1>

        <p className="mt-1 max-w-2xl text-sm font-bold leading-6 text-[#06142E]/50">
          Gestisci le foto profilo dei 20 migliori marcatori e la copertina del primo classificato
        </p>
      </header>

        {error && (
          <MessageBox
            type="error"
            message={
              error
            }
          />
        )}

        {successMessage && (
          <MessageBox
            type="success"
            message={
              successMessage
            }
          />
        )}

        {isLoading ? (
          <LoadingState />
        ) : ranking.length ===
          0 ? (
          <EmptyState />
        ) : (
          <section className="space-y-4">
            {ranking.map(
              (
                player,
                index,
              ) => (
                <PlayerAdminCard
                  key={
                    player.playerId
                  }
                  player={
                    player
                  }
                  position={
                    index + 1
                  }
                  isSaving={
                    savingPlayerId ===
                    player.playerId
                  }
                  onPhotoChange={(
                    url,
                  ) => {
                    void updatePlayerPhoto(
                      player.playerId,
                      url,
                    );
                  }}
                  onPhotoRemove={() => {
                    void removePlayerPhoto(
                      player.playerId,
                    );
                  }}
                  onCoverImageChange={(
                    url,
                  ) => {
                    void updatePlayerCoverImage(
                      player.playerId,
                      url,
                    );
                  }}
                  onCoverImageRemove={() => {
                    void removePlayerCoverImage(
                      player.playerId,
                    );
                  }}
                />
              ),
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}

function PlayerAdminCard({
  player,
  position,
  isSaving,
  onPhotoChange,
  onPhotoRemove,
  onCoverImageChange,
  onCoverImageRemove,
}: {
  player:
    AllTimeGoalscorer;

  position: number;

  isSaving: boolean;

  onPhotoChange: (
    url: string,
  ) => void;

  onPhotoRemove:
    () => void;

  onCoverImageChange: (
    url: string,
  ) => void;

  onCoverImageRemove:
    () => void;
}) {
  return (
    <article className="overflow-hidden rounded-[20px] bg-white shadow-[0_10px_26px_rgba(6,20,46,0.08)]">
      <div className="bg-[#06142E] p-4 text-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-yellow-300">
              Posizione{" "}
              {String(
                position,
              ).padStart(
                2,
                "0",
              )}
            </p>

            <h2 className="mt-1 whitespace-normal break-words text-xl font-black uppercase leading-tight">
              {
                player.firstName
              }{" "}
              {
                player.lastName
              }
            </h2>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-2xl font-black text-yellow-300">
              {
                player.totalGoals
              }
            </p>

            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/45">
              Reti
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs font-black uppercase text-white/50">
          <span>
            {
              player.totalAppearances
            }{" "}
            presenze
          </span>

          <span>
            {
              player.seasonsPlayed
            }{" "}
            stagioni
          </span>
        </div>
      </div>

      <div className="p-5">
        {isSaving && (
          <div className="mb-4 rounded-[13px] bg-[#06142E]/5 p-3 text-center">
            <p className="text-xs font-black uppercase text-[#06142E]/45">
              Salvataggio foto...
            </p>
          </div>
        )}

        <PlayerPhotoUploader
          value={
            player.photoUrl
          }
          playerName={`${player.firstName} ${player.lastName}`}
          label="Foto profilo"
          enableEditor
          defaultAspectRatio="1:1"
          onChange={
            onPhotoChange
          }
          onRemove={
            onPhotoRemove
          }
        />

        {position === 1 && (
          <div className="mt-6 border-t border-[#06142E]/10 pt-6">
            <div className="mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-yellow-600">
                Solo primo classificato
              </p>

              <h3 className="mt-1 text-lg font-black uppercase text-[#06142E]">
                Immagine copertina
              </h3>

              <p className="mt-1 text-xs font-bold leading-5 text-[#06142E]/45">
                Questa immagine viene usata nella card principale della pagina All-Times. Se non è presente, viene usata la foto profilo.
              </p>
            </div>

            <PlayerPhotoUploader
              value={
                player.coverImageUrl
              }
              playerName={`${player.firstName} ${player.lastName} - copertina`}
              label="Immagine copertina"
              enableEditor
              defaultAspectRatio="4:5"
              onChange={
                onCoverImageChange
              }
              onRemove={
                onCoverImageRemove
              }
            />
          </div>
        )}
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <section className="rounded-[18px] bg-white p-8 text-center shadow-[0_10px_24px_rgba(6,20,46,0.08)]">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#06142E]/10 border-t-[#06142E]" />

      <p className="mt-4 text-sm font-bold text-[#06142E]/45">
        Caricamento classifica
        storica...
      </p>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="rounded-[18px] bg-white p-8 text-center shadow-[0_10px_24px_rgba(6,20,46,0.08)]">
      <p className="text-4xl">
        ⚽
      </p>

      <h2 className="mt-3 text-xl font-black uppercase text-[#06142E]">
        Nessun dato storico
      </h2>

      <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/40">
        Importa prima le
        statistiche delle stagioni
        precedenti per generare la
        Top 20.
      </p>
    </section>
  );
}

function MessageBox({
  type,
  message,
}: {
  type:
    | "error"
    | "success";

  message: string;
}) {
  return (
    <div
      className={`mb-5 rounded-[14px] border p-4 ${
        type === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-green-200 bg-green-50 text-green-700"
      }`}
    >
      <p className="text-sm font-bold">
        {message}
      </p>
    </div>
  );
}