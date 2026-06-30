import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

/**
 * Tailwind config — Light SaaS B2B design system.
 *
 * The admin UI is built from Tailwind Plus blocks + components/tw/ primitives
 * using standard Tailwind utilities (zinc/indigo). The bespoke dark cockpit
 * design system has been removed.
 *
 * The `admin-*` color/radius/shadow scales below are a COMPAT SHIM kept only
 * so components/ui/Button.tsx (consumed by the 24 storefront templates we
 * preserve) keeps rendering. They alias the light CSS vars in globals.css.
 */
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // Compat shim for kept storefront primitives (components/ui/Button).
        admin: {
          bg: 'var(--admin-bg)',
          'bg-subtle': 'var(--admin-bg-subtle)',
          'bg-muted': 'var(--admin-bg-muted)',
          chrome: 'var(--admin-chrome)',
          'chrome-soft': 'var(--admin-chrome-soft)',
          border: 'var(--admin-border)',
          'border-strong': 'var(--admin-border-strong)',
          'border-soft': 'var(--admin-border-soft)',
          text: 'var(--admin-text)',
          'text-secondary': 'var(--admin-text-secondary)',
          'text-muted': 'var(--admin-text-muted)',
          'text-faint': 'var(--admin-text-faint)',
          'text-inverse': 'var(--admin-text-inverse)',
          accent: 'var(--admin-accent)',
          'accent-hover': 'var(--admin-accent-hover)',
          'accent-soft': 'var(--admin-accent-soft)',
          success: 'var(--admin-success)',
          warning: 'var(--admin-warning)',
          danger: 'var(--admin-danger)',
        },
      },
      borderRadius: {
        'admin-sm': 'var(--admin-radius-sm)',
        'admin-md': 'var(--admin-radius-md)',
        'admin-lg': 'var(--admin-radius-lg)',
        'admin-xl': 'var(--admin-radius-xl)',
      },
      boxShadow: {
        'admin-card': 'var(--admin-shadow-card)',
      },
    },
  },
  plugins: [],
};

export default config;
