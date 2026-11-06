import "server-only";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { nextDue, RECURRENCES } from "@/lib/daily/recurrence";
import { logActivity } from "./activity";
import { HttpError } from "./http";

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const TASK_STATUSES = ["open", "done", "cancelled"] as const;

export const TaskBody = z.object({
  title: z.string().trim().min(2).max(200),
  notes: z.string().max(4000).nullish(),
  dueDate: z.coerce.date().nullish(),
  priority: z.enum(TASK_PRIORITIES).default("normal"),
  recurrence: z.enum(RECURRENCES).nullish(),
  accountId: z.string().nullish(),
  opportunityId: z.string().nullish(),
  signalId: z.string().nullish(),
  contactId: z.string().nullish(),
  source: z.enum(["manual", "signal", "quick-capture", "next-step", "my-day"]).default("manual"),
});

const include = {
  account: { select: { id: true, name: true } },
  opportunity: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

export async function createTask(input: z.infer<typeof TaskBody>) {
  let accountId = input.accountId ?? null;
  if (input.opportunityId && !accountId)
    accountId = (await db.opportunity.findUnique({ where: { id: input.opportunityId }, select: { accountId: true } }))?.accountId ?? null;
  if (input.signalId && !accountId)
    accountId = (await db.signal.findUnique({ where: { id: input.signalId }, select: { accountId: true } }))?.accountId ?? null;
  const t = await db.task.create({ data: { ...input, accountId }, include });
  await logActivity({ entityType: "task", entityId: t.id, action: "task.created", summary: `Task: ${t.title}${t.account ? ` (${t.account.name})` : ""}` });
  return t;
}

export async function listTasks(q: { status?: string; accountId?: string; opportunityId?: string; due?: "overdue" | "today" | "week" }) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const due: Prisma.TaskWhereInput =
    q.due === "overdue" ? { dueDate: { lt: new Date(now.toDateString()) } }
      : q.due === "today" ? { dueDate: { lte: end } }
      : q.due === "week" ? { dueDate: { lte: new Date(end.getTime() + 6 * 86_400_000) } }
      : {};
  return db.task.findMany({
    where: { status: q.status ?? "open", accountId: q.accountId, opportunityId: q.opportunityId, ...due },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    include,
    take: 500,
  });
}

/** Completing a recurring task schedules its next occurrence. */
export async function updateTask(id: string, patch: Partial<z.infer<typeof TaskBody>> & { status?: (typeof TASK_STATUSES)[number] }) {
  const prev = await db.task.findUnique({ where: { id } });
  if (!prev) throw new HttpError(404, "Task not found");
  const done = patch.status === "done" && prev.status !== "done";
  const t = await db.task.update({
    where: { id },
    data: { ...patch, completedAt: done ? new Date() : patch.status === "open" ? null : undefined },
    include,
  });
  let next = null;
  if (done && prev.recurrence) {
    const base = prev.dueDate ?? new Date();
    next = await db.task.create({
      data: {
        title: prev.title, notes: prev.notes, priority: prev.priority, recurrence: prev.recurrence,
        accountId: prev.accountId, opportunityId: prev.opportunityId, contactId: prev.contactId, source: prev.source,
        dueDate: nextDue(base, prev.recurrence as (typeof RECURRENCES)[number], new Date()),
      },
    });
  }
  if (done) await logActivity({ entityType: "task", entityId: id, action: "task.done", summary: `Done: ${t.title}` });
  return { task: t, next };
}
