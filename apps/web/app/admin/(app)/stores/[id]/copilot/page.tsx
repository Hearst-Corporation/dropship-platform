import { Heading, Subheading } from "@/components/catalyst/heading";
import { Text } from "@/components/catalyst/text";
import { Button } from "@/components/catalyst/button";

export default async function StoreCopilot({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-8">
      <div>
        <Heading>Copilot</Heading>
        <Text>Assistant produit du store.</Text>
      </div>
      <div>
        <Subheading>Gérer le catalogue</Subheading>
        <Text className="mt-2 max-w-md">
          Le copilot conversationnel sera reconnecté ultérieurement. En
          attendant, ajoute et gère les produits directement depuis le catalogue
          du store.
        </Text>
        <div className="mt-4">
          <Button color="indigo" href={`/admin/stores/${id}/catalog`}>
            Ouvrir le catalogue
          </Button>
        </div>
      </div>
    </div>
  );
}
