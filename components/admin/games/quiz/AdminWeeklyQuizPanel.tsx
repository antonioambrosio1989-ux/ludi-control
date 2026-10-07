"use client";

import { localizeQuizText } from "@/src/services/games/quiz/QuizText";

import Image from "next/image";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CalendarDays,
  CheckCircle2,
  History,
  LoaderCircle,
  RefreshCcw,
  Sparkles,
} from "lucide-react";

import {
  useGamesSeason,
} from "@/src/hooks/useGamesSeason";

import {
  FirebaseWeeklyQuizRepository,
} from "@/src/services/games/FirebaseWeeklyQuizRepository";

import {
  auth,
} from "@/src/lib/firebase";

import {
  resolveWeekWindow,
} from "@/src/services/games/quiz/WeeklyQuizWeekWindow";

import type {
  GamesGame,
} from "@/src/types/GamesGame";

import type {
  WeeklyQuizQuestion,
  WeeklyQuizWeek,
  WeeklyQuizWeekWithQuestions,
} from "@/src/types/GamesWeeklyQuiz";

export default function AdminWeeklyQuizPanel({
  game,
}: {
  game:
    GamesGame;
}) {
  const {
    currentGamesSeason,

    isLoading:
      gamesSeasonLoading,

    error:
      gamesSeasonError,
  } =
    useGamesSeason();

  const [
    weeks,
    setWeeks,
  ] =
    useState<
      WeeklyQuizWeek[]
    >([]);

  const [
    selectedWeek,
    setSelectedWeek,
  ] =
    useState<
      WeeklyQuizWeekWithQuestions | null
    >(
      null,
    );

  const [
    isWeeksLoading,
    setIsWeeksLoading,
  ] =
    useState(
      true,
    );

  const [
    isSelectedWeekLoading,
    setIsSelectedWeekLoading,
  ] =
    useState(
      false,
    );

  const [
    isGenerating,
    setIsGenerating,
  ] =
    useState(
      false,
    );

  const [
    isPublishing,
    setIsPublishing,
  ] =
    useState(
      false,
    );

  const [
    isRegenerating,
    setIsRegenerating,
  ] =
    useState(
      false,
    );

  const [
    actionError,
    setActionError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const currentWindow =
    useMemo(
      () => {
        if (
          !currentGamesSeason
        ) {
          return null;
        }

        const startsAt =
          toDate(
            currentGamesSeason.startsAt,
          );

        const endsAt =
          toDate(
            currentGamesSeason.endsAt,
          );

        if (
          !startsAt ||
          !endsAt
        ) {
          return null;
        }

        const gameActivatesAt =
          toDate(
            game.activatesAt,
          );

        const quizScheduleStartsAt =
          gameActivatesAt &&
          gameActivatesAt.getTime() >
            startsAt.getTime()
            ? gameActivatesAt
            : startsAt;

        const now =
          new Date();

        if (
          now.getTime() >
            endOfDay(
              endsAt,
            ).getTime()
        ) {
          return null;
        }

        try {
          /*
           * resolveWeekWindow normalizza l'anchor al giorno locale:
           * il giovedì dalle 02:00 alle 10:00 l'Admin può quindi
           * vedere e revisionare la nuova Week prima del go-live.
           */
          return resolveWeekWindow({
            gamesSeasonStartsAt:
              quizScheduleStartsAt,

            gamesSeasonEndsAt:
              endsAt,

            targetDate:
              now,
          });
        } catch {
          return null;
        }
      },
      [
        currentGamesSeason,
        game.activatesAt,
      ],
    );

  const currentWeek =
    useMemo(
      () => {
        if (
          !currentWindow
        ) {
          return null;
        }

        return (
          weeks.find(
            (
              week,
            ) =>
              week.gamesSeasonId ===
                currentGamesSeason?.id &&
              week.weekNumber ===
                currentWindow.weekNumber,
          ) ??
          null
        );
      },
      [
        currentGamesSeason?.id,
        currentWindow,
        weeks,
      ],
    );

  useEffect(
    () => {
      const unsubscribe =
        FirebaseWeeklyQuizRepository.subscribeByGame(
          game.id,

          (
            nextWeeks,
          ) => {
            setWeeks(
              nextWeeks,
            );

            setIsWeeksLoading(
              false,
            );
          },

          (
            error,
          ) => {
            console.error(
              "Errore caricamento Weekly Quiz Admin:",
              error,
            );

            setActionError(
              "Impossibile caricare le Weekly Challenge.",
            );

            setIsWeeksLoading(
              false,
            );
          },
        );

      return () => {
        unsubscribe();
      };
    },
    [
      game.id,
    ],
  );

  useEffect(
    () => {
      if (
        !currentWeek
      ) {
        queueMicrotask(
          () => {
            setSelectedWeek(
              null,
            );

            setIsSelectedWeekLoading(
              false,
            );
          },
        );

        return;
      }

      let active =
        true;

      queueMicrotask(
        () => {
          if (
            active
          ) {
            setIsSelectedWeekLoading(
              true,
            );
          }
        },
      );

      void FirebaseWeeklyQuizRepository
        .getWeekWithQuestions(
          currentWeek.id,
        )
        .then(
          (
            value,
          ) => {
            if (
              active
            ) {
              setSelectedWeek(
                value,
              );

              setIsSelectedWeekLoading(
                false,
              );
            }
          },
        )
        .catch(
          (
            error,
          ) => {
            console.error(
              "Errore caricamento domande Weekly Quiz:",
              error,
            );

            if (
              active
            ) {
              setActionError(
                "Impossibile caricare le domande della Weekly Challenge.",
              );

              setIsSelectedWeekLoading(
                false,
              );
            }
          },
        );

      return () => {
        active =
          false;
      };
    },
    [
      currentWeek,
    ],
  );

  async function handleGenerate() {
    if (
      isGenerating ||
      !currentGamesSeason ||
      !currentWindow
    ) {
      return;
    }

    setIsGenerating(
      true,
    );

    clearMessages();

    try {
      const result =
        await runAdminQuizAction({
          action:
            "generate",

          gamesSeasonId:
            currentGamesSeason.id,

          gameId:
            game.id,
        });

      const loaded =
        await FirebaseWeeklyQuizRepository.getWeekWithQuestions(
          result.weekId,
        );

      setSelectedWeek(
        loaded,
      );

      setSuccessMessage(
        result.alreadyExisted
          ? "La Weekly Challenge di questa settimana esisteva già: è stata caricata senza rigenerare le domande."
          : "Weekly Challenge generata: 7 domande pronte per la revisione.",
      );
    } catch (
      error
    ) {
      setActionError(
        getErrorMessage(
          error,
          "Impossibile generare la Weekly Challenge.",
        ),
      );
    } finally {
      setIsGenerating(
        false,
      );
    }
  }

  async function handleRegenerate() {
    if (
      isRegenerating ||
      !currentGamesSeason ||
      !currentWindow ||
      !currentWeek
    ) {
      return;
    }

    const wasPublished =
      currentWeek.status ===
      "published";

    const confirmed =
      window.confirm(
        [
          `Rigenerare la Weekly Challenge #${currentWeek.weekNumber}?`,
          "",
          "Le 7 domande attuali verranno eliminate e ricreate con i generatori aggiornati.",
          wasPublished
            ? "La Week verrà ripubblicata automaticamente al termine."
            : "La nuova Week resterà in bozza.",
          "",
          "Usa questa funzione solo durante i test o prima che utenti reali abbiano iniziato il Quiz.",
        ].join(
          "\n",
        ),
      );

    if (
      !confirmed
    ) {
      return;
    }

    setIsRegenerating(
      true,
    );

    clearMessages();

    try {
      const result =
        await runAdminQuizAction({
          action:
            "regenerate",

          gamesSeasonId:
            currentGamesSeason.id,

          gameId:
            game.id,

          weekId:
            currentWeek.id,

          publishImmediately:
            wasPublished,
        });

      const loaded =
        await FirebaseWeeklyQuizRepository.getWeekWithQuestions(
          result.weekId,
        );

      setSelectedWeek(
        loaded,
      );

      setSuccessMessage(
        wasPublished
          ? "Weekly Challenge rigenerata e ripubblicata con i generatori aggiornati."
          : "Weekly Challenge rigenerata. Verifica le 7 domande prima della pubblicazione.",
      );
    } catch (
      error
    ) {
      setActionError(
        getErrorMessage(
          error,
          "Impossibile rigenerare la Weekly Challenge.",
        ),
      );
    } finally {
      setIsRegenerating(
        false,
      );
    }
  }

  async function handlePublish() {
    if (
      isPublishing ||
      !selectedWeek ||
      selectedWeek.status !==
        "draft"
    ) {
      return;
    }

    if (
      selectedWeek.questions.length !==
      7
    ) {
      setActionError(
        "La Weekly Challenge deve contenere esattamente 7 domande prima della pubblicazione.",
      );

      return;
    }

    const confirmed =
      window.confirm(
        [
          `Pubblicare la Weekly Challenge #${selectedWeek.weekNumber}?`,
          "",
          "Dopo la pubblicazione le domande devono essere considerate congelate per tutta la settimana.",
        ].join(
          "\n",
        ),
      );

    if (
      !confirmed
    ) {
      return;
    }

    setIsPublishing(
      true,
    );

    clearMessages();

    try {
      await runAdminQuizAction({
        action:
          "publish",

        weekId:
          selectedWeek.id,
      });

      setSelectedWeek(
        (
          current,
        ) =>
          current
            ? {
                ...current,
                status:
                  "published",
              }
            : current,
      );

      setSuccessMessage(
        "Weekly Challenge pubblicata.",
      );
    } catch (
      error
    ) {
      setActionError(
        getErrorMessage(
          error,
          "Impossibile pubblicare la Weekly Challenge.",
        ),
      );
    } finally {
      setIsPublishing(
        false,
      );
    }
  }

  function clearMessages() {
    setActionError(
      null,
    );

    setSuccessMessage(
      null,
    );
  }

  if (
    gamesSeasonLoading
  ) {
    return (
      <PanelMessage>
        Caricamento Games Season...
      </PanelMessage>
    );
  }

  if (
    gamesSeasonError ||
    !currentGamesSeason
  ) {
    return (
      <PanelMessage
        error
      >
        Nessuna Games Season attiva. Creala dal Centro di controllo Games prima di generare il Quiz settimanale.
      </PanelMessage>
    );
  }

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-[24px] bg-[#06142E] p-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
              Generazione automatica
            </p>

            <h2 className="mt-1 text-2xl font-black uppercase">
              Weekly Challenge
            </h2>

            <p className="mt-2 max-w-xl text-xs font-bold leading-5 text-white/45">
              Ogni settimana Ludi OS genera automaticamente 7 domande usando statistiche correnti e archivio storico.
            </p>
          </div>

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-white/10">
            <Sparkles
              size={23}
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <DarkStat
            label="Domande"
            value="7"
          />

          <DarkStat
            label="Punti max"
            value="700"
          />

          <DarkStat
            label="Tentativi"
            value="1"
          />
        </div>

        <div className="mt-5 rounded-[16px] bg-white/[0.06] p-4">
          <div className="flex items-center gap-2">
            <CalendarDays
              size={16}
              className="text-cyan-300"
            />

            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/35">
              Settimana corrente
            </p>
          </div>

          {currentWindow ? (
            <>
              <p className="mt-2 text-lg font-black uppercase">
                Week {currentWindow.weekNumber}
              </p>

              <p className="mt-1 text-xs font-bold text-white/45">
                {formatDate(
                  currentWindow.startsAt,
                )} → {formatDate(
                  currentWindow.endsAt,
                )}
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs font-bold text-white/45">
              La data odierna non rientra nella Games Season.
            </p>
          )}
        </div>
      </div>

      {actionError && (
        <PanelMessage
          error
        >
          {actionError}
        </PanelMessage>
      )}

      {successMessage && (
        <PanelMessage
          success
        >
          {successMessage}
        </PanelMessage>
      )}

      {!currentWindow ? (
        <PanelMessage>
          La Weekly Challenge potrà essere generata quando la Games Season sarà iniziata.
        </PanelMessage>
      ) : isWeeksLoading ? (
        <PanelMessage>
          Caricamento Weekly Challenge...
        </PanelMessage>
      ) : !currentWeek ? (
        <div className="rounded-[22px] border border-dashed border-[#06142E]/15 bg-[#F5F5F2] p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-white text-[#06142E]">
            <RefreshCcw
              size={20}
            />
          </div>

          <h3 className="mt-4 text-lg font-black uppercase text-[#06142E]">
            Quiz non ancora generato
          </h3>

          <p className="mt-2 text-xs font-bold leading-5 text-[#06142E]/45">
            Verranno interrogati i dati reali di Premier League, Championship, League One e l&apos;archivio storico. Le risposte saranno congelate nello snapshot della settimana.
          </p>

          <button
            type="button"
            disabled={
              isGenerating
            }
            onClick={() => {
              void handleGenerate();
            }}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-[#0B5FFF] px-5 text-xs font-black uppercase text-white disabled:opacity-40"
          >
            {isGenerating ? (
              <LoaderCircle
                size={17}
                className="animate-spin"
              />
            ) : (
              <Sparkles
                size={17}
              />
            )}

            {isGenerating
              ? "Generazione..."
              : "Genera Weekly Challenge"}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <WeeklyStatusCard
            week={
              currentWeek
            }
          />

          {isSelectedWeekLoading ? (
            <PanelMessage>
              Caricamento delle 7 domande...
            </PanelMessage>
          ) : selectedWeek ? (
            <>
              <div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
                      Anteprima
                    </p>

                    <h3 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
                      Le 7 domande
                    </h3>
                  </div>

                  <span className="text-xs font-black text-[#06142E]/35">
                    {selectedWeek.questions.length}/7
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {selectedWeek.questions.map(
                    (
                      question,
                    ) => (
                      <WeeklyQuestionCard
                        key={
                          question.id
                        }
                        question={
                          question
                        }
                      />
                    ),
                  )}
                </div>
              </div>

              {selectedWeek.status ===
              "draft" ? (
                <button
                  type="button"
                  disabled={
                    isPublishing ||
                    selectedWeek.questions.length !==
                      7
                  }
                  onClick={() => {
                    void handlePublish();
                  }}
                  className="flex min-h-13 w-full items-center justify-center gap-2 rounded-[14px] bg-emerald-600 px-5 text-xs font-black uppercase text-white disabled:opacity-40"
                >
                  {isPublishing ? (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <CheckCircle2
                      size={17}
                    />
                  )}

                  {isPublishing
                    ? "Pubblicazione..."
                    : "Pubblica Quiz settimanale"}
                </button>
              ) : (
                <div className="flex min-h-13 items-center justify-center gap-2 rounded-[14px] bg-emerald-50 px-5 text-xs font-black uppercase text-emerald-700">
                  <CheckCircle2
                    size={17}
                  />

                  Quiz settimanale pubblicato
                </div>
              )}

              <button
                type="button"
                disabled={
                  isRegenerating ||
                  isPublishing
                }
                onClick={() => {
                  void handleRegenerate();
                }}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] border border-amber-300 bg-amber-50 px-5 text-xs font-black uppercase text-amber-800 disabled:opacity-40"
              >
                {isRegenerating ? (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <RefreshCcw
                    size={17}
                  />
                )}

                {isRegenerating
                  ? "Rigenerazione..."
                  : "Rigenera Week"}
              </button>
            </>
          ) : (
            <PanelMessage
              error
            >
              La Weekly Challenge esiste ma non è stato possibile caricarne le domande.
            </PanelMessage>
          )}
        </div>
      )}

      {weeks.length >
        0 && (
        <div className="rounded-[20px] bg-[#F5F5F2] p-5">
          <div className="flex items-center gap-3">
            <History
              size={19}
              className="text-[#06142E]"
            />

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#06142E]/35">
                Archivio automatico
              </p>

              <p className="text-sm font-black text-[#06142E]">
                {weeks.length} Weekly Challenge salvate
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function WeeklyStatusCard({
  week,
}: {
  week:
    WeeklyQuizWeek;
}) {
  const statusLabel =
    week.status ===
      "published"
      ? "Pubblicato"
      : week.status ===
          "closed"
        ? "Chiuso"
        : "Bozza";

  return (
    <div className="rounded-[20px] bg-[#F5F5F2] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#06142E]/35">
            Weekly Challenge
          </p>

          <h3 className="mt-1 text-xl font-black uppercase text-[#06142E]">
            Week {week.weekNumber}
          </h3>
        </div>

        <span className={`rounded-full px-3 py-1.5 text-[8px] font-black uppercase ${
          week.status ===
          "published"
            ? "bg-emerald-100 text-emerald-800"
            : week.status ===
                "closed"
              ? "bg-slate-200 text-slate-600"
              : "bg-amber-100 text-amber-800"
        }`}>
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <LightStat
          label="Domande"
          value={
            week.questionCount
          }
        />

        <LightStat
          label="Punti"
          value={
            week.maxScore
          }
        />
      </div>
    </div>
  );
}

function WeeklyQuestionCard({
  question,
}: {
  question:
    WeeklyQuizQuestion;
}) {
  return (
    <article className="rounded-[20px] border border-[#06142E]/10 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#06142E] px-2.5 py-1 text-[8px] font-black uppercase text-white">
          Q{question.order}
        </span>

        <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[8px] font-black uppercase text-cyan-800">
          {challengeLabel(
            question.challengeType,
          )}
        </span>

        <span className="rounded-full bg-[#F5F5F2] px-2.5 py-1 text-[8px] font-black uppercase text-[#06142E]/45">
          {question.points} pt
        </span>
      </div>

      <h4 className="mt-3 whitespace-pre-line text-sm font-black leading-5 text-[#06142E]">
        {localizeQuizText(question.prompt)}
      </h4>

      <div className="mt-4 grid gap-2">
        {question.answers.map(
          (
            answer,
            index,
          ) => {
            const correct =
              index ===
              question.correctAnswerIndex;

            const answerImageUrl =
              question.kind === "higher_or_lower"
                ? question.answerImageUrls?.[index] ||
                  "/players/player-placeholder.png"
                : null;

            return (
              <div
                key={`${question.id}-${index}`}
                className={`flex items-center gap-3 rounded-[12px] border px-3 py-2.5 text-xs font-bold ${
                  correct
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-[#06142E]/[0.06] bg-[#F8F8F6] text-[#06142E]/55"
                }`}
              >
                {answerImageUrl ? (
                  <Image
                    src={answerImageUrl}
                    alt={answer}
                    width={48}
                    height={48}
                    sizes="48px"
                    onError={(event) => {
                      event.currentTarget.src =
                        "/players/player-placeholder.png";
                    }}
                    className="h-12 w-12 shrink-0 rounded-full bg-[#E9EDF2] object-cover"
                  />
                ) : null}

                <span>
                  {String.fromCharCode(
                    65 +
                      index,
                  )}. {answer}
                  {correct
                    ? " ✓"
                    : ""}
                </span>
              </div>
            );
          },
        )}
      </div>

      <div className="mt-4 rounded-[12px] bg-[#F5F5F2] p-3">
        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#06142E]/30">
          Verifica dato
        </p>

        <p className="mt-1 text-xs font-bold leading-5 text-[#06142E]/45">
          {localizeQuizText(question.explanation)}
        </p>
      </div>
    </article>
  );
}

function DarkStat({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div className="rounded-[13px] bg-white/[0.07] p-3 text-center">
      <p className="text-xl font-black">
        {value}
      </p>

      <p className="mt-1 text-[8px] font-black uppercase tracking-[0.1em] text-white/30">
        {label}
      </p>
    </div>
  );
}

function LightStat({
  label,
  value,
}: {
  label:
    string;

  value:
    number;
}) {
  return (
    <div className="rounded-[13px] bg-white p-3 text-center">
      <p className="text-xl font-black text-[#06142E]">
        {value}
      </p>

      <p className="mt-1 text-[8px] font-black uppercase tracking-[0.1em] text-[#06142E]/30">
        {label}
      </p>
    </div>
  );
}

function PanelMessage({
  children,
  error = false,
  success = false,
}: {
  children:
    React.ReactNode;

  error?:
    boolean;

  success?:
    boolean;
}) {
  return (
    <div className={`rounded-[18px] p-4 ${
      error
        ? "bg-red-50 text-red-700"
        : success
          ? "bg-emerald-50 text-emerald-800"
          : "bg-[#F5F5F2] text-[#06142E]/45"
    }`}>
      <p className="text-sm font-bold leading-5">
        {children}
      </p>
    </div>
  );
}

function challengeLabel(
  value:
    WeeklyQuizQuestion["challengeType"],
) {
  switch (
    value
  ) {
    case "history_challenge":
      return "History";

    case "higher_or_lower":
      return "Higher / Lower";

    case "whos_the_player":
      return "Who's the Player";

    default:
      return "Stats";
  }
}

function formatDate(
  value:
    Date,
) {
  return new Intl.DateTimeFormat(
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
    value,
  );
}

function endOfDay(
  value:
    Date,
) {
  const result =
    new Date(
      value,
    );

  result.setHours(
    23,
    59,
    59,
    999,
  );

  return result;
}

function toDate(
  value:
    unknown,
): Date | null {
  if (
    value instanceof
    Date
  ) {
    return value;
  }

  if (
    value &&
    typeof value ===
      "object" &&
    "toDate" in
      value &&
    typeof (
      value as {
        toDate?:
          unknown;
      }
    ).toDate ===
      "function"
  ) {
    return (
      value as {
        toDate:
          () => Date;
      }
    ).toDate();
  }

  if (
    typeof value ===
      "string" ||
    typeof value ===
      "number"
  ) {
    const result =
      new Date(
        value,
      );

    return Number.isNaN(
      result.getTime(),
    )
      ? null
      : result;
  }

  return null;
}

type AdminQuizActionResponse = {
  ok:
    boolean;

  weekId:
    string;

  weekNumber?:
    number;

  status?:
    string;

  alreadyExisted?:
    boolean;

  alreadyPublished?:
    boolean;
};

async function runAdminQuizAction(
  body:
    Record<
      string,
      unknown
    >,
): Promise<AdminQuizActionResponse> {
  const user =
    auth.currentUser;

  if (
    !user
  ) {
    throw new Error(
      "Sessione Admin non disponibile.",
    );
  }

  const token =
    await user.getIdToken();

  const response =
    await fetch(
      "/api/admin/games/quiz/weekly",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        body:
          JSON.stringify(
            body,
          ),
      },
    );

  const payload =
    await response
      .json()
      .catch(
        () => ({}),
      ) as
      Partial<
        AdminQuizActionResponse
      > & {
        error?:
          string;
      };

  if (
    !response.ok
  ) {
    throw new Error(
      payload.error ||
      "Operazione Weekly Quiz non riuscita.",
    );
  }

  return {
    ok:
      payload.ok ===
      true,

    weekId:
      String(
        payload.weekId ??
        body.weekId ??
        "",
      ),

    weekNumber:
      payload.weekNumber,

    status:
      payload.status,

    alreadyExisted:
      payload.alreadyExisted,

    alreadyPublished:
      payload.alreadyPublished,
  };
}

function getErrorMessage(
  error:
    unknown,
  fallback:
    string,
) {
  return error instanceof
      Error &&
    error.message
    ? error.message
    : fallback;
}
