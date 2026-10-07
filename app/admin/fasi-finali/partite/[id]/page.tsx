import AdminMatchWizard from "@/components/admin/match-editor/AdminMatchWizard";

type AdminFinalStageMatchPageProps = {
  params:
    Promise<{
      id:
        string;
    }>;
};

export default async function AdminFinalStageMatchPage({
  params,
}: AdminFinalStageMatchPageProps) {
  const {
    id,
  } =
    await params;

  return (
    <AdminMatchWizard
      matchId={
        id
      }
      mode="finalStage"
    />
  );
}