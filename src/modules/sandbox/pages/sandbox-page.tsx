"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Server } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AccountPicker } from "@/components/account-picker";
import { PageContainer, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { roomCalc } from "../lib/calc";
import { createLibrary, LIBRARY_DISCLAIMER } from "../lib/library";
import type { SandboxSpec } from "../lib/spec";

const lib = createLibrary();
interface Row {
  id: string;
  name: string;
  spec: SandboxSpec;
  baseId: string | null;
  updatedAt: string;
  account: { id: string; name: string } | null;
}

/** DC Sandbox home: create a scenario from a starter room and open existing ones. */
export default function SandboxPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const sp = useSearchParams();
  const [name, setName] = useState("");
  const [account, setAccount] = useState<{ id: string; name: string } | null>(null);
  const [template, setTemplate] = useState("enterprise-row");
  const list = useQuery({
    queryKey: ["sandbox-list"],
    queryFn: () => api<{ items: Row[] }>("/api/sandbox").then((r) => r.items),
  });
  const templates = useQuery({
    queryKey: ["sandbox-templates"],
    queryFn: () =>
      api<{ items: Array<{ id: string; name: string; description: string }> }>(
        "/api/sandbox/templates",
      ).then((r) => r.items),
  });
  const create = useMutation({
    mutationFn: () =>
      api<{ id: string }>("/api/sandbox", {
        method: "POST",
        json: { name, accountId: account?.id ?? sp.get("account"), templateId: template },
      }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["sandbox-list"] });
      router.push(`/sandbox/${s.id}`);
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <PageContainer>
      <PageHeader
        title="DC Sandbox"
        description={`Lay out a data hall, size power and cooling, test growth and failures, walk it in 3D and tour it with a customer. ${LIBRARY_DISCLAIMER}`}
      />
      <section
        className="bg-card grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
        aria-label="New scenario"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="sb-name">Name</Label>
          <Input
            id="sb-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. AI pod phase 1"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sb-acc">Account (optional)</Label>
          <AccountPicker id="sb-acc" value={account} onChange={setAccount} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sb-tpl">Start from</Label>
          <select
            id="sb-tpl"
            className="border-input dark:bg-input/30 h-9 rounded-md border bg-transparent px-2 text-sm"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          >
            {templates.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          disabled={name.trim().length < 2 || create.isPending}
          onClick={() => create.mutate()}
        >
          <Plus /> Create
        </Button>
        <p className="text-muted-foreground text-xs md:col-span-4">
          {templates.data?.find((t) => t.id === template)?.description}
        </p>
      </section>
      {list.data && !list.data.length ? (
        <EmptyState
          icon={Server}
          title="No scenarios yet"
          description="Create one above from a starter room."
        />
      ) : (
        <ul className="bg-card divide-y rounded-lg border" aria-label="Scenarios">
          {list.data?.map((r) => {
            const c = roomCalc(r.spec, lib);
            const crit = c.issues.filter((i) => i.severity === "critical").length;
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]"
              >
                <Link href={`/sandbox/${r.id}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                {r.baseId && (
                  <span className="text-muted-foreground rounded border px-1.5 text-[11px]">
                    what-if
                  </span>
                )}
                {r.account && (
                  <span className="text-muted-foreground text-xs">{r.account.name}</span>
                )}
                <span className="tabular text-muted-foreground ml-auto text-xs">
                  {r.spec.racks.length} racks · {c.drawKw.toFixed(0)} kW · PUE ≈{" "}
                  {c.pue ? c.pue.toFixed(2) : "—"}
                </span>
                <span className={`text-xs ${crit ? "text-critical-text" : "text-good-text"}`}>
                  {crit ? `${crit} critical` : "✓ no critical issues"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
