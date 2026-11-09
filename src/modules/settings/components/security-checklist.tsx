"use client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { api } from "@/lib/api-client";
import { SettingsSection } from "./section";

interface Check {
  id: string;
  label: string;
  status: "ok" | "warn" | "info";
  detail: string;
}
const ICON = { ok: CheckCircle2, warn: AlertTriangle, info: Info } as const;
const TONE = {
  ok: "text-good-text",
  warn: "text-warning-text",
  info: "text-muted-foreground",
} as const;
const WORD = { ok: "OK", warn: "Action needed", info: "Note" } as const;

/** Phase 15: what protects customer and internal data on this computer. */
export function SecurityChecklist() {
  const q = useQuery({
    queryKey: ["security"],
    queryFn: () => api<{ items: Check[] }>("/api/security").then((r) => r.items),
  });
  return (
    <SettingsSection
      title="Security checklist"
      description="Check these before bringing in customer or internal data (e.g. from Glean). Data stays on this computer."
    >
      {!q.data ? (
        <p className="text-muted-foreground text-[13px]">Checking…</p>
      ) : (
        <ul className="grid gap-2" aria-label="Security checklist">
          {q.data.map((c) => {
            const Icon = ICON[c.status];
            return (
              <li key={c.id} className="flex items-start gap-2 text-[13px]">
                <Icon className={`mt-0.5 size-4 shrink-0 ${TONE[c.status]}`} aria-hidden />
                <span>
                  <span className="font-medium">{c.label}</span>{" "}
                  <span className={`text-xs ${TONE[c.status]}`}>({WORD[c.status]})</span>
                  <span className="text-muted-foreground block text-xs">{c.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SettingsSection>
  );
}
