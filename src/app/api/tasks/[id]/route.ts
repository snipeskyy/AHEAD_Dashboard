import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";
import { TASK_STATUSES, TaskBody, updateTask } from "@/lib/server/tasks";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };
const Patch = TaskBody.partial().extend({ status: z.enum(TASK_STATUSES).optional() });

export const PATCH = handler(async (req: Request, ctx: Ctx) =>
  json(await updateTask((await ctx.params).id, Patch.parse(await readJson(req)))),
);

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  await db.task.deleteMany({ where: { id: (await ctx.params).id } });
  return json({ ok: true });
});
