import { ImportRequestSchema } from "@/lib/import/normalize";
import { createRealAccounts } from "@/lib/server/account-import";
import { handler, json, readJson } from "@/lib/server/http";

/** Bulk import of the user's own target accounts (public identifiers only). */
export const POST = handler(async (req: Request) => {
  const { rows } = ImportRequestSchema.parse(await readJson(req));
  return json(await createRealAccounts(rows));
});
