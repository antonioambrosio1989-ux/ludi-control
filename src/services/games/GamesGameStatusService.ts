import type {
  GamesGame,
} from "@/src/types/GamesGame";

export type EffectiveGamesGameStatus =
  | "waiting"
  | "active"
  | "suppressed";

export function getEffectiveGamesGameStatus(
  game:
    GamesGame,

  now:
    Date = new Date(),
): EffectiveGamesGameStatus {
  if (
    game.status ===
    "suppressed"
  ) {
    return "suppressed";
  }

  if (
    game.status ===
    "active"
  ) {
    return "active";
  }

  const activatesAt =
    toOptionalDate(
      game.activatesAt,
    );

  if (
    activatesAt &&
    activatesAt.getTime() <=
      now.getTime()
  ) {
    return "active";
  }

  return "waiting";
}

function toOptionalDate(
  value:
    unknown,
): Date | undefined {
  if (
    !value
  ) {
    return undefined;
  }

  if (
    value instanceof
    Date
  ) {
    return value;
  }

  if (
    typeof value ===
      "object" &&
    value !==
      null &&
    "toDate" in
      value &&
    typeof (
      value as {
        toDate?: unknown;
      }
    ).toDate ===
      "function"
  ) {
    return (
      value as {
        toDate: () => Date;
      }
    ).toDate();
  }

  return undefined;
}