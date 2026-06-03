"use client";

/**
 * THEME PROVIDER
 * Runtime theme switching with zero flash.
 * Applies theme via data-theme attribute on <html>.
 * Persists preference to localStorage.
 * Respects prefers-color-scheme on first load.
 *
 * Usage:
 *   <ThemeProvider defaultTheme="dark" storageKey="app-theme">
 *     {children}
 *   </ThemeProvider>
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ThemeName } from "../../design-tokens/src/colors.semantic";

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleDark: () => void;
  isDark: boolean;
  resolvedTheme: ThemeName;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── PROVIDER ─────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeName;
  storageKey?: string;
  /** Force a specific theme regardless of user preference */
  forcedTheme?: ThemeName;
  /** Tenant ID — adds [data-tenant="id"] for white-label overrides */
  tenantId?: string;
  /** Disable system preference detection */
  disableSystemPreference?: boolean;
}

const DARK_THEMES: ThemeName[] = ["dark", "amoled", "luxury-black", "neon-cyberpunk"];

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "ds-theme",
  forcedTheme,
  tenantId,
  disableSystemPreference = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (forcedTheme) return forcedTheme;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey) as ThemeName | null;
      if (stored) return stored;
    }
    if (!disableSystemPreference && typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : defaultTheme;
    }
    return defaultTheme;
  });

  // Apply to DOM
  useEffect(() => {
    const root = document.documentElement;
    const applied = forcedTheme ?? theme;

    root.setAttribute("data-theme", applied);

    // Also expose as CSS class for Tailwind dark: variant compatibility
    root.classList.remove(...Object.keys(DARK_THEMES).map((t) => `theme-${t}`));
    root.classList.add(`theme-${applied}`);

    if (DARK_THEMES.includes(applied)) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    if (tenantId) {
      root.setAttribute("data-tenant", tenantId);
    }
  }, [theme, forcedTheme, tenantId]);

  // Persist preference
  const setTheme = useCallback(
    (next: ThemeName) => {
      if (forcedTheme) return;
      setThemeState(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // ignore storage errors
      }
    },
    [forcedTheme, storageKey]
  );

  const toggleDark = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const isDark = DARK_THEMES.includes(forcedTheme ?? theme);
  const resolvedTheme = forcedTheme ?? theme;

  const value = useMemo(
    () => ({ theme, setTheme, toggleDark, isDark, resolvedTheme }),
    [theme, setTheme, toggleDark, isDark, resolvedTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── HOOK ──────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

// ─── SSR ANTI-FLASH SCRIPT ─────────────────────────────────────────────────────
// Inject this <script> tag as the FIRST child of <head> to prevent FOUC.

export function ThemeScript({
  storageKey = "ds-theme",
  defaultTheme = "light",
}: {
  storageKey?: string;
  defaultTheme?: ThemeName;
}) {
  const script = `
(function() {
  try {
    var stored = localStorage.getItem('${storageKey}');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored || (prefersDark ? 'dark' : '${defaultTheme}');
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.add('theme-' + theme);
    if (['dark','amoled','luxury-black','neon-cyberpunk'].includes(theme)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
})();
`.trim();

  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}

// ─── THEME TOGGLE BUTTON ──────────────────────────────────────────────────────

export function ThemeToggle() {
  const { theme, setTheme, isDark } = useTheme();

  const themes: { value: ThemeName; label: string }[] = [
    { value: "light",           label: "Light" },
    { value: "dark",            label: "Dark" },
    { value: "amoled",          label: "AMOLED" },
    { value: "luxury-black",    label: "Luxury" },
    { value: "glass",           label: "Glass" },
    { value: "enterprise",      label: "Enterprise" },
    { value: "neon-cyberpunk",  label: "Neon" },
    { value: "minimal-mono",    label: "Mono" },
  ];

  return (
    <div style={{ display: "flex", gap: "var(--spacing-2)", flexWrap: "wrap" }}>
      {themes.map((t) => (
        <button
          key={t.value}
          onClick={() => setTheme(t.value)}
          style={{
            padding: "var(--spacing-1) var(--spacing-3)",
            borderRadius: "var(--radius-full)",
            border: `1px solid ${theme === t.value ? "var(--color-border-brand)" : "var(--color-border-default)"}`,
            background: theme === t.value ? "var(--color-brand-primarySubtle)" : "transparent",
            color: theme === t.value ? "var(--color-text-brand)" : "var(--color-text-secondary)",
            fontSize: "var(--text-label-sm)",
            fontWeight: "var(--font-weight-medium)",
            cursor: "pointer",
            transition: "var(--transition-interactive)",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
