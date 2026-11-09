"use client";
import { Blocks, Cable, Database, Palette, PlugZap, Sigma, Tags, UserRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { AppearanceSettings } from "../components/appearance-settings";
import { ContractSettings } from "../components/contract-settings";
import { DataSettings } from "../components/data-settings";
import { ModuleSettings } from "../components/module-settings";
import { ProfileSettings } from "../components/profile-settings";
import { ScoringSettings } from "../components/scoring-settings";
import { SourceSettings } from "../components/source-settings";
import { TaxonomySettings } from "../components/taxonomy-settings";

const SECTIONS = [
  { id: "appearance", label: "Appearance", icon: Palette, Component: AppearanceSettings },
  { id: "profile", label: "Profile & team", icon: UserRound, Component: ProfileSettings },
  { id: "modules", label: "Modules & flags", icon: Blocks, Component: ModuleSettings },
  { id: "sources", label: "Data sources", icon: PlugZap, Component: SourceSettings },
  { id: "scoring", label: "Scoring", icon: Sigma, Component: ScoringSettings },
  { id: "taxonomy", label: "Taxonomy & tagging", icon: Tags, Component: TaxonomySettings },
  { id: "data", label: "Data & backup", icon: Database, Component: DataSettings },
  { id: "contract", label: "Data contract & API", icon: Cable, Component: ContractSettings },
] as const;

export default function SettingsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const active = SECTIONS.find((s) => s.id === params.get("tab")) ?? SECTIONS[0];
  const Active = active.Component;
  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Everything is stored locally in your workspace database."
      />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto lg:flex-col">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => router.replace(`/settings?tab=${s.id}`, { scroll: false })}
              aria-current={s.id === active.id ? "page" : undefined}
              className={cn(
                "text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 shrink-0 items-center gap-2 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                s.id === active.id && "bg-muted text-foreground",
              )}
            >
              <s.icon className="size-4" aria-hidden />
              {s.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          <Active />
        </div>
      </div>
    </PageContainer>
  );
}
