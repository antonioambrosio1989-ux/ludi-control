"use client";

import { useMemo, useState } from "react";

import { hasCompletePerformanceRating } from "@/src/services/match/PerformanceRating";

import TeamLogo from "@/components/common/TeamLogo";
import { usePlayers } from "@/src/hooks/usePlayers";

import type {
  MatchWizardPlayerPerformance,
  MatchWizardGoal,
} from "@/src/types/MatchWizardData";

import type { SeasonPlayer } from "@/src/types/SeasonPlayer";
import type { Team } from "@/src/types/Team";

import {
  parseTemporaryGoalkeeperId,
} from "@/src/services/match/TemporaryMatchPlayer";

type TeamTab = "home" | "away";

type PerformancePlayer = {
  id: string;
  name: string;
  teamId: string;
  role: SeasonPlayer["role"];
  shirtNumber?: number;
  temporary?: boolean;
};

type Props = {
  homeTeam?: Team;
  awayTeam?: Team;

  homeRoster: SeasonPlayer[];
  awayRoster: SeasonPlayer[];

  homePresentPlayerIds: string[];
  awayPresentPlayerIds: string[];

  performances: Record<
    string,
    MatchWizardPlayerPerformance
  >;

  goals: MatchWizardGoal[];

onGoalsChange: (
  goals: MatchWizardGoal[],
) => void;

  mvpPlayerId?: string;

  onPerformanceChange: (
    playerId: string,
    performance: MatchWizardPlayerPerformance,
  ) => void;

  onMvpPlayerChange: (
    playerId?: string,
  ) => void;

  onBack: () => void;
  onContinue: () => void;
};

export default function PerformanceStep({
  homeTeam,
  awayTeam,
  homeRoster,
  awayRoster,
  homePresentPlayerIds,
  awayPresentPlayerIds,
  performances,
  goals,
  mvpPlayerId,
  onPerformanceChange,
  onGoalsChange,
  onMvpPlayerChange,
  onBack,
  onContinue,
}: Props) {
  const [activeTeam, setActiveTeam] =
    useState<TeamTab>("home");

  const {
    players,
    isLoading: playersLoading,
    error: playersError,
  } = usePlayers();

  const homePlayers = useMemo(
    () =>
      buildPerformancePlayers({
        roster: homeRoster,
        presentPlayerIds:
          homePresentPlayerIds,
        players,
      }),
    [
      homeRoster,
      homePresentPlayerIds,
      players,
    ],
  );

  const awayPlayers = useMemo(
    () =>
      buildPerformancePlayers({
        roster: awayRoster,
        presentPlayerIds:
          awayPresentPlayerIds,
        players,
      }),
    [
      awayRoster,
      awayPresentPlayerIds,
      players,
    ],
  );

  const currentTeam =
    activeTeam === "home"
      ? homeTeam
      : awayTeam;

  const currentPlayers =
    activeTeam === "home"
      ? homePlayers
      : awayPlayers;

  const allPresentPlayers = [
    ...homePlayers,
    ...awayPlayers,
  ];

  const completedPlayers =
    allPresentPlayers.filter((player) => {
      const performance =
        performances[player.id];

      return hasCompletePerformanceRating(performance);
    }).length;

  const canContinue =
    allPresentPlayers.length > 0 &&
    completedPlayers ===
      allPresentPlayers.length &&
    Boolean(mvpPlayerId);

  function getPerformance(
    player: PerformancePlayer,
  ): MatchWizardPlayerPerformance {
    const existingPerformance =
      performances[player.id];

    if (existingPerformance) {
      return existingPerformance;
    }

    return {
      playerId: player.id,
      teamId: player.teamId,
      status: "rated",
      vote: undefined,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      directRedCards: 0,
      goalsConceded:
        player.role === "Portiere"
          ? 0
          : undefined,
    };
  }

  function updatePerformance(
    player: PerformancePlayer,
    updates: Partial<MatchWizardPlayerPerformance>,
  ) {
    const currentPerformance =
      getPerformance(player);

    onPerformanceChange(player.id, {
      ...currentPerformance,
      ...updates,
      playerId: player.id,
      teamId: player.teamId,
    });
  }

  if (playersLoading) {
    return (
      <section className="rounded-[13px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
        <p className="text-sm font-bold text-[#06142E]/50">
          Caricamento giocatori...
        </p>
      </section>
    );
  }

  if (playersError) {
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
            team={homeTeam}
            active={activeTeam === "home"}
            completedCount={countCompleted(
              homePlayers,
              performances,
            )}
            totalCount={homePlayers.length}
            onClick={() =>
              setActiveTeam("home")
            }
          />

          <TeamTabButton
            team={awayTeam}
            active={activeTeam === "away"}
            completedCount={countCompleted(
              awayPlayers,
              performances,
            )}
            totalCount={awayPlayers.length}
            onClick={() =>
              setActiveTeam("away")
            }
          />
        </div>
      </section>

      <section className="mb-5 rounded-[13px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#06142E]/40">
          Prestazioni
        </p>

        <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
          {currentTeam?.name ?? "Squadra"}
        </h2>

        <p className="mt-1 text-sm font-bold text-[#06142E]/45">
          Inserisci voto e provvedimenti
          disciplinari.
        </p>

        <div className="mt-5 space-y-3">
          {currentPlayers.map((player) => {
            const performance =
              getPerformance(player);

            return (
              <PlayerPerformanceCard
                key={player.id}
                player={player}
                performance={performance}
                goals={goals.filter((goal) => String(goal.scorerPlayerId) === String(player.id),)}
                opponentTeamId={
  String(player.teamId) ===
  String(homeTeam?.id)
    ? awayTeam?.id
    : homeTeam?.id
}
                isMvp={mvpPlayerId === player.id}
                onChange={(updates) => {updatePerformance(
                    player,
                    updates,
                  );
                }}
                onGoalsChange={(playerGoals) => {
                  const otherGoals = goals.filter(
                    (goal) =>
                       String(goal.scorerPlayerId) !==
                       String(player.id),
                  );

                onGoalsChange([
                 ...otherGoals,
                 ...playerGoals,
                ]);
              }}
                onMvpChange={() => {
                  onMvpPlayerChange(
                    mvpPlayerId === player.id
                      ? undefined
                      : player.id,
                  );
                }}
              />
            );
          })}
        </div>

        {currentPlayers.length === 0 && (
          <div className="mt-5 rounded-[13px] bg-[#06142E]/3 p-4">
            <p className="text-sm font-bold text-[#06142E]/40">
              Nessun giocatore presente per
              questa squadra.
            </p>
          </div>
        )}
      </section>

      {!mvpPlayerId && (
        <section className="mb-5 rounded-[13px] border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-700">
            Seleziona il Player of the Match.
          </p>
        </section>
      )}

      <NavigationFooter
        canContinue={canContinue}
        activeTeam={activeTeam}
        onBack={onBack}
        onContinue={() => {
          if (activeTeam === "home") {
            setActiveTeam("away");
            return;
          }

          onContinue();
        }}
      />
    </>
  );
}

function PlayerPerformanceCard({
  player,
  performance,
  goals,
  opponentTeamId,
  isMvp,
  onChange,
  onGoalsChange,
  onMvpChange,
}: {
  player: PerformancePlayer;
  performance: MatchWizardPlayerPerformance;
  goals: MatchWizardGoal[];
  opponentTeamId?: string | number;
  isMvp: boolean;

  onChange: (
    updates: Partial<MatchWizardPlayerPerformance>,
  ) => void;

  onGoalsChange: (
    goals: MatchWizardGoal[],
  ) => void;

  onMvpChange: () => void;
}) {

  /*
   * Un giocatore di movimento può essere impiegato
   * eccezionalmente in porta senza cambiare ruolo di rosa.
   * La presenza di goalsConceded identifica soltanto il ruolo
   * svolto in questa singola partita.
   */
  const isEmergencyGoalkeeper =
    player.role !== "Portiere" &&
    performance.goalsConceded !== undefined;

  const isMatchGoalkeeper =
    player.role === "Portiere" ||
    isEmergencyGoalkeeper;

    const regularGoals = goals.filter(
  (goal) => goal.type !== "ownGoal",
);

const ownGoals = goals.filter(
  (goal) => goal.type === "ownGoal",
);

  return (
    <article className="rounded-[13px] border border-[#06142E]/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black uppercase text-[#06142E]">
            {player.name}
          </p>

          <p className="mt-1 text-[10px] font-bold uppercase text-[#06142E]/40">
            {player.role}
            {player.shirtNumber !== undefined
              ? ` · #${player.shirtNumber}`
              : ""}
            {player.temporary
              ? " · Provvisorio"
              : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={onMvpChange}
          className={`rounded-[10px] px-3 py-2 text-[10px] font-black uppercase ${
            isMvp
              ? "bg-amber-400 text-[#06142E]"
              : "bg-[#06142E]/5 text-[#06142E]/45"
          }`}
        >
          ⭐ {isMvp ? "MVP" : "Scegli MVP"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] font-black uppercase text-[#06142E]/40">Voto</span>
          <select
            value={performance.status === "sv" ? "sv" : performance.vote ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              onChange({ status: value === "sv" ? "sv" : "rated", vote: value === "sv" || value === "" ? undefined : Number(value) });
            }}
            className="mt-1 h-12 w-full rounded-[11px] border border-[#06142E]/10 bg-white px-3 text-base font-bold text-[#06142E]"
          >
            <option value="">Seleziona voto</option>
            <option value="sv">SV</option>
            {RATING_OPTIONS.map((rating) => <option key={rating} value={rating}>{String(rating).replace(".", ",")}</option>)}
          </select>
        </label>

        <NumberField
           label="Gol"
           value={regularGoals.length}
           min={0}
           max={15}
           onChange={(value) => {
  const nextRegularGoals = [
    ...regularGoals,
  ];

  if (
    value >
    nextRegularGoals.length
  ) {
    const goalsToAdd =
      value -
      nextRegularGoals.length;

    for (
      let index = 0;
      index < goalsToAdd;
      index += 1
    ) {
      nextRegularGoals.push({
        id: crypto.randomUUID(),
        scorerPlayerId: player.id,
        teamId: player.teamId,
        minute: 1,
        stoppageTime: undefined,
        type: "action",
      });
    }
  }

  if (
    value <
    nextRegularGoals.length
  ) {
    nextRegularGoals.splice(value);
  }

  onGoalsChange([
    ...nextRegularGoals,
    ...ownGoals,
  ]);

  onChange({
    goals: value,
  });
}}
/>

<NumberField
  label="Assist"
  value={performance.assists}
  min={0}
  max={10}
  onChange={(value) => {
    onChange({
      assists: value,
    });
  }}
/>

<NumberField
  label="Autoreti"
  value={ownGoals.length}
  min={0}
  max={5}
  onChange={(value) => {
    const nextOwnGoals = [
      ...ownGoals,
    ];

    if (
      value >
      nextOwnGoals.length
    ) {
      const goalsToAdd =
        value -
        nextOwnGoals.length;

      for (
        let index = 0;
        index < goalsToAdd;
        index += 1
      ) {
        nextOwnGoals.push({
          id: crypto.randomUUID(),
          scorerPlayerId: player.id,

          /*
           * L’autore è il giocatore,
           * ma la rete viene assegnata
           * alla squadra avversaria.
           */
          teamId:
            opponentTeamId ??
            "",

          minute: 1,
          stoppageTime: undefined,
          type: "ownGoal",
        });
      }
    }

    if (
      value <
      nextOwnGoals.length
    ) {
      nextOwnGoals.splice(value);
    }

    onGoalsChange([
      ...regularGoals,
      ...nextOwnGoals,
    ]);
  }}
/>

<NumberField
  label="Ammonizioni"
  value={performance.yellowCards}
  min={0}
  max={2}
  onChange={(value) => {
    onChange({
      yellowCards: value,
    });
  }}
/>

<NumberField
  label="Rosso diretto"
  value={
    performance.directRedCards ?? 0
  }
  min={0}
  max={1}
  onChange={(value) => {
    onChange({
      directRedCards: value,
      redCards: value,
    });
  }}
/>

{goals.length > 0 && (
  <div className="col-span-2 rounded-[11px] bg-[#06142E]/[0.03] p-3">
    <p className="mb-3 text-[10px] font-black uppercase text-[#06142E]/40">
      Dettagli delle reti
    </p>

    <div className="space-y-3">
      {goals.map((goal, index) => (
        <div
          key={goal.id}
          className="rounded-[11px] border border-[#06142E]/10 bg-white p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase text-[#06142E]/45">
              Rete {index + 1}
            </p>

            {goal.type === "ownGoal" && (
              <span className="rounded-full bg-red-100 px-2 py-1 text-[9px] font-black uppercase text-red-700">
                Autorete
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <label className="block">
              <span className="text-[9px] font-black uppercase text-[#06142E]/40">
                Minuto
              </span>

              <select
                value={
                  (goal.minute === 25 || goal.minute === 50) && (goal.stoppageTime ?? 0) > 0
                    ? `${goal.minute}+`
                    : String(goal.minute)
                }
                onChange={(event) => {
                  const value = event.target.value;
                  const extraTime = value.endsWith("+");
                  const minute = Number(value.replace("+", ""));
                  onGoalsChange(goals.map((currentGoal) => currentGoal.id === goal.id
                    ? { ...currentGoal, minute, stoppageTime: extraTime
                        ? (currentGoal.stoppageTime && currentGoal.stoppageTime >= 1 && currentGoal.stoppageTime <= 10 ? currentGoal.stoppageTime : 1)
                        : undefined }
                    : currentGoal));
                }}
                className="mt-1 h-12 w-full rounded-[11px] border border-[#06142E]/10 bg-white px-3 text-base font-bold text-[#06142E]"
              >
                {(goal.minute < 1 || goal.minute > 50) && <option value={String(goal.minute)}>{goal.minute} (salvato)</option>}
                {GOAL_MINUTE_OPTIONS.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
              </select>
            </label>

            <span className="pb-3 text-lg font-black text-[#06142E]/35">
              +
            </span>

            <label className="block">
              <span className="text-[9px] font-black uppercase text-[#06142E]/40">
                Recupero
              </span>

              <select
                disabled={!((goal.minute === 25 || goal.minute === 50) && (goal.stoppageTime ?? 0) > 0)}
                value={(goal.minute === 25 || goal.minute === 50) && (goal.stoppageTime ?? 0) > 0 ? goal.stoppageTime : ""}
                onChange={(event) => {
                  onGoalsChange(goals.map((currentGoal) => currentGoal.id === goal.id
                    ? { ...currentGoal, stoppageTime: Number(event.target.value) }
                    : currentGoal));
                }}
                className="mt-1 h-12 w-full rounded-[11px] border border-[#06142E]/10 bg-white px-3 text-base font-bold text-[#06142E] disabled:cursor-not-allowed disabled:bg-[#06142E]/5 disabled:opacity-40"
              >
                <option value="" disabled>—</option>
                {(goal.minute === 25 || goal.minute === 50) && (goal.stoppageTime ?? 0) > 10 && <option value={goal.stoppageTime}>{goal.stoppageTime} (salvato)</option>}
                {Array.from({ length: 10 }, (_, index) => index + 1).map((minute) => <option key={minute} value={minute}>{minute}</option>)}
              </select>
            </label>
          </div>

          <p className="mt-2 text-center text-xs font-black text-[#06142E]/55">
            {goal.minute}
            {goal.stoppageTime &&
            goal.stoppageTime > 0
              ? `'+${goal.stoppageTime}`
              : "'"}
          </p>
        </div>
      ))}
    </div>
  </div>
)}


        {player.role !== "Portiere" && (
          <label className="col-span-2 flex cursor-pointer items-center justify-between gap-4 rounded-[11px] border border-[#06142E]/10 bg-[#06142E]/[0.03] p-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase text-[#06142E]">
                Impiegato in porta
              </p>

              <p className="mt-1 text-[10px] font-bold leading-4 text-[#06142E]/45">
                Registra i gol subiti senza modificare il ruolo del giocatore e senza assegnare clean sheet.
              </p>
            </div>

            <input
              type="checkbox"
              checked={isEmergencyGoalkeeper}
              onChange={(event) => {
                onChange({
                  goalsConceded:
                    event.target.checked
                      ? 0
                      : undefined,
                });
              }}
              className="h-5 w-5 shrink-0 accent-[#06142E]"
            />
          </label>
        )}

        {isMatchGoalkeeper && (
          <NumberField
            label="Gol subiti"
            value={
              performance.goalsConceded ?? 0
            }
            min={0}
            max={30}
            onChange={(value) => {
              onChange({
                goalsConceded: value,
              });
            }}
          />
        )}
      </div>
    </article>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase text-[#06142E]/40">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 h-12 w-full rounded-[11px] border border-[#06142E]/10 bg-white px-3 text-base font-bold text-[#06142E]"
      >
        {(value < min || value > max) && <option value={value}>{value} (salvato)</option>}
        {Array.from({ length: max - min + 1 }, (_, index) => min + index).map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function TeamTabButton({
  team,
  active,
  completedCount,
  totalCount,
  onClick,
}: {
  team?: Team;
  active: boolean;
  completedCount: number;
  totalCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[13px] border p-3 ${
        active
          ? "border-[#06142E] bg-[#06142E] text-white"
          : "border-[#06142E]/10 bg-white text-[#06142E]"
      }`}
    >
      <div className="flex items-center gap-3">
        <TeamLogo
          logoUrl={team?.logoUrl}
          teamName={team?.name}
          size={38}
        />

        <div className="min-w-0 text-left">
          <p className="truncate text-xs font-black uppercase">
            {team?.aliasName ?? team?.name ?? "Squadra"}
          </p>

          <p
            className={`mt-1 text-[10px] font-bold ${
              active
                ? "text-white/55"
                : "text-[#06142E]/40"
            }`}
          >
            {completedCount}/{totalCount} compilati
          </p>
        </div>
      </div>
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
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 rounded-[13px] bg-white p-3 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
      <button
        type="button"
        onClick={onBack}
        className="h-12 rounded-[13px] border border-[#06142E] font-black uppercase text-[#06142E]"
      >
        Indietro
      </button>

      <button
        type="button"
        disabled={
          activeTeam === "away" &&
          !canContinue
        }
        onClick={onContinue}
        className="h-12 rounded-[13px] bg-[#06142E] font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-30"
      >
        {activeTeam === "home"
          ? "Squadra ospite"
          : "Continua"}
      </button>
    </div>
  );
}

function buildPerformancePlayers({
  roster,
  presentPlayerIds,
  players,
}: {
  roster: SeasonPlayer[];
  presentPlayerIds: string[];
  players: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
}): PerformancePlayer[] {
  const rosterPlayers =
    roster
      .filter((entry) =>
        presentPlayerIds.includes(
          entry.playerId,
        ),
      )
      .map((entry) => {
        const player =
          players.find(
            (
              currentPlayer,
            ) =>
              String(
                currentPlayer.id,
              ) ===
              String(
                entry.playerId,
              ),
          );

        return {
          id:
            entry.playerId,
          name:
            player
              ? `${player.firstName} ${player.lastName}`.trim()
              : "Giocatore senza nome",
          teamId:
            String(
              entry.teamId,
            ),
          role:
            entry.role,
          shirtNumber:
            entry.shirtNumber,
        };
      });

  const temporaryGoalkeepers =
    presentPlayerIds.flatMap(
      (
        playerId,
      ) => {
        const temporary =
          parseTemporaryGoalkeeperId(
            playerId,
          );

        if (!temporary) {
          return [];
        }

        return [
          {
            id:
              temporary.id,
            name:
              temporary.name,
            teamId:
              temporary.teamId,
            role:
              "Portiere" as const,
            temporary:
              true,
          },
        ];
      },
    );

  // Stesso ordine dello step Formazioni: Portieri, Difensori, Attaccanti.
  // La sort stabile mantiene l'ordine originario della rosa all'interno
  // di ogni ruolo e include i portieri provvisori nel primo gruppo.
  const roleOrder: Record<SeasonPlayer["role"], number> = {
    Portiere: 0,
    Difensore: 1,
    Attaccante: 2,
  };

  return [...rosterPlayers, ...temporaryGoalkeepers].sort(
    (first, second) =>
      (roleOrder[first.role] ?? 3) - (roleOrder[second.role] ?? 3),
  );
}

function countCompleted(
  players: PerformancePlayer[],
  performances: Record<
    string,
    MatchWizardPlayerPerformance
  >,
): number {
  return players.filter(
    (player) =>
      hasCompletePerformanceRating(performances[player.id]),
  ).length;
}

const RATING_OPTIONS = Array.from(
  { length: 13 },
  (_, index) => 4 + index * 0.5,
);
const GOAL_MINUTE_OPTIONS = Array.from({ length: 50 }, (_, index) => index + 1)
  .flatMap((minute) => minute === 25 || minute === 50 ? [String(minute), `${minute}+`] : [String(minute)]);
