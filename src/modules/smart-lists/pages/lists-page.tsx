"use client";
import { useQuery } from "@tanstack/react-query";
import { Pin } from "lucide-react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/page-header";
import { api } from "@/lib/api-client";
import { ListEditor, type ListDef } from "../components/list-editor";

const EXAMPLE: ListDef = {
  name: "Strategic accounts with AI evidence and no AI opp",
  entity: "account",
  pinned: true,
  rules: {
    match: "all",
    rules: [
      { field: "tier", op: "in", value: ["Strategic"] },
      { field: "initiativePractices", op: "has", value: ["ai-infra"] },
      { field: "openOppPractices", op: "lacks", value: ["ai-infra"] },
    ],
  },
};

export default function ListsPage() {
  const { data } = useQuery({ queryKey: ["smart-lists"], queryFn: () => api<{ items: Array<ListDef & { id: string }> }>("/api/smart-lists").then((r) => r.items) });
  return (
    <PageContainer>
      <PageHeader title="Smart lists" description="Saved filters across accounts, opportunities and signals. Pinned lists appear in the sidebar." />
      {!!data?.length && (
        <ul className="bg-card divide-y rounded-lg border" aria-label="Your smart lists">
          {data.map((l) => <li key={l.id} className="flex items-center gap-2 px-4 py-2 text-[13px]">{l.pinned && <Pin className="text-muted-foreground size-3" aria-label="Pinned" />}<Link href={`/lists/${l.id}`} className="font-medium hover:underline">{l.name}</Link><span className="text-muted-foreground text-xs">· {l.entity}s · {l.rules.rules.length} rules</span></li>)}
        </ul>
      )}
      <h2 className="text-sm font-semibold">New list</h2>
      <ListEditor initial={EXAMPLE} />
    </PageContainer>
  );
}
