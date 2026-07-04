'use client';

import { useEffect, useState, type ReactNode } from 'react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function computeTimeLeft(targetMs: number): TimeLeft | null {
  const diff = targetMs - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Small client island for the `street-drop` template's live countdown.
 * Renders `fallback` (or nothing, if omitted) when `targetIso` is absent or
 * already elapsed. Liveness is decided here — client-side, on each tick —
 * rather than by the parent server component, so the server render never
 * needs to call `Date.now()`.
 */
export function StreetDropCountdown({
  targetIso,
  fallback = null,
}: {
  targetIso?: string | null;
  fallback?: ReactNode;
}) {
  const targetMs = targetIso ? new Date(targetIso).getTime() : null;
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    if (!targetMs) return;
    const tick = () => setTimeLeft(computeTimeLeft(targetMs));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (!targetMs || !timeLeft) return <>{fallback}</>;

  return (
    <span className="font-mono tabular-nums" aria-live="polite">
      {timeLeft.days > 0 && `${timeLeft.days}j `}
      {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
    </span>
  );
}
