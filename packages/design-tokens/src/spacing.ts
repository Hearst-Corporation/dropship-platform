/**
 * SPACING TOKENS
 * 4px base grid — every spacing value is a multiple of 4px.
 * Scale extends into semantic layout, container, and section tokens.
 */

// ─── BASE SCALE ──────────────────────────────────────────────────────────────
// All values in rem (1rem = 16px at browser default)

export const spacing = {
  0:   "0rem",          //   0px
  px:  "0.0625rem",     //   1px — hairlines only
  0.5: "0.125rem",      //   2px
  1:   "0.25rem",       //   4px
  1.5: "0.375rem",      //   6px
  2:   "0.5rem",        //   8px
  2.5: "0.625rem",      //  10px
  3:   "0.75rem",       //  12px
  3.5: "0.875rem",      //  14px
  4:   "1rem",          //  16px — base unit
  5:   "1.25rem",       //  20px
  6:   "1.5rem",        //  24px
  7:   "1.75rem",       //  28px
  8:   "2rem",          //  32px
  9:   "2.25rem",       //  36px
  10:  "2.5rem",        //  40px
  11:  "2.75rem",       //  44px — touch target
  12:  "3rem",          //  48px
  14:  "3.5rem",        //  56px
  16:  "4rem",          //  64px
  18:  "4.5rem",        //  72px
  20:  "5rem",          //  80px
  24:  "6rem",          //  96px
  28:  "7rem",          // 112px
  32:  "8rem",          // 128px
  36:  "9rem",          // 144px
  40:  "10rem",         // 160px
  44:  "11rem",         // 176px
  48:  "12rem",         // 192px
  52:  "13rem",         // 208px
  56:  "14rem",         // 224px
  60:  "15rem",         // 240px
  64:  "16rem",         // 256px
  72:  "18rem",         // 288px
  80:  "20rem",         // 320px
  96:  "24rem",         // 384px
} as const;

// ─── SEMANTIC LAYOUT SPACING ──────────────────────────────────────────────────

export const layoutSpacing = {
  // Component-internal padding
  "component-xs":  spacing[2],   //  8px — chips, tags
  "component-sm":  spacing[3],   // 12px — small buttons
  "component-md":  spacing[4],   // 16px — default buttons
  "component-lg":  spacing[5],   // 20px — large inputs
  "component-xl":  spacing[6],   // 24px — XL buttons

  // Inset (x+y padding together as shorthand reference)
  "inset-xs":  `${spacing[1]} ${spacing[2]}`,    //  4px 8px
  "inset-sm":  `${spacing[1.5]} ${spacing[3]}`,  //  6px 12px
  "inset-md":  `${spacing[2]} ${spacing[4]}`,    //  8px 16px
  "inset-lg":  `${spacing[3]} ${spacing[6]}`,    // 12px 24px
  "inset-xl":  `${spacing[4]} ${spacing[8]}`,    // 16px 32px

  // Stack (vertical rhythm between elements)
  "stack-2xs": spacing[1],    //  4px
  "stack-xs":  spacing[2],    //  8px
  "stack-sm":  spacing[3],    // 12px
  "stack-md":  spacing[4],    // 16px
  "stack-lg":  spacing[6],    // 24px
  "stack-xl":  spacing[8],    // 32px
  "stack-2xl": spacing[12],   // 48px
  "stack-3xl": spacing[16],   // 64px

  // Section spacing (large blocks)
  "section-xs":  spacing[10],  //  40px
  "section-sm":  spacing[14],  //  56px
  "section-md":  spacing[20],  //  80px
  "section-lg":  spacing[24],  //  96px
  "section-xl":  spacing[32],  // 128px
  "section-2xl": spacing[40],  // 160px

  // Page containers
  "container-sm":  "640px",
  "container-md":  "768px",
  "container-lg":  "1024px",
  "container-xl":  "1280px",
  "container-2xl": "1440px",
  "container-3xl": "1600px",
  "container-full":"100%",

  // Sidebar dimensions
  "sidebar-collapsed":  "3.5rem",  // 56px — icon rail
  "sidebar-sm":         "15rem",   // 240px
  "sidebar-md":         "16.5rem", // 264px
  "sidebar-lg":         "18rem",   // 288px

  // Topbar height
  "topbar-sm":  "3rem",   // 48px
  "topbar-md":  "3.5rem", // 56px
  "topbar-lg":  "4rem",   // 64px

  // Page gutter
  "page-gutter-xs":  spacing[4],   // 16px — mobile
  "page-gutter-sm":  spacing[6],   // 24px — tablet
  "page-gutter-md":  spacing[8],   // 32px — desktop
  "page-gutter-lg":  spacing[12],  // 48px — wide
  "page-gutter-xl":  spacing[16],  // 64px — ultrawide
} as const;

// ─── GRID TOKENS ─────────────────────────────────────────────────────────────

export const grid = {
  cols: {
    1:  "repeat(1, minmax(0, 1fr))",
    2:  "repeat(2, minmax(0, 1fr))",
    3:  "repeat(3, minmax(0, 1fr))",
    4:  "repeat(4, minmax(0, 1fr))",
    6:  "repeat(6, minmax(0, 1fr))",
    8:  "repeat(8, minmax(0, 1fr))",
    12: "repeat(12, minmax(0, 1fr))",
    auto: "repeat(auto-fill, minmax(0, 1fr))",
  },
  gap: {
    xs:  spacing[2],   //  8px
    sm:  spacing[4],   // 16px
    md:  spacing[6],   // 24px
    lg:  spacing[8],   // 32px
    xl:  spacing[10],  // 40px
    "2xl": spacing[12],// 48px
  },
} as const;

export type Spacing      = keyof typeof spacing;
export type LayoutSpacing = keyof typeof layoutSpacing;
