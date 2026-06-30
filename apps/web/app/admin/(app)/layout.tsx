import { AdminAppShell } from '@/components/admin/AdminAppShell';

export const revalidate = 0;

export default function AdminAppLayout({ children }: { children: React.ReactNode }) {
  return <AdminAppShell>{children}</AdminAppShell>;
}
