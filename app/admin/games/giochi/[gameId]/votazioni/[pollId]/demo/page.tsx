import VotingGameScreen from "@/components/games/voting/VotingGameScreen";

export default async function Page({
  params,
}: {
  params: Promise<{ gameId: string; pollId: string }>;
}) {
  const { gameId, pollId } = await params;

  return (
    <VotingGameScreen
      gameId={gameId}
      demoMode
      demoPollId={pollId}
    />
  );
}
