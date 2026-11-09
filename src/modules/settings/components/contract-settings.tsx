"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, FileJson, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMounted } from "@/hooks/use-mounted";
import { api } from "@/lib/api-client";
import { ContractReview } from "./contract-review";
import { SecurityChecklist } from "./security-checklist";
import { SettingsSection } from "./section";

interface Status {
  enabled: boolean;
  hasToken: boolean;
  tokenHint: string | null;
  createdAt: string | null;
  allowStaging: boolean;
}

/** Data contract (Phase 13): schema + example downloads, export, import with preview/undo, and the local read API. */
export function ContractSettings() {
  return (
    <div className="grid gap-6">
      <SecurityChecklist />
      <ContractReview />
      <ContractFiles />
      <LocalApi />
    </div>
  );
}

function ContractFiles() {
  return (
    <SettingsSection
      title="Data contract"
      description="A neutral, versioned JSON format (acc-data v1) for moving your own account knowledge in and out of ACC: accounts, contacts, opportunities, activities, notes, tasks and partner reps. It has no fields for personal contact details or pricing."
    >
      <div className="grid gap-5">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href="/api/contract/schema" download aria-label="Download JSON Schema">
              <FileJson /> Download JSON Schema
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href="/api/contract/example" download aria-label="Download example file">
              <FileJson /> Download example file
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a
              href="/api/contract/export?visibility=internal"
              download
              aria-label="Export internal"
            >
              <Download /> Export internal
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a
              href="/api/contract/export?visibility=customer-safe"
              download
              aria-label="Export customer-safe"
            >
              <Download /> Export customer-safe
            </a>
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Exports leave out demo data and anything your role hides. Customer-safe also drops deal
          amounts, probabilities, owner notes and notes.
        </p>
      </div>
    </SettingsSection>
  );
}

function LocalApi() {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const status = useQuery({
    queryKey: ["local-api"],
    queryFn: () => api<Status>("/api/local-api"),
  });
  const act = useMutation({
    mutationFn: (
      action:
        | "enable"
        | "disable"
        | "generate-token"
        | "revoke-token"
        | "allow-staging"
        | "block-staging",
    ) =>
      api<{ status: Status; token?: string }>("/api/local-api", {
        method: "POST",
        json: { action },
      }),
    onSuccess: (r) => {
      qc.setQueryData(["local-api"], r.status);
      setToken(r.token ?? null);
    },
    onError: (e) => toast.error(e.message),
  });
  const s = status.data;
  const mounted = useMounted();
  const origin = mounted ? window.location.origin : "http://localhost:3000";
  const curl = `curl -H "Authorization: Bearer ${token ?? "<token>"}" ${origin}/api/v1/accounts`;
  return (
    <SettingsSection
      title="Local API"
      description="Lets a tool read your workspace in the contract format (GET /api/v1/…) and, if you allow it, send files for review. Off by default; every request needs the token. Nothing is ever applied without your review."
    >
      <div className="grid gap-4">
        <div className="flex items-center gap-3">
          <Switch
            id="local-api-enabled"
            checked={!!s?.enabled}
            disabled={!s || act.isPending}
            onCheckedChange={(v) => act.mutate(v ? "enable" : "disable")}
          />
          <Label htmlFor="local-api-enabled">Enable the local API</Label>
          <span className="text-muted-foreground text-xs">{s?.enabled ? "On" : "Off"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Switch
            id="local-api-staging"
            checked={!!s?.allowStaging}
            disabled={!s || act.isPending}
            onCheckedChange={(v) => act.mutate(v ? "allow-staging" : "block-staging")}
          />
          <Label htmlFor="local-api-staging">Let tools with the token send data for review</Label>
          <span className="text-muted-foreground text-xs">
            {s?.allowStaging ? "On" : "Off"} · POST /api/v1/staged-imports (e.g. a Glean action).
            Files only wait in the review queue; nothing is applied without you.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <KeyRound className="text-muted-foreground size-4" aria-hidden />
          <span>{s?.hasToken ? `Token ending …${s.tokenHint}` : "No token yet"}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => act.mutate("generate-token")}
            disabled={act.isPending}
          >
            {s?.hasToken ? "Replace token" : "Generate token"}
          </Button>
          {s?.hasToken && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => act.mutate("revoke-token")}
              disabled={act.isPending}
            >
              Revoke
            </Button>
          )}
        </div>
        {token && (
          <div className="bg-muted grid gap-2 rounded-md p-3 text-[13px]" role="status">
            <p className="font-medium">Copy this token now. It won’t be shown again.</p>
            <div className="flex items-center gap-2">
              <code
                className="bg-background min-w-0 flex-1 truncate rounded border px-2 py-1 font-mono text-xs"
                data-testid="api-token"
              >
                {token}
              </code>
              <Button
                size="sm"
                variant="outline"
                aria-label="Copy token"
                onClick={() =>
                  navigator.clipboard?.writeText(token).then(() => toast.success("Copied"))
                }
              >
                <Copy /> Copy
              </Button>
            </div>
          </div>
        )}
        <div className="grid gap-1">
          <p className="text-muted-foreground text-xs">Example</p>
          <code className="bg-muted overflow-x-auto rounded-md px-3 py-2 font-mono text-xs whitespace-pre">
            {curl}
          </code>
          <p className="text-muted-foreground text-xs">
            Endpoints: accounts, accounts/&#123;id&#125;, contacts, opportunities, activities,
            tasks, export. Add ?visibility=customer-safe for the redacted view. See
            docs/DATA_CONTRACT.md.
          </p>
        </div>
      </div>
    </SettingsSection>
  );
}
