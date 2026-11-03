"use client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { DEFAULT_TEMPLATES, type ExportConfig } from "@/lib/export/config";
import { ExportBuilder } from "../components/export-builder";
import { ExportHistory } from "../components/export-history";

/** `?account=<id>` opens the builder pre-scoped to one account (linked from Account 360). */
export default function ExportsPage() {
  const params = useSearchParams();
  const accountId = params.get("account");
  const { data: acc, isPending } = useQuery({
    queryKey: ["account-name", accountId],
    queryFn: () =>
      api<{ account: { id: string; name: string } }>(`/api/accounts/${accountId}`).then(
        (r) => r.account,
      ),
    enabled: !!accountId,
  });
  const scoped = accountId && acc ? acc : null;
  const { scopeType, ...rest } = DEFAULT_TEMPLATES[scoped ? 0 : 2].config;
  const initial: ExportConfig = {
    ...rest,
    hiddenFields: rest.hiddenFields ?? [],
    title: scoped ? `${scoped.name} — account brief` : "Portfolio readout",
    scope: scoped
      ? { type: "account", accountIds: [scoped.id] }
      : { type: scopeType, accountIds: [] },
  };
  return (
    <PageContainer>
      <PageHeader
        title="Exports"
        description="Assemble executive-ready summaries from every module, with audience-aware redaction."
      />
      <Tabs defaultValue="build">
        <TabsList>
          <TabsTrigger value="build">Builder</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="build" className="mt-3">
          {accountId && isPending ? (
            <Skeleton className="h-[640px]" />
          ) : (
            <ExportBuilder
              key={scoped?.id ?? "portfolio"}
              initial={initial}
              initialNames={scoped ? { [scoped.id]: scoped.name } : {}}
            />
          )}
        </TabsContent>
        <TabsContent value="history" className="mt-3">
          <ExportHistory />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
