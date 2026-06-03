'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface NavSegment {
  label: string;
  href: string;
  exact?: boolean;
}

const NAV: NavSegment[] = [
  { label: 'Dashboard', href: '/admin', exact: true },
  { label: 'Stores', href: '/admin/stores' },
  { label: 'Catalogue', href: '/admin/catalog' },
  { label: 'Commandes', href: '/admin/orders' },
  { label: 'Templates', href: '/admin/templates' },
  { label: 'Observabilité', href: '/admin/observability' },
  { label: 'Paramètres', href: '/admin/settings' },
];

export function MerchantBottomBar() {
  const pathname = usePathname();
  const [track, setTrack] = useState<Element | null>(null);

  useEffect(() => {
    // Poll until HubBottomBar (from @hearst/cockpit-shell) mounts its .ct-hub-bar-track
    let raf: number;
    function find() {
      const el = document.querySelector('.ct-hub-bar-track');
      if (el) {
        setTrack(el);
      } else {
        raf = requestAnimationFrame(find);
      }
    }
    raf = requestAnimationFrame(find);
    return () => cancelAnimationFrame(raf);
  }, []);

  function isActive(seg: NavSegment): boolean {
    if (seg.exact) return pathname === seg.href;
    return pathname.startsWith(seg.href);
  }

  if (!track) return null;

  return createPortal(
    <>
      {NAV.map((seg) => (
        <Link
          key={seg.href}
          href={seg.href}
          className={`ct-hub-bar-seg${isActive(seg) ? ' active' : ''}`}
        >
          {seg.label}
        </Link>
      ))}
    </>,
    track,
  );
}
