import { z } from "zod";
import { SMART_ENTITIES, RulesSchema } from "@/lib/daily/smart-lists";
import { handler, json, readJson } from "@/lib/server/http";
import { evaluate } from "@/lib/server/smart-lists";

/** Live preview for the query builder (nothing saved). */
export const POST = handler(async (req: Request) => {
  const b = z.object({ entity: z.enum(SMART_ENTITIES), rules: RulesSchema }).parse(await readJson(req));
  return json(await evaluate(b.entity, b.rules, 50));
});
