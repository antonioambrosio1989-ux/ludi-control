export type WeeklyQuizParticipationReason =
  | "admin_preview"
  | "free"
  | "games_pass"
  | "purchase_required";

export type WeeklyQuizAttemptStatus =
  | "in_progress"
  | "completed"
  | "abandoned";

export type QuizRuntimeQuestion = {
  id:
    string;

  order:
    number;

  challengeType:
    | "stats_challenge"
    | "history_challenge"
    | "higher_or_lower"
    | "whos_the_player";

  kind:
    | "multiple_choice"
    | "higher_or_lower";

  prompt:
    string;

  answers:
    string[];

  answerImageUrls?:
    string[];

  points:
    number;
};

export type QuizWeeklyLeaderboardEntry = {
  position:
    number;

  userId:
    string;

  displayName:
    string;

  score:
    number;

  maxScore:
    number;

  percent:
    number;

  correctCount:
    number;

  status:
    "completed" | "abandoned";
};

export type QuizSeasonLeaderboardEntry = {
  position:
    number;

  userId:
    string;

  displayName:
    string;

  totalScore:
    number;

  totalMaxScore:
    number;

  totalPercent:
    number;

  totalCorrect:
    number;

  completedWeeks:
    number;
};

export type QuizMyWeeklyResult = {
  status:
    WeeklyQuizAttemptStatus;

  score:
    number;

  maxScore:
    number;

  percent:
    number;

  correctCount:
    number;

  questionCount:
    number;
};

export type QuizPublicState = {
  game: {
    id:
      string;

    name:
      string;

    priceCents:
      number;

    status:
      string;
  };

  week:
    | {
        id:
          string;

        weekNumber:
          number;

        startsAtMs:
          number;

        endsAtMs:
          number;

        questionCount:
          number;

        maxScore:
          number;
      }
    | null;

  participation: {
    canParticipate:
      boolean;

    reason:
      WeeklyQuizParticipationReason;

    previewMode:
      boolean;

    hasAttempt:
      boolean;

    canStart:
      boolean;

    attemptStatus:
      WeeklyQuizAttemptStatus | null;
  };

  myWeeklyResult:
    QuizMyWeeklyResult | null;

  weeklyLeaderboard:
    QuizWeeklyLeaderboardEntry[];

  seasonLeaderboard:
    QuizSeasonLeaderboardEntry[];
};

export type QuizStartResponse = {
  attemptId:
    string;

  previewMode:
    boolean;

  resumed:
    boolean;

  answeredCount:
    number;

  weekId:
    string;

  weekNumber:
    number;

  questions:
    QuizRuntimeQuestion[];
};

export type QuizAnswerRequest = {
  attemptId:
    string;

  questionId:
    string;

  selectedAnswerPosition:
    number;
};

export type QuizAnswerResponse = {
  accepted:
    boolean;

  answeredCount:
    number;

  questionCount:
    number;

  isComplete:
    boolean;

  feedback: {
    questionId:
      string;

    selectedAnswerPosition:
      number;

    correctAnswerPosition:
      number;

    isCorrect:
      boolean;

    earnedPoints:
      number;

    maxPoints:
      number;

    explanation:
      string;
  };
};

export type QuizQuestionResult = {
  questionId:
    string;

  order:
    number;

  challengeType:
    QuizRuntimeQuestion["challengeType"];

  prompt:
    string;

  answers:
    string[];

  selectedAnswerPosition:
    number | null;

  correctAnswerPosition:
    number;

  isCorrect:
    boolean;

  earnedPoints:
    number;

  maxPoints:
    number;

  explanation:
    string;
};

export type QuizFinishResponse = {
  status:
    "completed" | "abandoned";

  score:
    number;

  maxScore:
    number;

  percent:
    number;

  correctCount:
    number;

  questionCount:
    number;

  previewMode:
    boolean;

  results:
    QuizQuestionResult[];

  weeklyLeaderboard:
    QuizWeeklyLeaderboardEntry[];

  seasonLeaderboard:
    QuizSeasonLeaderboardEntry[];
};
