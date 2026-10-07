"use client";

import {
  ArrowDown,
  ArrowUp,
} from "lucide-react";

import {
  getEffectiveGamesGameStatus,
} from "@/src/services/games/GamesGameStatusService";

import {
  toGamesDate,
} from "@/src/services/games/GamesSeasonStatusService";

import type {
  GamesGame,
  GamesGameStatus,
  GamesGameType,
} from "@/src/types/GamesGame";

type Props = {
  games:
    GamesGame[];

  orderedGames:
    GamesGame[];

  gamesError:
    string | null;

  gamesLoading:
    boolean;

  isGameOrderDirty:
    boolean;

  isSavingGameOrder:
    boolean;

  isSavingGame:
    boolean;

  resettingGameId:
    string | null;

  editingGameId:
    string | null;

  editingGameName:
    string;

  editingGameDescription:
    string;

  editingGamePrice:
    string;

  editingGameStatus:
    Exclude<
      GamesGameStatus,
      "suppressed"
    >;

  editingGameActivatesAt:
    string;

  onCancelGameOrder:
    () => void;

  onSaveGameOrder:
    () => void | Promise<void>;

  onMoveGame:
    (
      gameId:
        string,

      direction:
        "up" | "down",
    ) => void;

  onOpenVoting:
    (
      game:
        GamesGame,
    ) => void;

  onDevelopGame:
    (
      game:
        GamesGame,
    ) => void;

  onDemoGame:
    (
      game:
        GamesGame,
    ) => void;

  onStartEditGame:
    (
      game:
        GamesGame,
    ) => void;

  onResetGame:
    (
      game:
        GamesGame,
    ) => void | Promise<void>;

  onEditingGameNameChange:
    (
      value:
        string,
    ) => void;

  onEditingGameDescriptionChange:
    (
      value:
        string,
    ) => void;

  onEditingGamePriceChange:
    (
      value:
        string,
    ) => void;

  onEditingGameStatusChange:
    (
      status:
        Exclude<
          GamesGameStatus,
          "suppressed"
        >,
    ) => void;

  onEditingGameActivatesAtChange:
    (
      value:
        string,
    ) => void;

  onCancelEditGame:
    () => void;

  onSaveGameEdit:
    () => void | Promise<void>;
};

export default function AdminGamesCatalogSection({
  games,
  orderedGames,
  gamesError,
  gamesLoading,
  isGameOrderDirty,
  isSavingGameOrder,
  isSavingGame,
  resettingGameId,
  editingGameId,
  editingGameName,
  editingGameDescription,
  editingGamePrice,
  editingGameStatus,
  editingGameActivatesAt,
  onCancelGameOrder,
  onSaveGameOrder,
  onMoveGame,
  onOpenVoting,
  onDevelopGame,
  onDemoGame,
  onStartEditGame,
  onResetGame,
  onEditingGameNameChange,
  onEditingGameDescriptionChange,
  onEditingGamePriceChange,
  onEditingGameStatusChange,
  onEditingGameActivatesAtChange,
  onCancelEditGame,
  onSaveGameEdit,
}: Props) {
  const handleCancelGameOrder =
    onCancelGameOrder;

  const handleSaveGameOrder =
    onSaveGameOrder;

  const handleMoveGame =
    onMoveGame;

  const handleDevelopGame =
    onDevelopGame;

  const handleDemoGame =
    onDemoGame;

  const handleStartEditGame =
    onStartEditGame;

  const handleResetGame =
    onResetGame;

  const setEditingGameName =
    onEditingGameNameChange;

  const setEditingGameDescription =
    onEditingGameDescriptionChange;

  const setEditingGamePrice =
    onEditingGamePriceChange;

  const setEditingGameStatus =
    onEditingGameStatusChange;

  const setEditingGameActivatesAt =
    onEditingGameActivatesAtChange;

  const handleCancelEditGame =
    onCancelEditGame;

  const handleSaveGameEdit =
    onSaveGameEdit;

  return (
        <section className="rounded-[24px] bg-white p-6 shadow-[0_12px_30px_rgba(6,20,46,0.08)]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
              Catalogo fisso
            </p>

            <h2 className="mt-2 text-2xl font-black uppercase text-[#06142E]">
              Giochi
            </h2>

            <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/45">
              I 5 Games sono già definiti e restano nel catalogo. Puoi modificarne impostazioni e ordine oppure azzerare i dati operativi per farli ripartire da zero.
            </p>
          </div>

          <div className="mt-6">
            <div className="flex items-end justify-between gap-3">
              <p className="text-xs font-black uppercase text-[#06142E]">
                Games disponibili
              </p>

              <span className="text-xs font-black text-[#06142E]/35">
                {games.length}
              </span>
            </div>

            <p className="mt-2 text-[9px] font-bold leading-4 text-[#06142E]/35">
              Usa le frecce per preparare il nuovo ordine. Le modifiche vengono applicate al Catalogo pubblico solo quando premi &quot;Salva ordine&quot;.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={
                  !isGameOrderDirty ||
                  isSavingGameOrder
                }
                onClick={
                  handleCancelGameOrder
                }
                className="min-h-10 rounded-[11px] bg-[#06142E]/[0.06] px-3 text-[9px] font-black uppercase text-[#06142E] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Annulla ordine
              </button>

              <button
                type="button"
                disabled={
                  !isGameOrderDirty ||
                  isSavingGameOrder
                }
                onClick={() => {
                  void handleSaveGameOrder();
                }}
                className="min-h-10 rounded-[11px] bg-[#06142E] px-3 text-[9px] font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                {isSavingGameOrder
                  ? "Salvataggio..."
                  : "Salva ordine"}
              </button>
            </div>

            {isGameOrderDirty && (
              <p className="mt-2 rounded-[10px] bg-amber-50 px-3 py-2 text-[9px] font-black uppercase text-amber-800">
                Ordine modificato · da salvare
              </p>
            )}

            {gamesError && (
              <p className="mt-3 text-sm font-bold text-red-700">
                {gamesError}
              </p>
            )}

            {gamesLoading ? (
              <p className="mt-4 text-sm font-bold text-[#06142E]/45">
                Caricamento giochi...
              </p>
            ) : games.length ===
              0 ? (
              <p className="mt-4 text-sm font-bold text-[#06142E]/45">
                Nessun gioco creato.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {orderedGames.map(
                  (
                    game,
                    gameIndex,
                  ) => (
                    <div
                      key={
                        game.id
                      }
                    >
                      <article className="flex h-full min-w-0 flex-col rounded-[18px] border border-[#06142E]/10 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate font-black uppercase text-[#06142E]">
                              {game.name}
                            </p>

                            <p className="mt-1 text-sm font-black text-[#06142E]/60">
                              {game.catalogVersion !==
                              2
                                ? "PREZZO DA CONFIGURARE"
                                : game.priceCents ===
                                    0
                                  ? "GRATUITO"
                                  : formatEuro(
                                      game.priceCents,
                                    )}
                            </p>

                            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#06142E]/35">
                              {getGameTypeLabel(
                                game.gameType ??
                                  "custom",
                              )}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <GameStatusBadge
                              game={
                                game
                              }
                            />

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                title="Sposta su"
                                aria-label={`Sposta ${game.name} in alto`}
                                disabled={
                                  isSavingGame ||
                                  isSavingGameOrder ||
                                  gameIndex ===
                                    0
                                }
                                onClick={() => {
                                  void handleMoveGame(
                                    game.id,
                                    "up",
                                  );
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#06142E]/[0.06] text-[#06142E] transition hover:bg-[#06142E]/10 disabled:cursor-not-allowed disabled:opacity-25"
                              >
                                <ArrowUp
                                  size={15}
                                  strokeWidth={2.6}
                                />
                              </button>

                              <button
                                type="button"
                                title="Sposta giù"
                                aria-label={`Sposta ${game.name} in basso`}
                                disabled={
                                  isSavingGame ||
                                  isSavingGameOrder ||
                                  gameIndex ===
                                    orderedGames.length -
                                      1
                                }
                                onClick={() => {
                                  void handleMoveGame(
                                    game.id,
                                    "down",
                                  );
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#06142E]/[0.06] text-[#06142E] transition hover:bg-[#06142E]/10 disabled:cursor-not-allowed disabled:opacity-25"
                              >
                                <ArrowDown
                                  size={15}
                                  strokeWidth={2.6}
                                />
                              </button>
                            </div>
                          </div>
                        </div>

                        {game.status ===
                          "waiting" &&
                          Boolean(
                            game.activatesAt,
                          ) && (
                          <p className="mt-3 text-[10px] font-bold text-[#06142E]/40">
                            Attivazione:{" "}
                            {formatDateTime(
                              game.activatesAt,
                            )}
                          </p>
                        )}

                        <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                          {game.gameType ===
                          "votazioni" ? (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenVoting(
                                  game,
                                )
                              }
                              className="min-h-10 rounded-[11px] bg-[#0B5FFF] px-2 text-[9px] font-black uppercase text-white"
                            >
                              Apri elenco votazioni
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDevelopGame(
                                    game,
                                  )
                                }
                                className="min-h-10 rounded-[11px] bg-[#0B5FFF] px-2 text-[9px] font-black uppercase text-white"
                              >
                                Sviluppa gioco
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDemoGame(
                                    game,
                                  )
                                }
                                className="min-h-10 rounded-[11px] bg-emerald-100 px-2 text-[9px] font-black uppercase text-emerald-800"
                              >
                                Demo
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            disabled={
                              isSavingGame ||
                              resettingGameId !==
                                null
                            }
                            onClick={() =>
                              handleStartEditGame(
                                game,
                              )
                            }
                            className="min-h-10 rounded-[11px] bg-[#06142E]/[0.06] px-2 text-[9px] font-black uppercase text-[#06142E] disabled:opacity-40"
                          >
                            Modifica
                          </button>

                          {game.gameType !==
                            "votazioni" && (
                            <button
                              type="button"
                              disabled={
                                isSavingGame ||
                                resettingGameId !==
                                  null
                              }
                              onClick={() => {
                                void handleResetGame(
                                  game,
                                );
                              }}
                              className="min-h-10 rounded-[11px] bg-amber-100 px-2 text-[9px] font-black uppercase text-amber-800 disabled:opacity-40"
                            >
                              {resettingGameId ===
                              game.id
                                ? "Reset..."
                                : "Reset"}
                            </button>
                          )}
                        </div>
                      </article>

                      {editingGameId ===
                        game.id && (
                        <div className="mt-3 rounded-[18px] bg-[#F5F5F2] p-4">
                          <p className="text-xs font-black uppercase text-[#06142E]">
                            Modifica gioco
                          </p>

                          <label className="mt-4 block">
                            <span className="text-[10px] font-black uppercase text-[#06142E]/45">
                              Nome
                            </span>

                            <input
                              type="text"
                              value={
                                editingGameName
                              }
                              onChange={(
                                event,
                              ) =>
                                setEditingGameName(
                                  event.target.value,
                                )
                              }
                              className="mt-2 min-h-11 w-full rounded-[12px] bg-white px-4 text-sm font-bold text-[#06142E] outline-none"
                            />
                          </label>

                          <label className="mt-4 block">
                            <span className="text-[10px] font-black uppercase text-[#06142E]/45">
                              Descrizione
                            </span>

                            <textarea
                              value={
                                editingGameDescription
                              }
                              onChange={(
                                event,
                              ) =>
                                setEditingGameDescription(
                                  event.target.value,
                                )
                              }
                              rows={3}
                              placeholder="Descrizione breve del gioco"
                              className="mt-2 w-full resize-none rounded-[12px] bg-white px-4 py-3 text-sm font-bold leading-5 text-[#06142E] outline-none"
                            />
                          </label>

                          <label className="mt-4 block">
                            <span className="text-[10px] font-black uppercase text-[#06142E]/45">
                              Prezzo €
                            </span>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                editingGamePrice
                              }
                              onChange={(
                                event,
                              ) =>
                                setEditingGamePrice(
                                  event.target.value,
                                )
                              }
                              className="mt-2 min-h-11 w-full rounded-[12px] bg-white px-4 text-sm font-bold text-[#06142E] outline-none"
                            />
                          </label>

                          <GameStatusEditor
                            status={
                              editingGameStatus
                            }
                            activatesAt={
                              editingGameActivatesAt
                            }
                            onStatusChange={
                              setEditingGameStatus
                            }
                            onActivatesAtChange={
                              setEditingGameActivatesAt
                            }
                          />

                          <div className="mt-5 flex gap-3">
                            <button
                              type="button"
                              disabled={
                                isSavingGame
                              }
                              onClick={
                                handleCancelEditGame
                              }
                              className="min-h-11 flex-1 rounded-[12px] bg-white px-4 text-xs font-black uppercase text-[#06142E]"
                            >
                              Annulla
                            </button>

                            <button
                              type="button"
                              disabled={
                                isSavingGame
                              }
                              onClick={() => {
                                void handleSaveGameEdit();
                              }}
                              className="min-h-11 flex-1 rounded-[12px] bg-[#06142E] px-4 text-xs font-black uppercase text-white disabled:opacity-40"
                            >
                              {isSavingGame
                                ? "Salvataggio..."
                                : "Salva modifiche"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </section>
  );
}

function getGameTypeLabel(
  gameType:
    GamesGameType,
) {
  switch (
    gameType
  ) {
    case "fantacalcio":
      return "Fantacalcio";

    case "pronostici":
      return "Pronostici";

    case "votazioni":
      return "Votazioni";

    case "quiz":
      return "Quiz";

    case "custom":
    default:
      return "Altro";
  }
}

function GameStatusEditor({
  status,
  activatesAt,
  onStatusChange,
  onActivatesAtChange,
}: {
  status:
    Exclude<
      GamesGameStatus,
      "suppressed"
    >;

  activatesAt:
    string;

  onStatusChange:
    (
      status:
        Exclude<
          GamesGameStatus,
          "suppressed"
        >,
    ) => void;

  onActivatesAtChange:
    (
      value:
        string,
    ) => void;
}) {
  const activationDate =
    activatesAt
      ? activatesAt.slice(
          0,
          10,
        )
      : "";

  const activationTime =
    activatesAt.includes(
      "T",
    )
      ? activatesAt.slice(
          11,
          16,
        ) ||
        "00:00"
      : "00:00";

  return (
    <>
      <div className="mt-4">
        <p className="text-[10px] font-black uppercase text-[#06142E]/45">
          Stato iniziale
        </p>

        <div className="mt-2 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() =>
              onStatusChange(
                "active",
              )
            }
            className={`min-h-11 rounded-[12px] text-xs font-black uppercase ${
              status ===
                "active"
                ? "bg-emerald-600 text-white"
                : "bg-white text-[#06142E]"
            }`}
          >
            Attivo
          </button>

          <button
            type="button"
            onClick={() =>
              onStatusChange(
                "waiting",
              )
            }
            className={`min-h-11 rounded-[12px] text-xs font-black uppercase ${
              status ===
                "waiting"
                ? "bg-[#06142E] text-white"
                : "bg-white text-[#06142E]"
            }`}
          >
            Prossimamente
          </button>
        </div>
      </div>

      {status ===
        "waiting" && (
        <div className="mt-4">
          <span className="text-[10px] font-black uppercase text-[#06142E]/45">
            Attivazione programmata
          </span>

          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_120px] gap-3">
            <label className="block">
              <span className="sr-only">
                Data di attivazione
              </span>

              <input
                type="date"
                value={
                  activationDate
                }
                onChange={(
                  event,
                ) => {
                  const nextDate =
                    event.target.value;

                  onActivatesAtChange(
                    nextDate
                      ? `${nextDate}T${activationTime || "00:00"}`
                      : "",
                  );
                }}
                className="min-h-11 w-full rounded-[12px] bg-white px-4 text-sm font-bold text-[#06142E] outline-none"
              />
            </label>

            <label className="block">
              <span className="sr-only">
                Ora di attivazione
              </span>

              <input
                type="time"
                value={
                  activationDate
                    ? activationTime
                    : "00:00"
                }
                disabled={
                  !activationDate
                }
                onChange={(
                  event,
                ) => {
                  if (
                    !activationDate
                  ) {
                    return;
                  }

                  onActivatesAtChange(
                    `${activationDate}T${event.target.value || "00:00"}`,
                  );
                }}
                className="min-h-11 w-full rounded-[12px] bg-white px-3 text-sm font-bold text-[#06142E] outline-none disabled:opacity-45"
              />
            </label>
          </div>

          <p className="mt-2 text-[9px] font-bold text-[#06142E]/30">
            Se scegli solo la data, il gioco verrà attivato automaticamente alle 00:00. Puoi impostare anche un orario preciso.
          </p>
        </div>
      )}
    </>
  );
}

function GameStatusBadge({
  game,
}: {
  game:
    GamesGame;
}) {
  const activatesAt =
    toGamesDate(
      game.activatesAt,
    );

  const isScheduled =
    game.status ===
      "waiting" &&
    Boolean(
      activatesAt,
    );

  const isEffectivelyActive =
    getEffectiveGamesGameStatus(
      game,
    ) ===
    "active";

  const label =
    game.status ===
      "active" ||
    isEffectivelyActive
      ? "Attivo"
      : isScheduled
        ? "Programmato"
        : "Prossimamente";

  const badgeClass =
    label ===
      "Attivo"
      ? "bg-emerald-100 text-emerald-800"
      : label ===
          "Programmato"
        ? "bg-sky-100 text-sky-800"
        : "bg-amber-100 text-amber-800";

  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-black uppercase ${badgeClass}`}
      title={
        activatesAt
          ? `Attivazione: ${formatScheduledActivation(activatesAt)}`
          : undefined
      }
    >
      {label}
    </span>
  );
}

function formatEuro(
  priceCents:
    number,
): string {
  return new Intl.NumberFormat(
    "it-IT",
    {
      style:
        "currency",

      currency:
        "EUR",
    },
  ).format(
    priceCents /
    100,
  );
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

function formatDateTime(
  value:
    unknown,
): string {
  const date =
    toGamesDate(
      value,
    );

  if (
    !date
  ) {
    return "—";
  }

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
