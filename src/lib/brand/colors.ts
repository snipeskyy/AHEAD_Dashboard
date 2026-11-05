/** Brand color math (pure): derive accessible UI tokens from one or two brand hex colors. */

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

export const rgbToHex = (c: Rgb) =>
  `#${c
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

const lin = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export const luminance = ([r, g, b]: Rgb) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

export function contrast(a: Rgb, b: Rgb) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb =>
  [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as Rgb;

/** Moves `c` toward black (or white) until it reaches `min` contrast against `bg`. */
export function ensureContrast(c: Rgb, bg: Rgb, min: number): Rgb {
  if (contrast(c, bg) >= min) return c;
  const target: Rgb = luminance(bg) > 0.5 ? [0, 0, 0] : [255, 255, 255];
  for (let t = 0.05; t <= 1; t += 0.05) {
    const next = mix(c, target, t);
    if (contrast(next, bg) >= min) return next;
  }
  return target;
}

export interface BrandTokens {
  light: { primary: string; primaryForeground: string; soft: string };
  dark: { primary: string; primaryForeground: string; soft: string };
  /** True when a brand color had to be adjusted to stay readable (WCAG AA 4.5:1). */
  adjusted: boolean;
}

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const LIGHT_BG: Rgb = [246, 246, 244]; // --background (light): the darker of page and card
const DARK_BG: Rgb = [24, 24, 23]; // --card (dark): the lighter of page and card

/**
 * Light mode uses the brand color as-is when it reads on white (links, focus, buttons);
 * otherwise a darker shade of the same hue. Dark mode uses `primaryDark` or a lighter shade.
 */
export function deriveBrandTokens(primaryHex: string, primaryDarkHex?: string): BrandTokens | null {
  const p = hexToRgb(primaryHex);
  if (!p) return null;
  const pd = (primaryDarkHex && hexToRgb(primaryDarkHex)) || mix(p, WHITE, 0.35);
  const light = ensureContrast(p, LIGHT_BG, 4.5);
  const dark = ensureContrast(pd, DARK_BG, 4.5);
  const fg = (c: Rgb) => (contrast(c, WHITE) >= contrast(c, BLACK) ? "#ffffff" : "#0b0b0b");
  return {
    light: {
      primary: rgbToHex(light),
      primaryForeground: fg(light),
      soft: rgbToHex(mix(light, WHITE, 0.9)),
    },
    dark: {
      primary: rgbToHex(dark),
      primaryForeground: fg(dark),
      soft: `rgba(${dark.map(Math.round).join(", ")}, 0.16)`,
    },
    adjusted:
      rgbToHex(light) !== rgbToHex(p) || (!!primaryDarkHex && rgbToHex(dark) !== rgbToHex(pd)),
  };
}

/** CSS for the "brand" accent, injected by the root layout. */
export function brandCss(t: BrandTokens) {
  return [
    `:root[data-accent="brand"]{--primary:${t.light.primary};--primary-foreground:${t.light.primaryForeground};--brand-soft:${t.light.soft};--ring:${t.light.primary};}`,
    `:root.dark[data-accent="brand"]{--primary:${t.dark.primary};--primary-foreground:${t.dark.primaryForeground};--brand-soft:${t.dark.soft};--ring:${t.dark.primary};}`,
  ].join("\n");
}
