import AdminFantasyScreen from "@/components/admin/games/fantasy-game/AdminFantasyScreen";

type Props = {
  params:
    Promise<{
      gameId:
        string;
    }>;

  searchParams:
    Promise<{
      gamesSeasonId?:
        string;
    }>;
};

export default async function AdminFantasyPage({
  params,
  searchParams,
}: Props) {
  const {
    gameId,
  } =
    await params;

  const {
    gamesSeasonId,
  } =
    await searchParams;

  return (
    <AdminFantasyScreen
      gameId={
        gameId
      }
      gamesSeasonId={
        gamesSeasonId ?? ""
      }
    />
  );
}