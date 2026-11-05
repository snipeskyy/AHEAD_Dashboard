import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { brandCss, deriveBrandTokens, type BrandTokens } from "./colors";

/**
 * Optional local brand pack: `brand/brand.json` + logo files in `brand/`.
 * The folder is git-ignored (only README + example are committed), so company logos and
 * trademarks stay on the machine that uses them and never reach the repository.
 */
// ACC_BRAND_DIR lets tests point at a fixture pack (or none) instead of your real one.
export const BRAND_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.env.ACC_BRAND_DIR || path.join(process.cwd(), "brand"),
);
/** Runtime-only path into the brand folder (not traced into the build output). */
const brandPath = (name: string) => path.join(/*turbopackIgnore: true*/ BRAND_DIR, name);

const File = z
  .string()
  .regex(
    /^[\w.-]+\.(svg|png|webp|jpe?g)$/i,
    "Use a file name in brand/ ending in .svg, .png, .webp or .jpg",
  );
const Hex = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, "Use a hex color like #1a2b3c");

export const BrandPackSchema = z.object({
  appName: z.string().trim().min(1).max(60).optional(),
  wordmark: z.string().trim().min(1).max(12).optional(),
  tagline: z.string().trim().max(80).optional(),
  logo: File.optional(),
  logoDark: File.optional(),
  mark: File.optional(),
  colors: z.object({ primary: Hex, primaryDark: Hex.optional() }).optional(),
  /** Shown in the sidebar footer / exports, e.g. "Internal use only". */
  footerNote: z.string().trim().max(80).optional(),
});
export type BrandPackFile = z.infer<typeof BrandPackSchema>;

export interface BrandPack extends Omit<BrandPackFile, "colors"> {
  tokens: BrandTokens | null;
  css: string | null;
  error: string | null;
  /** Asset keys that exist on disk. */
  assets: Array<"logo" | "logoDark" | "mark">;
}

const EMPTY: BrandPack = { tokens: null, css: null, error: null, assets: [] };
let cache: { mtime: number; pack: BrandPack } | null = null;

/** Reads brand/brand.json (re-read when the file changes). Never throws: a bad file reports `error`. */
export async function loadBrandPack(): Promise<BrandPack> {
  const file = brandPath("brand.json");
  const st = await stat(file).catch(() => null);
  if (!st) return EMPTY;
  if (cache?.mtime === st.mtimeMs) return cache.pack;
  let pack: BrandPack;
  try {
    const parsed = BrandPackSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      pack = { ...EMPTY, error: `brand/brand.json: ${i.path.join(".")} ${i.message}` };
    } else {
      const { colors, ...rest } = parsed.data;
      const tokens = colors ? deriveBrandTokens(colors.primary, colors.primaryDark) : null;
      const assets: BrandPack["assets"] = [];
      for (const k of ["logo", "logoDark", "mark"] as const)
        if (rest[k] && (await stat(brandPath(rest[k]!)).catch(() => null))) assets.push(k);
      pack = { ...rest, tokens, css: tokens ? brandCss(tokens) : null, error: null, assets };
    }
  } catch {
    pack = { ...EMPTY, error: "brand/brand.json is not valid JSON" };
  }
  cache = { mtime: st.mtimeMs, pack };
  return pack;
}

const TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/** Reads one brand asset by key (only files named in brand.json; no arbitrary paths). */
export async function readBrandAsset(key: "logo" | "logoDark" | "mark") {
  const pack = await loadBrandPack();
  const name = pack[key];
  if (!name || !pack.assets.includes(key)) return null;
  const ext = name.split(".").pop()!.toLowerCase();
  return { body: await readFile(brandPath(name)), type: TYPES[ext] };
}

/** What the client needs (no CSS, no file names). */
export const publicBrand = (p: BrandPack) => ({
  appName: p.appName ?? null,
  wordmark: p.wordmark ?? null,
  tagline: p.tagline ?? null,
  footerNote: p.footerNote ?? null,
  hasColors: !!p.tokens,
  swatch: p.tokens?.light.primary ?? null,
  adjusted: p.tokens?.adjusted ?? false,
  assets: p.assets,
  error: p.error,
});
export type PublicBrand = ReturnType<typeof publicBrand> & { activeAccent?: string };
