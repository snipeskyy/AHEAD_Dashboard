"use client";
import { ArrowDown, ArrowUp, ChevronRight, Lock } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { ExportConfig } from "@/lib/export/config";
import { useMe } from "@/hooks/use-me";
import { fieldStates } from "@/lib/export/redaction";
import { cn } from "@/lib/utils";
import { registry } from "@/modules/registry";

/** Sections from every module's exportSections: enable, reorder, and toggle individual fields. */
export function SectionPicker({
  config,
  onChange,
}: {
  config: ExportConfig;
  onChange: (c: ExportConfig) => void;
}) {
  const defs = registry.exportSections();
  const [open, setOpen] = useState<string | null>(null);
  const scopeType = config.scope.type;
  const applicable = defs.filter(
    (d) =>
      d.scopes.includes(scopeType) || (scopeType === "accounts" && d.scopes.includes("account")),
  );
  const enabled = config.sections.filter((id) => applicable.some((d) => d.id === id));
  const disabled = applicable.filter((d) => !enabled.includes(d.id));
  const ordered = [...enabled.map((id) => applicable.find((d) => d.id === id)!), ...disabled];

  const toggle = (id: string, on: boolean) =>
    onChange({
      ...config,
      sections: on ? [...config.sections, id] : config.sections.filter((x) => x !== id),
    });
  const move = (id: string, dir: -1 | 1) => {
    const list = [...enabled];
    const i = list.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    onChange({ ...config, sections: list });
  };
  const roleHidden = useMe().data?.role.exportHidden ?? [];
  const toggleField = (key: string, visible: boolean) =>
    onChange({
      ...config,
      hiddenFields: visible
        ? config.hiddenFields.filter((k) => k !== key)
        : [...config.hiddenFields, key],
    });

  return (
    <ul className="grid gap-1.5" aria-label="Sections">
      {ordered.map((d) => {
        const on = enabled.includes(d.id);
        const stub = d.status === "stub";
        const internalBlocked = config.audience === "customer" && !!d.internalOnly;
        const fields = fieldStates(d, { ...config, roleHidden });
        const idx = enabled.indexOf(d.id);
        return (
          <li key={d.id} className={cn("bg-card rounded-md border", !on && "bg-muted/30")}>
            <div className="flex items-center gap-2 px-2.5 py-2">
              <Checkbox
                id={`sec-${d.id}`}
                checked={on && !stub}
                disabled={stub}
                onCheckedChange={(v) => toggle(d.id, v === true)}
                aria-label={`Include ${d.title}`}
              />
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                onClick={() => setOpen(open === d.id ? null : d.id)}
                aria-expanded={open === d.id}
                aria-controls={`fields-${d.id}`}
              >
                <ChevronRight
                  className={cn(
                    "text-muted-foreground size-3.5 shrink-0 transition-transform",
                    open === d.id && "rotate-90",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "truncate text-[13px] font-medium",
                    (stub || internalBlocked) && "text-muted-foreground",
                  )}
                >
                  {d.title}
                </span>
              </button>
              {stub && (
                <Badge variant="outline" className="h-5 text-[10px] font-normal">
                  Add-on
                </Badge>
              )}
              {internalBlocked && on && (
                <Badge
                  variant="outline"
                  className="border-critical/40 text-critical-text h-5 gap-1 text-[10px] font-normal"
                >
                  <Lock className="size-2.5" /> Internal
                </Badge>
              )}
              {on && (
                <span className="flex">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move ${d.title} up`}
                    disabled={idx <= 0}
                    onClick={() => move(d.id, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move ${d.title} down`}
                    disabled={idx < 0 || idx >= enabled.length - 1}
                    onClick={() => move(d.id, 1)}
                  >
                    <ArrowDown />
                  </Button>
                </span>
              )}
            </div>
            {open === d.id && (
              <div id={`fields-${d.id}`} className="grid gap-1.5 border-t px-3 py-2.5">
                <p className="text-muted-foreground text-xs">
                  {d.description}
                  {internalBlocked
                    ? " This whole section is internal-only and is removed from customer-facing exports."
                    : ""}
                </p>
                {fields.map((f) => (
                  <label
                    key={f.key}
                    className={cn(
                      "flex items-center gap-2 text-xs",
                      f.locked && "text-muted-foreground",
                    )}
                  >
                    <Checkbox
                      checked={f.visible}
                      disabled={f.locked || stub}
                      onCheckedChange={(v) => toggleField(f.key, v === true)}
                      aria-label={`Show ${f.label}`}
                    />
                    {f.label}
                    {f.visibility === "internal" && (
                      <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[10px]">
                        <Lock className="size-2.5" aria-hidden />
                        internal{f.locked && !roleHidden.includes(f.key) ? " — hidden for customers" : ""}
                      </span>
                    )}
                    {roleHidden.includes(f.key) && <span className="text-muted-foreground text-[10px]">· hidden for your role</span>}
                  </label>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
