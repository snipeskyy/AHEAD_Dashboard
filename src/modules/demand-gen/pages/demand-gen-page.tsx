"use client";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarRange, Lightbulb, PenLine, Presentation, Sparkles } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NeedsAccounts } from "@/components/states/needs-data";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import type { MessageChannel } from "@/lib/demand-gen/messages";
import { CampaignPlanner } from "../components/campaign-planner";
import { EventsView } from "../components/events-view";
import { MessageBuilder } from "../components/message-builder";
import { MetricsView } from "../components/metrics-view";
import { PlayLibrary } from "../components/play-library";
import { RecommenderView } from "../components/recommender-view";

const TABS = [
  { id: "plays", label: "Play library", icon: Lightbulb },
  { id: "recommender", label: "Recommender", icon: Sparkles },
  { id: "campaigns", label: "Campaign planner", icon: CalendarRange },
  { id: "messages", label: "Message builder", icon: PenLine },
  { id: "events", label: "Events", icon: Presentation },
  { id: "metrics", label: "Metrics", icon: BarChart3 },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function DemandGenPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "plays") as TabId;
  const accountId = params.get("account");
  const { data: acc } = useQuery({
    queryKey: ["account-name", accountId],
    queryFn: () =>
      api<{ account: { id: string; name: string } }>(`/api/accounts/${accountId}`).then(
        (r) => r.account,
      ),
    enabled: !!accountId,
  });
  const initialAccount = acc ? { id: acc.id, name: acc.name } : null;
  const waitingForAccount = !!accountId && !acc;

  return (
    <PageContainer>
      <PageHeader
        title="Demand Gen"
        description="Plan and run outreach: reusable plays, explainable recommendations, a campaign calendar, templated messages, and events."
      />
      <Tabs
        value={tab}
        onValueChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}
      >
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger
                aria-controls={
                  undefined /* URL-driven tabs: the panel is rendered outside <Tabs> */
                }
                key={t.id}
                value={t.id}
                className="gap-1.5"
              >
                <t.icon className="size-3.5" /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      {tab === "plays" && <PlayLibrary />}
      {tab === "recommender" && !waitingForAccount && (
        <NeedsAccounts what="Play recommendations">
          <RecommenderView
            key={accountId ?? "none"}
            initialAccount={initialAccount}
            highlightPractice={params.get("practice")}
          />
        </NeedsAccounts>
      )}
      {tab === "campaigns" && <CampaignPlanner />}
      {tab === "messages" && !waitingForAccount && (
        <NeedsAccounts what="Message drafts">
          <MessageBuilder
            key={accountId ?? "none"}
            initialAccount={initialAccount}
            initialPersona={params.get("persona")}
            initialChannel={(params.get("channel") as MessageChannel) ?? null}
          />
        </NeedsAccounts>
      )}
      {tab === "events" && <EventsView />}
      {tab === "metrics" && (
        <NeedsAccounts what="Outreach metrics">
          <MetricsView />
        </NeedsAccounts>
      )}
    </PageContainer>
  );
}
