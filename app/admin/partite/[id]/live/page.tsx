import AdminLiveMatchScreen from "@/components/admin/matches/AdminLiveMatchScreen";

export default async function Page({
  params,
}: {
  params:
    Promise<{
      id: string;
    }>;
}) {
  const {
    id,
  } =
    await params;

  return (
    <AdminLiveMatchScreen
      matchId={
        id
      }
    />
  );
}
