"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditLog } from "../components/audit-log";
import { ImportPack } from "../components/import-pack";
import { PlayLibrary } from "../components/play-library";
import { SharePack } from "../components/share-pack";

const TABS = [
  { id: "share", label: "Share accounts", C: SharePack },
  { id: "import", label: "Import a pack", C: ImportPack },
  { id: "plays", label: "Play Library", C: PlayLibrary },
  { id: "audit", label: "Audit log", C: AuditLog },
] as const;

export default function SharePage() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = TABS.find((t) => t.id === params.get("tab")) ?? TABS[0];
  return (
    <PageContainer>
      <PageHeader title="Team & sharing" description="Hand accounts and plays to a teammate as a file; they import it into their own ACC. Nothing is uploaded anywhere." />
      <Tabs value={tab.id} onValueChange={(v) => router.replace(`/share?tab=${v}`, { scroll: false })}>
        <TabsList>{TABS.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}</TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-4">
            {t.id === tab.id && <t.C />}
          </TabsContent>
        ))}
      </Tabs>
    </PageContainer>
  );
}
