"use client";
import { format } from "date-fns";
import { Flag, ListChecks, Plus, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { InlineDate, InlineSelect, InlineText } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Account360 } from "../../hooks/use-accounts";
import { useAccountMutation } from "../../hooks/use-accounts";

type Item = Account360["planItems"][number];
const STATUS_OPTS = ["open", "in-progress", "done", "blocked"].map((s) => ({
  value: s,
  label: s.replace("-", " "),
}));
const CHILD: Record<string, "strategy" | "action" | null> = {
  objective: "strategy",
  strategy: "action",
  action: null,
};
const ICON = { objective: Target, strategy: Flag, action: ListChecks };

/** Structured account plan: objectives → strategies → actions (feeds the executive summary). */
export function PlanTab({ d }: { d: Account360 }) {
  const id = d.account.id;
  const [now] = useState(() => Date.now());
  const create = useAccountMutation(
    id,
    (b: { kind: string; parentId?: string | null; text: string }) =>
      api(`/api/accounts/${id}/plan`, { method: "POST", json: b }),
  );
  const update = useAccountMutation(
    id,
    ({ itemId, ...b }: { itemId: string } & Record<string, unknown>) =>
      api(`/api/plan-items/${itemId}`, { method: "PATCH", json: b }),
  );
  const remove = useAccountMutation(
    id,
    (itemId: string) => api(`/api/plan-items/${itemId}`, { method: "DELETE" }),
    "Removed",
  );
  const items = d.planItems;
  const children = (pid: string | null) =>
    items.filter((i) => (i.parentId ?? null) === pid && (pid !== null || i.kind === "objective"));
  const actions = items.filter((i) => i.kind === "action");
  const done = actions.filter((a) => a.status === "done").length;
  const nextDue = items
    .filter((i) => i.dueDate && i.status !== "done")
    .map((i) => i.dueDate!)
    .sort()[0];

  return (
    <section className="bg-card grid gap-3 rounded-lg border p-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Account plan</h2>
          <p className="text-muted-foreground text-xs">
            Objectives → strategies → actions.{" "}
            {actions.length ? `${done} of ${actions.length} actions done.` : ""}
            {nextDue && ` Next due ${format(new Date(nextDue), "MMM d")}.`}
          </p>
        </div>
        <NewObjective onAdd={(text) => create.mutate({ kind: "objective", text })} />
      </header>
      {items.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-[13px]">
          No plan yet. Start with an objective — e.g. “Establish executive sponsorship with the
          CIO”.
        </p>
      ) : (
        <ul>
          {children(null).map((o) => (
            <PlanRow
              key={o.id}
              item={o}
              depth={0}
              h={{
                update: update.mutate,
                create: create.mutate,
                remove: remove.mutate,
                children,
                now,
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface Handlers {
  update: (v: { itemId: string } & Record<string, unknown>) => void;
  create: (v: { kind: string; parentId?: string | null; text: string }) => void;
  remove: (id: string) => void;
  children: (pid: string | null) => Item[];
  now: number;
}

function PlanRow({ item, depth, h }: { item: Item; depth: number; h: Handlers }) {
  const { update, create, remove, children, now } = h;
  const Icon = ICON[item.kind as keyof typeof ICON] ?? ListChecks;
  const childKind = CHILD[item.kind];
  const overdue = item.dueDate && item.status !== "done" && new Date(item.dueDate).getTime() < now;
  return (
    <li>
      <div
        className={cn(
          "group hover:bg-muted/40 flex flex-wrap items-center gap-2 rounded-md py-1 pr-1",
          depth === 0 && "mt-2 font-medium",
        )}
        style={{ paddingLeft: depth * 24 }}
      >
        <Icon
          className={cn(
            "size-4 shrink-0",
            item.kind === "objective" ? "text-primary" : "text-muted-foreground",
          )}
          aria-label={item.kind}
        />
        <InlineText
          label={`${item.kind} text`}
          value={item.text}
          onCommit={(v) => update({ itemId: item.id, text: v })}
          className={cn(
            "min-w-48 flex-1",
            item.status === "done" && "text-muted-foreground line-through",
          )}
        />
        {item.kind === "action" && (
          <>
            <InlineText
              label="Owner"
              value={item.owner ?? ""}
              placeholder="Owner"
              onCommit={(v) => update({ itemId: item.id, owner: v || null })}
              className="w-28"
            />
            <InlineDate
              label="Due date"
              value={item.dueDate ?? ""}
              onCommit={(iso) => update({ itemId: item.id, dueDate: iso })}
            />
            {overdue && <span className="text-critical-text text-[11px]">Overdue</span>}
          </>
        )}
        <div className="w-32">
          <InlineSelect
            label="Status"
            value={item.status}
            options={STATUS_OPTS}
            onCommit={(v) => update({ itemId: item.id, status: v })}
          />
        </div>
        {childKind && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Add ${childKind}`}
            title={`Add ${childKind}`}
            onClick={() =>
              create({
                kind: childKind,
                parentId: item.id,
                text: childKind === "strategy" ? "New strategy" : "New action",
              })
            }
          >
            <Plus />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Delete ${item.kind}`}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100"
          onClick={() => remove(item.id)}
        >
          <Trash2 />
        </Button>
      </div>
      {children(item.id).length > 0 && (
        <ul>
          {children(item.id).map((c) => (
            <PlanRow key={c.id} item={c} depth={depth + 1} h={h} />
          ))}
        </ul>
      )}
    </li>
  );
}

function NewObjective({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim().length >= 2) {
          onAdd(text.trim());
          setText("");
        }
      }}
    >
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="New objective…"
        className="h-8 w-64"
        aria-label="New objective"
      />
      <Button type="submit" size="sm" disabled={text.trim().length < 2}>
        <Plus /> Objective
      </Button>
    </form>
  );
}
