"use client";
import { Badge } from "@/components/ui/badge";
import { useSetting } from "@/hooks/use-setting";
import { SettingsSection } from "./section";

/** Read-only in Phase 1; the taxonomy and tagging-rules editors arrive with Live Signals (Phase 3). */
export function TaxonomySettings() {
  const { data: practices = [] } = useSetting("taxonomy.practiceAreas");
  const { data: rules = [] } = useSetting("tagging.rules");
  return (
    <div className="grid gap-6">
      <SettingsSection
        title="Practice areas & tagging rules"
        description="Signals are tagged with a practice area when any keyword matches (case-insensitive, whole word)."
      >
        <ul className="divide-y">
          {practices.map((p) => {
            const kws = rules.find((r) => r.practiceArea === p.id)?.keywords ?? [];
            return (
              <li
                key={p.id}
                className="grid gap-2 py-3 first:pt-0 last:pb-0 md:grid-cols-[220px_1fr]"
              >
                <div>
                  <div className="text-[13px] font-medium">{p.label}</div>
                  <div className="text-muted-foreground text-xs">{p.description}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {kws.map((k) => (
                    <Badge key={k} variant="secondary" className="font-normal">
                      {k}
                    </Badge>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </SettingsSection>
    </div>
  );
}
