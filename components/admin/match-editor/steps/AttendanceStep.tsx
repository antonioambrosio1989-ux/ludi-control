"use client";

import {
  useMemo,
  useState,
} from "react";

import TeamLogo from "@/components/common/TeamLogo";
import { usePlayers } from "@/src/hooks/usePlayers";

import {
  AddPlayerToSeasonRosterService,
} from "@/src/application/season-player/AddPlayerToSeasonRosterService";

import {
  createTemporaryGoalkeeperId,
  parseTemporaryGoalkeeperId,
} from "@/src/services/match/TemporaryMatchPlayer";

import type {
  SeasonPlayer,
} from "@/src/types/SeasonPlayer";

import type {
  Team,
} from "@/src/types/Team";

type AttendanceRosterPlayer = {
  id: string;
  name: string;

  role:
    SeasonPlayer["role"];

  shirtNumber?: number;
  temporary?: boolean;
};

type Props = {
  homeTeam?: Team;
  awayTeam?: Team;

  seasonId: string;

  homeRoster:
    SeasonPlayer[];

  awayRoster:
    SeasonPlayer[];

  onRosterUpdate:
    () =>
      void |
      Promise<void>;

  homePresentPlayerIds:
    string[];

  awayPresentPlayerIds:
    string[];

  onHomePresentPlayersChange: (
    playerIds: string[],
  ) => void;

  onAwayPresentPlayersChange: (
    playerIds: string[],
  ) => void;

  onBack: () => void;
  onContinue: () => void;
};

type TeamTab =
  | "home"
  | "away";

export default function AttendanceStep({
  seasonId,

  homeTeam,
  awayTeam,

  homeRoster,
  awayRoster,

  homePresentPlayerIds,
  awayPresentPlayerIds,

  onHomePresentPlayersChange,
  onAwayPresentPlayersChange,

  onBack,
  onContinue,
  onRosterUpdate,
}: Props) {
  const [
    activeTeam,
    setActiveTeam,
  ] =
    useState<TeamTab>(
      "home",
    );

  const {
    players,

    isLoading:
      playersLoading,

    error:
      playersError,

    refresh:
      refreshPlayers,
  } = usePlayers();

  const currentTeam =
    activeTeam === "home"
      ? homeTeam
      : awayTeam;

  const currentPresentPlayerIds =
    activeTeam === "home"
      ? homePresentPlayerIds
      : awayPresentPlayerIds;

  const currentSeasonRoster =
    activeTeam === "home"
      ? homeRoster
      : awayRoster;

  const [
    showPlayerForm,
    setShowPlayerForm,
  ] = useState(false);

  const [
    showTemporaryGoalkeeperForm,
    setShowTemporaryGoalkeeperForm,
  ] = useState(false);

  const [
    temporaryGoalkeeperFirstName,
    setTemporaryGoalkeeperFirstName,
  ] = useState("");

  const [
    temporaryGoalkeeperLastName,
    setTemporaryGoalkeeperLastName,
  ] = useState("");

  const [
    temporaryGoalkeeperError,
    setTemporaryGoalkeeperError,
  ] = useState<
    string | null
  >(null);

  const [
    newPlayerFirstName,
    setNewPlayerFirstName,
  ] = useState("");

  const [
    newPlayerLastName,
    setNewPlayerLastName,
  ] = useState("");

  const [
    newPlayerBirthYear,
    setNewPlayerBirthYear,
  ] = useState("");

  const [
    newPlayerRole,
    setNewPlayerRole,
  ] =
    useState<
      SeasonPlayer["role"]
    >(
      "Attaccante",
    );

  const [
    newPlayerShirtNumber,
    setNewPlayerShirtNumber,
  ] = useState("");

  const [
    isAddingPlayer,
    setIsAddingPlayer,
  ] = useState(false);

  const [
    addPlayerError,
    setAddPlayerError,
  ] =
    useState<
      string | null
    >(null);

  const currentRoster =
    useMemo<
      AttendanceRosterPlayer[]
    >(() => {
      const seasonRoster =
        currentSeasonRoster.map(
          (
            seasonPlayer,
          ) => {
            const player =
              players.find(
                (
                  currentPlayer,
                ) =>
                  String(
                    currentPlayer.id,
                  ) ===
                  String(
                    seasonPlayer.playerId,
                  ),
              );

            return {
              id:
                seasonPlayer.playerId,

              name:
                player
                  ? `${player.firstName} ${player.lastName}`.trim()
                  : "Giocatore senza nome",

              role:
                seasonPlayer.role,

              shirtNumber:
                seasonPlayer.shirtNumber,
            };
          },
        );

      const temporaryGoalkeepers =
        currentPresentPlayerIds.flatMap(
          (
            playerId,
          ) => {
            const temporary =
              parseTemporaryGoalkeeperId(
                playerId,
              );

            if (
              !temporary ||
              String(
                temporary.teamId,
              ) !==
                String(
                  currentTeam?.id ??
                    "",
                )
            ) {
              return [];
            }

            return [
              {
                id:
                  temporary.id,
                name:
                  temporary.name,
                role:
                  "Portiere" as const,
                temporary:
                  true,
              },
            ];
          },
        );

      return [
        ...seasonRoster,
        ...temporaryGoalkeepers,
      ];
    }, [
      currentSeasonRoster,
      currentPresentPlayerIds,
      currentTeam?.id,
      players,
    ]);

  const canContinue =
    homePresentPlayerIds.length >
      0 &&
    awayPresentPlayerIds.length >
      0;

  function updateCurrentPresentPlayers(
    playerIds: string[],
  ) {
    if (
      activeTeam === "home"
    ) {
      onHomePresentPlayersChange(
        playerIds,
      );

      return;
    }

    onAwayPresentPlayersChange(
      playerIds,
    );
  }

  function togglePlayer(
    playerId: string,
  ) {
    const isPresent =
      currentPresentPlayerIds.includes(
        playerId,
      );

    if (isPresent) {
      updateCurrentPresentPlayers(
        currentPresentPlayerIds.filter(
          (id) =>
            id !==
            playerId,
        ),
      );

      return;
    }

    updateCurrentPresentPlayers([
      ...currentPresentPlayerIds,
      playerId,
    ]);
  }

  function selectAllCurrentTeam() {
    updateCurrentPresentPlayers(
      currentRoster.map(
        (player) =>
          player.id,
      ),
    );
  }

  function clearCurrentTeam() {
    updateCurrentPresentPlayers(
      [],
    );
  }

  async function addPlayerToCurrentRoster() {
    if (!currentTeam) {
      setAddPlayerError(
        "Squadra non disponibile.",
      );

      return;
    }

    setIsAddingPlayer(
      true,
    );

    setAddPlayerError(
      null,
    );

    try {
      const result =
        await AddPlayerToSeasonRosterService.execute({
          seasonId,

          teamId:
            String(
              currentTeam.id,
            ),

          firstName:
            newPlayerFirstName,

          lastName:
            newPlayerLastName,

          birthYear:
            newPlayerBirthYear.trim()
              ? Number(
                  newPlayerBirthYear,
                )
              : undefined,

          role:
            newPlayerRole,

          shirtNumber:
            newPlayerShirtNumber.trim()
              ? Number(
                  newPlayerShirtNumber,
                )
              : undefined,
        });

      updateCurrentPresentPlayers([
        ...currentPresentPlayerIds,
        result.playerId,
      ]);

      await Promise.all([
        refreshPlayers(),
        onRosterUpdate(),
      ]);

      setNewPlayerFirstName(
        "",
      );

      setNewPlayerLastName(
        "",
      );

      setNewPlayerBirthYear(
        "",
      );

      setNewPlayerRole(
        "Attaccante",
      );

      setNewPlayerShirtNumber(
        "",
      );

      setShowPlayerForm(
        false,
      );
    } catch (error) {
      setAddPlayerError(
        error instanceof
          Error
          ? error.message
          : "Impossibile aggiungere il giocatore.",
      );
    } finally {
      setIsAddingPlayer(
        false,
      );
    }
  }


  function addTemporaryGoalkeeper() {
    if (!currentTeam) {
      setTemporaryGoalkeeperError(
        "Squadra non disponibile.",
      );

      return;
    }

    const firstName =
      temporaryGoalkeeperFirstName.trim();

    const lastName =
      temporaryGoalkeeperLastName.trim();

    if (
      !firstName ||
      !lastName
    ) {
      setTemporaryGoalkeeperError(
        "Inserisci nome e cognome del portiere provvisorio.",
      );

      return;
    }

    const temporaryPlayerId =
      createTemporaryGoalkeeperId({
        teamId:
          currentTeam.id,
        firstName,
        lastName,
      });

    updateCurrentPresentPlayers([
      ...currentPresentPlayerIds,
      temporaryPlayerId,
    ]);

    setTemporaryGoalkeeperFirstName(
      "",
    );

    setTemporaryGoalkeeperLastName(
      "",
    );

    setTemporaryGoalkeeperError(
      null,
    );

    setShowTemporaryGoalkeeperForm(
      false,
    );
  }

  if (
    playersLoading
  ) {
    return (
      <section className="rounded-[13px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
        <p className="text-sm font-bold text-[#06142E]/50">
          Caricamento giocatori...
        </p>
      </section>
    );
  }

  if (
    playersError
  ) {
    return (
      <section className="rounded-[13px] border border-red-200 bg-red-50 p-5">
        <p className="text-sm font-bold text-red-600">
          {playersError}
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="mb-5 rounded-[13px] bg-white p-4 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
        <div className="grid grid-cols-2 gap-2">
          <TeamTabButton
            team={
              homeTeam
            }
            active={
              activeTeam ===
              "home"
            }
            presentCount={
              homePresentPlayerIds.length
            }
            onClick={() =>
              setActiveTeam(
                "home",
              )
            }
          />

          <TeamTabButton
            team={
              awayTeam
            }
            active={
              activeTeam ===
              "away"
            }
            presentCount={
              awayPresentPlayerIds.length
            }
            onClick={() =>
              setActiveTeam(
                "away",
              )
            }
          />
        </div>
      </section>

      <section className="mb-5 rounded-[13px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#06142E]/40">
              Seleziona i presenti
            </p>

            <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
              {currentTeam?.aliasName ??
                currentTeam?.name ??
                "Squadra"}
            </h2>

            <p className="mt-1 text-sm font-bold text-[#06142E]/45">
              {
                currentPresentPlayerIds.length
              }{" "}
              di{" "}
              {
                currentRoster.length
              }{" "}
              selezionati
            </p>
          </div>

          <div className="flex gap-2">
            <SmallActionButton
              label="Tutti"
              onClick={
                selectAllCurrentTeam
              }
            />

            <SmallActionButton
              label="Nessuno"
              onClick={
                clearCurrentTeam
              }
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowPlayerForm(
              (
                currentValue,
              ) =>
                !currentValue,
            );

            setAddPlayerError(
              null,
            );
          }}
          className="mt-4 w-full rounded-[13px] border border-dashed border-[#06142E]/25 bg-[#06142E]/3 px-4 py-3 text-xs font-black uppercase text-[#06142E]"
        >
          {showPlayerForm
            ? "Chiudi inserimento"
            : "+ Nuovo giocatore"}
        </button>

        {showPlayerForm && (
          <div className="mt-4 space-y-3 rounded-[13px] border border-[#06142E]/10 bg-[#F7F8FA] p-4">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={
                  newPlayerFirstName
                }
                onChange={(
                  event,
                ) => {
                  setNewPlayerFirstName(
                    event
                      .target
                      .value,
                  );
                }}
                placeholder="Nome"
                className="h-12 rounded-[13px] border border-[#06142E]/10 bg-white px-3 text-sm font-bold text-[#06142E] outline-none"
              />

              <input
                type="text"
                value={
                  newPlayerLastName
                }
                onChange={(
                  event,
                ) => {
                  setNewPlayerLastName(
                    event
                      .target
                      .value,
                  );
                }}
                placeholder="Cognome"
                className="h-12 rounded-[13px] border border-[#06142E]/10 bg-white px-3 text-sm font-bold text-[#06142E] outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                inputMode="numeric"
                value={
                  newPlayerBirthYear
                }
                onChange={(
                  event,
                ) => {
                  setNewPlayerBirthYear(
                    event
                      .target
                      .value,
                  );
                }}
                placeholder="Anno di nascita (opzionale)"
                className="h-12 rounded-[13px] border border-[#06142E]/10 bg-white px-3 text-sm font-bold text-[#06142E] outline-none"
              />

              <input
                type="number"
                inputMode="numeric"
                value={
                  newPlayerShirtNumber
                }
                onChange={(
                  event,
                ) => {
                  setNewPlayerShirtNumber(
                    event
                      .target
                      .value,
                  );
                }}
                placeholder="Numero maglia"
                className="h-12 rounded-[13px] border border-[#06142E]/10 bg-white px-3 text-sm font-bold text-[#06142E] outline-none"
              />
            </div>

            <select
              value={
                newPlayerRole
              }
              onChange={(
                event,
              ) => {
                setNewPlayerRole(
                  event
                    .target
                    .value as
                    SeasonPlayer["role"],
                );
              }}
              className="h-12 w-full rounded-[13px] border border-[#06142E]/10 bg-white px-3 text-sm font-bold text-[#06142E] outline-none"
            >
              <option value="Portiere">
                Portiere
              </option>

              <option value="Difensore">
                Difensore
              </option>

              <option value="Attaccante">
                Attaccante
              </option>
            </select>

            {addPlayerError && (
              <p className="text-xs font-bold text-red-600">
                {
                  addPlayerError
                }
              </p>
            )}

            <button
              type="button"
              disabled={
                isAddingPlayer
              }
              onClick={() => {
                void addPlayerToCurrentRoster();
              }}
              className="h-12 w-full rounded-[13px] bg-[#06142E] text-sm font-black uppercase text-white disabled:opacity-40"
            >
              {isAddingPlayer
                ? "Inserimento..."
                : `Aggiungi a ${
                    currentTeam?.aliasName ??
                    currentTeam?.name ??
                    "squadra"
                  }`}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setShowTemporaryGoalkeeperForm(
              (
                currentValue,
              ) =>
                !currentValue,
            );

            setTemporaryGoalkeeperError(
              null,
            );
          }}
          className="mt-3 w-full rounded-[13px] border border-dashed border-amber-400/70 bg-amber-50 px-4 py-3 text-xs font-black uppercase text-amber-800"
        >
          {showTemporaryGoalkeeperForm
            ? "Chiudi portiere provvisorio"
            : "+ Portiere provvisorio"}
        </button>

        {showTemporaryGoalkeeperForm && (
          <div className="mt-3 space-y-3 rounded-[13px] border border-amber-200 bg-amber-50/60 p-4">
            <p className="text-xs font-bold leading-5 text-amber-800/80">
              Verrà usato soltanto in questa partita come portiere e non sarà aggiunto alla lista giocatori né alla rosa stagionale.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={
                  temporaryGoalkeeperFirstName
                }
                onChange={(
                  event,
                ) => {
                  setTemporaryGoalkeeperFirstName(
                    event.target.value,
                  );
                }}
                placeholder="Nome"
                className="h-12 min-w-0 rounded-[13px] border border-amber-200 bg-white px-3 text-sm font-bold text-[#06142E] outline-none"
              />

              <input
                type="text"
                value={
                  temporaryGoalkeeperLastName
                }
                onChange={(
                  event,
                ) => {
                  setTemporaryGoalkeeperLastName(
                    event.target.value,
                  );
                }}
                placeholder="Cognome"
                className="h-12 min-w-0 rounded-[13px] border border-amber-200 bg-white px-3 text-sm font-bold text-[#06142E] outline-none"
              />
            </div>

            {temporaryGoalkeeperError && (
              <p className="text-xs font-bold text-red-600">
                {
                  temporaryGoalkeeperError
                }
              </p>
            )}

            <button
              type="button"
              onClick={
                addTemporaryGoalkeeper
              }
              className="h-12 w-full rounded-[13px] bg-amber-500 text-sm font-black uppercase text-[#06142E]"
            >
              Schiera portiere provvisorio
            </button>
          </div>
        )}

        <div className="mt-5 space-y-5">
          <RoleGroup
            title="Portieri"
            icon="🥅"
            players={
              currentRoster.filter(
                (player) =>
                  player.role ===
                  "Portiere",
              )
            }
            presentPlayerIds={
              currentPresentPlayerIds
            }
            onToggle={
              togglePlayer
            }
          />

          <RoleGroup
            title="Difensori"
            icon="🛡️"
            players={
              currentRoster.filter(
                (player) =>
                  player.role ===
                  "Difensore",
              )
            }
            presentPlayerIds={
              currentPresentPlayerIds
            }
            onToggle={
              togglePlayer
            }
          />

          <RoleGroup
            title="Attaccanti"
            icon="⚽"
            players={
              currentRoster.filter(
                (player) =>
                  player.role ===
                  "Attaccante",
              )
            }
            presentPlayerIds={
              currentPresentPlayerIds
            }
            onToggle={
              togglePlayer
            }
          />
        </div>

        {currentRoster.length ===
          0 && (
          <div className="mt-5 rounded-[13px] border border-dashed border-[#06142E]/15 p-4 text-center">
            <p className="text-sm font-bold text-[#06142E]/40">
              Nessun giocatore attivo risulta
              associato a questa squadra.
            </p>
          </div>
        )}
      </section>

      {!canContinue && (
        <section className="mb-5 rounded-[13px] border border-[#06142E]/10 bg-white p-4 text-center">
          <p className="text-sm font-bold text-[#06142E]/50">
            Seleziona almeno un giocatore per
            entrambe le squadre.
          </p>
        </section>
      )}

      <NavigationFooter
        canContinue={
          canContinue
        }
        activeTeam={
          activeTeam
        }
        onBack={
          onBack
        }
        onContinue={() => {
          if (
            activeTeam ===
            "home"
          ) {
            setActiveTeam(
              "away",
            );

            return;
          }

          onContinue();
        }}
      />
    </>
  );
}

function TeamTabButton({
  team,
  active,
  presentCount,
  onClick,
}: {
  team?: Team;
  active: boolean;
  presentCount: number;
  onClick: () => void;
}) {
  const teamName =
    team?.aliasName ??
    team?.name ??
    "Squadra";

  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`rounded-[13px] border p-3 transition ${
        active
          ? "border-[#06142E] bg-[#06142E] text-white"
          : "border-[#06142E]/10 bg-white text-[#06142E]"
      }`}
    >
      <div className="flex items-center gap-3">
        <TeamLogo
          logoUrl={
            team?.logoUrl
          }
          teamName={
            teamName
          }
          size={38}
        />

        <div className="min-w-0 text-left">
          <p className="text-xs font-black uppercase">
            {teamName}
          </p>

          <p
            className={`mt-1 text-[10px] font-bold ${
              active
                ? "text-white/55"
                : "text-[#06142E]/40"
            }`}
          >
            {presentCount} presenti
          </p>
        </div>
      </div>
    </button>
  );
}

function RoleGroup({
  title,
  icon,
  players,
  presentPlayerIds,
  onToggle,
}: {
  title: string;
  icon: string;

  players:
    AttendanceRosterPlayer[];

  presentPlayerIds:
    string[];

  onToggle:
    (
      playerId: string,
    ) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span>
          {icon}
        </span>

        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#06142E]/45">
          {title}
        </h3>
      </div>

      {players.length > 0 ? (
        <div className="space-y-2">
          {players.map(
            (player) => {
              const isPresent =
                presentPlayerIds.includes(
                  player.id,
                );

              return (
                <button
                  key={
                    player.id
                  }
                  type="button"
                  onClick={() =>
                    onToggle(
                      player.id,
                    )
                  }
                  className={`flex min-h-14 w-full items-center gap-3 rounded-[13px] border px-4 py-3 text-left transition ${
                    isPresent
                      ? "border-[#06142E] bg-[#06142E]/5"
                      : "border-[#06142E]/8 bg-white"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[7px] border text-xs font-black ${
                      isPresent
                        ? "border-[#06142E] bg-[#06142E] text-white"
                        : "border-[#06142E]/20 text-transparent"
                    }`}
                  >
                    ✓
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[#06142E]">
                      {
                        player.name
                      }
                    </p>

                    <p className="mt-0.5 text-[10px] font-bold uppercase text-[#06142E]/40">
                      {
                        player.role
                      }

                      {player.shirtNumber !==
                      undefined
                        ? ` · #${player.shirtNumber}`
                        : ""}

                      {player.temporary
                        ? " · Provvisorio"
                        : ""}
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-black uppercase ${
                      isPresent
                        ? "text-[#06142E]"
                        : "text-[#06142E]/30"
                    }`}
                  >
                    {isPresent
                      ? "Presente"
                      : "Assente"}
                  </span>
                </button>
              );
            },
          )}
        </div>
      ) : (
        <div className="rounded-[13px] bg-[#06142E]/3 p-4">
          <p className="text-xs font-bold italic text-[#06142E]/35">
            Nessun giocatore in questo ruolo.
          </p>
        </div>
      )}
    </div>
  );
}

function SmallActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className="rounded-[10px] bg-[#06142E]/5 px-3 py-2 text-[9px] font-black uppercase text-[#06142E]/60"
    >
      {label}
    </button>
  );
}

function NavigationFooter({
  canContinue,
  activeTeam,
  onBack,
  onContinue,
}: {
  canContinue: boolean;
  activeTeam: TeamTab;
  onBack: () => void;
  onContinue: () => void;
}) {
  const buttonLabel =
    activeTeam === "home"
      ? "Squadra ospite"
      : "Continua";

  return (
    <div className="mt-5 grid grid-cols-2 gap-3 rounded-[13px] border border-[#06142E]/10 bg-white p-3 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
      <button
        type="button"
        onClick={
          onBack
        }
        className="h-12 rounded-[13px] border border-[#06142E] bg-white text-sm font-black uppercase text-[#06142E]"
      >
        Indietro
      </button>

      <button
        type="button"
        disabled={
          activeTeam ===
            "away" &&
          !canContinue
        }
        onClick={
          onContinue
        }
        className="h-12 rounded-[13px] bg-[#06142E] text-sm font-black uppercase text-white disabled:cursor-not-allowed disabled:bg-[#06142E]/20"
      >
        {buttonLabel}
      </button>
    </div>
  );
}