import { z } from "zod";
import { db } from "@/lib/db";
import { FIELD_BY_ID } from "@/lib/enrich/fields";
import { setLocked, setManualValue } from "@/lib/enrich/store";
import { handler, HttpError, json, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({
  field: z.string().max(80),
  value: z.unknown().optional(),
  /** Only toggles the lock (keeps the value). */
  locked: z.boolean().optional(),
});

/** Manual entry (highest precedence, locked) or lock/unlock of a field. */
export const PUT = handler(async (req: Request, ctx: Ctx) => {
  const id = (await ctx.params).id;
  const b = Body.parse(await readJson(req));
  const def = FIELD_BY_ID.get(b.field);
  if (!def) throw new HttpError(400, `Unknown field ${b.field}`);
  if (b.value === undefined && b.locked !== undefined) {
    await setLocked(db, id, b.field, b.locked);
    return json({ ok: true });
  }
  let value = b.value;
  if (def.kind === "number" || def.kind === "money" || def.kind === "year") {
    const n = Number(String(value).replace(/[$,\s]/g, ""));
    if (!Number.isFinite(n)) throw new HttpError(400, `${def.label} must be a number`);
    value = n;
  } else if (typeof value === "string") value = value.trim().slice(0, 4000);
  if (value === "" || value === null) {
    await db.accountField.deleteMany({ where: { accountId: id, field: b.field } });
    return json({ ok: true, cleared: true });
  }
  await setManualValue(db, id, b.field, value);
  return json({ ok: true });
});
