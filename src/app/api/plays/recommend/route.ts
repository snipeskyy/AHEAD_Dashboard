import { z } from "zod";
import { handler, json } from "@/lib/server/http";
import { recommendForAccount } from "@/lib/server/plays";

export const GET = handler(async (req: Request) => {
  const { accountId, max } = z
    .object({
      accountId: z.string().min(1),
      max: z.coerce.number().int().min(1).max(15).default(6),
    })
    .parse(Object.fromEntries(new URL(req.url).searchParams));
  return json(await recommendForAccount(accountId, max));
});
