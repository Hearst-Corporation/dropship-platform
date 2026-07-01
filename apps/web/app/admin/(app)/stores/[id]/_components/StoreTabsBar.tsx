'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Squares2X2Icon,
  ChartBarIcon,
  CubeIcon,
  AdjustmentsHorizontalIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';

// ── Tab definitions ───────────────────────────────────────────────────────────

type HeroIcon = typeof Squares2X2Icon;

interface StoreTab {
  id: string;
  label: string;
  /** Route with [id] placeholder replaced by storeId at render time. */
  routePattern: string;
  Icon: HeroIcon;
  /** When true, active only on exact pathname match. */
  exact?: boolean;
}

const STORE_TABS: readonly StoreTab[] = [
  {
    id: 'overview',
    label: 'Détails',
    routePattern: '/admin/stores/[id]',
    Icon: Squares2X2Icon,
    exact: true,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    routePattern: '/admin/stores/[id]/analytics',
    Icon: ChartBarIcon,
  },
  {
    id: 'catalog',
    label: 'Catalogue',
    routePattern: '/admin/stores/[id]/catalog',
    Icon: CubeIcon,
  },
  {
    id: 'settings',
    label: 'Réglages',
    routePattern: '/admin/stores/[id]/settings',
    Icon: AdjustmentsHorizontalIcon,
  },
  {
    id: 'assets',
    label: 'Médias',
    routePattern: '/admin/stores/[id]/assets',
    Icon: PhotoIcon,
  },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

interface StoreTabsBarProps {
  storeId: string;
}

export function StoreTabsBar({ storeId }: StoreTabsBarProps) {
  const pathname = usePathname() ?? '';

  function resolveRoute(tab: StoreTab): string {
    return tab.routePattern.replace('[id]', storeId);
  }

  function isActive(tab: StoreTab): boolean {
    const route = resolveRoute(tab);
    if (tab.exact) return pathname === route;
    return pathname === route || pathname.startsWith(route + '/');
  }

  return (
    <nav
      role="tablist"
      aria-label="Onglets du store"
      className="flex shrink-0 gap-6 overflow-x-auto border-b border-zinc-950/10 dark:border-white/10"
    >
      {STORE_TABS.map((tab) => {
        const active = isActive(tab);
        return (
          <Link
            key={tab.id}
            href={resolveRoute(tab)}
            role="tab"
            aria-selected={active}
            className={[
              'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm transition-colors',
              active
                ? 'border-indigo-500 font-semibold text-zinc-950 dark:border-indigo-400 dark:text-white'
                : 'border-transparent font-medium text-zinc-500 hover:border-zinc-950/20 hover:text-zinc-800 dark:text-zinc-400 dark:hover:border-white/20 dark:hover:text-zinc-200',
            ].join(' ')}
          >
            <tab.Icon className="size-4" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default StoreTabsBar;
