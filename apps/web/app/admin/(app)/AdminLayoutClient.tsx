"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  BuildingStorefrontIcon,
  CubeIcon,
  ShoppingBagIcon,
  Squares2X2Icon,
  ChartBarIcon,
  Cog6ToothIcon,
} from "@heroicons/react/20/solid";
import { SidebarLayout } from "@/components/catalyst/sidebar-layout";
import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from "@/components/catalyst/sidebar";
import {
  Navbar,
  NavbarItem,
  NavbarSection,
  NavbarSpacer,
} from "@/components/catalyst/navbar";
import { SuperAgentRail } from "@/components/admin/SuperAgentRail";

/**
 * Admin chrome — Catalyst SidebarLayout (official kit). Dark forced via the
 * `.dark` wrapper so Catalyst components render in dark mode.
 */
type NavItem = {
  name: string;
  href: string;
  icon: typeof HomeIcon;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { name: "Dashboard", href: "/admin", icon: HomeIcon, exact: true },
  { name: "Stores", href: "/admin/stores", icon: BuildingStorefrontIcon },
  { name: "Catalogue", href: "/admin/catalog", icon: CubeIcon },
  { name: "Commandes", href: "/admin/orders", icon: ShoppingBagIcon },
  { name: "Templates", href: "/admin/templates", icon: Squares2X2Icon },
  { name: "Observabilité", href: "/admin/observability", icon: ChartBarIcon },
  { name: "Réglages", href: "/admin/settings", icon: Cog6ToothIcon },
];

function isActive(
  pathname: string | null,
  href: string,
  exact?: boolean,
): boolean {
  if (!pathname) return false;
  return exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Dark is class-based (.dark wrapper below covers the SSR paint), but
  // Headless UI v2 Dialogs (mobile nav sidebar, agent drawer) portal into
  // document.body, OUTSIDE the wrapper. Mirror the class on <html> so the
  // portals (and the overscroll area) render dark too.
  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, []);

  const sidebar = (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-sm font-bold text-white shadow-sm shadow-indigo-500/30">
            H
          </span>
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">
              Hearst Merchant
            </span>
            <span className="block text-admin-kicker font-medium uppercase tracking-wider text-indigo-500 text-indigo-400">
              Dropship
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarBody>
        <SidebarSection>
          {NAV.map((item) => (
            <SidebarItem
              key={item.name}
              href={item.href}
              current={isActive(pathname, item.href, item.exact)}
            >
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
      <NavbarSection>
        <NavbarItem href="/admin" aria-label="Dashboard">
          Hearst Merchant
        </NavbarItem>
      </NavbarSection>
      <NavbarSpacer />
    </Navbar>
  );

  return (
    <div className="dark">
      <SidebarLayout sidebar={sidebar} navbar={navbar}>
        <div className="min-w-0 xl:pr-96">{children}</div>
        <SuperAgentRail />
      </SidebarLayout>
    </div>
  );
}
