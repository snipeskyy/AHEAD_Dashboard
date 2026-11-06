"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, EyeOff, FileText, Loader2, Presentation, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DocumentView } from "@/components/export/document-view";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useDebounced } from "@/hooks/use-debounced";
import { api } from "@/lib/api-client";
import {
  ExportConfigSchema,
  FORMAT_META,
  type ExportConfig,
  type ExportFormat,
} from "@/lib/export/config";
import type { ExportDocument } from "@/lib/export/types";
import { DeckOptions } from "./deck-options";
import { DeckPreview, type DeckDoc } from "./deck-preview";
import { ExportOptions } from "./export-options";
import { ScopePicker } from "./scope-picker";
import { SectionPicker } from "./section-picker";

interface Template {
  id: string;
  name: string;
  config: Omit<ExportConfig, "scope" | "title"> & { scopeType: ExportConfig["scope"]["type"] };
}

const FORMAT_ICON = { pdf: FileText, markdown: FileText, pptx: Presentation } as const;

export function ExportBuilder({
  initial,
  initialNames,
}: {
  initial: ExportConfig;
  initialNames: Record<string, string>;
}) {
  const qc = useQueryClient();
  const [config, setConfig] = useState(initial);
  const [names, setNames] = useState(initialNames);
  const [highlight, setHighlight] = useState(true);
  const [tplName, setTplName] = useState("");
  const update = (c: ExportConfig, n?: Record<string, string>) => {
    setConfig(c);
    if (n) setNames((prev) => ({ ...prev, ...n }));
  };

  const templates = useQuery({
    queryKey: ["export-templates"],
    queryFn: () => api<{ items: Template[] }>("/api/export-templates").then((r) => r.items),
  });
  const applyTemplate = (t: Template) => {
    const { scopeType, ...rest } = t.config;
    const ids =
      scopeType === "portfolio"
        ? []
        : scopeType === "account"
          ? config.scope.accountIds.slice(0, 1)
          : config.scope.accountIds;
    setConfig({
      ...config,
      ...rest,
      hiddenFields: rest.hiddenFields ?? [],
      scope: { type: scopeType, accountIds: ids },
    });
  };
  const saveTemplate = useMutation({
    mutationFn: () => {
      const { scope, title: _title, ...rest } = config;
      return api("/api/export-templates", {
        method: "POST",
        json: { name: tplName, config: { ...rest, scopeType: scope.type } },
      });
    },
    onSuccess: () => {
      toast.success("Template saved");
      setTplName("");
      qc.invalidateQueries({ queryKey: ["export-templates"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const valid = ExportConfigSchema.safeParse(config);
  const needsAccount = config.scope.type !== "portfolio" && config.scope.accountIds.length === 0;
  const debounced = useDebounced(config, 350);
  const preview = useQuery({
    queryKey: ["export-preview", debounced],
    queryFn: () =>
      api<ExportDocument | DeckDoc>("/api/exports/preview", {
        method: "POST",
        json: { config: debounced, mode: "preview", view: debounced.style },
      }),
    enabled: valid.success && !needsAccount,
    placeholderData: (prev) => prev,
  });

  const generate = useMutation({
    mutationFn: (format: ExportFormat) =>
      api<{ job: { id: string; version: number }; removedFields: string[] }>("/api/exports", {
        method: "POST",
        json: { config, format },
      }),
    onSuccess: (r, format) => {
      toast.success(`${FORMAT_META[format].label} ready (v${r.job.version})`, {
        description: r.removedFields.length
          ? `${r.removedFields.length} field${r.removedFields.length === 1 ? "" : "s"} redacted`
          : undefined,
        action: {
          label: "Download",
          onClick: () => window.open(`/api/exports/${r.job.id}/download`, "_blank"),
        },
      });
      qc.invalidateQueries({ queryKey: ["exports"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const doc = preview.data;
  const hiddenCount = doc
    ? doc.redaction.removedFields.length + doc.redaction.removedSections.length
    : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
      <div className="grid content-start gap-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Scope & template</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ScopePicker config={config} names={names} onChange={update} />
            <Select
              value=""
              onValueChange={(id) => {
                const t = templates.data?.find((x) => x.id === id);
                if (t) applyTemplate(t);
              }}
            >
              <SelectTrigger size="sm" aria-label="Apply a template" className="w-full">
                <SelectValue placeholder="Apply a template…" />
              </SelectTrigger>
              <SelectContent>
                {templates.data?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Audience & document</CardTitle>
          </CardHeader>
          <CardContent>
            <ExportOptions config={config} onChange={setConfig} />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Style & theme</CardTitle>
          </CardHeader>
          <CardContent>
            <DeckOptions config={config} onChange={setConfig} />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Sections</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <SectionPicker config={config} onChange={setConfig} />
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (tplName.trim().length >= 2) saveTemplate.mutate();
              }}
            >
              <Input
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                placeholder="Save as template…"
                aria-label="Template name"
                className="h-8"
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={tplName.trim().length < 2 || saveTemplate.isPending}
              >
                <Save />
                Save
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 content-start gap-3">
        <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
          {(["pdf", "markdown", "pptx"] as const).map((f) => {
            const Icon = FORMAT_ICON[f];
            const busy = generate.isPending && generate.variables === f;
            return (
              <Button
                key={f}
                size="sm"
                variant={f === "pdf" ? "default" : "outline"}
                disabled={!valid.success || needsAccount || generate.isPending}
                onClick={() => generate.mutate(f)}
              >
                {busy ? (
                  <Loader2 className="animate-spin" />
                ) : f === "pdf" ? (
                  <Download />
                ) : (
                  <Icon />
                )}
                {f === "pdf" && config.style === "deck" ? "PDF (slides)" : FORMAT_META[f].label}
              </Button>
            );
          })}
          <div className="text-muted-foreground ml-auto flex items-center gap-2 text-xs">
            {hiddenCount > 0 && (
              <span className="tabular" aria-live="polite">
                {hiddenCount} item{hiddenCount === 1 ? "" : "s"} redacted
              </span>
            )}
            <label className="flex items-center gap-1.5">
              {highlight ? (
                <Eye className="size-3.5" aria-hidden />
              ) : (
                <EyeOff className="size-3.5" aria-hidden />
              )}
              Show redactions
              <Switch
                checked={highlight}
                onCheckedChange={setHighlight}
                aria-label="Highlight redacted content in preview"
              />
            </label>
          </div>
        </div>
        <div
          className="bg-muted/40 relative rounded-lg p-3 sm:p-6"
          aria-label="Export preview"
          aria-busy={preview.isFetching}
        >
          {needsAccount ? (
            <p className="text-muted-foreground py-16 text-center text-sm">
              Pick an account to preview the export.
            </p>
          ) : !valid.success ? (
            <p className="text-muted-foreground py-16 text-center text-sm">
              {valid.error.issues[0]?.path.join(".") === "sections"
                ? "Enable at least one section."
                : "Add a title to preview."}
            </p>
          ) : preview.isError ? (
            <ErrorState
              title="Preview failed"
              error={preview.error}
              onRetry={() => void preview.refetch()}
            />
          ) : !doc ? (
            <Skeleton className="mx-auto h-[640px] max-w-[820px]" />
          ) : config.style === "deck" && "deck" in doc ? (
            <DeckPreview doc={doc as DeckDoc} config={config} onChange={setConfig} />
          ) : (
            <div className="mx-auto max-w-[820px]">
              <DocumentView doc={highlight ? doc : stripMarked(doc)} />
            </div>
          )}
          {preview.isFetching && doc && (
            <Loader2
              className="text-muted-foreground absolute top-4 right-4 size-4 animate-spin"
              aria-label="Updating preview"
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Preview without highlight: drop marked content so it reads like the final export. */
function stripMarked(doc: ExportDocument): ExportDocument {
  return {
    ...doc,
    sections: doc.sections
      .filter((s) => !s.redacted)
      .map((s) => ({
        ...s,
        blocks: s.blocks
          .filter((b) => !b.redacted)
          .map((b) => {
            if (b.kind === "kv" || b.kind === "list")
              return { ...b, items: b.items.filter((i) => !i.redacted) } as typeof b;
            if (b.kind === "table") return { ...b, columns: b.columns.filter((c) => !c.redacted) };
            return b;
          }),
      })),
  };
}
