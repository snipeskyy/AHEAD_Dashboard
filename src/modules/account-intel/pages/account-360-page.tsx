"use client";
import { ArrowLeft, Calculator, ClipboardList, ExternalLink, FileOutput, FlaskConical, Globe, KanbanSquare, NotebookPen, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { NotesList } from "@/components/notes-list";
import { PageContainer } from "@/components/page-header";
import { CardSkeleton, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api-client";
import { CreateOppDialog } from "@/modules/opportunities/components/create-opp-dialog";
import { useUiStore } from "@/stores/ui-store";
import { TierBadge } from "../components/account-columns";
import { AccountSources } from "../components/account-sources";
import { ActivityTab } from "../components/tabs/activity-tab";
import { CommitteeTab } from "../components/tabs/committee-tab";
import { IntelligenceTab } from "../components/tabs/intelligence-tab";
import { BudgetTiming } from "../components/budget-timing";
import { EnrichActions } from "../components/enrichment/enrich-actions";
import { OppsTab } from "../components/tabs/opps-tab";
import { ProfileTab } from "../components/tabs/profile-tab";
import { OverviewTab } from "../components/tabs/overview-tab";
import { PlanTab } from "../components/tabs/plan-tab";
import { SignalsTab } from "../components/tabs/signals-tab";
import { WhitespaceTab } from "../components/tabs/whitespace-tab";
import { useAccount360 } from "../hooks/use-accounts";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "profile", label: "Profile" },
  { id: "intelligence", label: "Intelligence" },
  { id: "committee", label: "Buying Committee", internal: true },
  { id: "whitespace", label: "Whitespace" },
  { id: "signals", label: "Signals" },
  { id: "opportunities", label: "Opportunities", internal: true },
  { id: "activity", label: "Activity" },
  { id: "notes", label: "Notes", internal: true },
  { id: "plan", label: "Account Plan" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function Account360Page({ params }: { params: Record<string, string> }) {
  const id = params.id;
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (TABS.find((t) => t.id === search.get("tab"))?.id ?? "overview") as TabId;
  const { data: d, isLoading, error, refetch } = useAccount360(id);
  const openNote = useUiStore((s) => s.openNoteDialog);
  const [creating, setCreating] = useState(false);

  if (isLoading)
    return (
      <PageContainer>
        <CardSkeleton lines={2} />
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} lines={6} />
          ))}
        </div>
      </PageContainer>
    );
  if (error || !d)
    return (
      <PageContainer>
        <ErrorState
          title={
            error instanceof ApiError && error.status === 404
              ? "Account not found"
              : "Couldn't load account"
          }
          error={error}
          onRetry={() => refetch()}
        />
      </PageContainer>
    );
  const a = d.account;
  return (
    <PageContainer>
      <header className="grid grid-cols-1 gap-3">
        <Link
          href="/accounts"
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-xs"
        >
          <ArrowLeft className="size-3" /> Accounts
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{a.name}</h1>
              <span data-internal-only="true">
                <TierBadge tier={a.tier} />
              </span>
              {a.isDemo ? (
                <Badge variant="outline" className="text-muted-foreground gap-1 font-normal">
                  <FlaskConical className="size-3" /> Fictional demo account
                </Badge>
              ) : (
                <Badge variant="outline" className="text-good-text gap-1 font-normal">
                  <ShieldCheck className="size-3" /> Real account · public sources only
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
              <span>
                {a.industry}
                {a.subIndustry ? ` · ${a.subIndustry}` : ""}
              </span>
              {a.hq && <span>{a.hq}</span>}
              {a.domain &&
                (a.isDemo ? (
                  <span className="inline-flex items-center gap-1">
                    <Globe className="size-3" />
                    {a.domain}
                  </span>
                ) : (
                  <a
                    href={`https://${a.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground inline-flex items-center gap-1"
                  >
                    <Globe className="size-3" />
                    {a.domain}
                    <ExternalLink className="size-3" />
                  </a>
                ))}
              {a.ticker && <span>Ticker {a.ticker}</span>}
              <BudgetTiming fye={(a as { fiscalYearEnd?: string | null }).fiscalYearEnd} />
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/accounts/${a.id}/brief`}>
                <ClipboardList /> Prep brief
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/cases?account=${a.id}`}>
                <Calculator /> Business case
              </Link>
            </Button>
            <EnrichActions accountId={a.id} accountName={a.name} isDemo={a.isDemo} />
            <Button variant="outline" size="sm" asChild>
              <Link href={`/exports?account=${a.id}`}>
                <FileOutput /> Export
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => openNote("account", a.id)}>
              <NotebookPen /> Note
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <KanbanSquare /> New opportunity
            </Button>
          </div>
        </div>
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
                  data-internal-only={"internal" in t && t.internal ? "true" : undefined}
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      </header>

      <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
        {tab === "overview" && <OverviewTab d={d} />}
        {tab === "profile" && <ProfileTab accountId={a.id} accountName={a.name} />}
        {tab === "intelligence" && <IntelligenceTab d={d} />}
        {tab === "committee" && <CommitteeTab d={d} />}
        {tab === "whitespace" && <WhitespaceTab d={d} />}
        {tab === "signals" && (
          <div className="grid gap-4">
            <AccountSources d={d} />
            <SignalsTab accountId={a.id} />
          </div>
        )}
        {tab === "opportunities" && <OppsTab accountId={a.id} accountName={a.name} />}
        {tab === "activity" && <ActivityTab accountId={a.id} />}
        {tab === "notes" && (
          <div className="max-w-3xl">
            <NotesList entityType="account" entityId={a.id} />
          </div>
        )}
        {tab === "plan" && <PlanTab d={d} />}
      </div>
      <CreateOppDialog
        open={creating}
        onOpenChange={setCreating}
        defaults={{ account: { id: a.id, name: a.name } }}
        onCreated={(oid) => router.push(`/opportunities?focus=${oid}`)}
      />
    </PageContainer>
  );
}
