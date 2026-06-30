'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart2,
  Package,
  SlidersHorizontal,
  Bot,
  Image,
  type LucideIcon,
} from 'lucide-react';

// ── Tab definitions ───────────────────────────────────────────────────────────

interface StoreTab {
  id: string;
  label: string;
  /** Route with [id] placeholder replaced by storeId at render time. */
  routePattern: string;
  Icon: LucideIcon;
  /** When true, active only on exact pathname match. */
  exact?: boolean;
}

const STORE_TABS: readonly StoreTab[] = [
  {
    id: 'overview',
    label: 'Détails',
    routePattern: '/admin/stores/[id]',
    Icon: LayoutDashboard,
    exact: true,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    routePattern: '/admin/stores/[id]/analytics',
    Icon: BarChart2,
  },
  {
    id: 'catalog',
    label: 'Catalogue',
    routePattern: '/admin/stores/[id]/catalog',
    Icon: Package,
  },
  {
    id: 'settings',
    label: 'Réglages',
    routePattern: '/admin/stores/[id]/settings',
    Icon: SlidersHorizontal,
  },
  {
    id: 'copilot',
    label: 'Copilote',
    routePattern: '/admin/stores/[id]/copilot',
    Icon: Bot,
  },
  {
    id: 'assets',
    label: 'Médias',
    routePattern: '/admin/stores/[id]/assets',
    Icon: Image,
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
      className="flex shrink-0 gap-6 overflow-x-auto border-b border-white/10"
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
                ? 'border-indigo-400 font-semibold text-white'
                : 'border-transparent font-medium text-gray-400 hover:border-white/20 hover:text-gray-200',
            ].join(' ')}
          >
            <tab.Icon size={16} strokeWidth={1.75} aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default StoreTabsBar;
