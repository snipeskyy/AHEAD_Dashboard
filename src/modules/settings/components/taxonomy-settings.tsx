"use client";
import { useMutation } from "@tanstack/react-query";
import { Plus, RotateCcw, Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveSetting, useSetting } from "@/hooks/use-setting";
import { api } from "@/lib/api-client";
import { DEFAULT_TAGGING_RULES, tagText, type TaggingRule } from "@/lib/tagging/rules";
import { practiceLabel } from "@/config/practice-areas";
import { PipelineLists } from "./pipeline-lists";
import { SettingsSection } from "./section";

/** Editable keyword → practice-area rules, with a live tester and a "re-tag existing signals" action. */
export function TaxonomySettings() {
  const { data: practices = [] } = useSetting("taxonomy.practiceAreas");
  const { data: saved } = useSetting("tagging.rules");
  return (
    <div className="grid gap-6">
      {saved && <RulesEditor key={JSON.stringify(saved)} saved={saved} practices={practices} />}
      <PipelineLists />
    </div>
  );
}

function RulesEditor({
  saved,
  practices,
}: {
  saved: TaggingRule[];
  practices: Array<{ id: string; label: string; description: string }>;
}) {
  const save = useSaveSetting("tagging.rules");
  const [rules, setRules] = useState<TaggingRule[]>(() =>
    practices.map(
      (p) => saved.find((r) => r.practiceArea === p.id) ?? { practiceArea: p.id, keywords: [] },
    ),
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sample, setSample] = useState(
    "Acme hiring 12 GPU engineers for its new AI factory; also expanding ServiceNow ITSM",
  );
  const dirty =
    JSON.stringify(rules) !==
    JSON.stringify(
      practices.map(
        (p) => saved.find((r) => r.practiceArea === p.id) ?? { practiceArea: p.id, keywords: [] },
      ),
    );
  const result = useMemo(() => tagText(sample, rules), [sample, rules]);
  const retag = useMutation({
    mutationFn: () => api("/api/jobs", { method: "POST", json: { kind: "retag-signals" } }),
    onSuccess: () => toast.success("Re-tagging recent signals in the background"),
  });

  const add = (pid: string) => {
    const kw = (drafts[pid] ?? "").trim();
    if (!kw) return;
    setRules(
      rules.map((r) =>
        r.practiceArea === pid && !r.keywords.some((k) => k.toLowerCase() === kw.toLowerCase())
          ? { ...r, keywords: [...r.keywords, kw] }
          : r,
      ),
    );
    setDrafts({ ...drafts, [pid]: "" });
  };
  const remove = (pid: string, kw: string) =>
    setRules(
      rules.map((r) =>
        r.practiceArea === pid ? { ...r, keywords: r.keywords.filter((k) => k !== kw) } : r,
      ),
    );

  return (
    <div className="grid gap-6">
      <SettingsSection
        title="Tagging rules"
        description="A signal is tagged with a practice area when any keyword matches (case-insensitive, whole word, plural allowed). Practice areas themselves are defined in src/config/practice-areas.ts."
        actions={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setRules(
                  practices.map(
                    (p) =>
                      DEFAULT_TAGGING_RULES.find((r) => r.practiceArea === p.id) ?? {
                        practiceArea: p.id,
                        keywords: [],
                      },
                  ),
                )
              }
            >
              <RotateCcw /> Defaults
            </Button>
            <Button
              size="sm"
              disabled={!dirty || save.isPending}
              onClick={() =>
                save.mutate(rules, {
                  onSuccess: () =>
                    toast.success("Rules saved — re-tag existing signals to apply them to history"),
                })
              }
            >
              <Save /> Save rules
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={dirty || retag.isPending}
              onClick={() => retag.mutate()}
            >
              Re-tag signals
            </Button>
          </div>
        }
      >
        <ul className="divide-y">
          {practices.map((p) => {
            const r = rules.find((x) => x.practiceArea === p.id)!;
            return (
              <li
                key={p.id}
                className="grid gap-2 py-3 first:pt-0 last:pb-0 md:grid-cols-[200px_1fr]"
              >
                <div>
                  <div className="text-[13px] font-medium">{p.label}</div>
                  <div className="text-muted-foreground text-xs">{p.description}</div>
                </div>
                <div className="grid gap-2">
                  <ul className="flex flex-wrap gap-1">
                    {r.keywords.map((k) => (
                      <li key={k}>
                        <Badge variant="secondary" className="gap-1 pr-1 font-normal">
                          {k}
                          <button
                            type="button"
                            aria-label={`Remove keyword ${k} from ${p.label}`}
                            onClick={() => remove(p.id, k)}
                            className="hover:bg-muted rounded"
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      </li>
                    ))}
                    {r.keywords.length === 0 && (
                      <li className="text-muted-foreground text-xs">
                        No keywords — this practice will never be tagged automatically.
                      </li>
                    )}
                  </ul>
                  <form
                    className="flex gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      add(p.id);
                    }}
                  >
                    <Input
                      value={drafts[p.id] ?? ""}
                      onChange={(e) => setDrafts({ ...drafts, [p.id]: e.target.value })}
                      placeholder="Add keyword…"
                      className="h-7 w-56 text-xs"
                      aria-label={`Add keyword to ${p.label}`}
                    />
                    <Button
                      type="submit"
                      size="xs"
                      variant="outline"
                      disabled={!(drafts[p.id] ?? "").trim()}
                    >
                      <Plus /> Add
                    </Button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      </SettingsSection>
      <SettingsSection
        title="Test the rules"
        description="Type a headline to see which practice areas the current (unsaved) rules would assign."
      >
        <Input
          value={sample}
          onChange={(e) => setSample(e.target.value)}
          aria-label="Sample headline"
        />
        <div className="mt-3 flex flex-wrap gap-1.5" aria-live="polite">
          {result.hits.length === 0 ? (
            <span className="text-muted-foreground text-xs">No practice area matched.</span>
          ) : (
            result.hits.map((h, i) => (
              <Badge key={i} variant="outline" className="font-normal">
                “{h.keyword}” → {practiceLabel(h.practiceArea, true)}
              </Badge>
            ))
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
