import type { CSSProperties } from "react";

/** Pick black or white text for best contrast against a hex background. */
export function contrastColor(hex: string): string {
  const c = hex.replace("#", "");
  const full =
    c.length === 3
      ? c
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : c;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  // Relative luminance
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#14201a" : "#ffffff";
}

/**
 * Build the inline CSS variable style for a course-themed subtree so all
 * `course`/`course-secondary` Tailwind utilities adopt the tenant's brand.
 */
export function courseThemeStyle(
  primary?: string | null,
  secondary?: string | null
): CSSProperties {
  const p = primary || "#0d3522";
  const s = secondary || "#c9a84c";
  return {
    ["--course-primary" as string]: p,
    ["--course-secondary" as string]: s,
    ["--course-primary-contrast" as string]: contrastColor(p),
  };
}
