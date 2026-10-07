"use client";

import AdminWeeklyQuizPanel from "@/components/admin/games/quiz/AdminWeeklyQuizPanel";

import type {
  GamesGame,
} from "@/src/types/GamesGame";

/**
 * Il Quiz pubblico usa esclusivamente la Weekly Challenge.
 * Il precedente editor manuale non fa più parte del flusso applicativo.
 */
export default function AdminQuizBuilder({
  game,
}: {
  game:
    GamesGame;
}) {
  return (
    <AdminWeeklyQuizPanel
      game={
        game
      }
    />
  );
}
