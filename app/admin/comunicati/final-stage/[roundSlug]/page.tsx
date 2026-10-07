import AdminFinalStageOfficialCommunicationPage from "@/components/admin/discipline/AdminFinalStageOfficialCommunicationPage";

function parseFinalStageWeek(
  value:
    string,
): number | null {
  const match =
    /^fs(\d+)$/i.exec(
      value.trim(),
    );

  if (
    !match
  ) {
    return null;
  }

  const number =
    Number(
      match[1],
    );

  return Number.isInteger(
    number,
  ) &&
    number >
      0
    ? number
    : null;
}

export default async function Page({
  params,
}: {
  params:
    Promise<{
      roundSlug:
        string;
    }>;
}) {
  const {
    roundSlug,
  } =
    await params;

  const finalStageWeek =
    parseFinalStageWeek(
      roundSlug,
    );

  if (
    !finalStageWeek
  ) {
    return (
      <main className="p-6 text-center text-sm font-bold text-red-700">
        Settimana Final Stage non valida.
      </main>
    );
  }

  return (
    <AdminFinalStageOfficialCommunicationPage
      finalStageWeek={
        finalStageWeek
      }
    />
  );
}
