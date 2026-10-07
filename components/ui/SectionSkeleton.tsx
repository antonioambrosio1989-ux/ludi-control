export default function SectionSkeleton({
  label = "Caricamento...",
  rows = 3,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div role="status" aria-label={label} className="rounded-[13px] border border-[#06142E]/5 bg-white p-5">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
        <div className="h-5 w-2/5 rounded bg-[#06142E]/10" />
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="h-12 rounded-lg bg-[#06142E]/5" />
        ))}
      </div>
    </div>
  );
}
