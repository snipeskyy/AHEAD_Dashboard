"use client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MAP_SIDES,
  MAP_STATUSES,
  SIDE_LABELS,
  STATUS_LABELS,
  isOverdue,
  type MapStep,
} from "@/lib/map/model";

const sel = "border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-1.5 text-[13px]";

/** Table editor for plan steps. Every control has a label that names its step. */
export function PlanStepsEditor({
  steps,
  onChange,
  newId,
}: {
  steps: MapStep[];
  onChange: (s: MapStep[]) => void;
  newId: () => string;
}) {
  const now = new Date();
  const set = (i: number, p: Partial<MapStep>) =>
    onChange(steps.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="grid gap-3">
      <div
        className="overflow-x-auto rounded-lg border"
        role="region"
        aria-label="Plan steps"
        tabIndex={0}
      >
        <table className="w-full min-w-[920px] text-left text-[13px]">
          <thead className="text-muted-foreground border-b text-xs">
            <tr>
              <th className="px-2 py-2 font-medium">Step</th>
              <th className="px-2 py-2 font-medium">Side</th>
              <th className="px-2 py-2 font-medium">Owner (role or name)</th>
              <th className="px-2 py-2 font-medium">Due</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Customer sees</th>
              <th className="px-2 py-2 font-medium">Internal note</th>
              <th className="px-2 py-2" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {steps.map((s, i) => {
              const n = `step ${i + 1}`;
              return (
                <tr key={s.id} className={isOverdue(s, now) ? "bg-warning/5" : undefined}>
                  <td className="px-2 py-1.5">
                    <Input
                      className="h-8 min-w-56"
                      aria-label={`Title, ${n}`}
                      value={s.title}
                      onChange={(e) => set(i, { title: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      className={sel}
                      aria-label={`Side, ${n}`}
                      value={s.side}
                      onChange={(e) => set(i, { side: e.target.value as MapStep["side"] })}
                    >
                      {MAP_SIDES.map((x) => (
                        <option key={x} value={x}>
                          {SIDE_LABELS[x]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      className="h-8 w-40"
                      aria-label={`Owner, ${n}`}
                      value={s.owner}
                      placeholder="e.g. CIO"
                      onChange={(e) => set(i, { owner: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="date"
                      className="h-8 w-36"
                      aria-label={`Due date, ${n}`}
                      value={s.dueDate ?? ""}
                      onChange={(e) => set(i, { dueDate: e.target.value || null })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      className={sel}
                      aria-label={`Status, ${n}`}
                      value={s.status}
                      onChange={(e) => set(i, { status: e.target.value as MapStep["status"] })}
                    >
                      {MAP_STATUSES.map((x) => (
                        <option key={x} value={x}>
                          {STATUS_LABELS[x]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      className="size-4 accent-current"
                      aria-label={`Customer sees ${n}`}
                      checked={s.customerVisible}
                      onChange={(e) => set(i, { customerVisible: e.target.checked })}
                    />
                  </td>
                  <td className="px-2 py-1.5" data-internal-only="true">
                    <Input
                      className="h-8 w-48"
                      aria-label={`Internal note, ${n}`}
                      value={s.note}
                      onChange={(e) => set(i, { note: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Move ${n} up`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Move ${n} down`}
                      disabled={i === steps.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${n}`}
                      onClick={() => onChange(steps.filter((_, j) => j !== i))}
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <Button
          size="sm"
          variant="outline"
          disabled={steps.length >= 60}
          onClick={() =>
            onChange([
              ...steps,
              {
                id: newId(),
                title: "New step",
                side: "joint",
                owner: "",
                dueDate: null,
                status: "planned",
                customerVisible: true,
                note: "",
              },
            ])
          }
        >
          <Plus /> Add step
        </Button>
      </div>
    </div>
  );
}
