"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IMPORT_KINDS, type ImportKind } from "@/lib/import/types";
import { ImportHistory } from "../components/import-history";
import { ImportWizard } from "../components/import-wizard";

export default function ImportPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = params.get("tab") === "history" ? "history" : "new";
  const kindParam = params.get("kind");
  const kind = (IMPORT_KINDS as readonly string[]).includes(kindParam ?? "")
    ? (kindParam as ImportKind)
    : "accounts";
  const setParams = (next: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  return (
    <PageContainer>
      <PageHeader
        title="Import data"
        description="Bring in what you already know: accounts first, then contacts, opportunities, notes and partner reps. Files are parsed on this machine and every import can be undone."
      />
      <Tabs
        value={tab}
        onValueChange={(v) => setParams({ tab: v === "history" ? "history" : null })}
      >
        <TabsList>
          <TabsTrigger value="new" aria-controls={undefined /* URL-driven tabs */}>
            New import
          </TabsTrigger>
          <TabsTrigger value="history" aria-controls={undefined}>
            History
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "history" ? (
        <ImportHistory />
      ) : (
        <ImportWizard initialKind={kind} onKindChange={(k) => setParams({ kind: k })} />
      )}
    </PageContainer>
  );
}
