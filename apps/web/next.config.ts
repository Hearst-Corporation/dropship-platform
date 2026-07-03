import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

/**
 * Security headers applied site-wide. Notes:
 *  - HSTS: 2-year max-age with includeSubDomains + preload-ready value. Once
 *    set in prod, removing it is a multi-year process (browsers remember).
 *  - Permissions-Policy: lock down browser APIs we don't use. `payment=(self
 *    "https://js.stripe.com")` is mandatory for Apple Pay / Google Pay via
 *    Stripe Payment Elements, do NOT remove.
 *  - CSP: defensive but pragmatic. `script-src 'self' 'unsafe-inline'` is
 *    required by Next.js (inline bootstrap + hydration scripts); `'unsafe-eval'`
 *    is added only in dev (React Refresh / Turbopack need it). `object-src
 *    'none'` and `base-uri 'self'` close off plugin and base-tag injection.
 *    `style-src` keeps 'unsafe-inline' (Next inline styles + the storefront
 *    design-token <style> block). We deliberately do NOT lock down
 *    connect-src/img-src yet (Stripe Elements, supplier CDNs, fal.ai/R2,
 *    Sentry tunnel) — adding those blind would risk a white-screen on paid
 *    traffic. Tighten those via a Report-Only header first.
 */

// In Vercel production, restrict frame-ancestors to 'self' only.
// localhost:4200/4201 are needed only in local dev (Hearst Hub Electron webview).
const isVercelProd = process.env.VERCEL_ENV === 'production';
const frameAncestors = isVercelProd
  ? "'self'"
  : "'self' http://localhost:4200 http://localhost:4201";

// Next.js needs 'unsafe-eval' on script-src in dev (React Refresh / Turbopack).
// In prod we drop it: only 'self' + 'unsafe-inline' (Next bootstrap scripts).
const isProd = process.env.NODE_ENV === 'production';
const scriptSrc = isProd
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const CSP_DIRECTIVES = [
  scriptSrc,
  // Next.js inline styles + the storefront design-token <style> block.
  // Google Fonts stylesheets are loaded by the storefront templates
  // (Instrument Serif, Inter Tight, Poppins…) — without this allowance the
  // CSP silently drops them and every template renders in fallback type.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "object-src 'none'",
  "base-uri 'self'",
  `frame-ancestors ${frameAncestors}`,
];

const SECURITY_HEADERS = [
  // X-Frame-Options replaced by CSP frame-ancestors below so the Hearst Hub
  // (Electron webview on localhost:4200/4201) can embed Merchant while all
  // other origins remain blocked.
  // { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Content-Security-Policy',
    value: CSP_DIRECTIVES.join('; '),
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Permissions-Policy',
    value: [
      'accelerometer=()',
      'autoplay=()',
      'camera=()',
      'display-capture=()',
      'encrypted-media=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'payment=(self "https://js.stripe.com")',
      'picture-in-picture=()',
      'publickey-credentials-get=()',
      'sync-xhr=()',
      'usb=()',
      'xr-spatial-tracking=()',
    ].join(', '),
  },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ];
  },
  images: {
    // Whitelist of remote hosts the <Image> component is allowed to load.
    // Suppliers (AliExpress, CJ Dropshipping) serve product images on their
    // own CDNs; Shopify is included because some Medusa imports keep their
    // original Shopify CDN URLs. fal.ai / R2 are for AI-generated assets.
    remotePatterns: [
      { protocol: 'https', hostname: '**.alicdn.com' },
      { protocol: 'https', hostname: '**.aliexpress-media.com' },
      { protocol: 'https', hostname: '**.cjdropshipping.com' },
      { protocol: 'https', hostname: 'oss-cf.cjdropshipping.com' },
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      { protocol: 'https', hostname: '**.fal.media' },
      { protocol: 'https', hostname: 'fal.media' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
      // Deterministic placeholder images for AI-generated synthetic catalogs
      // (both AliExpress + CJ supplier search failed) — see
      // fetchProductImage() in lib/agent/store-creator.ts.
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry build plugin: uploads source maps so stack traces in the
  // dashboard point at original TS, and tunnels client events through
  // /monitoring on our own domain to bypass ad blockers.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Sentry v10 deletes source maps after upload by default, so they
  // never end up served from /_next/static — no need for an explicit
  // hideSourceMaps flag.
  tunnelRoute: '/monitoring',
  // v10 moved bundler-related toggles under `webpack`. Keeping the old
  // top-level `disableLogger` / `automaticVercelMonitors` triggers a
  // deprecation warning on every build.
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: false,
  },
});
