"use client";

import GamesGameRuntimeScreen from "@/components/games/GamesGameRuntimeScreen";

export default function AdminGameDemoScreen({
  gameId,
}: {
  gameId: string;
}) {
  return (
    <GamesGameRuntimeScreen
      gameId={gameId}
      demoMode
    />
  );
}
