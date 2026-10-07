import type {
  WeeklyQuizKnowledgeBase,
} from "@/src/types/GamesWeeklyQuiz";

/*
 * ============================================================
 * WEEKLY QUIZ KNOWLEDGE SOURCE
 * ============================================================
 *
 * Questo è il confine tra:
 *
 * 1. database Ludi OS;
 * 2. motore di generazione Quiz.
 *
 * Il motore non deve conoscere i dettagli di MatchReport,
 * seasonPlayers, historicalPlayerSeasonStats, Hall of Fame,
 * Albo d'Oro, ecc.
 *
 * Il prossimo step implementerà FirebaseWeeklyQuizKnowledgeSource
 * traducendo le sorgenti reali del progetto in questo formato.
 * ============================================================
 */

export interface WeeklyQuizKnowledgeSource {
  buildKnowledgeBase(): Promise<
    WeeklyQuizKnowledgeBase
  >;
}
