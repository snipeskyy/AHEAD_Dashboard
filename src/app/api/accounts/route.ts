import { z } from "zod";
import { db } from "@/lib/db";
import { TierSchema } from "@/lib/domain/enums";
import { listAccounts } from "@/lib/server/accounts";
import { createRealAccounts } from "@/lib/server/account-import";
import { handler, json, readJson } from "@/lib/server/http";

export const GET = handler(async () => json({ items: await listAccounts() }));

const Create = z.object({
  name: z.string().trim().min(2).max(160),
  domain: z.string().trim().max(200).optional(),
  ticker: z.string().trim().max(10).optional(),
  industry: z.string().trim().max(80).optional(),
  tier: TierSchema.default("Growth"),
});

export const POST = handler(async (req: Request) => {
  const input = Create.parse(await readJson(req));
  const result = await createRealAccounts([input]);
  if (!result.created.length)
    return json({ error: result.skipped[0]?.reason ?? "Not created" }, { status: 409 });
  return json(await db.account.findUnique({ where: { id: result.created[0].id } }), {
    status: 201,
  });
});
