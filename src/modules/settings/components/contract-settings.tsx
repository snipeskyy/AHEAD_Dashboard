"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, FileJson, KeyRound, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMounted } from "@/hooks/use-mounted";
import { api } from "@/lib/api-client";
import { SettingsSection } from "./section";

interface EntityPreview {
  key: string;
  total: number;
  create: number;
  merge: number;
  unchanged: number;
  errors: Array<{ label: string; message: string }>;
}
interface Preview {
  source: { system: string; note?: string };
  visibility: string;
  version: string;
  entities: EntityPreview[];
}
interface Status {
  enabled: boolean;
  hasToken: boolean;
  tokenHint: string | null;
  createdAt: string | null;
}

const LABEL: Record<string, string> = {
  accounts: "Accounts",
  contacts: "Contacts",
  opportunities: "Opportunities",
  notes: "Notes",
  partnerReps: "Partner reps",
  activities: "Activities",
  tasks: "Tasks",
};

/** Data contract (Phase 13): schema + example downloads, export, import with preview/undo, and the local read API. */
export function ContractSettings() {
  return (
    <div className="grid gap-6">
      <ContractFiles />
      <LocalApi />
    </div>
  );
}

function ContractFiles() {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; data: unknown } | null>(null);
  const preview = useMutation({
    mutationFn: (data: unknown) =>
      api<Preview>("/api/contract/preview", { method: "POST", json: { file: data } }),
    onError: (e) => toast.error(e.message),
  });
  const commit = useMutation({
    mutationFn: () =>
      api<{ groupId: string; counts: Record<string, { created: number; merged: number }> }>(
        "/api/contract/import",
        { method: "POST", json: { file: file!.data, fileName: file!.name } },
      ),
    onSuccess: (r) => {
      const t = Object.values(r.counts).reduce(
        (s, x) => ({ c: s.c + x.created, m: s.m + x.merged }),
        { c: 0, m: 0 },
      );
      toast.success("Data contract imported", {
        description: `${t.c} created, ${t.m} merged. Undo it from Import → History.`,
      });
      setFile(null);
      preview.reset();
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });
  const pick = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      setFile({ name: f.name, data });
      preview.mutate(data);
    } catch {
      toast.error("That file isn't valid JSON");
    }
  };
  const p = preview.data;
  const errors = p?.entities.flatMap((e) => e.errors.map((x) => ({ ...x, key: e.key }))) ?? [];
  const changes = p?.entities.reduce((s, e) => s + e.create + e.merge, 0) ?? 0;

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
        <div className="grid gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={input}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Contract file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pick(f);
                e.target.value = "";
              }}
            />
            <Button size="sm" onClick={() => input.current?.click()} disabled={preview.isPending}>
              <Upload /> Import a contract file…
            </Button>
            <span className="text-muted-foreground text-xs">
              Preview first; imports dedupe like CSV imports and can be undone from{" "}
              <Link className="underline" href="/import?tab=history">
                Import → History
              </Link>
              .
            </span>
          </div>
          {p && file && (
            <div className="grid gap-3" aria-live="polite">
              <p className="text-[13px]">
                <span className="font-medium">{file.name}</span> · from{" "}
                <span className="font-medium">{p.source.system}</span> · v{p.version} ·{" "}
                {p.visibility}
              </p>
              <div
                className="overflow-x-auto rounded-md border"
                role="region"
                aria-label="Import preview"
                tabIndex={0}
              >
                <table className="w-full text-left text-[13px]">
                  <thead className="text-muted-foreground border-b text-xs">
                    <tr>
                      {["Entity", "In file", "New", "Merge", "Unchanged", "Errors"].map((h) => (
                        <th key={h} className="px-3 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y tabular-nums">
                    {p.entities
                      .filter((e) => e.total)
                      .map((e) => (
                        <tr key={e.key}>
                          <td className="px-3 py-1.5">{LABEL[e.key] ?? e.key}</td>
                          <td className="px-3 py-1.5">{e.total}</td>
                          <td className="px-3 py-1.5">{e.create}</td>
                          <td className="px-3 py-1.5">{e.merge}</td>
                          <td className="px-3 py-1.5">{e.unchanged}</td>
                          <td
                            className={`px-3 py-1.5 ${e.errors.length ? "text-critical-text" : ""}`}
                          >
                            {e.errors.length}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {errors.length > 0 && (
                <ul
                  className="text-critical-text grid gap-0.5 text-xs"
                  aria-label="Rows that will be skipped"
                >
                  {errors.slice(0, 8).map((e, i) => (
                    <li key={i}>
                      ⚠ {LABEL[e.key]}: {e.label}: {e.message}
                    </li>
                  ))}
                  {errors.length > 8 && <li>…and {errors.length - 8} more</li>}
                </ul>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => commit.mutate()}
                  disabled={commit.isPending || !changes}
                >
                  Import {changes} change{changes === 1 ? "" : "s"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFile(null);
                    preview.reset();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
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
    mutationFn: (action: "enable" | "disable" | "generate-token" | "revoke-token") =>
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
      title="Local read-only API"
      description="Lets a tool on this computer read your workspace in the contract format (GET /api/v1/…). Off by default; every request needs the token. Nothing can write through it."
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
