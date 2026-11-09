import { handler, json, readJson } from "@/lib/server/http";
import { previewContract } from "@/lib/server/contract/import";
import { parseContract } from "@/lib/server/contract/refs";

/** Validates a contract file and reports, per entity, what an import would create, merge or reject. Read-only. */
export const POST = handler(async (req: Request) => {
  const body = (await readJson(req)) as { file?: unknown };
  return json(await previewContract(parseContract(body.file)));
});
