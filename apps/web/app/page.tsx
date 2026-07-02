import { redirect } from 'next/navigation';

// Hearst Dropship runs as a portfolio of per-store storefronts at /shop/{slug}
// (or each store's own custom domain). The root path is reserved for the
// admin: visiting `/` lands operators on the portfolio dashboard.
export default function RootPage() {
  redirect('/admin');
}
