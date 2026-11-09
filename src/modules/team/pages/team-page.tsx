"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamDigest } from "../components/team-digest";
import { TerritoryPlan } from "../components/territory-plan";
import { Workload } from "../components/workload";

const TABS = ["workload", "plan", "digest"] as const;

/** Account team workspace: workload, shared territory plan, weekly digest. */
export default function TeamPage() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = TABS.find((t) => t === params.get("tab")) ?? "workload";
  return (
    <PageContainer>
      <PageHeader
        title="Team workspace"
        description="Who is doing what, where each plan stands, and the week in one page. Teammates are names you add in Settings → Profile & team."
      />
      <Tabs
        value={tab}
        onValueChange={(v) => router.replace(`/team?tab=${v}`, { scroll: false })}
        className="gap-4"
      >
        <TabsList>
          <TabsTrigger value="workload">Workload</TabsTrigger>
          <TabsTrigger value="plan">Territory plan</TabsTrigger>
          <TabsTrigger value="digest">Weekly digest</TabsTrigger>
        </TabsList>
        <TabsContent value="workload">{tab === "workload" && <Workload />}</TabsContent>
        <TabsContent value="plan">{tab === "plan" && <TerritoryPlan />}</TabsContent>
        <TabsContent value="digest">{tab === "digest" && <TeamDigest />}</TabsContent>
      </Tabs>
    </PageContainer>
  );
}
