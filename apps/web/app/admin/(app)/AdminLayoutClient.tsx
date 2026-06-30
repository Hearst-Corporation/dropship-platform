'use client';

import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  BuildingStorefrontIcon,
  CubeIcon,
  ShoppingBagIcon,
  Squares2X2Icon,
  ChartBarIcon,
  Cog6ToothIcon,
} from '@heroicons/react/20/solid';
import { SidebarLayout } from '@/components/catalyst/sidebar-layout';
import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from '@/components/catalyst/sidebar';
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from '@/components/catalyst/navbar';

/**
 * Admin chrome — Catalyst SidebarLayout (official kit). Dark forced via the
 * `.dark` wrapper so Catalyst components render in dark mode.
 */
type NavItem = { name: string; href: string; icon: typeof HomeIcon; exact?: boolean };

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

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const sidebar = (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-500 text-sm font-bold text-white">
            H
          </span>
          <span className="text-sm font-semibold text-zinc-950 dark:text-white">Hearst Merchant</span>
        </div>
      </SidebarHeader>
      <SidebarBody>
        <SidebarSection>
          {NAV.map((item) => (
            <SidebarItem key={item.name} href={item.href} current={isActive(pathname, item.href, item.exact)}>
              <item.icon data-slot="icon" />
              <SidebarLabel>{item.name}</SidebarLabel>
            </SidebarItem>
          ))}
        </SidebarSection>
      </SidebarBody>
    </Sidebar>
  );

  const navbar = (
    <Navbar>
      <NavbarSpacer />
      <NavbarSection>
        <NavbarItem href="/admin" aria-label="Dashboard">
          Hearst Merchant
        </NavbarItem>
      </NavbarSection>
    </Navbar>
  );

  return (
    <div className="dark">
      <SidebarLayout sidebar={sidebar} navbar={navbar}>
        {/* Reserve space on the right for the fixed SuperAgent rail (lg:w-96). */}
        <div className="lg:pr-96">{children}</div>
      </SidebarLayout>
    </div>
  );
}
