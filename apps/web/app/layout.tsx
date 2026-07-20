import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Dropship Platform',
  description: 'Dropship admin & integrations',
  // Google Search Console / Merchant Center site verification.
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
};

// data-accent : indigo (défaut dropship) | fuchsia | bordeaux | amber | emerald | teal | blue | violet
// Bascule côté client via lib/accent.ts (localStorage).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const tiktokVerif = process.env.NEXT_PUBLIC_TIKTOK_SITE_VERIFICATION;
  return (
    <html
      lang="fr"
      data-accent="indigo"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {tiktokVerif && (
          <meta name="tiktok-developers-site-verification" content={tiktokVerif} />
        )}
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-zinc-950 font-sans">
        {children}
      </body>
    </html>
  );
}
