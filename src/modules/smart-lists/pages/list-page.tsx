"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { CardSkeleton, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { ListEditor, Results, type ListDef } from "../components/list-editor";

export default function ListPage({ params }: { params: Record<string, string> }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["smart-lists", params.id],
    queryFn: () => api<{ list: ListDef & { id: string }; results: { total: number; of: number; items: Array<{ id: string; href: string; title: string; sub: string }> } }>(`/api/smart-lists/${params.id}`),
  });
  const del = useMutation({ mutationFn: () => api(`/api/smart-lists/${params.id}`, { method: "DELETE" }), onSuccess: () => router.push("/lists") });
  if (isLoading) return <PageContainer><CardSkeleton lines={6} /></PageContainer>;
  if (error || !data) return <PageContainer><ErrorState error={error} onRetry={() => refetch()} /></PageContainer>;
  return (
    <PageContainer>
      <PageHeader
        title={data.list.name}
        description={`${data.list.entity === "account" ? "Accounts" : data.list.entity === "opportunity" ? "Opportunities" : "Signals"} matching ${data.list.rules.match} of ${data.list.rules.rules.length} rules`}
        actions={<><Button size="sm" variant="outline" onClick={() => setEditing(!editing)}>{editing ? "Done" : "Edit rules"}</Button><Button size="sm" variant="ghost" aria-label="Delete list" onClick={() => del.mutate()}><Trash2 /></Button></>}
      />
      {editing ? <ListEditor initial={data.list} onSaved={() => { setEditing(false); refetch(); }} /> : <Results r={data.results} />}
    </PageContainer>
  );
}
