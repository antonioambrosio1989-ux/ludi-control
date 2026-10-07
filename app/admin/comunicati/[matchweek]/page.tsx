import AdminOfficialCommunicationPage from "@/components/admin/discipline/AdminOfficialCommunicationPage";

type PageProps = {
  params:
    Promise<{
      matchweek:
        string;
    }>;
};

export default async function Page({
  params,
}: PageProps) {
  const {
    matchweek,
  } =
    await params;

  return (
    <AdminOfficialCommunicationPage
      matchweekParam={
        matchweek
      }
    />
  );
}