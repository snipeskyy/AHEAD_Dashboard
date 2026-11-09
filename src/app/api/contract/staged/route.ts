import { z } from "zod";
import { extractJson } from "@/lib/contract/extract";
import { HttpError, handler, json, readJson } from "@/lib/server/http";
import { listStaged, stageContract } from "@/lib/server/contract/staging";

const Body = z.object({
  /** A parsed file, or `text` pasted from an AI tool (code fences and surrounding prose are ignored). */
  file: z.unknown().optional(),
  text: z.string().max(10_000_000).optional(),
  fileName: z.string().max(255).nullish(),
  origin: z.enum(["paste", "file"]).default("file"),
});

/** Files waiting for review. */
export const GET = handler(async () => json({ items: await listStaged() }));

/** Put a file or pasted text in the review queue (nothing is applied yet). */
export const POST = handler(async (req: Request) => {
  const b = Body.parse(await readJson(req));
  let raw = b.file;
  if (raw === undefined && b.text !== undefined) {
    try {
      raw = extractJson(b.text);
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : "Invalid JSON");
    }
  }
  if (raw === undefined) throw new HttpError(400, "Send a file or pasted text");
  return json(await stageContract(raw, b.origin, b.fileName), { status: 201 });
});
