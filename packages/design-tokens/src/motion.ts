/**
 * MOTION TOKENS
 * Premium animation system — Apple/Linear/Arc quality.
 *
 * Principles:
 *  - Entrances: overshoot slightly (spring), feels alive
 *  - Exits:     clean easeIn, no bounce — don't fight departures
 *  - Micro:     fast, precise, <200ms
 *  - Page:      cinematic, generous timing
 *  - Reduced-motion: all durations collapse to ≤ 1ms
 */

// ─── DURATIONS ────────────────────────────────────────────────────────────────

export const duration = {
  instant:  "0ms",
  "75":     "75ms",
  "100":    "100ms",
  "150":    "150ms",
  "200":    "200ms",  // micro interactions
  "250":    "250ms",
  "300":    "300ms",  // standard UI
  "350":    "350ms",
  "400":    "400ms",  // modal open
  "500":    "500ms",
  "600":    "600ms",  // page transitions
  "700":    "700ms",
  "1000":   "1000ms", // hero animations
  "1500":   "1500ms", // loading sequences
} as const;

// ─── EASINGS ──────────────────────────────────────────────────────────────────

export const easing = {
  // Standard CSS easings
  linear:      "linear",
  ease:        "ease",
  "ease-in":   "ease-in",
  "ease-out":  "ease-out",
  "ease-in-out":"ease-in-out",

  // Custom cubic-bezier curves — Apple-inspired
  "spring":         "cubic-bezier(0.34, 1.56, 0.64, 1)",    // overshoot, feels alive
  "spring-gentle":  "cubic-bezier(0.34, 1.30, 0.64, 1)",    // subtle spring
  "spring-snappy":  "cubic-bezier(0.34, 1.80, 0.64, 1)",    // dramatic spring

  "smooth":         "cubic-bezier(0.16, 1, 0.3, 1)",        // fast start, smooth settle
  "smooth-out":     "cubic-bezier(0.22, 1, 0.36, 1)",       // entrance easing
  "smooth-in":      "cubic-bezier(0.64, 0, 0.78, 0)",       // exit easing

  "decelerate":     "cubic-bezier(0.0, 0.0, 0.2, 1)",       // Material decelerate
  "accelerate":     "cubic-bezier(0.4, 0.0, 1, 1)",         // Material accelerate
  "standard":       "cubic-bezier(0.4, 0.0, 0.2, 1)",       // Material standard

  "elastic":        "cubic-bezier(0.68, -0.55, 0.265, 1.55)", // elastic bounce
  "back-in":        "cubic-bezier(0.36, 0, 0.66, -0.56)",   // anticipation
  "back-out":       "cubic-bezier(0.34, 1.56, 0.64, 1)",    // follow-through

  "button-press":   "cubic-bezier(0.16, 1, 0.3, 1)",        // snappy press response
  "menu-open":      "cubic-bezier(0.22, 1, 0.36, 1)",       // menu entrance
  "modal-enter":    "cubic-bezier(0.16, 1, 0.3, 1)",        // modal scale-in
  "modal-exit":     "cubic-bezier(0.4, 0, 1, 1)",           // modal fade-out
  "tooltip":        "cubic-bezier(0.16, 1, 0.3, 1)",        // tooltip pop
  "page":           "cubic-bezier(0.22, 1, 0.36, 1)",       // page slide
} as const;

// ─── SPRING PHYSICS (Framer Motion) ──────────────────────────────────────────

export const spring = {
  // stiffness + damping + mass
  "snappy": {
    type:      "spring",
    stiffness: 500,
    damping:   30,
    mass:      0.8,
  },
  "smooth": {
    type:      "spring",
    stiffness: 350,
    damping:   25,
    mass:      1,
  },
  "gentle": {
    type:      "spring",
    stiffness: 200,
    damping:   20,
    mass:      1,
  },
  "bouncy": {
    type:      "spring",
    stiffness: 600,
    damping:   15,
    mass:      0.8,
  },
  "stiff": {
    type:      "spring",
    stiffness: 800,
    damping:   40,
    mass:      0.6,
  },
  "wobbly": {
    type:      "spring",
    stiffness: 180,
    damping:   12,
    mass:      1.2,
  },
  // Button press — instant feedback
  "button": {
    type:      "spring",
    stiffness: 700,
    damping:   35,
    mass:      0.5,
  },
  // Modal entrance
  "modal": {
    type:      "spring",
    stiffness: 300,
    damping:   28,
    mass:      1,
  },
  // Sidebar slide
  "sidebar": {
    type:      "spring",
    stiffness: 280,
    damping:   26,
    mass:      0.9,
  },
} as const;

// ─── TRANSITION PRESETS ───────────────────────────────────────────────────────
// CSS transition shorthand presets for non-Framer components

export const transition = {
  // Micro — hover, focus, active
  "micro-fast":   `all ${duration[100]} ${easing["smooth-out"]}`,
  "micro":        `all ${duration[150]} ${easing["smooth-out"]}`,
  "micro-slow":   `all ${duration[200]} ${easing["smooth-out"]}`,

  // Color only — performance-safe (composited)
  "color":        `color ${duration[150]} ${easing["smooth-out"]}, background-color ${duration[150]} ${easing["smooth-out"]}, border-color ${duration[150]} ${easing["smooth-out"]}`,

  // Transform only — GPU-accelerated
  "transform":    `transform ${duration[200]} ${easing["spring-gentle"]}`,
  "transform-fast":"transform ${duration[150]} ${easing["spring-gentle"]}`,

  // Opacity — fades
  "fade":         `opacity ${duration[200]} ${easing["smooth-out"]}`,
  "fade-fast":    `opacity ${duration[150]} ${easing["smooth-out"]}`,

  // Shadow elevation on hover
  "shadow":       `box-shadow ${duration[200]} ${easing["smooth-out"]}`,

  // Standard interactive elements
  "interactive":  `color ${duration[150]} ${easing["smooth-out"]}, background-color ${duration[150]} ${easing["smooth-out"]}, border-color ${duration[150]} ${easing["smooth-out"]}, box-shadow ${duration[200]} ${easing["smooth-out"]}, transform ${duration[150]} ${easing["spring-gentle"]}`,

  // Input focus ring
  "input":        `border-color ${duration[150]} ${easing["smooth-out"]}, box-shadow ${duration[200]} ${easing["smooth-out"]}`,
} as const;

// ─── FRAMER MOTION VARIANT PRESETS ────────────────────────────────────────────

export const motionVariants = {
  // Fade
  fadeIn: {
    initial:  { opacity: 0 },
    animate:  { opacity: 1, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } },
    exit:     { opacity: 0, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } },
  },

  // Scale + fade (modal, popover)
  scaleIn: {
    initial:  { opacity: 0, scale: 0.94 },
    animate:  { opacity: 1, scale: 1, transition: spring.modal },
    exit:     { opacity: 0, scale: 0.96, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } },
  },

  // Slide up (toast, bottom sheet)
  slideUp: {
    initial:  { opacity: 0, y: 12 },
    animate:  { opacity: 1, y: 0, transition: spring.smooth },
    exit:     { opacity: 0, y: 8, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } },
  },

  // Slide down (dropdown, menu)
  slideDown: {
    initial:  { opacity: 0, y: -8 },
    animate:  { opacity: 1, y: 0, transition: spring.snappy },
    exit:     { opacity: 0, y: -4, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } },
  },

  // Slide in from left (sidebar, drawer)
  slideInLeft: {
    initial:  { opacity: 0, x: -20 },
    animate:  { opacity: 1, x: 0, transition: spring.sidebar },
    exit:     { opacity: 0, x: -16, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } },
  },

  // Slide in from right
  slideInRight: {
    initial:  { opacity: 0, x: 20 },
    animate:  { opacity: 1, x: 0, transition: spring.sidebar },
    exit:     { opacity: 0, x: 16, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } },
  },

  // Page transition
  pageTransition: {
    initial:  { opacity: 0, y: 8, filter: "blur(4px)" },
    animate:  { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
    exit:     { opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } },
  },

  // Stagger children
  staggerContainer: {
    initial:  {},
    animate:  { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
  },

  // Individual stagger child
  staggerItem: {
    initial:  { opacity: 0, y: 8 },
    animate:  { opacity: 1, y: 0, transition: spring.smooth },
  },

  // Button press
  buttonTap: {
    whileTap:  { scale: 0.97, transition: spring.button },
    whileHover: { scale: 1.01, transition: spring.button },
  },

  // Icon button press
  iconButtonTap: {
    whileTap:  { scale: 0.92, transition: spring.button },
    whileHover: { scale: 1.06, transition: spring.snappy },
  },

  // Skeleton shimmer
  skeleton: {
    animate: {
      backgroundPosition: ["200% 0", "-200% 0"],
      transition: { duration: 1.5, repeat: Infinity, ease: "linear" },
    },
  },

  // Pulse loader
  pulse: {
    animate: {
      scale: [1, 1.05, 1],
      opacity: [0.7, 1, 0.7],
      transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
    },
  },
} as const;

// ─── REDUCED MOTION ───────────────────────────────────────────────────────────
// Override at runtime: if prefers-reduced-motion, collapse all durations

export const reducedMotion = {
  duration: "1ms",
  spring: { ...spring.stiff, duration: 0.001 },
} as const;

export type Duration = keyof typeof duration;
export type Easing   = keyof typeof easing;
export type Spring   = keyof typeof spring;
