import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { RefResolver } from "@/lib/contract/convert";
import type { Contract } from "@/lib/contract/schema";
import type { AccountIndex } from "../import/account-index";
import { refMap } from "./refs";

/**
 * Activities (Touch) and tasks have no CSV import kind; the contract plans them here with the same rules:
 * an existing externalId (same sending system) merges, otherwise a natural key dedupes, otherwise create.
 */
export interface ChildPlan {
  kind: "touch" | "task";
  index: number;
  label: string;
  externalId?: string;
  sourceUrl?: string;
  status: "new" | "merge" | "same" | "error";
  error?: string;
  matchId?: string;
  data?: Prisma.TouchUncheckedCreateInput | Prisma.TaskUncheckedCreateInput;
}

const day = (s: string) => new Date(s.length === 10 ? `${s}T12:00:00.000Z` : s);
const lc = (s: unknown) =>
  String(s ?? "")
    .trim()
    .toLowerCase();

/** Fields compared to decide merge vs unchanged. */
const TOUCH_KEYS = [
  "channel",
  "persona",
  "scheduledAt",
  "completedAt",
  "outcome",
  "angle",
] as const;
const TASK_KEYS = ["title", "dueDate", "priority", "status"] as const;

const same = (a: unknown, b: unknown) =>
  a instanceof Date || b instanceof Date
    ? new Date(a as Date).getTime() === new Date(b as Date).getTime()
    : (a ?? null) === (b ?? null);

export async function planChildren(
  c: Contract,
  resolve: RefResolver,
  idx: AccountIndex,
  pending: Set<string>,
) {
  const system = c.source.system;
  const [touchRefs, taskRefs] = await Promise.all([
    refMap(system, "touch"),
    refMap(system, "task"),
  ]);
  const out: ChildPlan[] = [];
  const accountFor = (ref: Parameters<RefResolver>[0] | undefined) => {
    if (!ref) return { id: null as string | null };
    const s = resolve(ref);
    const a = s ? idx.resolve(s) : null;
    if (a) return { id: a.id };
    if (s && pending.has(lc(s))) return { id: null, pending: true };
    return { id: null, error: `No account matches "${s ?? ref.externalId}"` };
  };

  const touchIds = c.entities.activities.map((a) => touchRefs.get(a.externalId ?? ""));
  const taskIds = c.entities.tasks.map((t) => taskRefs.get(t.externalId ?? ""));
  const [touches, tasks] = await Promise.all([
    db.touch.findMany({ where: { id: { in: touchIds.filter(Boolean) as string[] } } }),
    db.task.findMany({ where: { id: { in: taskIds.filter(Boolean) as string[] } } }),
  ]);
  const touchById = new Map(touches.map((t) => [t.id, t]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  for (const [i, a] of c.entities.activities.entries()) {
    const acc = accountFor(a.account);
    const label = `${a.channel} · ${a.persona} · ${a.date.slice(0, 10)}`;
    if ("error" in acc && acc.error) {
      out.push({ kind: "touch", index: i, label, status: "error", error: acc.error });
      continue;
    }
    const data = {
      accountId: acc.id ?? "",
      channel: a.channel,
      persona: a.persona,
      scheduledAt: day(a.date),
      completedAt: a.completed ? day(a.date) : null,
      outcome: a.outcome ?? null,
      angle: a.summary ?? null,
    };
    const prev = touchById.get(touchIds[i] ?? "");
    const status = !prev
      ? "new"
      : TOUCH_KEYS.every((k) => same(prev[k], data[k]))
        ? "same"
        : "merge";
    out.push({
      kind: "touch",
      index: i,
      label,
      externalId: a.externalId,
      sourceUrl: a.sourceUrl,
      status,
      matchId: prev?.id,
      data,
    });
  }
  for (const [i, t] of c.entities.tasks.entries()) {
    const acc = accountFor(t.account);
    if ("error" in acc && acc.error) {
      out.push({ kind: "task", index: i, label: t.title, status: "error", error: acc.error });
      continue;
    }
    const data = {
      title: t.title,
      dueDate: t.dueDate ? day(t.dueDate) : null,
      priority: t.priority ?? "normal",
      status: t.status ?? "open",
      completedAt: t.status === "done" ? new Date() : null,
      accountId: acc.id,
      source: "import",
    };
    const prev = taskById.get(taskIds[i] ?? "");
    const status = !prev
      ? "new"
      : TASK_KEYS.every((k) => same(prev[k], data[k]))
        ? "same"
        : "merge";
    out.push({
      kind: "task",
      index: i,
      label: t.title,
      externalId: t.externalId,
      sourceUrl: t.sourceUrl,
      status,
      matchId: prev?.id,
      data,
    });
  }
  return out;
}

/** Applies planned activities/tasks; returns ImportRecord rows (created or merged with a `before` snapshot). */
export async function applyChildren(
  plans: ChildPlan[],
  idx: AccountIndex,
  c: Contract,
  resolve: RefResolver,
) {
  const records: Array<{
    entityType: string;
    entityId: string;
    action: "created" | "merged";
    before?: unknown;
    externalId?: string;
    sourceUrl?: string;
  }> = [];
  for (const p of plans) {
    if (p.status === "error" || p.status === "same" || !p.data) continue;
    // Accounts created by this file exist now: resolve them again.
    const src =
      p.kind === "touch"
        ? c.entities.activities[p.index].account
        : c.entities.tasks[p.index].account;
    const s = src ? resolve(src) : null;
    const accountId = s ? (idx.resolve(s)?.id ?? null) : null;
    if (p.kind === "touch") {
      if (!accountId) continue;
      const data = { ...(p.data as Prisma.TouchUncheckedCreateInput), accountId };
      if (p.matchId) {
        const before = await db.touch.findUnique({ where: { id: p.matchId } });
        await db.touch.update({ where: { id: p.matchId }, data });
        records.push({
          entityType: "touch",
          entityId: p.matchId,
          action: "merged",
          before: pick(before, TOUCH_KEYS),
          externalId: p.externalId,
          sourceUrl: p.sourceUrl,
        });
      } else {
        const t = await db.touch.create({ data });
        records.push({
          entityType: "touch",
          entityId: t.id,
          action: "created",
          externalId: p.externalId,
          sourceUrl: p.sourceUrl,
        });
      }
    } else {
      const data = { ...(p.data as Prisma.TaskUncheckedCreateInput), accountId };
      if (p.matchId) {
        const before = await db.task.findUnique({ where: { id: p.matchId } });
        const { source: _s, ...patch } = data;
        await db.task.update({ where: { id: p.matchId }, data: patch });
        records.push({
          entityType: "task",
          entityId: p.matchId,
          action: "merged",
          before: pick(before, [...TASK_KEYS, "accountId", "completedAt"]),
          externalId: p.externalId,
          sourceUrl: p.sourceUrl,
        });
      } else {
        const t = await db.task.create({ data });
        records.push({
          entityType: "task",
          entityId: t.id,
          action: "created",
          externalId: p.externalId,
          sourceUrl: p.sourceUrl,
        });
      }
    }
  }
  return records;
}

const pick = (row: object | null, keys: readonly string[]) =>
  row ? Object.fromEntries(keys.map((k) => [k, (row as Record<string, unknown>)[k] ?? null])) : {};
