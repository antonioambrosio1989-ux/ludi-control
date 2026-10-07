import type { WeeklyQuizQuestion, WeeklyQuizQuestionFamily, WeeklyQuizQuestionDifficulty, QuizPlayerIdentity, QuizHistoricalPlayerSeasonStats, QuizCurrentPlayerStats, QuizHistoricalAwardFact } from "@/src/types/GamesWeeklyQuiz";

export type Candidate = Omit<WeeklyQuizQuestion, "id" | "order" | "points"> & {
  questionFamily: WeeklyQuizQuestionFamily;
  difficulty: WeeklyQuizQuestionDifficulty;
};

export type MetricDefinition<T> = {
  family: WeeklyQuizQuestionFamily;
  label: string;
  value: (row: T) => number | undefined;
  minimum: number;
};

export type CareerProfile = {
  player: QuizPlayerIdentity;
  historical: QuizHistoricalPlayerSeasonStats[];
  current: QuizCurrentPlayerStats[];
  awards: QuizHistoricalAwardFact[];
  titleCount: number;
};

export type PlayerClue = {
  key: string;
  category: string;
  source: "historical" | "current" | "career";
  text: string;
  /** Più alto = indizio più significativo quando esistono più combinazioni valide. */
  priority: number;
  matches: (profile: CareerProfile) => boolean;
};

export type CompetitionFamily = "premier" | "championship" | string;

export type PlayerOption = {
  identityKey: string;
  label: string;
  playerId?: string;
  playerName: string;
  birthYear?: number;
  teamId?: string;
  teamName?: string;
};

export type ResolvedHistoricalPlayer = PlayerOption & {
  competitionId: string;
  seasonId: string;
  seasonName: string;
  row?: QuizHistoricalPlayerSeasonStats;
};

export type TeamTitleFact = {
  competitionId: string;
  seasonId: string;
  seasonName: string;
  phase: "regularSeason" | "finalStage";
  teamId?: string;
  teamName: string;
};

export type ComparableRow = {
  player: QuizPlayerIdentity;
  competitionId: string;
  seasonId: string;
  seasonName: string;
  teamName: string;
  value: number | undefined;
};

export type OccurrenceRankingEntry = {
  key: string;
  label: string;
  count: number;
};
