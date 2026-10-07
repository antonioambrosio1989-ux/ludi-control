import AdminVotingPollBuilder from "@/components/admin/games/voting/AdminVotingPollBuilder";

export default async function Page({
  params,
}: {
  params: Promise<{ gameId: string; pollId: string }>;
}) {
  const { gameId, pollId } = await params;
  return <AdminVotingPollBuilder gameId={gameId} pollId={pollId} />;
}
