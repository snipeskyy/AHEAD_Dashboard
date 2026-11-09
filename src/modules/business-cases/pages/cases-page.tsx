"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Plus } from "lucide-react";
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
import { computeTco } from "@/lib/tco/compute";
import { TcoModelSchema } from "@/lib/tco/model";
import { money } from "../components/use-case";

interface Row {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  model: unknown;
  account: { id: string; name: string } | null;
  _count: { versions: number };
}

/** Business cases: start from a structure (no prices), list existing ones with their headline savings. */
export default function CasesPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const sp = useSearchParams();
  const [name, setName] = useState("");
  const [account, setAccount] = useState<{ id: string; name: string } | null>(null);
  const [template, setTemplate] = useState("refresh-vs-cloud");
  const opp = sp.get("opportunity");
  const list = useQuery({
    queryKey: ["business-cases"],
    queryFn: () => api<{ items: Row[] }>("/api/business-cases").then((r) => r.items),
  });
  const templates = useQuery({
    queryKey: ["tco-templates"],
    queryFn: () =>
      api<{ items: Array<{ id: string; name: string; description: string }> }>(
        "/api/business-cases/templates",
      ).then((r) => r.items),
  });
  const create = useMutation({
    mutationFn: () =>
      api<{ id: string }>("/api/business-cases", {
        method: "POST",
        json: {
          name,
          accountId: account?.id ?? sp.get("account"),
          opportunityId: opp,
          templateId: template,
        },
      }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["business-cases"] });
      router.push(`/cases/${c.id}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const headline = (r: Row) => {
    const m = TcoModelSchema.safeParse(r.model);
    if (!m.success) return "—";
    const c = computeTco(m.data).comparisons[0];
    return c && c.totalSavings
      ? `${money(c.totalSavings)} ${c.totalSavings >= 0 ? "saved" : "more"} over ${m.data.years} yrs`
      : "No costs entered";
  };
  return (
    <PageContainer>
      <PageHeader
        title="TCO & business cases"
        description="Compare options over 3–10 years with NPV, IRR, payback and sensitivity. Every figure is an assumption you enter; nothing is pre-priced."
      />
      <section
        className="bg-card grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
        aria-label="New business case"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="bc-name">Name</Label>
          <Input
            id="bc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. DC refresh vs cloud"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bc-acc">Account (optional)</Label>
          {sp.get("account") && !account ? (
            <p className="text-muted-foreground text-xs">
              Linked to the account{opp ? " and deal" : ""} you came from.
            </p>
          ) : (
            <AccountPicker id="bc-acc" value={account} onChange={setAccount} />
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bc-tpl">Start from</Label>
          <select
            id="bc-tpl"
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
          {templates.data?.find((t) => t.id === template)?.description} Starting structures have
          every cost at $0 for you to fill in.
        </p>
      </section>
      {list.data && !list.data.length ? (
        <EmptyState
          icon={Calculator}
          title="No business cases yet"
          description="Create one above, or from an account or opportunity."
        />
      ) : (
        <ul className="bg-card divide-y rounded-lg border" aria-label="Business cases">
          {list.data?.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]"
            >
              <Link href={`/cases/${r.id}`} className="font-medium hover:underline">
                {r.name}
              </Link>
              {r.account && <span className="text-muted-foreground text-xs">{r.account.name}</span>}
              <span className="text-muted-foreground rounded border px-1.5 text-[11px]">
                {r.status}
              </span>
              <span className="tabular ml-auto text-xs">{headline(r)}</span>
              <span className="text-muted-foreground text-xs">{r._count.versions} versions</span>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
