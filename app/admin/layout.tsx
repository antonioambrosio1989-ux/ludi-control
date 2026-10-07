import AdminGuard from "@/components/admin/AdminGuard";
import ControlFrame from "@/components/control/ControlFrame";

export default function AdminLayout({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <AdminGuard>
      <ControlFrame>
        {children}
      </ControlFrame>
    </AdminGuard>
  );
}
