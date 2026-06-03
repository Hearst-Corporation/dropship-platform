/**
 * Z-INDEX TOKENS
 * Explicit layering hierarchy — no magic numbers anywhere in the codebase.
 * All z-index values must reference this scale via CSS var or TS import.
 */

export const zIndex = {
  // Document flow
  base:      0,
  raised:    1,
  above:     2,

  // UI chrome
  sticky:    10,   // sticky headers, floating labels
  docked:    20,   // docked panels, sidebar when overlapping

  // Dropdowns and menus
  dropdown:  100,  // select menus, datepicker calendars
  popover:   110,  // contextual popovers
  "context-menu": 120,

  // Floating UI
  tooltip:   200,  // always on top of everything else UI
  "floating-bar": 150, // AI chat bar, floating actions

  // Overlays
  overlay:   300,  // modal scrims, drawer backgrounds
  modal:     400,  // modal dialogs
  drawer:    410,  // side drawers
  sheet:     420,  // bottom sheets

  // Top-layer elements
  toast:     500,  // toasts/notifications — above modals
  alert:     510,  // alert dialogs

  // Command interface
  "command-palette": 600, // always on top

  // Debug / dev tools
  devtools:  900,
  max:       9999,
} as const;

// CSS custom properties output
export function zIndexCssVars(): string {
  return Object.entries(zIndex)
    .map(([key, value]) => `  --z-${key}: ${value};`)
    .join("\n");
}

export type ZIndex = keyof typeof zIndex;
