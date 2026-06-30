// Pass-through frame. The bespoke cockpit-shell chrome (RailLeft/RailRight + Kimi
// chat) was removed in the Tailwind reset. Admin chrome is now provided by the
// AppShell built from Tailwind Plus blocks, mounted in app/admin/(app)/layout.tsx.
// Storefront routes render their children directly (StoreShell handles their chrome).
export default function AppFrame({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
