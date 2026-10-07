"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import QuizGameScreen from "@/components/games/quiz/QuizGameScreen";
import PredictionGameScreen from "@/components/games/prediction/PredictionGameScreen";
import SurvivorGameScreen from "@/components/games/survivor/SurvivorGameScreen";
import VotingGameScreen from "@/components/games/voting/VotingGameScreen";
import AppShell from "@/components/ui/AppShell";

import {
  useAuth,
} from "@/src/hooks/useAuth";

import {
  useGamesSeason,
} from "@/src/hooks/useGamesSeason";

import {
  useGamesSubscription,
} from "@/src/hooks/useGamesSubscription";

import { useGamesGames } from "@/src/hooks/useGamesGames";

import {
  isSurvivorGame,
  type GamesGame,
} from "@/src/types/GamesGame";

type AccessState = {
  purchasedGameIds:
    string[];

  status:
    | "idle"
    | "loading"
    | "ready"
    | "error";
};

export default function GamesGameRuntimeScreen({
  gameId,
  demoMode = false,
  directPollId,
}: {
  gameId:
    string;
  demoMode?: boolean;
  directPollId?: string;
}) {
  const router =
    useRouter();

  const {
    user,
    isAdmin,

    isLoading:
      authLoading,
  } =
    useAuth();

  const {
    currentGamesSeason,

    isLoading:
      seasonLoading,
  } =
    useGamesSeason();

  const {
    hasAccess:
      hasGamesPass,

    isLoading:
      passLoading,
  } =
    useGamesSubscription({
      userId:
        user?.uid,

      gamesSeasonId:
        currentGamesSeason?.id,
    });

  const { games, isLoading: gameLoading, error: gameError } =
    useGamesGames(currentGamesSeason?.id);
  const game = games.find((item) => item.id === gameId) ?? null;

  const [
    accessState,
    setAccessState,
  ] =
    useState<
      AccessState
    >({
      purchasedGameIds:
        [],

      status:
        "idle",
    });

  useEffect(
    () => {
      if (
        demoMode ||
        !user ||
        !currentGamesSeason ||
        isAdmin ||
        hasGamesPass
      ) {
        return;
      }

      let active =
        true;

      const activeUser =
        user;

      const gamesSeasonId =
        currentGamesSeason.id;

      async function loadAccess() {
        setAccessState({
          purchasedGameIds:
            [],

          status:
            "loading",
        });

        try {
          const token =
            await activeUser.getIdToken();

          const response =
            await fetch(
              `/api/games/access?gamesSeasonId=${encodeURIComponent(
                gamesSeasonId,
              )}`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },

                cache:
                  "no-store",
              },
            );

          const data =
            await response.json() as {
              purchasedGameIds?:
                string[];
            };

          if (
            !response.ok
          ) {
            throw new Error(
              "Accesso Games non disponibile.",
            );
          }

          if (
            !active
          ) {
            return;
          }

          setAccessState({
            purchasedGameIds:
              Array.isArray(
                data.purchasedGameIds,
              )
                ? data.purchasedGameIds
                : [],

            status:
              "ready",
          });
        } catch {
          if (
            active
          ) {
            setAccessState({
              purchasedGameIds:
                [],

              status:
                "error",
            });
          }
        }
      }

      void loadAccess();

      return () => {
        active =
          false;
      };
    },
    [
      currentGamesSeason,
      demoMode,
      hasGamesPass,
      isAdmin,
      user,
    ],
  );

  const hasSingleGameAccess =
    accessState
      .purchasedGameIds
      .includes(
        gameId,
      );

  const hasAccess =
    Boolean(
      demoMode ||
      isAdmin ||
      hasGamesPass ||
      game?.priceCents ===
        0 ||
      hasSingleGameAccess,
    );

  const accessLoading =
    Boolean(
      !demoMode &&
      user &&
      currentGamesSeason &&
      !isAdmin &&
      !hasGamesPass &&
      game?.priceCents !==
        0 &&
      (
        accessState.status ===
          "idle" ||
        accessState.status ===
          "loading"
      ),
    );

  const loading =
    authLoading ||
    seasonLoading ||
    passLoading ||
    gameLoading ||
    accessLoading;

  if (
    loading
  ) {
    return (
      <AppShell>
        <div className="rounded-[20px] bg-[#F5F5F2] p-5 text-sm font-bold text-[#06142E]/45">
          Caricamento gioco...
        </div>
      </AppShell>
    );
  }

  if (gameError) {
    return (
      <AppShell>
        <div className="rounded-[20px] bg-[#F5F5F2] p-5 text-sm font-bold text-[#06142E]/45">
          Impossibile caricare il gioco. Riprova tra poco.
        </div>
      </AppShell>
    );
  }

  if (
    !game ||
    game.status ===
      "suppressed"
  ) {
    return (
      <AppShell>
        <div className="rounded-[20px] bg-[#F5F5F2] p-5 text-sm font-bold text-[#06142E]/45">
          Gioco non disponibile.
        </div>
      </AppShell>
    );
  }

  if (
    !hasAccess
  ) {
    return (
      <AppShell>
        <main className="min-h-screen bg-white pb-28">
          <button
            type="button"
            onClick={() =>
              router.push(
                "/games",
              )
            }
            className="mb-4 text-xs font-black uppercase text-[#06142E]/45"
          >
            ← Games
          </button>

          <section className="rounded-[22px] bg-[#F5F5F2] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#06142E]/35">
              Accesso richiesto
            </p>

            <h1 className="mt-2 text-2xl font-black uppercase text-[#06142E]">
              {game.name}
            </h1>

            <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/45">
              Acquista il gioco oppure attiva il Games Pass per accedere all&apos;anteprima.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(
                  `/games/acquista?gameId=${encodeURIComponent(
                    game.id,
                  )}`,
                )
              }
              className="mt-5 min-h-12 w-full rounded-[13px] bg-[#06142E] px-5 text-xs font-black uppercase text-white"
            >
              Acquista accesso
            </button>
          </section>
        </main>
      </AppShell>
    );
  }

  if (
    !demoMode &&
    game.status ===
      "waiting"
  ) {
    return (
      <ScheduledGamePreview
        game={
          game
        }

        onBack={() =>
          router.push(
            "/games",
          )
        }
      />
    );
  }

  if (
    game.gameType ===
      "votazioni"
  ) {
    return (
      <VotingGameScreen
        directPollId={directPollId}
        gameId={
          gameId
        }
      />
    );
  }

  if (
    game.gameType ===
      "pronostici"
  ) {
    return (
      <PredictionGameScreen
        gameId={
          gameId
        }
        demoMode={
          demoMode
        }
      />
    );
  }

  if (
    isSurvivorGame(
      game,
    )
  ) {
    return (
      <SurvivorGameScreen
        gameId={
          gameId
        }
        demoMode={
          demoMode
        }
      />
    );
  }

  if (
    game.gameType ===
      "quiz"
  ) {
    return (
      <QuizGameScreen
        gameId={
          gameId
        }
      />
    );
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-white pb-28">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
          Ludi Games
        </p>

        <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
          {game.name}
        </h1>

        <div className="mt-5 rounded-[18px] bg-amber-50 p-4 text-sm font-bold text-amber-800">
          Questo gioco non ha ancora un runtime pubblico associato.
        </div>
      </main>
    </AppShell>
  );
}

function ScheduledGamePreview({
  game,
  onBack,
}: {
  game:
    GamesGame;

  onBack:
    () => void;
}) {
  const launchDate =
    toRuntimeDate(
      game.activatesAt,
    );

  const availabilityText =
    launchDate
      ? `Il gioco sarà disponibile a partire dal ${new Intl.DateTimeFormat(
          "it-IT",
          {
            day:
              "2-digit",

            month:
              "2-digit",

            year:
              "numeric",
          },
        ).format(
          launchDate,
        )}`
      : "Il gioco sarà disponibile prossimamente";

  return (
    <AppShell>
      <main className="min-h-screen bg-white pb-28">
        <button
          type="button"
          onClick={
            onBack
          }
          className="mb-4 text-xs font-black uppercase text-[#06142E]/45"
        >
          ← Games
        </button>

        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/35">
          Anteprima
        </p>

        <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
          {game.name}
        </h1>

        {game.description?.trim() ? (
          <p className="mt-2 text-sm font-bold leading-6 text-[#06142E]/45">
            {game.description}
          </p>
        ) : null}

        <section className="mt-5 rounded-[20px] bg-[#F1F2F4] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#06142E]/35">
            Disponibilità
          </p>

          <p className="mt-2 text-lg font-black text-[#06142E]/65">
            {availabilityText}
          </p>
        </section>

        <div
          aria-hidden="true"
          className="pointer-events-none mt-5 select-none opacity-55 grayscale"
        >
          <GameDemoPreview
            game={
              game
            }
          />
        </div>
      </main>
    </AppShell>
  );
}

function GameDemoPreview({
  game,
}: {
  game:
    GamesGame;
}) {
  if (
    game.gameType ===
      "quiz"
  ) {
    return (
      <section className="rounded-[24px] bg-[#06142E] p-5 text-white">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/45">
          Demo
        </p>

        <h2 className="mt-1 text-xl font-black uppercase">
          Weekly Challenge
        </h2>

        <div className="mt-5 rounded-[18px] bg-white p-4 text-[#06142E]">
          <p className="text-[10px] font-black uppercase text-[#06142E]/40">
            Domanda 1 di 7
          </p>

          <p className="mt-2 text-sm font-black">
            Quale giocatore ha realizzato più gol?
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              "A",
              "B",
              "C",
              "D",
            ].map(
              (
                answer,
              ) => (
                <div
                  key={
                    answer
                  }
                  className="rounded-[12px] bg-[#F1F2F4] px-3 py-3 text-xs font-black"
                >
                  {answer}. Risposta
                </div>
              ),
            )}
          </div>
        </div>
      </section>
    );
  }

  if (
    game.gameType ===
      "votazioni"
  ) {
    return (
      <section className="rounded-[24px] bg-[#06142E] p-5 text-white">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/45">
          Ludi Vote · Demo
        </p>

        <h2 className="mt-1 text-xl font-black uppercase">
          Votazione
        </h2>

        <div className="mt-5 space-y-3">
          {[
            "Candidato 1",
            "Candidato 2",
            "Candidato 3",
          ].map(
            (
              label,
            ) => (
              <div
                key={
                  label
                }
                className="flex min-h-12 items-center rounded-[14px] bg-white px-4 text-xs font-black text-[#06142E]"
              >
                {label}
              </div>
            ),
          )}
        </div>
      </section>
    );
  }


  const identity =
    `${game.slug} ${game.name}`
      .toLocaleLowerCase(
        "it",
      );

  if (
    identity.includes(
      "survivor",
    )
  ) {
    return (
      <section className="rounded-[24px] bg-[#06142E] p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/45">
              League One Survivor
            </p>

            <h2 className="mt-1 text-xl font-black uppercase">
              Giornata 1
            </h2>
          </div>

          <span className="rounded-[8px] bg-white/10 px-3 py-1.5 text-[9px] font-black uppercase text-white/70">
            In gioco
          </span>
        </div>

        <p className="mt-3 text-xs font-bold leading-5 text-white/55">
          Scegli una squadra che deve vincere. La stessa squadra non può essere utilizzata due volte.
        </p>

        <div className="mt-5 space-y-3">
          {[
            ["Blackburn", "Millwall"],
            ["Middlesbrough", "QPR"],
            ["Leicester", "Swansea"],
          ].map(
            (
              teams,
            ) => (
              <div
                key={
                  teams.join(
                    "-",
                  )
                }
                className="rounded-[16px] bg-white/10 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-11 w-11 shrink-0 rounded-full bg-white/20" />

                    <div className="min-w-0">
                      <p className="truncate text-xs font-black">
                        {teams[0]}
                      </p>

                      <p className="mt-0.5 text-[9px] font-bold uppercase text-white/40">
                        vs {teams[1]}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[10px] bg-white px-3 py-2 text-[9px] font-black uppercase text-[#06142E]">
                    Scegli
                  </div>
                </div>
              </div>
            ),
          )}
        </div>

        <div className="mt-4 rounded-[14px] bg-white/[0.07] p-4">
          <p className="text-[9px] font-black uppercase text-white/40">
            Squadre già utilizzate
          </p>

          <div className="mt-2 flex gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-[9px] font-black text-white/50">
              Nessuna
            </span>
          </div>
        </div>
      </section>
    );
  }

  if (
    game.gameType ===
      "pronostici"
  ) {
    return (
      <section className="rounded-[24px] bg-[#06142E] p-5 text-white">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/45">
          Demo pronostico
        </p>

        <div className="mt-4 space-y-3">
          {[
            "Blackburn - Millwall",
            "Middlesbrough - QPR",
          ].map(
            (
              match,
            ) => (
              <div
                key={
                  match
                }
                className="rounded-[16px] bg-white/10 p-4"
              >
                <p className="text-xs font-black">
                  {match}
                </p>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    "1",
                    "X",
                    "2",
                  ].map(
                    (
                      value,
                    ) => (
                      <div
                        key={
                          value
                        }
                        className="rounded-[10px] bg-white py-2 text-center text-xs font-black text-[#06142E]"
                      >
                        {value}
                      </div>
                    ),
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[24px] bg-[#E5E7EB] p-5">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#06142E]/40">
        Demo
      </p>

      <h2 className="mt-1 text-xl font-black uppercase text-[#06142E]/70">
        {game.name}
      </h2>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="h-24 rounded-[16px] bg-[#06142E]/10" />
        <div className="h-24 rounded-[16px] bg-[#06142E]/10" />
      </div>

      <div className="mt-4 h-12 rounded-[14px] bg-[#06142E]/10" />
    </section>
  );
}

function toRuntimeDate(
  value:
    unknown,
): Date | null {
  if (
    value instanceof
      Date
  ) {
    return Number.isNaN(
      value.getTime(),
    )
      ? null
      : value;
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    const timestamp =
      value as {
        toDate?:
          () => Date;

        seconds?:
          number;
      };

    if (
      typeof timestamp.toDate ===
        "function"
    ) {
      const date =
        timestamp.toDate();

      return Number.isNaN(
        date.getTime(),
      )
        ? null
        : date;
    }

    if (
      typeof timestamp.seconds ===
        "number"
    ) {
      const date =
        new Date(
          timestamp.seconds *
            1000,
        );

      return Number.isNaN(
        date.getTime(),
      )
        ? null
        : date;
    }
  }

  if (
    typeof value ===
      "string" ||
    typeof value ===
      "number"
  ) {
    const date =
      new Date(
        value,
      );

    return Number.isNaN(
      date.getTime(),
    )
      ? null
      : date;
  }

  return null;
}
