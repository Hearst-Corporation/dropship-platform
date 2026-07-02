'use client';

import Link from 'next/link';
import type { StoreConfig } from '@/lib/store-config';
import { StoreLogo } from '@/components/ui';
import { DS, dsClass } from '@/lib/design/css-vars';

interface SmartStoreShellProps {
  store: StoreConfig;
  children: React.ReactNode;
}

export function SmartStoreShell({ store, children }: SmartStoreShellProps) {
  return (
    <div className={`min-h-screen ${dsClass.bg} ${dsClass.text}`} style={{ fontFamily: DS.fontBody }}>
      <nav
        aria-label="Navigation principale"
        className={`sticky top-0 z-30 border-b ${dsClass.border} backdrop-blur-md`}
        style={{ backgroundColor: 'color-mix(in srgb, var(--ds-bg) 90%, transparent)' }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href={`/shop/${store.slug}`} className="flex items-center gap-2">
            <StoreLogo emoji={store.logoEmoji} size={22} strokeWidth={1.5} />
            <span className="text-sm font-semibold tracking-tight">{store.name}</span>
          </Link>
          <Link
            href="/cart"
            className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-opacity hover:opacity-70 ${dsClass.border}`}
            aria-label="Panier"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="size-4"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
              />
            </svg>
            Panier
          </Link>
        </div>
      </nav>

      <main>{children}</main>
    </div>
  );
}
