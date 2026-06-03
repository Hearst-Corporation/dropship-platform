/**
 * TAILWIND CONFIG — TOKEN-DRIVEN
 * Every value in Tailwind maps back to a CSS variable.
 * This means: change a CSS var at runtime → Tailwind utility classes update automatically.
 *
 * Features:
 *  - Token-mapped colors, spacing, typography, shadows, radius
 *  - Container queries plugin
 *  - Tailwind variants plugin
 *  - Custom utilities
 *  - Responsive breakpoints matching our spacing scale
 */

import type { Config } from "tailwindcss";
import containerQueries from "@tailwindcss/container-queries";
import typography from "@tailwindcss/typography";
import animate from "tailwindcss-animate";

// Helper: creates a CSS variable reference for Tailwind
const v = (name: string) => `var(--${name})`;
// Helper: with opacity support
const cv = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const config: Config = {
  // ─── DARK MODE ──────────────────────────────────────────────────────────────
  darkMode: ["class", "[data-theme='dark']", "[data-theme='amoled']", "[data-theme='luxury-black']", "[data-theme='neon-cyberpunk']"],

  // ─── CONTENT ─────────────────────────────────────────────────────────────────
  content: [
    "./apps/**/*.{ts,tsx}",
    "./packages/ui/src/**/*.{ts,tsx}",
    "../../apps/**/*.{ts,tsx}",
    "../../packages/**/*.{ts,tsx}",
  ],

  theme: {
    // ─── SCREENS (breakpoints) ───────────────────────────────────────────────
    screens: {
      xs:   "375px",   // small mobile
      sm:   "640px",   // mobile landscape / large mobile
      md:   "768px",   // tablet portrait
      lg:   "1024px",  // tablet landscape / small desktop
      xl:   "1280px",  // desktop
      "2xl":"1440px",  // large desktop
      "3xl":"1600px",  // ultrawide
      "4xl":"1920px",  // 4K
    },

    // ─── CONTAINERS ──────────────────────────────────────────────────────────
    container: {
      center: true,
      padding: {
        DEFAULT: v("layout-page-gutter-xs"),
        sm:      v("layout-page-gutter-sm"),
        md:      v("layout-page-gutter-md"),
        lg:      v("layout-page-gutter-md"),
        xl:      v("layout-page-gutter-lg"),
        "2xl":   v("layout-page-gutter-xl"),
      },
    },

    extend: {
      // ─── COLORS (semantic — all via CSS vars) ──────────────────────────────
      colors: {
        // Backgrounds
        bg: {
          canvas:      v("color-bg-canvas"),
          primary:     v("color-bg-primary"),
          secondary:   v("color-bg-secondary"),
          tertiary:    v("color-bg-tertiary"),
          inverse:     v("color-bg-inverse"),
          overlay:     v("color-bg-overlay"),
          glass:       v("color-bg-glass"),
          "glass-strong": v("color-bg-glassStrong"),
        },

        // Text
        text: {
          primary:    v("color-text-primary"),
          secondary:  v("color-text-secondary"),
          tertiary:   v("color-text-tertiary"),
          quaternary: v("color-text-quaternary"),
          inverse:    v("color-text-inverse"),
          link:       v("color-text-link"),
          brand:      v("color-text-brand"),
          success:    v("color-text-success"),
          warning:    v("color-text-warning"),
          error:      v("color-text-error"),
          info:       v("color-text-info"),
        },

        // Borders
        border: {
          subtle:  v("color-border-subtle"),
          DEFAULT: v("color-border-default"),
          strong:  v("color-border-strong"),
          brand:   v("color-border-brand"),
          focus:   v("color-border-focus"),
          error:   v("color-border-error"),
          success: v("color-border-success"),
        },

        // Brand
        brand: {
          DEFAULT:    v("color-brand-primary"),
          hover:      v("color-brand-primaryHover"),
          active:     v("color-brand-primaryActive"),
          subtle:     v("color-brand-primarySubtle"),
          "subtle-hover": v("color-brand-primarySubtleHover"),
          secondary:  v("color-brand-secondary"),
        },

        // Status
        success: {
          DEFAULT: v("color-status-successFill"),
          subtle:  v("color-status-successSubtle"),
          text:    v("color-status-successText"),
        },
        warning: {
          DEFAULT: v("color-status-warningFill"),
          subtle:  v("color-status-warningSubtle"),
          text:    v("color-status-warningText"),
        },
        error: {
          DEFAULT: v("color-status-errorFill"),
          subtle:  v("color-status-errorSubtle"),
          text:    v("color-status-errorText"),
        },
        info: {
          DEFAULT: v("color-status-infoFill"),
          subtle:  v("color-status-infoSubtle"),
          text:    v("color-status-infoText"),
        },

        // Interactive
        interactive: {
          hover:    v("color-interactive-hover"),
          pressed:  v("color-interactive-pressed"),
          selected: v("color-interactive-selected"),
          disabled: v("color-interactive-disabled"),
        },

        // Chart palette
        chart: {
          1: v("color-chart-1"),
          2: v("color-chart-2"),
          3: v("color-chart-3"),
          4: v("color-chart-4"),
          5: v("color-chart-5"),
          6: v("color-chart-6"),
          7: v("color-chart-7"),
          8: v("color-chart-8"),
          grid:  v("color-chart-gridLine"),
          axis:  v("color-chart-axisLabel"),
        },
      },

      // ─── SPACING ──────────────────────────────────────────────────────────
      // Extends base Tailwind scale with our custom values
      spacing: {
        "sidebar":    v("layout-sidebar-md"),
        "sidebar-sm": v("layout-sidebar-sm"),
        "sidebar-collapsed": v("layout-sidebar-collapsed"),
        "topbar":     v("layout-topbar-md"),
        "topbar-sm":  v("layout-topbar-sm"),
        "topbar-lg":  v("layout-topbar-lg"),
      },

      // ─── BORDER RADIUS ───────────────────────────────────────────────────
      borderRadius: {
        none:  v("radius-none"),
        xs:    v("radius-xs"),
        sm:    v("radius-sm"),
        DEFAULT:v("radius-md"),
        md:    v("radius-md"),
        lg:    v("radius-lg"),
        xl:    v("radius-xl"),
        "2xl": v("radius-2xl"),
        "3xl": v("radius-3xl"),
        "4xl": v("radius-4xl"),
        full:  v("radius-full"),
      },

      // ─── SHADOWS ─────────────────────────────────────────────────────────
      boxShadow: {
        none:       "none",
        xs:         v("shadow-xs"),
        sm:         v("shadow-sm"),
        DEFAULT:    v("shadow-md"),
        md:         v("shadow-md"),
        lg:         v("shadow-lg"),
        xl:         v("shadow-xl"),
        "2xl":      v("shadow-2xl"),
        floating:   v("shadow-floating"),
        overlay:    v("shadow-overlay"),
        "focus":    v("shadow-focus-ring"),
        "focus-error": v("shadow-focus-ring-error"),
        "glow":     v("shadow-glow-brand"),
        "glow-success": v("shadow-glow-success"),
        "glow-error":   v("shadow-glow-error"),
        glass:      v("shadow-glass"),
        "glass-lg": v("shadow-glass-lg"),
        "inset-xs": v("shadow-inset-xs"),
        "inset-sm": v("shadow-inset-sm"),
        "inset-md": v("shadow-inset-md"),
        "neu-raised":  v("shadow-neu-raised"),
        "neu-pressed": v("shadow-neu-pressed"),
      },

      // ─── TYPOGRAPHY ──────────────────────────────────────────────────────
      fontFamily: {
        sans:    [v("font-sans")],
        display: [v("font-display")],
        mono:    [v("font-mono")],
        serif:   [v("font-serif")],
      },

      fontSize: {
        "display-2xl": [v("text-display-2xl"), { lineHeight: v("leading-display"), letterSpacing: v("tracking-display"), fontFamily: v("font-display") }],
        "display-xl":  [v("text-display-xl"),  { lineHeight: v("leading-display"), letterSpacing: v("tracking-display"), fontFamily: v("font-display") }],
        "display-lg":  [v("text-display-lg"),  { lineHeight: v("leading-display"), letterSpacing: v("tracking-display"), fontFamily: v("font-display") }],
        "display-md":  [v("text-display-md"),  { lineHeight: v("leading-display") }],
        "display-sm":  [v("text-display-sm"),  { lineHeight: v("leading-display") }],
        "heading-2xl": [v("text-heading-2xl"), { lineHeight: v("leading-heading"), letterSpacing: v("tracking-heading") }],
        "heading-xl":  [v("text-heading-xl"),  { lineHeight: v("leading-heading"), letterSpacing: v("tracking-heading") }],
        "heading-lg":  [v("text-heading-lg"),  { lineHeight: v("leading-heading"), letterSpacing: v("tracking-heading") }],
        "heading-md":  [v("text-heading-md"),  { lineHeight: v("leading-heading"), letterSpacing: v("tracking-heading") }],
        "heading-sm":  [v("text-heading-sm"),  { lineHeight: v("leading-heading") }],
        "heading-xs":  [v("text-heading-xs"),  { lineHeight: v("leading-heading") }],
        "body-xl":     [v("text-body-xl"),     { lineHeight: v("leading-body") }],
        "body-lg":     [v("text-body-lg"),     { lineHeight: v("leading-body") }],
        "body-md":     [v("text-body-md"),     { lineHeight: v("leading-body") }],
        "body-sm":     [v("text-body-sm"),     { lineHeight: v("leading-body") }],
        "body-xs":     [v("text-body-xs"),     { lineHeight: v("leading-body") }],
        "label-lg":    [v("text-label-lg"),    { lineHeight: v("leading-caption"), letterSpacing: v("tracking-label") }],
        "label-md":    [v("text-label-md"),    { lineHeight: v("leading-caption"), letterSpacing: v("tracking-label") }],
        "label-sm":    [v("text-label-sm"),    { lineHeight: v("leading-caption"), letterSpacing: v("tracking-label") }],
        "label-xs":    [v("text-label-xs"),    { lineHeight: v("leading-caption") }],
        "overline-lg": [v("text-overline-lg"), { lineHeight: v("leading-caption"), letterSpacing: v("tracking-overline"), textTransform: "uppercase" }],
        "overline-md": [v("text-overline-md"), { lineHeight: v("leading-caption"), letterSpacing: v("tracking-overline"), textTransform: "uppercase" }],
        "overline-sm": [v("text-overline-sm"), { lineHeight: v("leading-caption"), letterSpacing: v("tracking-overline"), textTransform: "uppercase" }],
        "caption-lg":  [v("text-caption-lg"),  { lineHeight: v("leading-caption") }],
        "caption-md":  [v("text-caption-md"),  { lineHeight: v("leading-caption") }],
        "caption-sm":  [v("text-caption-sm"),  { lineHeight: v("leading-caption") }],
        "mono-lg":     [v("text-mono-lg"),     { lineHeight: v("leading-code"), fontFamily: v("font-mono") }],
        "mono-md":     [v("text-mono-md"),     { lineHeight: v("leading-code"), fontFamily: v("font-mono") }],
        "mono-sm":     [v("text-mono-sm"),     { lineHeight: v("leading-code"), fontFamily: v("font-mono") }],
        "mono-xs":     [v("text-mono-xs"),     { lineHeight: v("leading-code"), fontFamily: v("font-mono") }],
      },

      fontWeight: {
        light:     v("font-weight-light"),
        normal:    v("font-weight-regular"),
        medium:    v("font-weight-medium"),
        semibold:  v("font-weight-semibold"),
        bold:      v("font-weight-bold"),
        extrabold: v("font-weight-extrabold"),
        black:     v("font-weight-black"),
      },

      lineHeight: {
        none:    v("leading-none"),
        tight:   v("leading-tight"),
        snug:    v("leading-snug"),
        normal:  v("leading-normal"),
        relaxed: v("leading-relaxed"),
        loose:   v("leading-loose"),
        display: v("leading-display"),
        heading: v("leading-heading"),
        body:    v("leading-body"),
        caption: v("leading-caption"),
        code:    v("leading-code"),
      },

      letterSpacing: {
        tighter: v("tracking-tighter"),
        tight:   v("tracking-tight"),
        normal:  v("tracking-normal"),
        wide:    v("tracking-wide"),
        wider:   v("tracking-wider"),
        widest:  v("tracking-widest"),
        display: v("tracking-display"),
        heading: v("tracking-heading"),
        label:   v("tracking-label"),
        overline: v("tracking-overline"),
      },

      // ─── Z-INDEX ─────────────────────────────────────────────────────────
      zIndex: {
        base:      v("z-base"),
        raised:    v("z-raised"),
        above:     v("z-above"),
        sticky:    v("z-sticky"),
        docked:    v("z-docked"),
        dropdown:  v("z-dropdown"),
        popover:   v("z-popover"),
        overlay:   v("z-overlay"),
        modal:     v("z-modal"),
        drawer:    v("z-drawer"),
        toast:     v("z-toast"),
        command:   v("z-command-palette"),
      },

      // ─── CUSTOM UTILITIES ─────────────────────────────────────────────────
      backdropBlur: {
        glass:   "20px",
        "glass-sm": "12px",
        "glass-lg": "32px",
        "glass-xl": "48px",
      },

      backgroundImage: {
        "gradient-brand":   "linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))",
        "gradient-radial":  "radial-gradient(ellipse at center, var(--tw-gradient-stops))",
        "gradient-conic":   "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "gradient-shine":   "linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)",
        "noise":            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
      },

      // ─── ANIMATION ─────────────────────────────────────────────────────────
      keyframes: {
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%":   { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "scale-in": {
          "0%":   { opacity: "0", transform: "scale(0.94)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          "0%":   { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%":   { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-left": {
          "0%":   { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.5" },
        },
        "spin-slow": {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(-3%)" },
          "50%":      { transform: "translateY(0)" },
        },
        "ping-subtle": {
          "75%, 100%": { transform: "scale(1.2)", opacity: "0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-8px)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%":      { backgroundPosition: "100% 50%" },
        },
      },

      animation: {
        "fade-in":        "fade-in 0.2s var(--ease-smooth-out)",
        "fade-out":       "fade-out 0.15s var(--ease-smooth-in)",
        "scale-in":       "scale-in 0.2s var(--ease-smooth-out)",
        "slide-up":       "slide-up 0.2s var(--ease-smooth-out)",
        "slide-down":     "slide-down 0.15s var(--ease-smooth-out)",
        "slide-in-right": "slide-in-right 0.2s var(--ease-smooth-out)",
        "slide-in-left":  "slide-in-left 0.2s var(--ease-smooth-out)",
        shimmer:          "shimmer 2s linear infinite",
        "pulse-subtle":   "pulse 2s ease-in-out infinite",
        "spin-slow":      "spin-slow 3s linear infinite",
        float:            "float 3s ease-in-out infinite",
        "gradient-shift": "gradient-shift 4s ease infinite",
        "bounce-subtle":  "bounce-subtle 1s ease-in-out infinite",
      },

      // ─── TRANSITIONS ─────────────────────────────────────────────────────
      transitionTimingFunction: {
        spring:        "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "spring-gentle":"cubic-bezier(0.34, 1.30, 0.64, 1)",
        smooth:        "cubic-bezier(0.16, 1, 0.3, 1)",
        "smooth-out":  "cubic-bezier(0.22, 1, 0.36, 1)",
        "smooth-in":   "cubic-bezier(0.64, 0, 0.78, 0)",
      },

      transitionDuration: {
        75:   "75ms",
        100:  "100ms",
        150:  "150ms",
        200:  "200ms",
        250:  "250ms",
        300:  "300ms",
        350:  "350ms",
        400:  "400ms",
        500:  "500ms",
        600:  "600ms",
        700:  "700ms",
        1000: "1000ms",
      },
    },
  },

  plugins: [
    containerQueries,
    typography,
    animate,
  ],
};

export default config;
