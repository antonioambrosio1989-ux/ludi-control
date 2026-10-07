import AdminMatchWizard from "@/components/admin/match-editor/AdminMatchWizard";

type AdminMatchReportPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminMatchReportPage({
  params,
}: AdminMatchReportPageProps) {
  const { id } = await params;

  return <AdminMatchWizard matchId={id} />;
}