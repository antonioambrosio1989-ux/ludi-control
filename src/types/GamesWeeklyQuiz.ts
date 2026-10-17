export const WEEKLY_QUIZ_QUESTION_COUNT = 7;
export const WEEKLY_QUIZ_POINTS_PER_QUESTION = 100;
export const WEEKLY_QUIZ_DURATION_DAYS = 7;
export const WEEKLY_QUIZ_GENERATION_VERSION = 12;

/** I valori persistiti restano compatibili con le settimane già salvate. */
export type WeeklyQuizChallengeType =
  | "stats_challenge"
  | "history_challenge"
  | "higher_or_lower"
  | "whos_the_player";

export type WeeklyQuizQuestionKind = "multiple_choice" | "higher_or_lower";
export type WeeklyQuizWeekStatus = "draft" | "published" | "closed";

export type HistoricalQuestionFamily =
  | "champion"
  | "final"
  | "best_player"
  | "best_goalkeeper"
  | "top_scorer"
  | "top_scorer_goals"
  | "final_record"
  | "historical_record";

export type CurrentQuestionFamily =
  | "goals"
  | "assists"
  | "mvp"
  | "appearances"
  | "average_vote"
  | "clean_sheets";

export type WeeklyQuizQuestionFamily =
  | HistoricalQuestionFamily
  | CurrentQuestionFamily
  | "higher_or_lower"
  | "whos_the_player";

export type WeeklyQuizQuestionDifficulty = "easy" | "medium" | "hard";

export type WeeklyQuizSourceSnapshot = {
  generatedAtMs: number;
  competitionIds: string[];
  seasonIds: string[];
  playerIds: string[];
  teamIds: string[];
  facts: Record<string, string | number | boolean | null>;
};

export type WeeklyQuizQuestion = {
  id: string;
  order: number;
  challengeType: WeeklyQuizChallengeType;
  kind: WeeklyQuizQuestionKind;
  prompt: string;
  answers: string[];
  answerImageUrls?: string[];
  correctAnswerIndex: number;
  points: number;
  explanation: string;
  fingerprint: string;
  sourceSnapshot: WeeklyQuizSourceSnapshot;
  /** Opzionali per leggere senza migrazione le settimane già salvate. */
  questionFamily?: WeeklyQuizQuestionFamily;
  difficulty?: WeeklyQuizQuestionDifficulty;
};

export type WeeklyQuizWeek = {
  id: string;
  gamesSeasonId: string;
  gameId: string;
  weekNumber: number;
  startsAt: unknown;
  endsAt: unknown;
  status: WeeklyQuizWeekStatus;
  questionCount: number;
  maxScore: number;
  generationVersion: number;
  generatedAt?: unknown;
  publishedAt?: unknown;
  closedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type WeeklyQuizWeekWithQuestions = WeeklyQuizWeek & {
  questions: WeeklyQuizQuestion[];
};

/** Composizione editoriale fissa: 3 storiche + 2 correnti + 1 + 1. */
export type WeeklyQuizMix = {
  statsChallenge: number;
  historyChallenge: number;
  higherOrLower: number;
  whosThePlayer: number;
};

export const DEFAULT_WEEKLY_QUIZ_MIX: WeeklyQuizMix = {
  statsChallenge: 2,
  historyChallenge: 3,
  higherOrLower: 1,
  whosThePlayer: 1,
};

export type WeeklyQuizGenerationConfig = {
  questionCount: number;
  pointsPerQuestion: number;
  durationDays: number;
  currentMinAppearanceRate: number;
  historicalMinAppearances: number;
  recentFingerprintWeeks: number;
  mix: WeeklyQuizMix;
};

export const DEFAULT_WEEKLY_QUIZ_GENERATION_CONFIG: WeeklyQuizGenerationConfig = {
  questionCount: WEEKLY_QUIZ_QUESTION_COUNT,
  pointsPerQuestion: WEEKLY_QUIZ_POINTS_PER_QUESTION,
  durationDays: WEEKLY_QUIZ_DURATION_DAYS,
  currentMinAppearanceRate: 0.4,
  historicalMinAppearances: 4,
  recentFingerprintWeeks: 10,
  mix: DEFAULT_WEEKLY_QUIZ_MIX,
};

export type QuizPlayerIdentity = {
  playerId: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  birthYear?: number;
  photoUrl?: string;
};

export type QuizTeamIdentity = {
  teamId: string;
  teamName: string;
  competitionId: string;
  seasonId: string;
};

export type QuizCurrentPlayerStats = {
  player: QuizPlayerIdentity;
  team: QuizTeamIdentity;
  seasonName: string;
  appearances: number;
  availableTeamMatches: number;
  goals: number;
  assists: number;
  mvp: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  averageVote?: number;
  cleanSheets?: number;
  goalsConceded?: number;
};

export type QuizHistoricalPlayerSeasonStats = {
  player: QuizPlayerIdentity;
  teamId?: string;
  teamName?: string;
  competitionId: string;
  seasonId: string;
  seasonName: string;
  appearances: number;
  goals: number;
  assists: number;
  ownGoals: number;
  yellowCards: number;
  redCards: number;
  averageVote?: number;
};

export type QuizHistoricalFinalScorer = {
  playerId?: string;
  playerName: string;
  goals: number;
};

export type QuizHistoricalFinalFact = {
  id: string;
  competitionId: string;
  seasonId: string;
  seasonName: string;
  competitionName: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  winnerTeamId: string;
  winnerTeamName: string;
  scorerPlayerIds: string[];
  scorerNames: string[];
  /** Opzionali per mantenere compatibili fixture e snapshot di generazione v1. */
  scorers?: QuizHistoricalFinalScorer[];
  hatTrickScorerNames?: string[];
  decisiveScorerPlayerId?: string;
  decisiveScorerName?: string;
};

export type QuizHistoricalAwardFact = {
  id: string;
  competitionId: string;
  competitionName?: string;
  seasonId: string;
  seasonName: string;
  award: string;
  awardLabel: string;
  /** Sezione Hall of Fame originale, utile per riconoscere la Top Five. */
  section?:
    | "bestOfSeason"
    | "teamOfSeason"
    | "goalAndSave"
    | "otherAwards";
  /** Ordine dell'elemento nella sezione Hall of Fame. */
  sortOrder?: number;
  /** Tipo di vincitore originale della Hall of Fame. */
  winnerType?: "player" | "team" | "custom";
  playerId?: string;
  playerName?: string;
  /** Anno di nascita, quando disponibile, per distinguere gli omonimi. */
  birthYear?: number;
  teamId?: string;
  teamName?: string;
  /** Per esempio, i gol ufficiali del capocannoniere. */
  value?: number;
};

export type QuizHistoricalTeamTitleFact = {
  id: string;
  competitionId: string;
  seasonId: string;
  seasonName: string;
  phase: "regularSeason" | "finalStage";
  title: string;
  teamId: string;
  teamName: string;
};

/** Titolo di squadra esplicitamente registrato nel palmarès del giocatore. */
export type QuizHistoricalPlayerPalmaresTitle = {
  playerId: string;
  competitionId: string;
  seasonId: string;
  phase: "regularSeason" | "finalStage";
  title: string;
};

export type WeeklyQuizKnowledgeBase = {
  generatedAtMs: number;
  currentPlayers: QuizCurrentPlayerStats[];
  historicalPlayerSeasons: QuizHistoricalPlayerSeasonStats[];
  historicalFinals: QuizHistoricalFinalFact[];
  historicalAwards: QuizHistoricalAwardFact[];
  /**
   * Titoli di squadra ricavati dal Palmarès giocatori.
   * Opzionale per mantenere compatibili fixture e snapshot precedenti.
   */
  historicalTeamTitles?: QuizHistoricalTeamTitleFact[];
  /** Solo i titoli effettivamente presenti nel palmarès del singolo giocatore. */
  historicalPlayerPalmaresTitles?: QuizHistoricalPlayerPalmaresTitle[];
};

export type WeeklyQuizGenerationInput = {
  gamesSeasonId: string;
  gameId: string;
  weekNumber: number;
  startsAt: Date;
  endsAt: Date;
  knowledgeBase: WeeklyQuizKnowledgeBase;
  recentFingerprints: string[];
  config?: Partial<WeeklyQuizGenerationConfig>;
};

export type WeeklyQuizGeneratedWeek = {
  week: Omit<
    WeeklyQuizWeek,
    "generatedAt" | "publishedAt" | "closedAt" | "createdAt" | "updatedAt"
  >;
  questions: WeeklyQuizQuestion[];
  rejectedCandidateCount: number;
  availableCandidateCount: number;
};
