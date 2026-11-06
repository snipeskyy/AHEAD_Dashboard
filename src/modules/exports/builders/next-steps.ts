import "server-only";
import { day } from "@/lib/export/build-helpers";
import type { BuildContext } from "@/lib/export/builder-types";
import type { Block } from "@/lib/export/types";

const OPEN = { notIn: ["ClosedWon", "ClosedLost"] };

/**
 * Next steps (closes a deck). First list = agreed actions from the account plan (customer-safe);
 * then deal next steps and open tasks (internal). Sorted by due date.
 */
export async function nextSteps(ctx: BuildContext): Promise<Block[]> {
  const ids = ctx.accounts.map((a) => a.id);
  const multi = ids.length > 1;
  const names = new Map(ctx.accounts.map((a) => [a.id, a.name]));
  const [actions, opps, tasks] = await Promise.all([
    ctx.db.accountPlanItem.findMany({ where: { accountId: { in: ids }, kind: "action", status: { not: "done" } }, orderBy: [{ dueDate: "asc" }], take: 8 }),
    ctx.db.opportunity.findMany({ where: { accountId: { in: ids }, stage: OPEN, nextStep: { not: null } }, orderBy: [{ nextStepDate: "asc" }], take: 8, select: { name: true, nextStep: true, nextStepDate: true, accountId: true } }),
    ctx.db.task.findMany({ where: { accountId: { in: ids }, status: "open" }, orderBy: [{ dueDate: "asc" }], take: 8, select: { title: true, dueDate: true, accountId: true } }),
  ]);
  const who = (accountId: string | null) => (multi && accountId ? ` (${names.get(accountId)})` : "");
  const blocks: Block[] = [];
  if (actions.length)
    blocks.push({
      kind: "list",
      field: "actions",
      items: actions.map((a) => ({ text: `${a.text}${who(a.accountId)}`, sub: [a.owner, a.dueDate ? `by ${day(a.dueDate)}` : null].filter(Boolean).join(" · ") || undefined })),
    });
  if (opps.length || tasks.length) {
    blocks.push({ kind: "heading", level: 3, text: "Deal and team follow-ups", field: "followups" });
    blocks.push({
      kind: "list",
      field: "followups",
      items: [
        ...opps.map((o) => ({ text: `${o.nextStep}${who(o.accountId)}`, sub: [o.name, o.nextStepDate ? `by ${day(o.nextStepDate)}` : "no date yet"].join(" · ") })),
        ...tasks.map((t) => ({ text: `${t.title}${who(t.accountId)}`, sub: t.dueDate ? `due ${day(t.dueDate)}` : undefined })),
      ].slice(0, 10),
    });
  }
  if (!blocks.length) blocks.push({ kind: "paragraph", field: "actions", text: "No open actions recorded. Add plan actions or deal next steps to fill this slide." });
  return blocks;
}
