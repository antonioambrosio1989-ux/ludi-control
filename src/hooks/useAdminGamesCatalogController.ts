"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FirebaseGamesGameRepository,
} from "@/src/services/games/FirebaseGamesGameRepository";

import {
  toGamesDate,
} from "@/src/services/games/GamesSeasonStatusService";

import type {
  useAuth,
} from "@/src/hooks/useAuth";

import type {
  GamesGame,
  GamesGameStatus,
} from "@/src/types/GamesGame";

type AuthUser =
  ReturnType<
    typeof useAuth
  >["user"];

type Props = {
  games:
    GamesGame[];

  user:
    AuthUser;

  clearMessages:
    () => void;

  setActionError:
    (
      message:
        string | null,
    ) => void;

  setSuccessMessage:
    (
      message:
        string | null,
    ) => void;
};

export function useAdminGamesCatalogController({
  games,
  user,
  clearMessages,
  setActionError,
  setSuccessMessage,
}: Props) {
  const [
    isSavingGame,
    setIsSavingGame,
  ] =
    useState(
      false,
    );

  const [
    resettingGameId,
    setResettingGameId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    gameOrderDraft,
    setGameOrderDraft,
  ] =
    useState<string[]>(
      [],
    );

  const [
    isGameOrderDirty,
    setIsGameOrderDirty,
  ] =
    useState(
      false,
    );

  const [
    isSavingGameOrder,
    setIsSavingGameOrder,
  ] =
    useState(
      false,
    );

  const [
    editingGameId,
    setEditingGameId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    editingGameName,
    setEditingGameName,
  ] =
    useState("");

  const [
    editingGameDescription,
    setEditingGameDescription,
  ] =
    useState("");

  const [
    editingGamePrice,
    setEditingGamePrice,
  ] =
    useState(
      "0",
    );

  const [
    editingGameStatus,
    setEditingGameStatus,
  ] =
    useState<
      Exclude<
        GamesGameStatus,
        "suppressed"
      >
    >(
      "waiting",
    );

  const [
    editingGameActivatesAt,
    setEditingGameActivatesAt,
  ] =
    useState("");

  useEffect(
    () => {
      if (
        isGameOrderDirty
      ) {
        return;
      }

      const nextOrder =
        games.map(
          (
            game,
          ) =>
            game.id,
        );

      const frameId =
        window.requestAnimationFrame(
          () => {
            setGameOrderDraft(
              nextOrder,
            );
          },
        );

      return () => {
        window.cancelAnimationFrame(
          frameId,
        );
      };
    },
    [
      games,
      isGameOrderDirty,
    ],
  );

  const orderedGames =
    useMemo(
      () => {
        if (
          gameOrderDraft.length ===
          0
        ) {
          return games;
        }

        const gamesById =
          new Map(
            games.map(
              (
                game,
              ) => [
                game.id,
                game,
              ],
            ),
          );

        const ordered =
          gameOrderDraft
            .map(
              (
                gameId,
              ) =>
                gamesById.get(
                  gameId,
                ),
            )
            .filter(
              (
                game,
              ): game is GamesGame =>
                Boolean(
                  game,
                ),
            );

        const orderedIds =
          new Set(
            ordered.map(
              (
                game,
              ) =>
                game.id,
            ),
          );

        games.forEach(
          (
            game,
          ) => {
            if (
              !orderedIds.has(
                game.id,
              )
            ) {
              ordered.push(
                game,
              );
            }
          },
        );

        return ordered;
      },
      [
        games,
        gameOrderDraft,
      ],
    );

  function handleStartEditGame(
    game:
      GamesGame,
  ) {
    setEditingGameId(
      game.id,
    );

    setEditingGameName(
      game.name,
    );

    setEditingGamePrice(
      String(
        game.priceCents /
        100,
      ),
    );

    setEditingGameDescription(
      game.description ??
      "",
    );

    setEditingGameStatus(
      game.status ===
        "active"
        ? "active"
        : "waiting",
    );

    const activatesAt =
      toGamesDate(
        game.activatesAt,
      );

    setEditingGameActivatesAt(
      activatesAt
        ? formatDateTimeInput(
            activatesAt,
          )
        : "",
    );

    clearMessages();
  }

  function handleCancelEditGame() {
    setEditingGameId(
      null,
    );

    setEditingGameName(
      "",
    );

    setEditingGamePrice(
      "0",
    );

    setEditingGameDescription(
      "",
    );

    setEditingGameStatus(
      "waiting",
    );

    setEditingGameActivatesAt(
      "",
    );
  }

  async function handleSaveGameEdit() {
    if (
      !editingGameId ||
      isSavingGame
    ) {
      return;
    }

    const game =
      games.find(
        (
          current,
        ) =>
          current.id ===
          editingGameId,
      );

    if (
      !game
    ) {
      setActionError(
        "Gioco non trovato.",
      );

      return;
    }

    const normalizedName =
      editingGameName.trim();

    if (
      !normalizedName
    ) {
      setActionError(
        "Inserisci il nome del gioco.",
      );

      return;
    }

    const priceCents =
      parseEuroToCents(
        editingGamePrice,
      );

    if (
      priceCents ===
      null
    ) {
      setActionError(
        "Inserisci un prezzo valido. Usa 0 per un gioco gratuito.",
      );

      return;
    }

    const activatesAt =
      editingGameStatus ===
        "waiting" &&
      editingGameActivatesAt
        ? parseDateTimeInput(
            editingGameActivatesAt,
          )
        : undefined;

    if (
      editingGameStatus ===
        "waiting" &&
      editingGameActivatesAt &&
      !activatesAt
    ) {
      setActionError(
        "La data di attivazione programmata non è valida.",
      );

      return;
    }

    setIsSavingGame(
      true,
    );

    clearMessages();

    try {
      await FirebaseGamesGameRepository
        .update({
          gameId:
            game.id,

          name:
            normalizedName,

          slug:
            game.slug,

          priceCents,

          gameType:
            game.gameType,

          description:
            editingGameDescription.trim() ||
            undefined,

          status:
            editingGameStatus,

          activatesAt,
        });

      handleCancelEditGame();

      setSuccessMessage(
        activatesAt
          ? `Gioco programmato per ${formatScheduledActivation(activatesAt)}.`
          : "Gioco aggiornato correttamente.",
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore modifica gioco:",
        currentError,
      );

      setActionError(
        getErrorMessage(
          currentError,
          "Impossibile aggiornare il gioco.",
        ),
      );
    } finally {
      setIsSavingGame(
        false,
      );
    }
  }

  async function handleResetGame(
    game:
      GamesGame,
  ) {
    if (
      !user ||
      isSavingGame ||
      resettingGameId
    ) {
      return;
    }

    const votingWarning =
      game.gameType ===
        "votazioni"
        ? "\n\nPer Votazioni verranno eliminate tutte le votazioni create e le relative submission."
        : "";

    const confirmed =
      window.confirm(
        [
          `AZZERARE "${game.name}"?`,
          "",
          "Il gioco ripartirà come appena configurato: verranno cancellati dati operativi, partecipazioni, risultati e classifiche collegati al gioco.",
          "Nome, prezzo, stato del catalogo, Games Pass e acquisti singoli resteranno invariati.",
          votingWarning,
          "Questa operazione non può essere annullata.",
        ]
          .filter(Boolean)
          .join(
            "\n",
          ),
      );

    if (
      !confirmed
    ) {
      return;
    }

    setResettingGameId(
      game.id,
    );

    clearMessages();

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          `/api/admin/games/${encodeURIComponent(
            game.id,
          )}/reset`,
          {
            method:
              "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const result =
        (await response
          .json()
          .catch(() => ({}))) as {
          error?:
            string;
        };

      if (
        !response.ok
      ) {
        throw new Error(
          result.error ||
          "Reset del gioco non riuscito.",
        );
      }

      if (
        editingGameId ===
        game.id
      ) {
        handleCancelEditGame();
      }

      setSuccessMessage(
        `${game.name} è stato azzerato. Il gioco è pronto per una nuova configurazione.`,
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore reset gioco:",
        currentError,
      );

      setActionError(
        getErrorMessage(
          currentError,
          "Impossibile azzerare il gioco.",
        ),
      );
    } finally {
      setResettingGameId(
        null,
      );
    }
  }

  function handleMoveGame(
    gameId:
      string,

    direction:
      | "up"
      | "down",
  ) {
    if (
      isSavingGame ||
      isSavingGameOrder
    ) {
      return;
    }

    const baseOrder =
      gameOrderDraft.length ===
      orderedGames.length
        ? [
            ...gameOrderDraft,
          ]
        : orderedGames.map(
            (
              game,
            ) =>
              game.id,
          );

    const currentIndex =
      baseOrder.indexOf(
        gameId,
      );

    if (
      currentIndex <
      0
    ) {
      return;
    }

    const targetIndex =
      direction ===
      "up"
        ? currentIndex -
          1
        : currentIndex +
          1;

    if (
      targetIndex <
        0 ||
      targetIndex >=
      baseOrder.length
    ) {
      return;
    }

    [
      baseOrder[
        currentIndex
      ],
      baseOrder[
        targetIndex
      ],
    ] = [
      baseOrder[
        targetIndex
      ],
      baseOrder[
        currentIndex
      ],
    ];

    setGameOrderDraft(
      baseOrder,
    );

    setIsGameOrderDirty(
      true,
    );
  }

  function handleCancelGameOrder() {
    setGameOrderDraft(
      games.map(
        (
          game,
        ) =>
          game.id,
      ),
    );

    setIsGameOrderDirty(
      false,
    );
  }

  async function handleSaveGameOrder() {
    if (
      !isGameOrderDirty ||
      isSavingGameOrder ||
      isSavingGame
    ) {
      return;
    }

    const orderedIds =
      orderedGames.map(
        (
          game,
        ) =>
          game.id,
      );

    setIsSavingGameOrder(
      true,
    );

    setActionError(
      null,
    );

    try {
      await FirebaseGamesGameRepository
        .reorderCatalog(
          orderedIds,
        );

      setGameOrderDraft(
        orderedIds,
      );

      setIsGameOrderDirty(
        false,
      );
    } catch (
      currentError
    ) {
      console.error(
        "Errore riordinamento giochi:",
        currentError,
      );

      setActionError(
        getErrorMessage(
          currentError,
          "Impossibile salvare l'ordine dei giochi.",
        ),
      );
    } finally {
      setIsSavingGameOrder(
        false,
      );
    }
  }

  return {
    orderedGames,
    isSavingGame,
    resettingGameId,
    isGameOrderDirty,
    isSavingGameOrder,
    editingGameId,
    editingGameName,
    editingGameDescription,
    editingGamePrice,
    editingGameStatus,
    editingGameActivatesAt,
    setEditingGameName,
    setEditingGameDescription,
    setEditingGamePrice,
    setEditingGameStatus,
    setEditingGameActivatesAt,
    handleStartEditGame,
    handleCancelEditGame,
    handleSaveGameEdit,
    handleResetGame,
    handleMoveGame,
    handleCancelGameOrder,
    handleSaveGameOrder,
  };
}

function parseEuroToCents(
  value:
    string,
): number | null {
  const normalized =
    Number(
      value
        .trim()
        .replace(
          ",",
          ".",
        ),
    );

  if (
    !Number.isFinite(
      normalized,
    ) ||
    normalized <
    0
  ) {
    return null;
  }

  return Math.round(
    normalized *
    100,
  );
}

function parseDateTimeInput(
  value:
    string,
): Date | undefined {
  if (
    !value
  ) {
    return undefined;
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return undefined;
  }

  return date;
}

function formatDateTimeInput(
  date:
    Date,
): string {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
      1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    );

  const hours =
    String(
      date.getHours(),
    ).padStart(
      2,
      "0",
    );

  const minutes =
    String(
      date.getMinutes(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatScheduledActivation(
  date:
    Date,
): string {
  return new Intl.DateTimeFormat(
    "it-IT",
    {
      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    },
  ).format(
    date,
  );
}

function getErrorMessage(
  error:
    unknown,

  fallback:
    string,
): string {
  return error instanceof
    Error
    ? error.message
    : fallback;
}
