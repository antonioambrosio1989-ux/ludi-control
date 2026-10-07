import AdminGameDemoScreen from "@/components/admin/games/demo/AdminGameDemoScreen";

export default async function Page({
  params,
}: {
  params: Promise<{
    gameId: string;
  }>;
}) {
  const {
    gameId,
  } = await params;

  return (
    <AdminGameDemoScreen
      gameId={gameId}
    />
  );
}
