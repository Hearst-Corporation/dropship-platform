import { Heading } from '@/components/catalyst/heading';
import { Text } from '@/components/catalyst/text';

export default function StoreCopilot() {
  return (
    <div className="space-y-6">
      <div>
        <Heading>Copilot</Heading>
        <Text>Assistant produit du store.</Text>
      </div>
      <div className="rounded-lg bg-white px-6 py-16 text-center ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
        <Text className="font-semibold">Copilot indisponible</Text>
        <Text className="mx-auto mt-1 max-w-md">
          Le copilot conversationnel a été retiré lors de la refonte. Il sera reconnecté
          ultérieurement sur la nouvelle base.
        </Text>
      </div>
    </div>
  );
}
