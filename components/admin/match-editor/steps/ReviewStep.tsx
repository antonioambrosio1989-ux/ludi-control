"use client";

import { useMemo } from "react";

import TeamLogo from "@/components/common/TeamLogo";
import { usePlayers } from "@/src/hooks/usePlayers";

import {
  validateMatchReport,
  type MatchValidationPlayer,
  type MatchValidationResult,
} from "@/src/services/match/MatchValidator";

import type { Match } from "@/src/types/Match";
import type { SeasonPlayer } from "@/src/types/SeasonPlayer";
import type { Team } from "@/src/types/Team";

import PlayerPhotoUploader from "../../players/PlayerPhotoUploader";

import type { MatchWizardData } from "@/src/types/MatchWizardData";

import {
  parseTemporaryGoalkeeperId,
} from "@/src/services/match/TemporaryMatchPlayer";

type ReviewPlayer = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  role: SeasonPlayer["role"];
};

type Props = {
  match: Match;

  homeTeam?: Team;
  awayTeam?: Team;

  homeRoster: SeasonPlayer[];
  awayRoster: SeasonPlayer[];

  data: MatchWizardData;
  requiresWinner?: boolean;
  requiresExtraTimeBeforePenalties?:
  boolean;
  forcePenalties?: boolean;
  onMvpPhotoChange: (
    photoUrl?: string,
  ) => void;

  isPublishing: boolean;

  onBack: () => void;
  onPublish: () => void;
};

export default function ReviewStep({
  match,
  homeTeam,
  awayTeam,
  homeRoster,
  awayRoster,
  data,
  requiresWinner = false,
  requiresExtraTimeBeforePenalties =
  false,
  forcePenalties = false,
  isPublishing,
  onMvpPhotoChange,
  onBack,
  onPublish,
}: Props) {
  const {
    players,
    isLoading: playersLoading,
    error: playersError,
  } = usePlayers();

  const reviewPlayers = useMemo<ReviewPlayer[]>(() => {
    const homeTeamName =
      homeTeam?.aliasName ??
      homeTeam?.name ??
      "Squadra casa";

    const awayTeamName =
      awayTeam?.aliasName ??
      awayTeam?.name ??
      "Squadra ospite";

    return [
      ...buildReviewPlayers({
        roster: homeRoster,
        teamName:
          homeTeamName,
        players,
      }),
      ...buildTemporaryReviewPlayers({
        playerIds:
          data.homePresentPlayerIds,
        teamName:
          homeTeamName,
      }),
      ...buildReviewPlayers({
        roster: awayRoster,
        teamName:
          awayTeamName,
        players,
      }),
      ...buildTemporaryReviewPlayers({
        playerIds:
          data.awayPresentPlayerIds,
        teamName:
          awayTeamName,
      }),
    ];
  }, [
    homeRoster,
    awayRoster,
    homeTeam?.name,
    homeTeam?.aliasName,
    awayTeam?.name,
    awayTeam?.aliasName,
    data.homePresentPlayerIds,
    data.awayPresentPlayerIds,
    players,
  ]);

  const validationPlayers =
    useMemo<MatchValidationPlayer[]>(
      () =>
        reviewPlayers.map((player) => ({
          id: player.id,
          name: player.name,
          team: player.teamId,
          role: player.role,
        })),
      [reviewPlayers],
    );

  const validationResults =
    validateMatchReport({
      data,
      homeTeam,
      awayTeam,
      allPlayers: validationPlayers,
    });

  const errors = validationResults.filter(
    (result) =>
      result.severity === "error",
  );

  const warnings = validationResults.filter(
    (result) =>
      result.severity === "warning",
  ); 

  const isTitlePlayoff =
  (
    match.matchType ??
    "regularSeason"
  ) ===
  "titlePlayoff";

const mustHaveWinner =
  isTitlePlayoff ||
  requiresWinner;

const isScoreTied =
  data.status ===
    "played" &&
  data.homeScore ===
    data.awayScore;

const requiresExtraTime =
  requiresExtraTimeBeforePenalties &&
  isScoreTied &&
  data.extraTimePlayed !==
    true;

const hasValidExtraTimeState =
  !requiresExtraTime;

const requiresPenalties =
  data.status ===
    "played" &&
  (
    forcePenalties ||
    (
      mustHaveWinner &&
      isScoreTied &&
      (
        !requiresExtraTimeBeforePenalties ||
        data.extraTimePlayed ===
          true
      )
    )
  );

const hasValidPenaltyResult =
  !requiresPenalties ||
  (
    typeof data.homePenalties ===
      "number" &&
    typeof data.awayPenalties ===
      "number" &&
    data.homePenalties !==
      data.awayPenalties
  );
  
  const canPublish =
    !playersLoading &&
    !playersError &&
    hasValidExtraTimeState &&
    hasValidPenaltyResult &&
    (
      data.status === "postponed" ||
      (
        errors.length === 0 &&
        (
          data.status === "walkover" ||
          Boolean(data.mvpPhotoUrl)
        )
     )
 );

const homeGoals = data.goals.filter(
  (goal) =>
    String(goal.teamId) ===
    String(homeTeam?.id),
);

const awayGoals = data.goals.filter(
  (goal) =>
    String(goal.teamId) ===
    String(awayTeam?.id),
);

const homePerformances = Object.values(
  data.performances,
).filter(
  (performance) =>
    String(performance.teamId) ===
    String(homeTeam?.id),
);

const awayPerformances = Object.values(
  data.performances,
).filter(
  (performance) =>
    String(performance.teamId) ===
    String(awayTeam?.id),
);

const homeYellowCards =
  homePerformances.filter(
    (performance) =>
      performance.yellowCards > 0,
  );

const awayYellowCards =
  awayPerformances.filter(
    (performance) =>
      performance.yellowCards > 0,
  );

const homeRedCards =
  homePerformances.filter(
    (performance) =>
      performance.redCards > 0,
  );

const awayRedCards =
  awayPerformances.filter(
    (performance) =>
      performance.redCards > 0,
  );

  const mvp = reviewPlayers.find(
    (player) =>
      String(player.id) ===
      String(data.mvpPlayerId),
  );

  if (playersLoading) {
    return (
      <section className="rounded-[13px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
        <p className="text-sm font-bold text-[#06142E]/50">
          Caricamento riepilogo...
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
    <div>
    {data.status === "postponed" && (
  <section className="mb-5 rounded-[13px] border border-amber-200 bg-amber-50 p-5">
    <h2 className="text-center text-xl font-black uppercase text-amber-800">
      Partita rinviata
    </h2>

    <p className="mt-2 text-center text-sm font-bold text-amber-700/70">
      La partita verrà pubblicata come rinviata.
      Non saranno inseriti risultato, presenze,
      pagelle, gol, cartellini o MVP.
    </p>
  </section>
)}

{data.status !== "postponed" && (
    <>
      <section className="mb-5 rounded-[13px] bg-[#06142E] p-5 text-white shadow-[0_14px_34px_rgba(6,20,46,0.20)]">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">
  {isTitlePlayoff
    ? "Spareggio Regular Season"
    : `Matchweek ${match.matchweek}`}
</p>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamResult
            team={homeTeam}
            score={data.homeScore}
          />

          <span className="text-2xl font-black text-white/25">
            -
          </span>

          <TeamResult
            team={awayTeam}
            score={data.awayScore}
          />
        </div>

{requiresExtraTimeBeforePenalties &&
  data.extraTimePlayed ===
    true && (
  <div className="mt-4 text-center">
    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
      Risultato dopo i tempi
      supplementari
    </p>
  </div>
)}

        {requiresPenalties &&
  typeof data.homePenalties ===
    "number" &&
  typeof data.awayPenalties ===
    "number" && (
    <div className="mt-5 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
        Dopo i calci di rigore
      </p>

      <p className="mt-1 text-xl font-black">
        {
          data.homePenalties
        }
        {" - "}
        {
          data.awayPenalties
        }
      </p>
    </div>
  )}
      </section>

      <section className="mb-5 rounded-[13px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#06142E]/40">
              Diagnostica
            </p>

            <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
              Verifica tabellino
            </h2>
          </div>

          <ValidationCounter
            errors={errors.length}
            warnings={warnings.length}
          />
        </div>

        <div className="mt-5 space-y-3">
          {validationResults.map((result) => (
            <ValidationCard
              key={result.id}
              result={result}
            />
          ))}
        </div>
      </section>

      <section className="mb-5 rounded-[13px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
        <h2 className="text-xl font-black uppercase text-[#06142E]">
          Marcatori
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <GoalsSummary
            teamName={
              homeTeam?.aliasName ?? homeTeam?.name ?? "Casa"
            }
            goals={homeGoals}
            players={reviewPlayers}
          />

          <GoalsSummary
            teamName={
              awayTeam?.aliasName ?? awayTeam?.name ?? "Ospite"
            }
            goals={awayGoals}
            players={reviewPlayers}
          />
        </div>
      </section>

{data.status !== "walkover" && mvp && (
   <section className="mb-5 rounded-[13px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
         <h2 className="text-xl font-black uppercase text-[#06142E]">
              Man of the Match
         </h2>

          <div className="mt-4 rounded-[13px] bg-[#06142E] p-4 text-white">

            <p className="mt-2 text-2xl font-black uppercase">
              {mvp.name}
            </p>

            <p className="mt-1 text-sm font-bold text-white/55">
              {mvp.teamName}
            </p>

          </div>
      </section>
      )}

{data.status !== "walkover" && mvp && (
      <section className="mb-5 rounded-[13px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
          <h2 className="text-center text-xl font-black uppercase text-[#06142E]">
            Foto Man of the Match
          </h2>

          <p className="mt-2 text-center text-sm font-bold text-[#06142E]/45">
              Carica la foto scattata
          </p> 

         <div className="mt-5">
           <PlayerPhotoUploader
  value={data.mvpPhotoUrl}
  playerName={`Man of the Match ${mvp?.name ?? ""}`}
  label="Foto Man of the Match"
  enableEditor
  onChange={(photoUrl: string) => {
    onMvpPhotoChange(photoUrl);
  }}
  onRemove={() => {
    onMvpPhotoChange(undefined);
  }}
/>
         </div>

      {!data.mvpPhotoUrl && (
        <p className="mt-3 text-center text-xs font-bold text-red-600">
          Carica la foto prima di pubblicare.
        </p>
      )}
    </section>
)}

      <section className="mb-5 rounded-[13px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
  <h2 className="text-xl font-black uppercase text-[#06142E]">
    Provvedimenti disciplinari
  </h2>

  <div className="mt-4 space-y-5">
    <DisciplinarySummary
      title="Ammoniti"
      homeTeamName={
        homeTeam?.aliasName ?? homeTeam?.name ?? "Casa"
      }
      awayTeamName={
        awayTeam?.aliasName ?? awayTeam?.name ?? "Ospite"
      }
      homePerformances={
        homeYellowCards
      }
      awayPerformances={
        awayYellowCards
      }
      players={reviewPlayers}
      type="yellow"
    />

    <DisciplinarySummary
      title="Espulsi"
      homeTeamName={
        homeTeam?.aliasName ?? homeTeam?.name ?? "Casa"
      }
      awayTeamName={
        awayTeam?.aliasName ?? awayTeam?.name ?? "Ospite"
      }
      homePerformances={
        homeRedCards
      }
      awayPerformances={
        awayRedCards
      }
      players={reviewPlayers}
      type="red"
    />
  </div>
</section>
</>
)}

      <div className="mt-5 grid grid-cols-2 gap-3 rounded-[13px] border border-[#06142E]/10 bg-white p-3 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
        <button
          type="button"
          onClick={onBack}
          className="h-12 rounded-[13px] border border-[#06142E] text-sm font-black uppercase text-[#06142E]"
        >
          Indietro
        </button>

        <button
          type="button"
          disabled={
            !canPublish ||
            isPublishing
          }
          onClick={onPublish}
          className="h-12 rounded-[13px] bg-[#06142E] text-sm font-black uppercase text-white disabled:cursor-not-allowed disabled:bg-[#06142E]/20"
        >
          {isPublishing
            ? "Pubblicazione..."
            : "Pubblica"}
        </button>
      </div>
    </div>
  );
}

function TeamResult({
  team,
  score,
}: {
  team?: Team;
  score: number;
}) {
  return (
    <div className="min-w-0 text-center">
      <div className="flex justify-center">
        <TeamLogo
          logoUrl={team?.logoUrl}
          size={52}
        />
      </div>

      <p className="mt-3 truncate text-xs font-black uppercase">
        {team?.name ?? "Squadra"}
      </p>

      <p className="mt-2 text-4xl font-black">
        {score}
      </p>
    </div>
  );
}

function ValidationCounter({
  errors,
  warnings,
}: {
  errors: number;
  warnings: number;
}) {
  return (
    <div className="text-right">
      <p className="text-sm font-black text-[#06142E]">
        {errors} errori
      </p>

      <p className="mt-1 text-xs font-bold text-[#06142E]/40">
        {warnings} avvisi
      </p>
    </div>
  );
}

function ValidationCard({
  result,
}: {
  result: MatchValidationResult;
}) {
  const icon =
    result.severity === "error"
      ? "✕"
      : result.severity === "warning"
        ? "!"
        : "✓";

  return (
    <div className="flex gap-3 rounded-[13px] bg-[#06142E]/5 p-4">
      <span
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-black ${
          result.severity === "success"
            ? "bg-[#06142E] text-white"
            : "bg-white text-[#06142E]"
        }`}
      >
        {icon}
      </span>

      <div>
        <p className="text-sm font-black text-[#06142E]">
          {result.title}
        </p>

        {result.description && (
          <p className="mt-1 text-xs font-bold leading-relaxed text-[#06142E]/45">
            {result.description}
          </p>
        )}
      </div>
    </div>
  );
}

function GoalsSummary({
  teamName,
  goals,
  players,
}: {
  teamName: string;
  goals: MatchWizardData["goals"];
  players: ReviewPlayer[];
}) {
  return (
    <div>
      <p className="truncate text-xs font-black uppercase text-[#06142E]/45">
        {teamName}
      </p>

      <div className="mt-3 space-y-2">
  {goals.length > 0 ? (
    goals
      .slice()
      .sort(
        (firstGoal, secondGoal) =>
          firstGoal.minute -
          secondGoal.minute,
      )
      .map((goal) => {
        const scorer = players.find(
          (player) =>
            String(player.id) ===
            String(goal.scorerPlayerId),
        );

        return (
          <div
            key={goal.id}
            className="rounded-[10px] bg-[#06142E]/5 p-3"
          >
            <p className="text-xs font-black text-[#06142E]">
              {scorer?.name ?? "Giocatore"}{" "}
              {formatGoalMinute(goal.minute, goal.stoppageTime,)};
            </p>
          </div>
        );
      })
  ) : (
    <p className="text-xs font-bold italic text-[#06142E]/30">
      Nessuna rete.
    </p>
  )}
</div>
</div>
  );
}

function DisciplinarySummary({
  title,
  homeTeamName,
  awayTeamName,
  homePerformances,
  awayPerformances,
  players,
  type,
}: {
  title: string;
  homeTeamName: string;
  awayTeamName: string;
  homePerformances: MatchWizardData["performances"][string][];
  awayPerformances: MatchWizardData["performances"][string][];
  players: ReviewPlayer[];
  type: "yellow" | "red";
}) {
  function renderPlayers(
    performances: MatchWizardData["performances"][string][],
  ) {
    if (performances.length === 0) {
      return (
        <p className="text-xs font-bold italic text-[#06142E]/30">
          Nessuno.
        </p>
      );
    }

    return performances.map(
      (performance) => {
        const player = players.find(
          (currentPlayer) =>
            String(currentPlayer.id) ===
            String(performance.playerId),
        );

        const quantity =
          type === "yellow"
            ? performance.yellowCards
            : performance.redCards;

        return (
          <p
            key={String(
              performance.playerId,
            )}
            className="text-xs font-black text-[#06142E]"
          >
            {player?.name ?? "Giocatore"}
            {quantity > 1
              ? ` ×${quantity}`
              : ""}
          </p>
        );
      },
    );
  }

  return (
    <div>
      <h3 className="text-sm font-black uppercase text-[#06142E]">
        {title}
      </h3>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <p className="mb-2 truncate text-[10px] font-black uppercase text-[#06142E]/40">
            {homeTeamName}
          </p>

          <div className="space-y-2">
            {renderPlayers(
              homePerformances,
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 truncate text-[10px] font-black uppercase text-[#06142E]/40">
            {awayTeamName}
          </p>

          <div className="space-y-2">
            {renderPlayers(
              awayPerformances,
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildReviewPlayers({
  roster,
  teamName,
  players,
}: {
  roster: SeasonPlayer[];
  teamName: string;
  players: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
}): ReviewPlayer[] {
  return roster.map((entry) => {
    const player = players.find(
      (currentPlayer) =>
        String(currentPlayer.id) ===
        String(entry.playerId),
    );

    return {
      id: entry.playerId,
      name: player
        ? `${player.firstName} ${player.lastName}`.trim()
        : "Giocatore senza nome",
      teamId: entry.teamId,
      teamName,
      role: entry.role,
    };
  });
}
function buildTemporaryReviewPlayers({
  playerIds,
  teamName,
}: {
  playerIds: string[];
  teamName: string;
}): ReviewPlayer[] {
  return playerIds.flatMap(
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
          teamName,
          role:
            "Portiere",
        },
      ];
    },
  );
}

function formatGoalMinute(
  minute: number,
  stoppageTime?: number,
) {
  if (
    stoppageTime &&
    stoppageTime > 0
  ) {
    return `${minute}'+${stoppageTime}`;
  }

  return `${minute}'`;
}