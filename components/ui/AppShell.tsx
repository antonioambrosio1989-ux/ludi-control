type AppShellProps = {
  children:
    React.ReactNode;
};

export default function AppShell({
  children,
}: AppShellProps) {
  return (
    <div className="w-full min-w-0 max-w-full text-[#06142E]">
      {children}
    </div>
  );
}
