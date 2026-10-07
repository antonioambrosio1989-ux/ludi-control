import AdminGameBuilderScreen from "@/components/admin/games/AdminGameBuilderScreen";

export default async function Page({
  params,
}: {
  params:
    Promise<{
      gameId:
        string;
    }>;
}) {
  const {
    gameId,
  } =
    await params;

  return (
    <AdminGameBuilderScreen
      gameId={
        gameId
      }
    />
  );
}
