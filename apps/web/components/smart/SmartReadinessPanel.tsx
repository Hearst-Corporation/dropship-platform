'use client';

import { useEffect, useState } from 'react';
import { Subheading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/client-fetch';
import type { ReadinessResult } from '@/lib/agent/store-readiness';

interface SmartReadinessPanelProps {
  storeId: string;
  initial?: ReadinessResult | null;
}

export function SmartReadinessPanel({ storeId, initial }: SmartReadinessPanelProps) {
  const [readiness, setReadiness] = useState<ReadinessResult | null>(initial ?? null);
  const [loading, setLoading] = useState(!initial);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReadiness = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/agent/stores/${storeId}/diagnostic`);
      const data = (await res.json()) as { readiness?: ReadinessResult };
      setReadiness(data.readiness ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initial) fetchReadiness();
  }, [storeId, initial]);

  const publish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/agent/stores/${storeId}/publish`, { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      await fetchReadiness();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) return <Text>Chargement du readiness...</Text>;
  if (!readiness) return <Text>Readiness indisponible.</Text>;

  return (
    <div className="space-y-4 rounded-lg p-5 ring-1 ring-zinc-800">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Subheading>Readiness</Subheading>
          <Text className="mt-1">
            Score <span className="font-semibold tabular-nums">{readiness.score}</span>/100
          </Text>
        </div>
        <Badge color={readiness.canPublish ? 'green' : 'zinc'}>
          {readiness.canPublish ? 'Prêt à publier' : 'Bloqué'}
        </Badge>
      </div>

      {readiness.blockers.length > 0 && (
        <div className="space-y-2">
          <Text className="font-medium text-white">Blockers</Text>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-400">
            {readiness.blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {readiness.warnings.length > 0 && (
        <div className="space-y-2">
          <Text className="font-medium text-white">Warnings</Text>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-400">
            {readiness.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {readiness.nextActions.length > 0 && (
        <div className="space-y-2">
          <Text className="font-medium text-white">Actions recommandées</Text>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-400">
            {readiness.nextActions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <Text className="text-sm text-red-400">{error}</Text>}

      <div className="flex items-center gap-3 pt-2">
        <Button
          color={readiness.canPublish ? 'green' : 'zinc'}
          disabled={!readiness.canPublish || publishing}
          onClick={publish}
        >
          {publishing ? 'Publication...' : 'Publier le store'}
        </Button>
        <Button plain onClick={fetchReadiness} disabled={loading}>
          Rafraîchir
        </Button>
      </div>
    </div>
  );
}
