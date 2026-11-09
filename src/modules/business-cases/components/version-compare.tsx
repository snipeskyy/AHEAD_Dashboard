"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { computeTco } from "@/lib/tco/compute";
import { TcoModelSchema, type TcoModel } from "@/lib/tco/model";
import { money } from "./use-case";

const sel = "border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-2 text-[13px]";

/** Current model vs a saved version, side by side: TCO per scenario and the headline business case. */
export function VersionCompare({
  caseId,
  current,
  versions,
}: {
  caseId: string;
  current: TcoModel;
  versions: Array<{ version: number; label: string | null }>;
}) {
  const [picked, setV] = useState<number | null>(null);
  const v = picked ?? versions[0]?.version ?? null; // newest by default, including right after the first save
  const q = useQuery({
    queryKey: ["business-case-version", caseId, v],
    queryFn: () =>
      api<{ model: unknown }>(`/api/business-cases/${caseId}/versions/${v}`).then((r) =>
        TcoModelSchema.parse(r.model),
      ),
    enabled: v !== null,
  });
  if (!versions.length)
    return (
      <p className="text-muted-foreground text-xs">Save a version to compare against it later.</p>
    );
  const a = computeTco(current);
  const b = q.data ? computeTco(q.data) : null;
  const rows: Array<[string, (r: ReturnType<typeof computeTco>) => string]> = [
    ...a.scenarios.map((s): [string, (r: ReturnType<typeof computeTco>) => string] => [
      `${s.name} (${a.years}-yr TCO)`,
      (r) => {
        const x = r.scenarios.find((y) => y.id === s.id);
        return x ? money(x.total) : "—";
      },
    ]),
    ["Total savings", (r) => (r.comparisons[0] ? money(r.comparisons[0].totalSavings) : "—")],
    ["NPV of savings", (r) => (r.comparisons[0] ? money(r.comparisons[0].npvSavings) : "—")],
    [
      "Payback (years)",
      (r) =>
        r.comparisons[0]?.paybackYears != null ? r.comparisons[0].paybackYears.toFixed(1) : "—",
    ],
  ];
  return (
    <div className="grid gap-2">
      <label className="flex items-center gap-2 text-[13px]">
        Compare with
        <select
          className={sel}
          value={v ?? ""}
          onChange={(e) => setV(Number(e.target.value))}
          aria-label="Version to compare"
        >
          {versions.map((x) => (
            <option key={x.version} value={x.version}>
              v{x.version}
              {x.label ? ` · ${x.label}` : ""}
            </option>
          ))}
        </select>
      </label>
      <div
        className="overflow-x-auto rounded-md border"
        tabIndex={0}
        role="region"
        aria-label="Version comparison"
      >
        <table className="w-full text-[13px]">
          <thead className="text-muted-foreground border-b text-left text-xs">
            <tr>
              <th className="px-3 py-1.5 font-medium">Measure</th>
              <th className="px-3 font-medium">Now</th>
              <th className="px-3 font-medium">v{v}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(([label, f]) => (
              <tr key={label}>
                <td className="px-3 py-1.5">{label}</td>
                <td className="tabular px-3">{f(a)}</td>
                <td className="tabular px-3">{b ? f(b) : "…"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
