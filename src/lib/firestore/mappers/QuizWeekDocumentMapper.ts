import type { WeeklyQuizQuestion, WeeklyQuizWeek } from "@/src/types/GamesWeeklyQuiz";

export function normalizeWeek(
  id:
    string,
  value:
    Record<
      string,
      unknown
    >,
): WeeklyQuizWeek {
  return {
    id,

    gamesSeasonId:
      normalizeString(
        value.gamesSeasonId,
      ),

    gameId:
      normalizeString(
        value.gameId,
      ),

    weekNumber:
      normalizeInteger(
        value.weekNumber,
      ),

    startsAt:
      value.startsAt,

    endsAt:
      value.endsAt,

    status:
      value.status ===
        "published" ||
      value.status ===
        "closed"
        ? value.status
        : "draft",

    questionCount:
      normalizeInteger(
        value.questionCount,
      ),

    maxScore:
      normalizeInteger(
        value.maxScore,
      ),

    generationVersion:
      normalizeInteger(
        value.generationVersion,
      ),

    generatedAt:
      value.generatedAt,

    publishedAt:
      value.publishedAt,

    closedAt:
      value.closedAt,

    createdAt:
      value.createdAt,

    updatedAt:
      value.updatedAt,
  };
}

export function normalizeQuestion(
  id:
    string,
  value:
    Record<
      string,
      unknown
    >,
): WeeklyQuizQuestion {
  return {
    id,

    order:
      normalizeInteger(
        value.order,
      ),

    challengeType:
      value.challengeType ===
        "history_challenge" ||
      value.challengeType ===
        "higher_or_lower" ||
      value.challengeType ===
        "whos_the_player"
        ? value.challengeType
        : "stats_challenge",

    kind:
      value.kind ===
      "higher_or_lower"
        ? "higher_or_lower"
        : "multiple_choice",

    prompt:
      normalizeString(
        value.prompt,
      ),

    answers:
      Array.isArray(
        value.answers,
      )
        ? value.answers.map(
            (
              answer,
            ) =>
              String(
                answer,
              ),
          )
        : [],

    answerImageUrls:
      Array.isArray(value.answerImageUrls)
        ? value.answerImageUrls.map((imageUrl) => normalizeString(imageUrl))
        : [],

    correctAnswerIndex:
      normalizeInteger(
        value.correctAnswerIndex,
      ),

    points:
      normalizeInteger(
        value.points,
      ),

    explanation:
      normalizeString(
        value.explanation,
      ),

    fingerprint:
      normalizeString(
        value.fingerprint,
      ),

    sourceSnapshot:
      (
        value.sourceSnapshot ??
        {
          generatedAtMs:
            0,
          competitionIds:
            [],
          seasonIds:
            [],
          playerIds:
            [],
          teamIds:
            [],
          facts:
            {},
        }
      ) as WeeklyQuizQuestion["sourceSnapshot"],
  };
}

export function normalizeString(
  value:
    unknown,
): string {
  return typeof value ===
    "string"
    ? value
    : "";
}

export function normalizeInteger(
  value:
    unknown,
): number {
  return typeof value ===
      "number" &&
    Number.isInteger(
      value,
    )
    ? value
    : 0;
}
