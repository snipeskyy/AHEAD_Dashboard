import { z } from "zod";
import { handler, json, readJson } from "@/lib/server/http";
import { createTask, listTasks, TaskBody } from "@/lib/server/tasks";

const Query = z.object({
  status: z.enum(["open", "done", "cancelled"]).optional(),
  accountId: z.string().optional(),
  opportunityId: z.string().optional(),
  assigneeId: z.string().optional(),
  due: z.enum(["overdue", "today", "week"]).optional(),
});

export const GET = handler(async (req: Request) =>
  json({ items: await listTasks(Query.parse(Object.fromEntries(new URL(req.url).searchParams))) }),
);

/** One task, or `{ items: [...] }` to create several (quick-capture action lines). */
export const POST = handler(async (req: Request) => {
  const body = await readJson(req);
  if (body && typeof body === "object" && "items" in body) {
    const items = z.object({ items: z.array(TaskBody).min(1).max(50) }).parse(body).items;
    const created = [];
    for (const t of items) created.push(await createTask(t));
    return json({ items: created }, { status: 201 });
  }
  return json(await createTask(TaskBody.parse(body)), { status: 201 });
});
