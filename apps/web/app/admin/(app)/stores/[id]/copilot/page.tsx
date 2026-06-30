import { Heading, Subheading } from '@/components/catalyst/heading';
import { Text } from '@/components/catalyst/text';

export default function StoreCopilot() {
  return (
    <div className="space-y-8">
      <div>
        <Heading>Copilot</Heading>
        <Text>Assistant produit du store.</Text>
      </div>
      <div>
        <Subheading>Copilot indisponible</Subheading>
        <Text className="mt-2 max-w-md">
          Le copilot conversationnel a été retiré lors de la refonte. Il sera reconnecté
          ultérieurement sur la nouvelle base.
        </Text>
      </div>
    </div>
  );
}
