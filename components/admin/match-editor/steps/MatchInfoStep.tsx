import type { ReactNode } from "react";

import TeamLogo from "@/components/common/TeamLogo";
import type { Team } from "@/src/types/Team";
import type {
  Match,
  MatchStatus,
} from "@/src/types/Match";

import type {
  MatchWizardData,
} from "@/src/types/MatchWizardData";

type Props = {
  match: Match;
  homeTeam?: Team;
  awayTeam?: Team;

  data: MatchWizardData;

  /*
   * Se true, una partita giocata
   * deve necessariamente produrre
   * una squadra vincente.
   *
   * Utilizzato per:
   * - gare secche delle fasi finali.
   *
   * Lo spareggio Regular Season
   * continua invece a essere rilevato
   * tramite matchType.
   */
  requiresWinner?: boolean;

  forcePenalties?: boolean;

  requiresExtraTimeBeforePenalties?:
  boolean;

  onChange: (
    updates: Partial<MatchWizardData>,
  ) => void;

  onContinue: () => void;
};

export default function MatchInfoStep({
  match,
  homeTeam,
  awayTeam,
  data,
  requiresWinner = false,
  forcePenalties = false,
  requiresExtraTimeBeforePenalties =
  false,
  onChange,
  onContinue,
}: Props) {
  const isWalkover =
    data.status === "walkover";

  const isPostponed =
    data.status === "postponed";

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

/*
 * ============================================================
 * TEMPI SUPPLEMENTARI
 * ============================================================
 *
 * Solo le finali prevedono:
 *
 * parità
 *   ↓
 * tempi supplementari
 *   ↓
 * eventuali rigori
 * ============================================================
 */

const requiresExtraTime =
  requiresExtraTimeBeforePenalties &&
  isScoreTied &&
  data.extraTimePlayed !==
    true;

const hasValidExtraTimeState =
  !requiresExtraTime;

/*
 * ============================================================
 * CALCI DI RIGORE
 * ============================================================
 */

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

  const scoreDisabled =
    isWalkover || isPostponed;

  const canContinue =
  (
    data.status ===
      "played" &&
    hasValidExtraTimeState &&
    hasValidPenaltyResult
  ) ||
  data.status ===
    "postponed" ||
  (
    isWalkover &&
    data.walkoverWinnerTeamId !==
      undefined
  );

  function changeScore(
    team: "home" | "away",
    amount: number,
  ) {
    if (isWalkover) {
      return;
    }

    if (team === "home") {
      onChange({
  homeScore:
    Math.max(
      0,
      data.homeScore +
        amount,
    ),

  homePenalties:
    undefined,

  awayPenalties:
    undefined,
});

      return;
    }

    onChange({
  awayScore:
    Math.max(
      0,
      data.awayScore +
        amount,
    ),

  homePenalties:
    undefined,

  awayPenalties:
    undefined,
});
  }

  function selectStatus(
    status: MatchStatus,
  ) {
    if (
      status === "walkover"
    ) {
      onChange({
        status,
        homeScore: 0,
        awayScore: 0,
        homePenalties:
  undefined,

awayPenalties:
  undefined,
  extraTimePlayed:
  undefined,
        walkoverWinnerTeamId:
          undefined,
      });

      return;
    }

    if (
      status === "postponed"
    ) {
      onChange({
        status,
        homeScore: 0,
        awayScore: 0,
        homePenalties:
  undefined,

awayPenalties:
  undefined,
  extraTimePlayed:
  undefined,
        walkoverWinnerTeamId:
          undefined,
      });

      return;
    }

    onChange({
      status,
      walkoverWinnerTeamId:
        undefined,
    });
  }

  function selectWalkoverWinner(
    teamId: string | number,
  ) {
    const homeWins =
      String(teamId) ===
      String(
        match.homeTeamId,
      );

    onChange({
      walkoverWinnerTeamId:
        teamId,

      homeScore:
        homeWins
          ? 6
          : 0,

      awayScore:
        homeWins
          ? 0
          : 6,
    });
  }

  function changePenaltyScore(
  team:
    | "home"
    | "away",
  amount: number,
) {
  if (
    !requiresPenalties
  ) {
    return;
  }

  if (
    team ===
    "home"
  ) {
    onChange({
      homePenalties:
        Math.max(
          0,
          (
            data.homePenalties ??
            0
          ) +
            amount,
        ),
    });

    return;
  }

  onChange({
    awayPenalties:
      Math.max(
        0,
        (
          data.awayPenalties ??
          0
        ) +
          amount,
      ),
  });
}

  return (
    <>
      <section className="mb-5 rounded-[13px] bg-[#06142E] p-5 text-white shadow-[0_14px_34px_rgba(6,20,46,0.20)]">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamScore
            teamLogoUrl={
              homeTeam?.logoUrl
            }
            teamName={
              homeTeam?.aliasName ??
              homeTeam?.name ??
              "Squadra casa"
            }
            score={
              data.homeScore
            }
            disabled={
              scoreDisabled
            }
            onDecrease={() =>
              changeScore(
                "home",
                -1,
              )
            }
            onIncrease={() =>
              changeScore(
                "home",
                1,
              )
            }
          />

          <span className="text-2xl font-black text-white/25">
            -
          </span>

          <TeamScore
            teamLogoUrl={
              awayTeam?.logoUrl
            }
            teamName={
              awayTeam?.aliasName ??
              awayTeam?.name ??
              "Squadra ospite"
            }
            score={
              data.awayScore
            }
            disabled={
              scoreDisabled
            }
            onDecrease={() =>
              changeScore(
                "away",
                -1,
              )
            }
            onIncrease={() =>
              changeScore(
                "away",
                1,
              )
            }
          />
        </div>

        <p className="mt-5 text-center text-xs font-black text-white/45">
          {formatItalianDate(
            match.date,
          )}{" "}
          · {match.time}
        </p>
      </section>

{requiresExtraTimeBeforePenalties &&
  data.status ===
    "played" && (
  <AdminCard title="Tempi supplementari">
    <p className="mb-4 text-sm font-bold leading-6 text-[#06142E]/50">
      Attiva questa opzione se
      la finale è proseguita
      oltre i tempi
      regolamentari.
    </p>

    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[13px] bg-[#06142E]/[0.04] p-4">
      <div>
        <p className="text-sm font-black text-[#06142E]">
          Tempi supplementari
          giocati
        </p>

        <p className="mt-1 text-xs font-bold leading-5 text-[#06142E]/45">
          Se il risultato resta
          in parità, saranno
          richiesti i calci di
          rigore.
        </p>
      </div>

      <input
        type="checkbox"
        checked={
          data.extraTimePlayed ===
          true
        }
        onChange={(
          event,
        ) => {
          const checked =
            event.target.checked;

          onChange({
            extraTimePlayed:
              checked,

            ...(
              checked
                ? {}
                : {
                    homePenalties:
                      undefined,

                    awayPenalties:
                      undefined,
                  }
            ),
          });
        }}
        className="h-5 w-5 shrink-0 accent-[#06142E]"
      />
    </label>

    {requiresExtraTime && (
      <p className="mt-3 rounded-[11px] bg-amber-50 px-3 py-2 text-xs font-black leading-5 text-amber-700">
        La finale è ancora in
        parità. Conferma che sono
        stati giocati i tempi
        supplementari.
      </p>
    )}
  </AdminCard>
)}

      {requiresPenalties && (
  <AdminCard title="Calci di rigore">
    <p className="mb-4 text-sm font-bold leading-6 text-[#06142E]/50">
  {isTitlePlayoff
    ? (
        <>
          Lo spareggio è terminato in parità.
          Inserisci il risultato della serie
          di rigori.
        </>
      )
    : (
        <>
          Il confronto a eliminazione diretta
          è in parità. Inserisci il risultato
          della serie di rigori.
        </>
      )}
</p>

    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <PenaltyScore
        teamName={
          homeTeam?.aliasName ??
          homeTeam?.name ??
          "Squadra casa"
        }
        score={
          data.homePenalties ??
          0
        }
        onDecrease={() =>
          changePenaltyScore(
            "home",
            -1,
          )
        }
        onIncrease={() =>
          changePenaltyScore(
            "home",
            1,
          )
        }
      />

      <span className="text-xl font-black text-[#06142E]/20">
        -
      </span>

      <PenaltyScore
        teamName={
          awayTeam?.aliasName ??
          awayTeam?.name ??
          "Squadra ospite"
        }
        score={
          data.awayPenalties ??
          0
        }
        onDecrease={() =>
          changePenaltyScore(
            "away",
            -1,
          )
        }
        onIncrease={() =>
          changePenaltyScore(
            "away",
            1,
          )
        }
      />
    </div>

    {typeof data.homePenalties ===
      "number" &&
      typeof data.awayPenalties ===
        "number" &&
      data.homePenalties ===
        data.awayPenalties && (
        <p className="mt-4 text-center text-xs font-black text-red-600">
          La serie di rigori deve
          determinare una squadra
          vincente.
        </p>
      )}
  </AdminCard>
)}

      <AdminCard title="Stato partita">
        <div className="grid grid-cols-2 gap-2">
          <StatusButton
            label="Giocata"
            active={
              data.status ===
              "played"
            }
            onClick={() =>
              selectStatus(
                "played",
              )
            }
          />

          <StatusButton
            label="Rinviata"
            active={
              data.status ===
              "postponed"
            }
            onClick={() =>
              selectStatus(
                "postponed",
              )
            }
          />

          <button
            type="button"
            onClick={() =>
              selectStatus(
                "walkover",
              )
            }
            className={`col-span-2 min-h-12 rounded-[13px] border px-3 text-sm font-black uppercase ${
              data.status ===
              "walkover"
                ? "border-[#06142E] bg-[#06142E] text-white"
                : "border-[#06142E]/15 bg-white text-[#06142E]"
            }`}
          >
            Vittoria a tavolino
          </button>
        </div>
      </AdminCard>

      {isWalkover && (
        <AdminCard title="Squadra vincente">
          <div className="grid grid-cols-2 gap-3">
            <WalkoverTeamButton
              teamLogoUrl={
                homeTeam?.logoUrl
              }
              teamName={
                homeTeam?.aliasName ??
                homeTeam?.name ??
                "Squadra casa"
              }
              active={
                String(
                  data.walkoverWinnerTeamId,
                ) ===
                String(
                  match.homeTeamId,
                )
              }
              onClick={() =>
                selectWalkoverWinner(
                  match.homeTeamId,
                )
              }
            />

            <WalkoverTeamButton
              teamLogoUrl={
                awayTeam?.logoUrl
              }
              teamName={
                awayTeam?.aliasName ??
                awayTeam?.name ??
                "Squadra ospite"
              }
              active={
                String(
                  data.walkoverWinnerTeamId,
                ) ===
                String(
                  match.awayTeamId,
                )
              }
              onClick={() =>
                selectWalkoverWinner(
                  match.awayTeamId,
                )
              }
            />
          </div>
        </AdminCard>
      )}

      <WizardFooter
        canContinue={
          canContinue
        }
        onContinue={
          onContinue
        }
      />
    </>
  );
}

function TeamScore({
  teamLogoUrl,
  teamName,
  score,
  disabled,
  onDecrease,
  onIncrease,
}: {
  teamLogoUrl?: string;
  teamName: string;
  score: number;
  disabled: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="min-w-0 text-center">
      <div className="flex justify-center">
        <TeamLogo
          logoUrl={
            teamLogoUrl
          }
          teamName={
            teamName
          }
          size={48}
        />
      </div>

      <p className="mt-3 text-xs font-black uppercase">
        {teamName}
      </p>

      <p className="mt-4 text-5xl font-black">
        {score}
      </p>

      <div className="mt-3 flex justify-center gap-2">
        <ScoreButton
          label="−"
          disabled={
            disabled ||
            score === 0
          }
          onClick={
            onDecrease
          }
        />

        <ScoreButton
          label="+"
          disabled={
            disabled
          }
          onClick={
            onIncrease
          }
        />
      </div>
    </div>
  );
}

function ScoreButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={
        disabled
      }
      onClick={
        onClick
      }
      className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-white/10 text-xl font-black disabled:opacity-25"
    >
      {label}
    </button>
  );
}

function StatusButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`min-h-12 rounded-[13px] border px-3 text-sm font-black uppercase ${
        active
          ? "border-[#06142E] bg-[#06142E] text-white"
          : "border-[#06142E]/15 bg-white text-[#06142E]"
      }`}
    >
      {label}
    </button>
  );
}

function PenaltyScore({
  teamName,
  score,
  onDecrease,
  onIncrease,
}: {
  teamName:
    string;

  score:
    number;

  onDecrease:
    () => void;

  onIncrease:
    () => void;
}) {
  return (
    <div className="min-w-0 text-center">
      <p className="truncate text-xs font-black uppercase text-[#06142E]">
        {teamName}
      </p>

      <p className="mt-3 text-4xl font-black text-[#06142E]">
        {score}
      </p>

      <div className="mt-3 flex justify-center gap-2">
        <button
          type="button"
          disabled={
            score ===
            0
          }
          onClick={
            onDecrease
          }
          className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-[#06142E]/5 text-xl font-black text-[#06142E] disabled:opacity-25"
        >
          −
        </button>

        <button
          type="button"
          onClick={
            onIncrease
          }
          className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-[#06142E] text-xl font-black text-white"
        >
          +
        </button>
      </div>
    </div>
  );
}

function WalkoverTeamButton({
  teamLogoUrl,
  teamName,
  active,
  onClick,
}: {
  teamLogoUrl?: string;
  teamName: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`rounded-[13px] border p-4 ${
        active
          ? "border-[#06142E] bg-[#06142E] text-white"
          : "border-[#06142E]/10 bg-white text-[#06142E]"
      }`}
    >
      <div className="flex justify-center">
        <TeamLogo
          logoUrl={
            teamLogoUrl
          }
          teamName={
            teamName
          }
          size={48}
        />
      </div>

      <p className="mt-3 text-xs font-black uppercase">
        {teamName}
      </p>
    </button>
  );
}

function AdminCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-5 rounded-[13px] bg-white p-5 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
      <h2 className="mb-4 text-xl font-black uppercase text-[#06142E]">
        {title}
      </h2>

      {children}
    </section>
  );
}

function WizardFooter({
  canContinue,
  onContinue,
}: {
  canContinue: boolean;
  onContinue: () => void;
}) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 rounded-[13px] border border-[#06142E]/10 bg-white p-3 shadow-[0_10px_24px_rgba(6,20,46,0.10)]">
      <button
        type="button"
        className="h-12 rounded-[13px] border border-[#06142E] bg-white text-sm font-black uppercase text-[#06142E]"
      >
        Salva bozza
      </button>

      <button
        type="button"
        disabled={
          !canContinue
        }
        onClick={
          onContinue
        }
        className="h-12 rounded-[13px] bg-[#06142E] text-sm font-black uppercase text-white disabled:cursor-not-allowed disabled:bg-[#06142E]/20"
      >
        Continua
      </button>
    </div>
  );
}

function formatItalianDate(
  value?: string,
): string {
  if (!value) {
    return "";
  }

  const [
    year,
    month,
    day,
  ] = value.split("-");

  if (
    !year ||
    !month ||
    !day
  ) {
    return value;
  }

  return `${day}/${month}/${year}`;
}