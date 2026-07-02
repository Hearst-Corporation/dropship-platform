'use client';

import Link from 'next/link';
import { DS } from '@/lib/design/css-vars';

interface SmartStickyCTAProps {
  href: string;
  label: string;
  sublabel?: string;
}

export function SmartStickyCTA({ href, label, sublabel }: SmartStickyCTAProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3 sm:px-6" style={{ borderColor: DS.border, backgroundColor: 'var(--ds-surface)' }}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {sublabel && <p className="hidden text-sm sm:block" style={{ color: 'var(--ds-text-muted)' }}>{sublabel}</p>}
        <Link
          href={href}
          className="ml-auto inline-flex items-center rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: DS.primary }}
        >
          {label}
        </Link>
      </div>
    </div>
  );
}
