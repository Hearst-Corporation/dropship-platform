import { AdminLayoutClient } from './AdminLayoutClient';
import { SuperAgentRail } from '@/components/admin/SuperAgentRail';

export const revalidate = 0;

export default function AdminAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLayoutClient>
      {children}
      <SuperAgentRail />
    </AdminLayoutClient>
  );
}
