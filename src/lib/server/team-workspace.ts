import "server-only";
import { canSee } from "@/config/roles";
import { currentUser, teamOverview } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { OPEN_STAGES } from "@/lib/domain/enums";
import { MapStepsSchema, isOverdue, mapProgress } from "@/lib/map/model";
import { buildDigest } from "@/lib/team/digest";

/**
 * Account team workspace (Phase 14): workload by teammate, the shared territory plan (account plan items and
 * mutual action plans), and the weekly digest. Teammates are names only (no contact details).
 */
const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export async function teamWorkload(now = new Date()) {
  const { users } = await teamOverview();
  const me = users.find((u) => u.isSelf);
  const [open, done] = await Promise.all([
    db.task.findMany({
      where: { status: "open" },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
      include: { account: { select: { id: true, name: true } } },
      take: 2000,
    }),
    db.task.findMany({
      where: { status: "done", completedAt: { gte: new Date(now.getTime() - 7 * DAY) } },
      select: { assigneeId: true },
    }),
  ]);
  const today = startOfDay(now);
  const weekEnd = new Date(today.getTime() + 7 * DAY);
  // Unassigned tasks belong to you (the local user).
  const who = (assigneeId: string | null) => assigneeId ?? me?.id ?? "local";
  const people = users.map((u) => {
    const mine = open.filter((t) => who(t.assigneeId) === u.id);
    return {
      user: { id: u.id, displayName: u.displayName, title: u.title, isSelf: u.isSelf },
      open: mine.length,
      overdue: mine.filter((t) => t.dueDate && t.dueDate < today).length,
      dueThisWeek: mine.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate < weekEnd)
        .length,
      doneThisWeek: done.filter((t) => who(t.assigneeId) === u.id).length,
      tasks: mine.slice(0, 50).map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate?.toISOString() ?? null,
        priority: t.priority,
        account: t.account,
        assigneeId: t.assigneeId,
      })),
    };
  });
  return { people };
}

export async function territoryPlan(now = new Date()) {
  const [items, plans] = await Promise.all([
    db.accountPlanItem.findMany({
      where: { status: { not: "done" } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }],
      include: { account: { select: { id: true, name: true, tier: true } } },
      take: 500,
    }),
    db.mutualActionPlan.findMany({
      include: {
        opportunity: {
          select: {
            id: true,
            name: true,
            stage: true,
            account: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return {
    items: items.map((i) => ({
      id: i.id,
      kind: i.kind,
      text: i.text,
      owner: i.owner,
      dueDate: i.dueDate?.toISOString() ?? null,
      status: i.status,
      overdue: !!i.dueDate && i.dueDate < startOfDay(now),
      account: i.account,
    })),
    plans: plans.map((p) => {
      const steps = MapStepsSchema.catch([]).parse(p.steps);
      const target = p.targetDate?.toISOString().slice(0, 10) ?? null;
      const prog = mapProgress(steps, target, now);
      return {
        opportunityId: p.opportunityId,
        title: p.title,
        opportunity: p.opportunity.name,
        stage: p.opportunity.stage,
        account: p.opportunity.account,
        targetDate: target,
        health: prog.health,
        summary: prog.summary,
        next: prog.next ? { title: prog.next.title, dueDate: prog.next.dueDate } : null,
      };
    }),
  };
}

export async function teamDigest(now = new Date()) {
  const weekStart = new Date(now.getTime() - 7 * DAY);
  const soon = new Date(now.getTime() + 14 * DAY);
  const [{ team, users }, user] = await Promise.all([teamOverview(), currentUser()]);
  const name = (id: string | null) =>
    users.find((u) => (id ? u.id === id : u.isSelf))?.displayName ?? "Me";
  const [moves, created, closing, done, overdue, plans, signals] = await Promise.all([
    db.stageChange.findMany({
      where: { changedAt: { gte: weekStart, lte: now }, fromStage: { not: null } },
      include: {
        opportunity: { select: { name: true, amount: true, account: { select: { name: true } } } },
      },
      orderBy: { changedAt: "desc" },
      take: 200,
    }),
    db.opportunity.findMany({
      where: { createdAt: { gte: weekStart, lte: now } },
      include: { account: { select: { name: true } } },
      orderBy: { amount: "desc" },
      take: 50,
    }),
    db.opportunity.findMany({
      where: { stage: { in: [...OPEN_STAGES] }, closeDate: { gte: startOfDay(now), lte: soon } },
      include: { account: { select: { name: true } } },
      orderBy: { closeDate: "asc" },
      take: 50,
    }),
    db.task.findMany({
      where: { status: "done", completedAt: { gte: weekStart } },
      select: { title: true, assigneeId: true },
    }),
    db.task.findMany({
      where: { status: "open", dueDate: { lt: startOfDay(now) } },
      include: { account: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 100,
    }),
    db.mutualActionPlan.findMany({ select: { title: true, steps: true } }),
    db.signal.findMany({
      where: { createdAt: { gte: weekStart, lte: now }, dismissed: false },
      include: { account: { select: { name: true } } },
      orderBy: { relevance: "desc" },
      take: 5,
    }),
  ]);
  const soonDay = soon.toISOString().slice(0, 10);
  const planSteps = plans
    .flatMap((p) =>
      MapStepsSchema.catch([])
        .parse(p.steps)
        .filter((s) => s.status !== "done" && s.dueDate && s.dueDate <= soonDay)
        .map((s) => ({
          plan: p.title,
          step: s.title,
          dueDate: s.dueDate!,
          overdue: isOverdue(s, now),
        })),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return buildDigest({
    teamName: team?.name ?? "Account team",
    weekStart,
    now,
    showAmounts: canSee(user.role, "opp.amount"),
    stageMoves: moves.map((m) => ({
      opp: m.opportunity.name,
      account: m.opportunity.account.name,
      from: m.fromStage,
      to: m.toStage,
      amount: m.opportunity.amount,
      at: m.changedAt,
    })),
    created: created.map((o) => ({ opp: o.name, account: o.account.name, amount: o.amount })),
    closingSoon: closing.map((o) => ({
      opp: o.name,
      account: o.account.name,
      amount: o.amount,
      closeDate: o.closeDate,
    })),
    tasksDone: done.map((t) => ({ title: t.title, assignee: name(t.assigneeId) })),
    tasksOverdue: overdue.map((t) => ({
      title: t.title,
      assignee: name(t.assigneeId),
      dueDate: t.dueDate!,
      account: t.account?.name ?? null,
    })),
    planSteps,
    topSignals: signals.map((s) => ({
      title: s.title,
      account: s.account.name,
      relevance: s.relevance,
    })),
  });
}
