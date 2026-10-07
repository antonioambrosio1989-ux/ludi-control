"use client";

import { localizeQuizText } from "@/src/services/games/quiz/QuizText";

import Image from "next/image";
import Link from "next/link";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  CheckCircle2,
  ChevronRight,
  Crown,
  LockKeyhole,
  Play,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";

import AppShell from "@/components/ui/AppShell";

import {
  useAuth,
} from "@/src/hooks/useAuth";

import {
  useGamesSeason,
} from "@/src/hooks/useGamesSeason";

import {
  WeeklyQuizGenerationService,
} from "@/src/services/games/quiz/WeeklyQuizGenerationService";

import type {
  QuizAnswerResponse,
  QuizFinishResponse,
  QuizPublicState,
  QuizRuntimeQuestion,
  QuizSeasonLeaderboardEntry,
  QuizStartResponse,
} from "@/src/types/GamesQuizRuntime";

const DEFAULT_QUESTION_TIME_SECONDS = 15;
const WHOS_THE_PLAYER_TIME_SECONDS = 30;
const DEMO_PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000;

function getQuestionTimeSeconds(
  question:
    | Pick<QuizRuntimeQuestion, "challengeType">
    | null
    | undefined,
): number {
  return question?.challengeType === "whos_the_player"
    ? WHOS_THE_PLAYER_TIME_SECONDS
    : DEFAULT_QUESTION_TIME_SECONDS;
}

type DemoQuizQuestion = {
  question: QuizRuntimeQuestion;
  correctAnswerPosition: number;
  explanation: string;
};

type DemoPreviewCacheEntry = {
  expiresAt: number;
  gamesSeasonId: string;
  gameId: string;
  weekNumber: number;
  weekStartsAtMs: number;
  weekEndsAtMs: number;
  questions: DemoQuizQuestion[];
};

export default function QuizGameScreen({
  gameId,
  demoMode = false,
}: {
  gameId: string;
  demoMode?: boolean;
}) {
  if (demoMode) {
    return <DemoQuizGameScreen gameId={gameId} />;
  }

  return <LiveQuizGameScreen gameId={gameId} />;
}

function DemoQuizGameScreen({ gameId }: { gameId: string }) {
  const {
    currentGamesSeason,
    isLoading: gamesSeasonLoading,
    error: gamesSeasonError,
  } = useGamesSeason();

  const currentGamesSeasonId =
    currentGamesSeason?.id;

  const [questions, setQuestions] = useState<DemoQuizQuestion[]>([]);
  const [weekNumber, setWeekNumber] = useState<number | null>(null);
  const [weekStartsAtMs, setWeekStartsAtMs] = useState<number | null>(null);
  const [weekEndsAtMs, setWeekEndsAtMs] = useState<number | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [started, setStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answerFeedback, setAnswerFeedback] = useState<QuizAnswerResponse["feedback"] | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Array<number | null>>([]);
  const [remainingMs, setRemainingMs] = useState(
    DEFAULT_QUESTION_TIME_SECONDS * 1000,
  );
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let active = true;

    /*
     * Aspettiamo che useGamesSeason abbia finito davvero il caricamento.
     * Prima la preview poteva partire una prima volta mentre la stagione
     * era ancora in caricamento e ripartire subito dopo, duplicando le
     * letture e la generazione del Quiz.
     */
    if (
      gamesSeasonLoading
    ) {
      return () => {
        active = false;
      };
    }

    async function loadPreview() {
      if (!currentGamesSeasonId) {
        setIsPreviewLoading(false);
        return;
      }

      const cached =
        readDemoPreviewCache({
          gamesSeasonId:
            currentGamesSeasonId,
          gameId,
        });

      if (cached) {
        setQuestions(
          cached.questions,
        );
        setSelectedAnswers(
          cached.questions.map(
            () => null,
          ),
        );
        setWeekNumber(
          cached.weekNumber,
        );
        setWeekStartsAtMs(
          cached.weekStartsAtMs,
        );
        setWeekEndsAtMs(
          cached.weekEndsAtMs,
        );
        setStarted(false);
        setCurrentQuestionIndex(0);
        setAnswerFeedback(null);
        setCompleted(false);
        setPreviewError(null);
        setIsPreviewLoading(false);
        return;
      }

      setIsPreviewLoading(true);
      setPreviewError(null);

      try {
        const generated =
          await WeeklyQuizGenerationService.previewWeek({
            gamesSeasonId:
              currentGamesSeasonId,
            gameId,
          });

        if (!active) return;

        const nextQuestions:
          DemoQuizQuestion[] =
            generated.questions.map(
              (question) => ({
                question: {
                  id:
                    question.id,
                  order:
                    question.order,
                  challengeType:
                    question.challengeType,
                  kind:
                    question.kind,
                  prompt:
                    question.prompt,
                  answers:
                    question.answers,
                  answerImageUrls:
                    question.answerImageUrls,
                  points:
                    question.points,
                },
                correctAnswerPosition:
                  question.correctAnswerIndex,
                explanation:
                  question.explanation,
              }),
            );

        const nextWeekStartsAtMs =
          toMillis(
            generated.week.startsAt,
          );

        const nextWeekEndsAtMs =
          toMillis(
            generated.week.endsAt,
          );

        setQuestions(
          nextQuestions,
        );
        setSelectedAnswers(
          nextQuestions.map(
            () => null,
          ),
        );
        setWeekNumber(
          generated.week.weekNumber,
        );
        setWeekStartsAtMs(
          nextWeekStartsAtMs,
        );
        setWeekEndsAtMs(
          nextWeekEndsAtMs,
        );
        setStarted(false);
        setCurrentQuestionIndex(0);
        setAnswerFeedback(null);
        setCompleted(false);

        if (
          nextWeekStartsAtMs !== null &&
          nextWeekEndsAtMs !== null
        ) {
          writeDemoPreviewCache({
            expiresAt:
              Date.now() +
              DEMO_PREVIEW_CACHE_TTL_MS,
            gamesSeasonId:
              currentGamesSeasonId,
            gameId,
            weekNumber:
              generated.week.weekNumber,
            weekStartsAtMs:
              nextWeekStartsAtMs,
            weekEndsAtMs:
              nextWeekEndsAtMs,
            questions:
              nextQuestions,
          });
        }
      } catch (error) {
        if (!active) return;

        setQuestions([]);
        setPreviewError(
          getErrorMessage(
            error,
            "Impossibile generare la preview con i dati reali del Quiz.",
          ),
        );
      } finally {
        if (active) {
          setIsPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      active = false;
    };
  }, [
    currentGamesSeasonId,
    gameId,
    gamesSeasonLoading,
  ]);

  const current = questions[currentQuestionIndex];
  const questionCount = questions.length;
  const currentQuestionTimeSeconds = getQuestionTimeSeconds(
    current?.question,
  );
  const progress = questionCount > 0
    ? Math.round((currentQuestionIndex / questionCount) * 100)
    : 0;
  const timerProgress = Math.max(
    0,
    Math.min(
      100,
      (1 - remainingMs / (currentQuestionTimeSeconds * 1000)) * 100,
    ),
  );
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

  useEffect(() => {
    if (!started || completed || !current || answerFeedback) return;

    const durationMs = getQuestionTimeSeconds(current.question) * 1000;
    const startedAt = Date.now();

    queueMicrotask(() => {
      setRemainingMs(durationMs);
    });

    const interval = window.setInterval(() => {
      const next = Math.max(0, durationMs - (Date.now() - startedAt));
      setRemainingMs(next);
    }, 100);

    return () => window.clearInterval(interval);
  }, [answerFeedback, completed, current, currentQuestionIndex, started]);

  useEffect(() => {
    if (!started || completed || !current || answerFeedback || remainingMs > 0) return;

    const timedOutQuestion = current;
    const timedOutQuestionIndex = currentQuestionIndex;

    queueMicrotask(() => {
      setSelectedAnswers((values) =>
        values.map((value, index) =>
          index === timedOutQuestionIndex ? null : value,
        ),
      );

      setAnswerFeedback((existing) =>
        existing ?? {
          questionId: timedOutQuestion.question.id,
          selectedAnswerPosition: -1,
          correctAnswerPosition: timedOutQuestion.correctAnswerPosition,
          isCorrect: false,
          earnedPoints: 0,
          maxPoints: timedOutQuestion.question.points,
          explanation: timedOutQuestion.explanation,
        },
      );
    });
  }, [answerFeedback, completed, current, currentQuestionIndex, remainingMs, started]);

  const publicState: QuizPublicState = {
    game: { id: gameId, name: "Weekly Quiz", priceCents: 0, status: "active" },
    week:
      weekNumber !== null &&
      weekStartsAtMs !== null &&
      weekEndsAtMs !== null
        ? {
            id: `preview-week-${weekNumber}`,
            weekNumber,
            startsAtMs: weekStartsAtMs,
            endsAtMs: weekEndsAtMs,
            questionCount,
            maxScore: questions.reduce(
              (total, item) => total + item.question.points,
              0,
            ),
          }
        : null,
    participation: {
      canParticipate: questionCount > 0,
      reason: "free",
      previewMode: true,
      hasAttempt: false,
      canStart: questionCount > 0,
      attemptStatus: null,
    },
    myWeeklyResult: null,
    weeklyLeaderboard: [],
    seasonLeaderboard: [],
  };

  function startDemo() {
    if (!current) return;

    setStarted(true);
    setCurrentQuestionIndex(0);
    setAnswerFeedback(null);
    setSelectedAnswers(questions.map(() => null));
    setCompleted(false);
    setRemainingMs(getQuestionTimeSeconds(questions[0]?.question) * 1000);
  }

  function chooseAnswer(selectedAnswerPosition: number) {
    if (!current || answerFeedback) return;

    const isCorrect =
      selectedAnswerPosition === current.correctAnswerPosition;

    setSelectedAnswers((values) =>
      values.map((value, index) =>
        index === currentQuestionIndex
          ? selectedAnswerPosition >= 0
            ? selectedAnswerPosition
            : null
          : value,
      ),
    );

    setAnswerFeedback({
      questionId: current.question.id,
      selectedAnswerPosition,
      correctAnswerPosition: current.correctAnswerPosition,
      isCorrect,
      earnedPoints: isCorrect ? current.question.points : 0,
      maxPoints: current.question.points,
      explanation: current.explanation,
    });
  }

  function continueQuiz() {
    if (!answerFeedback) return;

    if (currentQuestionIndex >= questionCount - 1) {
      setCompleted(true);
      return;
    }

    const nextIndex = currentQuestionIndex + 1;
    setCurrentQuestionIndex(nextIndex);
    setAnswerFeedback(null);
    setRemainingMs(
      getQuestionTimeSeconds(questions[nextIndex]?.question) * 1000,
    );
  }

  function buildResult(): QuizFinishResponse {
    const results = questions.map((item, index) => {
      const selected = selectedAnswers[index];
      const isCorrect = selected === item.correctAnswerPosition;

      return {
        questionId: item.question.id,
        order: item.question.order,
        challengeType: item.question.challengeType,
        prompt: item.question.prompt,
        answers: item.question.answers,
        selectedAnswerPosition: selected,
        correctAnswerPosition: item.correctAnswerPosition,
        isCorrect,
        earnedPoints: isCorrect ? item.question.points : 0,
        maxPoints: item.question.points,
        explanation: item.explanation,
      };
    });

    const score = results.reduce((total, item) => total + item.earnedPoints, 0);
    const maxScore = results.reduce((total, item) => total + item.maxPoints, 0);
    const correctCount = results.filter((item) => item.isCorrect).length;

    return {
      status: "completed",
      score,
      maxScore,
      percent: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
      correctCount,
      questionCount,
      previewMode: true,
      results,
      weeklyLeaderboard: [],
      seasonLeaderboard: [],
    };
  }

  if (gamesSeasonLoading || isPreviewLoading) {
    return (
      <AppShell>
        <PageHeader />
        <MessageCard>Caricamento Weekly Challenge...</MessageCard>
      </AppShell>
    );
  }

  if (gamesSeasonError || previewError || !currentGamesSeason || questions.length === 0) {
    return (
      <AppShell>
        <PageHeader />
        <MessageCard error>
          {previewError || gamesSeasonError || "Nessuna domanda reale disponibile per questa preview."}
        </MessageCard>
      </AppShell>
    );
  }

  if (completed) {
    return (
      <AppShell>
        <PageHeader />
        <ResultScreen result={buildResult()} backHref="/admin/games" />
      </AppShell>
    );
  }

  if (started && current) {
    return (
      <AppShell>
        <QuizHeader
          current={currentQuestionIndex + 1}
          total={questionCount}
          progress={progress}
        />
        <QuestionCard
          question={current.question}
          disabled={false}
          feedback={answerFeedback}
          timerProgress={timerProgress}
          remainingSeconds={remainingSeconds}
          isLastQuestion={currentQuestionIndex === questionCount - 1}
          onAnswer={chooseAnswer}
          onContinue={continueQuiz}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader />
      <IntroCard state={publicState} isStarting={false} onStart={startDemo} />

      <div className="mt-7 space-y-7">
        <LeaderboardSection
          title="Classifica generale"
        >
          <SeasonLeaderboard
            entries={
              publicState.seasonLeaderboard
            }
          />
        </LeaderboardSection>
      </div>
    </AppShell>
  );
}

function getDemoPreviewCacheKey({
  gamesSeasonId,
  gameId,
}: {
  gamesSeasonId:
    string;
  gameId:
    string;
}) {
  return [
    "ludi",
    "weekly-quiz-demo",
    "v12",
    gamesSeasonId,
    gameId,
  ].join(":");
}

function readDemoPreviewCache({
  gamesSeasonId,
  gameId,
}: {
  gamesSeasonId:
    string;
  gameId:
    string;
}): DemoPreviewCacheEntry | null {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  try {
    const key =
      getDemoPreviewCacheKey({
        gamesSeasonId,
        gameId,
      });

    const raw =
      window.sessionStorage.getItem(
        key,
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(
        raw,
      ) as
        Partial<DemoPreviewCacheEntry>;

    if (
      parsed.gamesSeasonId !==
        gamesSeasonId ||
      parsed.gameId !==
        gameId ||
      typeof parsed.expiresAt !==
        "number" ||
      parsed.expiresAt <=
        Date.now() ||
      typeof parsed.weekNumber !==
        "number" ||
      typeof parsed.weekStartsAtMs !==
        "number" ||
      typeof parsed.weekEndsAtMs !==
        "number" ||
      !Array.isArray(
        parsed.questions,
      )
    ) {
      window.sessionStorage.removeItem(
        key,
      );

      return null;
    }

    return parsed as
      DemoPreviewCacheEntry;
  } catch {
    return null;
  }
}

function writeDemoPreviewCache(
  value:
    DemoPreviewCacheEntry,
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      getDemoPreviewCacheKey({
        gamesSeasonId:
          value.gamesSeasonId,
        gameId:
          value.gameId,
      }),
      JSON.stringify(
        value,
      ),
    );
  } catch {
    /*
     * Cache opzionale: se sessionStorage non è disponibile,
     * la Demo continua normalmente senza bloccare il Quiz.
     */
  }
}

function toMillis(value: unknown): number | null {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function LiveQuizGameScreen({
  gameId,
}: {
  gameId:
    string;
}) {
  const {
    user,

    isLoading:
      authLoading,
  } =
    useAuth();

  const {
    currentGamesSeason,

    isLoading:
      seasonLoading,

    error:
      seasonError,
  } =
    useGamesSeason();

  const [
    publicState,
    setPublicState,
  ] =
    useState<
      QuizPublicState | null
    >(
      null,
    );

  const [
    session,
    setSession,
  ] =
    useState<
      QuizStartResponse | null
    >(
      null,
    );

  const [
    currentQuestionIndex,
    setCurrentQuestionIndex,
  ] =
    useState(
      0,
    );

  const [
    result,
    setResult,
  ] =
    useState<
      QuizFinishResponse | null
    >(
      null,
    );

  const [
    isMetadataLoading,
    setIsMetadataLoading,
  ] =
    useState(
      true,
    );

  const [
    isStarting,
    setIsStarting,
  ] =
    useState(
      false,
    );

  const [
    isAnswering,
    setIsAnswering,
  ] =
    useState(
      false,
    );

  const [
    loadError,
    setLoadError,
  ] =
    useState<
      string | null
    >(
      null,
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
    answerFeedback,
    setAnswerFeedback,
  ] =
    useState<
      QuizAnswerResponse["feedback"] | null
    >(
      null,
    );

  const [
    pendingFinish,
    setPendingFinish,
  ] =
    useState(
      false,
    );

  const [
    questionStartedAt,
    setQuestionStartedAt,
  ] =
    useState<
      number | null
    >(
      null,
    );

  const [
    remainingMs,
    setRemainingMs,
  ] =
    useState(
      DEFAULT_QUESTION_TIME_SECONDS *
        1000,
    );

  const handleAnswerRef =
    useRef<
      (
        selectedAnswerPosition:
          number,
      ) => void
    >(
      () => {},
    );

  const attemptTokenRef =
    useRef<
      string | null
    >(
      null,
    );

  const finishedAttemptRef =
    useRef<
      string | null
    >(
      null,
    );

  const exitQuestionRef =
    useRef<{
      attemptId: string;
      questionId: string;
      token: string;
    } | null>(
      null,
    );

  const answerRequestInFlightRef =
    useRef(
      false,
    );

  const settledQuestionKeyRef =
    useRef<
      string | null
    >(
      null,
    );

  const exitRequestKeyRef =
    useRef<
      string | null
    >(
      null,
    );

  const pendingExitWhileAnsweringKeyRef =
    useRef<
      string | null
    >(
      null,
    );

  const unmountExitTimerRef =
    useRef<
      number | null
    >(
      null,
    );

  const metadataRequestRef = useRef(0);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  useEffect(() => () => { metadataRequestRef.current += 1; }, [gameId, user?.uid, currentGamesSeason?.id]);

  const loadMetadata =
    useCallback(
      async () => {
        if (
          !user ||
          !currentGamesSeason
        ) {
          return;
        }

        const requestId = ++metadataRequestRef.current;
        setLeaderboardLoading(true);
        setLeaderboardError(null);
        try {
          const idToken =
            await user.getIdToken();

          const response =
            await fetch(
              `/api/games/quiz/${encodeURIComponent(
                gameId,
              )}?gamesSeasonId=${encodeURIComponent(
                currentGamesSeason.id,
              )}&includeLeaderboard=false`,
              {
                headers: {
                  Authorization:
                    `Bearer ${idToken}`,
                },

                cache:
                  "no-store",
              },
            );

          const data =
            await readJson<
              QuizPublicState
            >(
              response,
            );

          if (
            !response.ok
          ) {
            throw new Error(
              getResponseError(
                data,
                "Impossibile caricare la Weekly Challenge.",
              ),
            );
          }

          if (requestId !== metadataRequestRef.current) return;
          setPublicState(data);
          // Ranking is secondary: it must not delay the start/resume card.
          void (async () => {
            try {
              const leaderboardResponse = await fetch(
                `/api/games/quiz/${encodeURIComponent(gameId)}?gamesSeasonId=${encodeURIComponent(currentGamesSeason.id)}&section=leaderboard`,
                { headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store" },
              );
              const payload = await readJson<{ seasonLeaderboard?: QuizPublicState["seasonLeaderboard"]; error?: string }>(leaderboardResponse);
              if (!leaderboardResponse.ok) throw new Error("Classifica temporaneamente non disponibile.");
              if (requestId !== metadataRequestRef.current) return;
              setPublicState((current) => current ? { ...current, seasonLeaderboard: payload.seasonLeaderboard ?? [] } : current);
            } catch {
              if (requestId === metadataRequestRef.current) setLeaderboardError("Classifica temporaneamente non disponibile.");
            } finally {
              if (requestId === metadataRequestRef.current) setLeaderboardLoading(false);
            }
          })();

          setLoadError(
            null,
          );
        } catch (
          error
        ) {
          if (requestId !== metadataRequestRef.current) return;
          setLoadError(
            getErrorMessage(
              error,
              "Impossibile caricare la Weekly Challenge.",
            ),
          );
        } finally {
          if (requestId === metadataRequestRef.current) setIsMetadataLoading(false);
        }
      },
      [
        currentGamesSeason,
        gameId,
        user,
      ],
    );

  useEffect(
    () => {
      if (
        !user ||
        !currentGamesSeason
      ) {
        return;
      }

      queueMicrotask(
        () => {
          void loadMetadata();
        },
      );
    },
    [
      currentGamesSeason,
      loadMetadata,
      user,
    ],
  );

  /*
   * Le risposte vengono salvate una per una sul server.
   * Se l'utente abbandona il gioco mentre una domanda è ancora
   * aperta e senza risposta, quella domanda viene registrata con
   * selectedAnswerPosition = -1: vale quindi come errata e, alla
   * ripresa, il Quiz prosegue dalla domanda successiva.
   */

  const currentQuestion:
    QuizRuntimeQuestion | null =
    session?.questions[
      currentQuestionIndex
    ] ??
    null;

  const currentQuestionTimeSeconds =
    getQuestionTimeSeconds(
      currentQuestion,
    );

  const currentQuestionKey =
    session &&
    currentQuestion
      ? `${session.attemptId}:${currentQuestion.id}`
      : null;

  const markOpenQuestionAsUnansweredOnExit =
    useCallback(
      () => {
        const activeQuestion =
          exitQuestionRef.current;

        if (
          !activeQuestion
        ) {
          return;
        }

        const questionKey =
          `${activeQuestion.attemptId}:${activeQuestion.questionId}`;

        if (
          answerRequestInFlightRef.current
        ) {
          pendingExitWhileAnsweringKeyRef.current =
            questionKey;

          return;
        }

        if (
          settledQuestionKeyRef.current ===
            questionKey ||
          exitRequestKeyRef.current ===
            questionKey
        ) {
          return;
        }

        exitRequestKeyRef.current =
          questionKey;

        if (
          pendingExitWhileAnsweringKeyRef.current ===
          questionKey
        ) {
          pendingExitWhileAnsweringKeyRef.current =
            null;
        }

        void fetch(
          `/api/games/quiz/${encodeURIComponent(
            gameId,
          )}/answer`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${activeQuestion.token}`,
            },

            body:
              JSON.stringify({
                attemptId:
                  activeQuestion.attemptId,

                questionId:
                  activeQuestion.questionId,

                selectedAnswerPosition:
                  -1,
              }),

            /*
             * Mantiene viva la richiesta anche durante refresh,
             * chiusura pagina o navigazione verso un'altra route.
             */
            keepalive:
              true,
          },
        ).catch(
          () => {
            /*
             * In fase di uscita non mostriamo errori UI. Se la
             * richiesta non parte, il server lascerà la domanda
             * non registrata e non corromperà il tentativo.
             */
          },
        );
      },
      [
        gameId,
      ],
    );

  useEffect(
    () => {
      const token =
        attemptTokenRef.current;

      if (
        session &&
        currentQuestion &&
        token &&
        !answerFeedback
      ) {
        exitQuestionRef.current = {
          attemptId:
            session.attemptId,

          questionId:
            currentQuestion.id,

          token,
        };

        return;
      }

      exitQuestionRef.current =
        null;
    },
    [
      answerFeedback,
      currentQuestion,
      session,
    ],
  );

  useEffect(
    () => {
      const handlePageHide =
        () => {
          markOpenQuestionAsUnansweredOnExit();
        };

      window.addEventListener(
        "pagehide",
        handlePageHide,
      );

      if (
        unmountExitTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          unmountExitTimerRef.current,
        );

        unmountExitTimerRef.current =
          null;
      }

      return () => {
        window.removeEventListener(
          "pagehide",
          handlePageHide,
        );

        /*
         * La route può cambiare senza pagehide (navigazione client
         * di Next.js). Rimandiamo di un tick il salvataggio così il
         * doppio mount dello Strict Mode può annullarlo subito.
         */
        unmountExitTimerRef.current =
          window.setTimeout(
            () => {
              markOpenQuestionAsUnansweredOnExit();

              unmountExitTimerRef.current =
                null;
            },
            0,
          );
      };
    },
    [
      markOpenQuestionAsUnansweredOnExit,
    ],
  );

  useEffect(
    () => {
      if (
        !session ||
        !currentQuestion ||
        answerFeedback
      ) {
        return;
      }

      const startedAt =
        Date.now();

      queueMicrotask(
        () => {
          setQuestionStartedAt(
            startedAt,
          );

          setRemainingMs(
            currentQuestionTimeSeconds *
              1000,
          );
        },
      );

      const intervalId =
        window.setInterval(
          () => {
            const elapsed =
              Date.now() -
              startedAt;

            const nextRemaining =
              Math.max(
                0,
                currentQuestionTimeSeconds *
                  1000 -
                  elapsed,
              );

            setRemainingMs(
              nextRemaining,
            );
          },
          100,
        );

      return () => {
        window.clearInterval(
          intervalId,
        );
      };
    },
    [
      answerFeedback,
      currentQuestion,
      currentQuestionTimeSeconds,
      session,
    ],
  );

  useEffect(
    () => {
      if (
        !session ||
        !currentQuestion ||
        answerFeedback ||
        isAnswering ||
        questionStartedAt ===
          null ||
        remainingMs >
          0
      ) {
        return;
      }

      queueMicrotask(
        () => {
          handleAnswerRef.current(
            -1,
          );
        },
      );
    },
    [
      answerFeedback,
      currentQuestion,
      isAnswering,
      questionStartedAt,
      remainingMs,
      session,
    ],
  );

  const timerProgress =
    Math.max(
      0,
      Math.min(
        100,
        (
          1 -
          remainingMs /
            (
              currentQuestionTimeSeconds *
              1000
            )
        ) *
          100,
      ),
    );

  const remainingSeconds =
    Math.max(
      0,
      Math.ceil(
        remainingMs /
          1000,
      ),
    );

  const questionCount =
    session?.questions.length ??
    publicState?.week?.questionCount ??
    7;

  const answeredCount =
    session
      ? currentQuestionIndex
      : 0;

  const progress =
    questionCount >
    0
      ? Math.round(
          (
            answeredCount /
            questionCount
          ) *
            100,
        )
      : 0;

  async function handleStart() {
    if (
      !user ||
      !currentGamesSeason ||
      isStarting
    ) {
      return;
    }

    setIsStarting(
      true,
    );

    setActionError(
      null,
    );

    setResult(
      null,
    );

    setAnswerFeedback(
      null,
    );

    setPendingFinish(
      false,
    );

    try {
      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          `/api/games/quiz/${encodeURIComponent(
            gameId,
          )}/start`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${idToken}`,
            },

            body:
              JSON.stringify({
                gamesSeasonId:
                  currentGamesSeason.id,
              }),
          },
        );

      const data =
        await readJson<
          QuizStartResponse
        >(
          response,
        );

      if (
        !response.ok
      ) {
        throw new Error(
          getResponseError(
            data,
            "Impossibile iniziare la Weekly Challenge.",
          ),
        );
      }

      attemptTokenRef.current =
        idToken;

      finishedAttemptRef.current =
        null;

      setSession(
        data,
      );

      setCurrentQuestionIndex(
        Math.min(
          data.answeredCount,
          Math.max(
            0,
            data.questions.length -
              1,
          ),
        ),
      );

      setQuestionStartedAt(
        null,
      );

      setRemainingMs(
        currentQuestionTimeSeconds *
          1000,
      );
    } catch (
      error
    ) {
      setActionError(
        getErrorMessage(
          error,
          "Impossibile iniziare la Weekly Challenge.",
        ),
      );

      await loadMetadata();
    } finally {
      setIsStarting(
        false,
      );
    }
  }

  async function handleAnswer(
    selectedAnswerPosition:
      number,
  ) {
    if (
      !user ||
      !session ||
      !currentQuestion ||
      isAnswering
    ) {
      return;
    }

    answerRequestInFlightRef.current =
      true;

    setIsAnswering(
      true,
    );

    setActionError(
      null,
    );

    try {
      const token =
        attemptTokenRef.current ??
        await user.getIdToken();

      const response =
        await fetch(
          `/api/games/quiz/${encodeURIComponent(
            gameId,
          )}/answer`,
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
              JSON.stringify({
                attemptId:
                  session.attemptId,

                questionId:
                  currentQuestion.id,

                selectedAnswerPosition,
              }),

            /*
             * Se l'utente lascia la pagina subito dopo aver scelto
             * una risposta, permettiamo al salvataggio già avviato
             * di completarsi invece di trasformarlo in un -1.
             */
            keepalive:
              true,
          },
        );

      const data =
        await readJson<
          QuizAnswerResponse
        >(
          response,
        );

      if (
        !response.ok
      ) {
        throw new Error(
          getResponseError(
            data,
            "Impossibile salvare la risposta.",
          ),
        );
      }

      settledQuestionKeyRef.current =
        currentQuestionKey;

      setAnswerFeedback(
        data.feedback,
      );

      setPendingFinish(
        data.isComplete,
      );
    } catch (
      error
    ) {
      setActionError(
        getErrorMessage(
          error,
          "Impossibile salvare la risposta.",
        ),
      );
    } finally {
      answerRequestInFlightRef.current =
        false;

      if (
        pendingExitWhileAnsweringKeyRef.current ===
        currentQuestionKey
      ) {
        markOpenQuestionAsUnansweredOnExit();
      }

      setIsAnswering(
        false,
      );
    }
  }

  useEffect(() => {
    handleAnswerRef.current =
      handleAnswer;
  });

  async function handleContinue() {
    if (
      !session ||
      !answerFeedback ||
      isAnswering
    ) {
      return;
    }

    if (
      pendingFinish
    ) {
      const token =
        attemptTokenRef.current ??
        await user?.getIdToken();

      if (
        !token
      ) {
        setActionError(
          "Sessione non disponibile.",
        );

        return;
      }

      setIsAnswering(
        true,
      );

      try {
        await finishAttempt({
          token,
          attemptId:
            session.attemptId,
        });
      } catch (
        error
      ) {
        setActionError(
          getErrorMessage(
            error,
            "Impossibile concludere la Weekly Challenge.",
          ),
        );
      } finally {
        setIsAnswering(
          false,
        );
      }

      return;
    }

    setAnswerFeedback(
      null,
    );

    setQuestionStartedAt(
      null,
    );

    setRemainingMs(
      currentQuestionTimeSeconds *
        1000,
    );

    setCurrentQuestionIndex(
      (
        current,
      ) =>
        current +
        1,
    );
  }

  async function finishAttempt({
    token,
    attemptId,
  }: {
    token:
      string;

    attemptId:
      string;
  }) {
    const response =
      await fetch(
        `/api/games/quiz/${encodeURIComponent(
          gameId,
        )}/finish`,
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
            JSON.stringify({
              attemptId,
            }),
        },
      );

    const data =
      await readJson<
        QuizFinishResponse
      >(
        response,
      );

    if (
      !response.ok
    ) {
      throw new Error(
        getResponseError(
          data,
          "Impossibile concludere la Weekly Challenge.",
        ),
      );
    }

    finishedAttemptRef.current =
      attemptId;

    setResult(
      data,
    );

    setSession(
      null,
    );

    setCurrentQuestionIndex(
      0,
    );

    setAnswerFeedback(
      null,
    );

    setPendingFinish(
      false,
    );

    attemptTokenRef.current =
      null;

    await loadMetadata();
  }

  if (
    authLoading ||
    seasonLoading ||
    isMetadataLoading
  ) {
    return (
      <AppShell>
        <PageHeader />

        <MessageCard>
          Caricamento Weekly Challenge...
        </MessageCard>
      </AppShell>
    );
  }

  if (
    !user
  ) {
    return (
      <AppShell>
        <PageHeader />

        <MessageCard>
          Accedi per visualizzare il Quiz.
        </MessageCard>
      </AppShell>
    );
  }

  if (
    seasonError ||
    !currentGamesSeason
  ) {
    return (
      <AppShell>
        <PageHeader />

        <MessageCard
          error
        >
          Nessuna Games Season attiva.
        </MessageCard>
      </AppShell>
    );
  }

  if (
    loadError
  ) {
    return (
      <AppShell>
        <PageHeader />

        <MessageCard
          error
        >
          {loadError}
        </MessageCard>

        <Link
          href="/games"
          className="mt-4 block text-center text-xs font-black uppercase text-[#06142E]"
        >
          ← Games
        </Link>
      </AppShell>
    );
  }

  if (
    result
  ) {
    return (
      <AppShell>
        <PageHeader />

        <ResultScreen
          result={
            result
          }
        />
      </AppShell>
    );
  }

  if (
    session &&
    currentQuestion
  ) {
    return (
      <AppShell>
        <QuizHeader
          current={
            currentQuestionIndex +
            1
          }
          total={
            session.questions.length
          }
          progress={
            progress
          }
        />

        {actionError && (
          <MessageCard
            error
          >
            {actionError}
          </MessageCard>
        )}

        <QuestionCard
          question={
            currentQuestion
          }
          disabled={
            isAnswering
          }
          feedback={
            answerFeedback
          }
          timerProgress={
            timerProgress
          }
          remainingSeconds={
            remainingSeconds
          }
          isLastQuestion={
            pendingFinish
          }
          onAnswer={
            handleAnswer
          }
          onContinue={() => {
            void handleContinue();
          }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader />

      {actionError && (
        <MessageCard
          error
        >
          {actionError}
        </MessageCard>
      )}

      <IntroCard
        state={
          publicState
        }
        isStarting={
          isStarting
        }
        onStart={
          handleStart
        }
      />

      {publicState && (
        <div className="mt-7 space-y-7">
          <LeaderboardSection
            title="Classifica generale"
          >
            {leaderboardLoading ? (
              <p role="status" className="text-sm font-bold text-[#06142E]/45">Caricamento classifica...</p>
            ) : leaderboardError ? (
              <p className="text-sm font-bold text-[#06142E]/45">{leaderboardError}</p>
            ) : <SeasonLeaderboard
              entries={
                publicState.seasonLeaderboard
              }
            />}
          </LeaderboardSection>
        </div>
      )}
    </AppShell>
  );
}

function PageHeader() {
  return (
    <header className="mt-6 mb-3">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#06142E]/40">
        Ludi Quiz
      </p>

      <h1 className="mt-1 text-3xl font-black uppercase text-[#06142E]">
        Weekly Challenge
      </h1>
 
      <p className="mt-1 text-sm font-bold text-[#06142E]/50">
        7 domande. Una sola possibilità. Ogni settimana.
      </p>
    </header>
  );
}

function QuizHeader({
  current,
  total,
  progress,
}: {
  current:
    number;

  total:
    number;

  progress:
    number;
}) {
  return (
    <header className="mb-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
            Weekly Challenge
          </p>

          <h1 className="mt-0.5 text-xl font-black uppercase text-[#06142E]">
            Domanda {current}/{total}
          </h1>
        </div>

        <span className="rounded-full bg-[#06142E] px-3 py-1.5 text-[9px] font-black text-white">
          {progress}%
        </span>
      </div>

      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#06142E]/10">
        <div
          className="h-full rounded-full bg-[#0B5FFF] transition-[width]"
          style={{
            width:
              `${progress}%`,
          }}
        />
      </div>
    </header>
  );
}

function IntroCard({
  state,
  isStarting,
  onStart,
}: {
  state:
    QuizPublicState | null;

  isStarting:
    boolean;

  onStart:
    () => void;
}) {
  if (
    !state ||
    !state.week
  ) {
    return (
      <MessageCard>
        Nessuna Weekly Challenge disponibile.
      </MessageCard>
    );
  }

  const attempted =
    state.myWeeklyResult;

  return (
    <section className="overflow-hidden rounded-[24px] bg-[#06142E] p-5 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="mt-1 text-2xl font-black uppercase">
            Quiz della settimana
          </h2>
        </div>

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-white/10">
          <Sparkles
            size={22}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <MiniStat
          value={
            state.week.questionCount
          }
          label="Domande"
        />

        <MiniStat
          value={
            state.week.maxScore
          }
          label="Punti max"
        />

        <MiniStat
          value={1}
          label="Tentativo"
        />
      </div>

      {attempted?.status ===
      "in_progress" ? (
        <div className="mt-5">
          <div className="rounded-[16px] bg-white/[0.07] p-4">
            <div className="flex items-center gap-2">
              <Play
                size={18}
                className="text-cyan-300"
                fill="currentColor"
              />

              <p className="text-xs font-black uppercase">
                Quiz in corso
              </p>
            </div>

            <p className="mt-2 text-xs font-bold leading-5 text-white/45">
              Il tuo tentativo è stato salvato. Riprenderai dalla prima domanda non ancora completata.
            </p>
          </div>

          <button
            type="button"
            disabled={
              isStarting
            }
            onClick={
              onStart
            }
            className="mt-3 flex min-h-13 w-full items-center justify-center gap-2 rounded-[14px] bg-[#0B5FFF] px-5 text-xs font-black uppercase text-white disabled:opacity-40"
          >
            <Play
              size={17}
              fill="currentColor"
            />

            {isStarting
              ? "Ripristino..."
              : "Riprendi il gioco"}
          </button>
        </div>
      ) : attempted ? (
        <div className="mt-5 rounded-[16px] bg-white/[0.07] p-4">
          <div className="flex items-center gap-2">
            {attempted.status ===
            "completed" ? (
              <CheckCircle2
                size={18}
                className="text-emerald-300"
              />
            ) : (
              <LockKeyhole
                size={18}
                className="text-amber-300"
              />
            )}

            <p className="text-xs font-black uppercase">
              {attempted.status ===
              "completed"
                ? "Quiz completato"
                : "Tentativo concluso"}
            </p>
          </div>

          <p className="mt-3 text-3xl font-black">
            {attempted.score}/{attempted.maxScore}
          </p>

          <p className="mt-1 text-xs font-bold text-white/40">
            {attempted.correctCount}/{attempted.questionCount} risposte corrette · {attempted.percent}%
          </p>

          <p className="mt-3 text-[11px] font-bold leading-5 text-white/45">
            Hai già completato il quiz. Ritorna giovedi per la nuova Weekly Challenge.
          </p>
        </div>
      ) : state.participation.canStart ? (
        <button
          type="button"
          disabled={
            isStarting
          }
          onClick={
            onStart
          }
          className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-[14px] bg-[#0B5FFF] px-5 text-xs font-black uppercase text-white disabled:opacity-40"
        >
          <Play
            size={17}
            fill="currentColor"
          />

          {isStarting
            ? "Avvio..."
            : "Inizia il gioco"}
        </button>
      ) : (
        <div className="mt-5 rounded-[16px] bg-white/[0.07] p-4">
          <div className="flex items-center gap-2">
            <LockKeyhole
              size={17}
              className="text-white/50"
            />

            <p className="text-xs font-black uppercase">
              Partecipazione bloccata
            </p>
          </div>

          <p className="mt-2 text-xs font-bold leading-5 text-white/40">
            Puoi visualizzare classifiche e risultati. Per partecipare serve un Games Pass, un accesso al singolo gioco oppure il Quiz deve essere gratuito.
          </p>
        </div>
      )}
    </section>
  );
}

function QuestionCard({
  question,
  disabled,
  feedback,
  timerProgress,
  remainingSeconds,
  isLastQuestion,
  onAnswer,
  onContinue,
}: {
  question:
    QuizRuntimeQuestion;

  disabled:
    boolean;

  feedback:
    QuizAnswerResponse["feedback"] | null;

  timerProgress:
    number;

  remainingSeconds:
    number;

  isLastQuestion:
    boolean;

  onAnswer:
    (
      selectedAnswerPosition:
        number,
    ) => void;

  onContinue:
    () => void;
}) {
  const hasFeedback =
    feedback?.questionId ===
    question.id;

  const timedOut =
    hasFeedback &&
    feedback.selectedAnswerPosition <
      0;

  return (
    <section className="rounded-[20px] bg-white p-4 shadow-[0_10px_24px_rgba(6,20,46,0.07)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[7px] font-black uppercase text-cyan-800">
            {challengeLabel(
              question.challengeType,
            )}
          </span>

          <span className="rounded-full bg-[#F5F5F2] px-2.5 py-1 text-[7px] font-black uppercase text-[#06142E]/40">
            {question.points} pt
          </span>
        </div>

        <span className="shrink-0 text-[10px] font-black text-[#06142E]/45">
          {hasFeedback
            ? "STOP"
            : `${remainingSeconds}s`}
        </span>
      </div>

      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#06142E]/10">
        <div
          className="h-full rounded-full bg-[#0B5FFF] transition-[width] duration-100"
          style={{
            width:
              `${hasFeedback ? 100 : timerProgress}%`,
          }}
        />
      </div>

      <h2 className="mt-3 whitespace-pre-line text-[17px] font-black leading-[1.25] text-[#06142E]">
        {localizeQuizText(
          question.prompt,
        )}
      </h2>

      <div className="mt-3 grid gap-2">
        {question.answers.map(
          (
            answer,
            index,
          ) => {
            const isSelected =
              hasFeedback &&
              feedback.selectedAnswerPosition ===
                index;

            const isCorrect =
              hasFeedback &&
              feedback.correctAnswerPosition ===
                index;

            const isSelectedWrong =
              isSelected &&
              !isCorrect;

            const className =
              isCorrect
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : isSelectedWrong
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-[#06142E]/10 bg-[#F8F8F6] text-[#06142E]";

            const answerImageUrl =
              question.kind === "higher_or_lower"
                ? question.answerImageUrls?.[index] ||
                  "/players/player-placeholder.png"
                : null;

            return (
              <button
                key={`${question.id}-${index}`}
                type="button"
                disabled={
                  disabled ||
                  hasFeedback
                }
                onClick={() => {
                  onAnswer(
                    index,
                  );
                }}
                className={`flex min-h-11 items-center justify-between gap-3 rounded-[12px] border px-3 py-2 text-left text-[12px] font-black leading-4 transition active:scale-[0.99] disabled:cursor-default ${className}`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  {answerImageUrl ? (
                    <Image
                      src={answerImageUrl}
                      alt={localizeQuizText(answer)}
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
                    )}. {localizeQuizText(answer)}
                  </span>
                </span>

                {isCorrect ? (
                  <CheckCircle2
                    size={16}
                    className="shrink-0"
                  />
                ) : isSelectedWrong ? (
                  <XCircle
                    size={16}
                    className="shrink-0"
                  />
                ) : !hasFeedback ? (
                  <ChevronRight
                    size={15}
                    className="shrink-0 text-[#06142E]/25"
                  />
                ) : null}
              </button>
            );
          },
        )}
      </div>

      {hasFeedback ? (
        <div className="mt-3">
          <div className={`rounded-[11px] px-3 py-2.5 ${
            feedback.isCorrect
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-700"
          }`}>
            <p className="text-[10px] font-black uppercase">
              {timedOut
                ? "Tempo scaduto"
                : feedback.isCorrect
                  ? `Risposta corretta · +${feedback.earnedPoints} punti`
                  : "Risposta sbagliata"}
            </p>

            {feedback.explanation && (
              <p className="mt-1 text-[10px] font-bold leading-4 opacity-70">
                {localizeQuizText(
                  feedback.explanation,
                )}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={
              disabled
            }
            onClick={
              onContinue
            }
            className="mt-3 flex min-h-11 w-full items-center justify-center rounded-[12px] bg-[#06142E] px-4 text-[10px] font-black uppercase text-white disabled:opacity-40"
          >
            {isLastQuestion
              ? "Vedi risultato"
              : "Prossima domanda"}
          </button>
        </div>
      ) : (
        <p className="mt-2.5 text-center text-[9px] font-bold leading-3.5 text-[#06142E]/30">
          Hai {getQuestionTimeSeconds(question)} secondi. La risposta viene salvata subito.
        </p>
      )}
    </section>
  );
}

function ResultScreen({
  result,
  backHref = "/games",
}: {
  result:
    QuizFinishResponse;
  backHref?: string;
}) {
  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-[24px] bg-[#06142E] p-6 text-center text-white">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
          <Trophy
            size={27}
          />
        </div>

        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
          Weekly Challenge completata
        </p>

        <p className="mt-2 text-5xl font-black">
          {result.score}
        </p>

        <p className="mt-1 text-xs font-black uppercase text-white/35">
          su {result.maxScore} punti
        </p>

        <p className="mt-4 text-sm font-bold text-white/55">
          {result.correctCount}/{result.questionCount} corrette · {result.percent}%
        </p>
      </section>

      <section>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#06142E]/35">
          Soluzioni
        </p>

        <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
          Le tue risposte
        </h2>

        <div className="mt-4 space-y-3">
          {result.results.map(
            (
              item,
            ) => (
              <article
                key={
                  item.questionId
                }
                className="rounded-[20px] bg-white p-4 shadow-[0_8px_24px_rgba(6,20,46,0.06)]"
              >
                <div className="flex items-center gap-2">
                  {item.isCorrect ? (
                    <CheckCircle2
                      size={18}
                      className="text-emerald-600"
                    />
                  ) : (
                    <XCircle
                      size={18}
                      className="text-red-500"
                    />
                  )}

                  <span className="text-[9px] font-black uppercase text-[#06142E]/35">
                    Domanda {item.order}
                  </span>
                </div>

                <p className="mt-3 whitespace-pre-line text-sm font-black leading-5 text-[#06142E]">
                  {localizeQuizText(
                    item.prompt,
                  )}
                </p>

                <div className="mt-3 space-y-2">
                  {item.answers.map(
                    (
                      answer,
                      index,
                    ) => {
                      const isCorrect =
                        index ===
                        item.correctAnswerPosition;

                      const isSelected =
                        index ===
                        item.selectedAnswerPosition;

                      return (
                        <div
                          key={`${item.questionId}-result-${index}`}
                          className={`rounded-[11px] px-3 py-2 text-xs font-bold ${
                            isCorrect
                              ? "bg-emerald-50 text-emerald-800"
                              : isSelected
                                ? "bg-red-50 text-red-700"
                                : "bg-[#F5F5F2] text-[#06142E]/40"
                          }`}
                        >
                          {localizeQuizText(answer)}
                          {isCorrect
                            ? " ✓"
                            : isSelected
                              ? " ✕"
                              : ""}
                        </div>
                      );
                    },
                  )}
                </div>

                {item.selectedAnswerPosition ===
                  null && (
                  <p className="mt-3 text-[10px] font-black uppercase text-amber-600">
                    Nessuna risposta · conteggiata come errata
                  </p>
                )}

                {item.explanation && (
                  <p className="mt-3 text-xs font-bold leading-5 text-[#06142E]/40">
                    {localizeQuizText(
                      item.explanation,
                    )}
                  </p>
                )}
              </article>
            ),
          )}
        </div>
      </section>

      {!result.previewMode && (
        <>
          <LeaderboardSection
            title="Classifica generale"
          >
            <SeasonLeaderboard
              entries={
                result.seasonLeaderboard
              }
            />
          </LeaderboardSection>
        </>
      )}

      <Link
        href={backHref}
        className="block min-h-12 rounded-[13px] bg-[#06142E] px-5 py-4 text-center text-xs font-black uppercase text-white"
      >
        Torna a Games
      </Link>
    </div>
  );
}

function LeaderboardSection({
  title,
  children,
}: {
  title:
    string;

  children:
    ReactNode;
}) {
  return (
    <section>

      <h2 className="mt-1 text-2xl font-black uppercase text-[#06142E]">
        {title}
      </h2>

      <div className="mt-4">
        {children}
      </div>
    </section>
  );
}

function SeasonLeaderboard({
  entries,
}: {
  entries:
    QuizSeasonLeaderboardEntry[];
}) {
  if (
    entries.length ===
    0
  ) {
    return (
      <MessageCard>
        La classifica generale si popolerà dopo i primi Quiz completati.
      </MessageCard>
    );
  }

  return (
    <div className="overflow-hidden rounded-[20px] bg-white">
      {entries
        .slice(
          0,
          10,
        )
        .map(
          (
            entry,
          ) => (
            <LeaderboardRow
              key={
                entry.userId
              }
              position={
                entry.position
              }
              name={
                entry.displayName
              }
              value={`${entry.totalScore} pt`}
              detail={`${entry.completedWeeks} week`}
            />
          ),
        )}
    </div>
  );
}

function LeaderboardRow({
  position,
  name,
  value,
  detail,
}: {
  position:
    number;

  name:
    string;

  value:
    string;

  detail:
    string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[#06142E]/[0.06] px-4 py-3.5 last:border-b-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5F5F2] text-xs font-black text-[#06142E]">
        {position ===
        1 ? (
          <Crown
            size={15}
          />
        ) : (
          position
        )}
      </div>

      <p className="min-w-0 flex-1 truncate text-sm font-black text-[#06142E]">
        {name}
      </p>

      <div className="text-right">
        <p className="text-sm font-black text-[#06142E]">
          {value}
        </p>

        <p className="text-[9px] font-bold uppercase text-[#06142E]/30">
          {detail}
        </p>
      </div>
    </div>
  );
}

function MiniStat({
  value,
  label,
}: {
  value:
    number;

  label:
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

function MessageCard({
  children,
  error = false,
}: {
  children:
    ReactNode;

  error?:
    boolean;
}) {
  return (
    <div className={`rounded-[18px] p-4 ${
      error
        ? "bg-red-50 text-red-700"
        : "bg-[#F5F5F2] text-[#06142E]/50"
    }`}>
      <p className="text-sm font-bold leading-5">
        {children}
      </p>
    </div>
  );
}

function challengeLabel(
  value:
    QuizRuntimeQuestion["challengeType"],
) {
  switch (
    value
  ) {
    case "history_challenge":
      return "History Challenge";

    case "higher_or_lower":
      return "Higher or Lower";

    case "whos_the_player":
      return "Who's the Player";

    default:
      return "Stats Challenge";
  }
}


async function readJson<T>(
  response:
    Response,
): Promise<T> {
  const text =
    await response.text();

  if (
    !text
  ) {
    return {} as
      T;
  }

  try {
    return JSON.parse(
      text,
    ) as
      T;
  } catch {
    return {
      error:
        response.ok
          ? "Risposta API non valida."
          : `Errore API ${response.status}. Controlla il terminale Next.js per il dettaglio.`,
    } as
      T;
  }
}

function getResponseError(
  value:
    unknown,
  fallback:
    string,
) {
  if (
    value &&
    typeof value ===
      "object" &&
    "error" in
      value &&
    typeof (
      value as {
        error?:
          unknown;
      }
    ).error ===
      "string"
  ) {
    return (
      value as {
        error:
          string;
      }
    ).error;
  }

  return fallback;
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
