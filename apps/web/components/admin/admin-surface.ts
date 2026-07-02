/**
 * Shared Tailwind surface tokens for the admin densify kit.
 *
 * Design policy (dark-only admin, Catalyst-like):
 *   - The deep black page background lives ONLY in the Catalyst shell / layout.
 *   - Admin sections/cards use a single subtle raised surface so they sit
 *     slightly above the page without creating nested black boxes.
 *   - Inset surfaces (tables, code, nested form wells) are a hair darker than panels.
 *   - Borders are one consistent opacity family.
 *   - No `dark:` variants are needed here: the admin root already forces `.dark`.
 */

/** Primary card / panel / section surface. */
export const adminPanel = "border border-white/[0.08] bg-white/[0.02]";

/** Header row inside a panel. */
export const adminSectionHeader =
  "border-b border-white/[0.08] bg-white/[0.03]";

/** Slightly raised wash for highlighted panels (dashboard hero, etc.). */
export const adminHighlightWash = "bg-white/[0.03]";

/** Inset / well surface for tables, code blocks, nested form wells. */
export const adminInset = "bg-white/[0.03]";

/** Hover state for inset rows. */
export const adminInsetHover = "hover:bg-white/[0.05]";

/** Standard border. */
export const adminBorder = "border-white/[0.08]";

/** Subtle divider / separator. */
export const adminDivider = "border-white/[0.08]";

/** Muted secondary text. */
export const adminTextMuted = "text-zinc-400";

/** Primary text on dark surfaces. */
export const adminText = "text-zinc-100";

/** Removed the gradient hairline; kept empty for a strict flat accent line. */
export const adminAccentTop = "";
