import AdminFinalStageLiveMatchScreen from "@/components/admin/final-stage/AdminFinalStageLiveMatchScreen";

export default async function Page({
  params,
}: {
  params:
    Promise<{
      id:
        string;
    }>;
}) {
  const {
    id,
  } =
    await params;

  return (
    <AdminFinalStageLiveMatchScreen
      matchId={
        id
      }
    />
  );
}
