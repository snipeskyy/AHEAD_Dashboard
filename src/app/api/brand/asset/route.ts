import { z } from "zod";
import { readBrandAsset } from "@/lib/brand/brand-pack";
import { handler, HttpError } from "@/lib/server/http";

const Key = z.enum(["logo", "logoDark", "mark"]);

/** Serves the local brand pack's logo files (brand/ is git-ignored; files never leave this machine). */
export const GET = handler(async (req: Request) => {
  const key = Key.parse(new URL(req.url).searchParams.get("name"));
  const asset = await readBrandAsset(key);
  if (!asset) throw new HttpError(404, "No brand asset");
  return new Response(new Uint8Array(asset.body), {
    headers: {
      "content-type": asset.type,
      "cache-control": "no-cache",
      // SVGs are shown via <img>, which never runs scripts; this also blocks them if opened directly.
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "x-content-type-options": "nosniff",
    },
  });
});
