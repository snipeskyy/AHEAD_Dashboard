import { z } from "zod";
import { handler, json, readJson } from "@/lib/server/http";
import { commitContract } from "@/lib/server/contract/import";
import { parseContract } from "@/lib/server/contract/refs";
import { assertSameOrigin } from "@/lib/server/local-api";

const Body = z.object({ file: z.unknown(), fileName: z.string().max(255).nullish() });

/** Imports a contract file (one undoable group in Import → History). */
export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const b = Body.parse(await readJson(req));
  return json(await commitContract(parseContract(b.file), b.fileName));
});
