'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog, DialogBackdrop, DialogPanel, TransitionChild } from '@headlessui/react';
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  BuildingStorefrontIcon,
  CubeIcon,
  ShoppingBagIcon,
  Squares2X2Icon,
  ChartBarIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils/cn';

/**
 * AdminAppShell — admin chrome from Tailwind Plus application-shells__sidebar
 * (off-white, light SaaS). Static sidebar on desktop, slide-over on mobile.
 * No proprietary tokens, no parallel theme.
 */
type NavItem = {
  name: string;
  href: string;
  icon: typeof HomeIcon;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { name: 'Dashboard', href: '/admin', icon: HomeIcon, exact: true },
  { name: 'Stores', href: '/admin/stores', icon: BuildingStorefrontIcon },
  { name: 'Catalogue', href: '/admin/catalog', icon: CubeIcon },
  { name: 'Commandes', href: '/admin/orders', icon: ShoppingBagIcon },
  { name: 'Templates', href: '/admin/templates', icon: Squares2X2Icon },
  { name: 'Observabilité', href: '/admin/observability', icon: ChartBarIcon },
  { name: 'Réglages', href: '/admin/settings', icon: Cog6ToothIcon },
];

function isActive(pathname: string | null, href: string, exact?: boolean): boolean {
  if (!pathname) return false;
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <ul role="list" className="-mx-2 space-y-1">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        return (
          <li key={item.name}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6',
                active
                  ? 'bg-zinc-100 text-indigo-600'
                  : 'text-zinc-700 hover:bg-zinc-100 hover:text-indigo-600',
              )}
            >
              <item.icon
                aria-hidden
                className={cn(
                  'size-6 shrink-0',
                  active ? 'text-indigo-600' : 'text-zinc-400 group-hover:text-indigo-600',
                )}
              />
              {item.name}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Brand() {
  return (
    <div className="flex h-16 shrink-0 items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
        H
      </span>
      <span className="text-sm font-semibold tracking-tight text-zinc-900">Hearst Merchant</span>
    </div>
  );
}

export function AdminAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Mobile slide-over */}
      <Dialog open={sidebarOpen} onClose={setSidebarOpen} className="relative z-50 lg:hidden">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-zinc-900/80 transition-opacity duration-300 ease-linear data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 flex">
          <DialogPanel
            transition
            className="relative mr-16 flex w-full max-w-xs flex-1 transform transition duration-300 ease-in-out data-[closed]:-translate-x-full"
          >
            <TransitionChild>
              <div className="absolute left-full top-0 flex w-16 justify-center pt-5 duration-300 ease-in-out data-[closed]:opacity-0">
                <button type="button" onClick={() => setSidebarOpen(false)} className="-m-2.5 p-2.5">
                  <span className="sr-only">Fermer le menu</span>
                  <XMarkIcon aria-hidden className="size-6 text-white" />
                </button>
              </div>
            </TransitionChild>
            <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-2">
              <Brand />
              <nav className="flex flex-1 flex-col">
                <NavLinks pathname={pathname} onNavigate={() => setSidebarOpen(false)} />
              </nav>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Static desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-zinc-200 bg-white px-6">
          <Brand />
          <nav className="flex flex-1 flex-col">
            <NavLinks pathname={pathname} />
          </nav>
        </div>
      </div>

      {/* Mobile topbar */}
      <div className="sticky top-0 z-40 flex items-center gap-x-6 border-b border-zinc-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="-m-2.5 p-2.5 text-zinc-700 hover:text-zinc-900"
        >
          <span className="sr-only">Ouvrir le menu</span>
          <Bars3Icon aria-hidden className="size-6" />
        </button>
        <div className="flex-1 text-sm font-semibold text-zinc-900">Hearst Merchant</div>
      </div>

      <main className="py-8 lg:pl-72">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
