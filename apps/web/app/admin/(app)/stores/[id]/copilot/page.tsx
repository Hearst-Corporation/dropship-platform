import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminCard } from '@/components/admin/AdminCard';

export default function StoreCopilot() {
  return (
    <div className="space-y-6">
      <AdminPageHeader eyebrow="Store" title="Copilot" description="Assistant produit du store." />
      <AdminCard className="px-6 py-16 text-center">
        <p className="text-sm font-semibold text-white">Copilot indisponible</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-400">
          Le copilot conversationnel a été retiré lors de la refonte. Il sera reconnecté
          ultérieurement sur la nouvelle base.
        </p>
      </AdminCard>
    </div>
  );
}
