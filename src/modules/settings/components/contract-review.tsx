"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardPaste, Inbox, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { SettingsSection } from "./section";

interface Change {
  label: string;
  action: "create" | "merge";
  diff: Array<{ label: string; current: string; incoming: string }>;
}
interface EntityPreview {
  key: string;
  total: number;
  create: number;
  merge: number;
  unchanged: number;
  errors: Array<{ label: string; message: string }>;
  changes: Change[];
}
interface Review {
  id: string;
  origin: string;
  fileName: string | null;
  createdAt: string;
  preview: {
    source: { system: string };
    visibility: string;
    version: string;
    entities: EntityPreview[];
  };
}
interface Staged {
  id: string;
  origin: string;
  source: string;
  fileName: string | null;
  summary: Record<string, number>;
  createdAt: string;
}
interface Source {
  system: string;
  imports: number;
  linkedRecords: number;
  pending: number;
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
const when = (s: string) =>
  new Date(s).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** Paste or upload (or receive from the staging API) → review field by field → apply or discard. */
export function ContractReview() {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["staged"] });
    qc.invalidateQueries({ queryKey: ["contract-sources"] });
  };
  const staged = useQuery({
    queryKey: ["staged"],
    queryFn: () => api<{ items: Staged[] }>("/api/contract/staged").then((r) => r.items),
  });
  const stage = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ id: string }>("/api/contract/staged", { method: "POST", json: body }),
    onSuccess: (r) => {
      setText("");
      setOpen(r.id);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const pick = async (f: File) => {
    try {
      stage.mutate({ file: JSON.parse(await f.text()), fileName: f.name, origin: "file" });
    } catch {
      toast.error("That file isn't valid JSON");
    }
  };

  return (
    <SettingsSection
      title="Bring in data (Glean or a file)"
      description="Paste the acc-data JSON your Glean agent produced, or upload a file. Nothing changes until you review it and press Apply; every import can be undone."
    >
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="contract-paste">Paste Glean output</Label>
          <Textarea
            id="contract-paste"
            rows={5}
            className="font-mono text-xs"
            value={text}
            placeholder={
              '```json\n{ "format": "acc-data", "version": "1.0", "source": { "system": "glean" }, ... }\n```'
            }
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!text.trim() || stage.isPending}
              onClick={() => stage.mutate({ text, origin: "paste", fileName: "Pasted from Glean" })}
            >
              <ClipboardPaste /> Review pasted data
            </Button>
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => input.current?.click()}
              disabled={stage.isPending}
            >
              <Upload /> Upload a file…
            </Button>
            <span className="text-muted-foreground self-center text-xs">
              Prompt and format: docs/GLEAN.md. Undo from{" "}
              <Link className="underline" href="/import?tab=history">
                Import → History
              </Link>
              .
            </span>
          </div>
        </div>

        <div className="grid gap-2 border-t pt-4">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Inbox className="size-4" aria-hidden /> Waiting for review
          </h3>
          {!staged.data?.length ? (
            <p className="text-muted-foreground text-[13px]">Nothing waiting.</p>
          ) : (
            <ul className="divide-y rounded-md border" aria-label="Waiting for review">
              {staged.data.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[13px]"
                >
                  <span className="font-medium">{s.fileName ?? s.source}</span>
                  <span className="text-muted-foreground text-xs">
                    from {s.source} · {s.origin === "api" ? "staging API" : s.origin} ·{" "}
                    {when(s.createdAt)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {Object.entries(s.summary)
                      .filter(([, n]) => n)
                      .map(([k, n]) => `${n} ${LABEL[k]?.toLowerCase() ?? k}`)
                      .join(", ") || "empty"}
                  </span>
                  <Button
                    size="sm"
                    variant={open === s.id ? "default" : "outline"}
                    className="ml-auto h-7"
                    onClick={() => setOpen(open === s.id ? null : s.id)}
                    aria-label={`Review ${s.fileName ?? s.source}`}
                  >
                    Review
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {open && (
            <ReviewPanel
              key={open}
              id={open}
              onDone={() => {
                setOpen(null);
                refresh();
                qc.invalidateQueries();
              }}
            />
          )}
        </div>
        <Sources onChanged={refresh} />
      </div>
    </SettingsSection>
  );
}

function ReviewPanel({ id, onDone }: { id: string; onDone: () => void }) {
  const r = useQuery({
    queryKey: ["staged", id],
    queryFn: () => api<Review>(`/api/contract/staged/${id}`),
  });
  const apply = useMutation({
    mutationFn: () =>
      api<{ counts: Record<string, { created: number; merged: number }> }>(
        `/api/contract/staged/${id}/apply`,
        { method: "POST" },
      ),
    onSuccess: (res) => {
      const t = Object.values(res.counts).reduce(
        (s, x) => ({ c: s.c + x.created, m: s.m + x.merged }),
        { c: 0, m: 0 },
      );
      toast.success("Data applied", {
        description: `${t.c} created, ${t.m} merged. Undo it from Import → History.`,
      });
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });
  const discard = useMutation({
    mutationFn: () => api(`/api/contract/staged/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Discarded; nothing was changed");
      onDone();
    },
  });
  if (r.isLoading)
    return (
      <p className="text-muted-foreground text-[13px]">Checking the file against your workspace…</p>
    );
  if (r.error || !r.data)
    return (
      <p className="text-critical-text text-[13px]">⚠ {r.error?.message ?? "Could not load"}</p>
    );
  const p = r.data.preview;
  const changes = p.entities.reduce((s, e) => s + e.create + e.merge, 0);
  const errors = p.entities.flatMap((e) => e.errors.map((x) => ({ ...x, key: e.key })));
  return (
    <div
      className="bg-muted/40 grid gap-3 rounded-md border p-3"
      aria-live="polite"
      role="region"
      aria-label="Review changes"
    >
      <p className="text-[13px]">
        From <span className="font-medium">{p.source.system}</span> · contract v{p.version} ·{" "}
        {p.visibility}
      </p>
      <div className="grid gap-2">
        {p.entities
          .filter((e) => e.total)
          .map((e) => (
            <details key={e.key} className="bg-card rounded-md border px-3 py-2">
              <summary className="cursor-pointer text-[13px]">
                <span className="font-medium">{LABEL[e.key] ?? e.key}</span>
                <span className="text-muted-foreground tabular ml-2 text-xs">
                  {e.create} new · {e.merge} changed · {e.unchanged} unchanged
                  {e.errors.length ? ` · ${e.errors.length} skipped` : ""}
                </span>
              </summary>
              <ul className="mt-2 grid gap-1.5 text-xs">
                {e.changes.map((c, i) => (
                  <li key={i}>
                    <span
                      className={c.action === "create" ? "text-good-text" : "text-warning-text"}
                    >
                      {c.action === "create" ? "+ New" : "~ Change"}
                    </span>{" "}
                    <span className="font-medium">{c.label}</span>
                    {c.diff.length > 0 && (
                      <ul className="text-muted-foreground mt-0.5 ml-4 grid gap-0.5">
                        {c.diff.map((d, j) => (
                          <li key={j}>
                            {d.label}: <span className="line-through">{d.current || "—"}</span> →{" "}
                            <span className="text-foreground">{d.incoming}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
                {e.create + e.merge > e.changes.length && (
                  <li className="text-muted-foreground">
                    …and {e.create + e.merge - e.changes.length} more
                  </li>
                )}
              </ul>
            </details>
          ))}
      </div>
      {errors.length > 0 && (
        <ul
          className="text-critical-text grid gap-0.5 text-xs"
          aria-label="Rows that will be skipped"
        >
          {errors.slice(0, 8).map((x, i) => (
            <li key={i}>
              ⚠ {LABEL[x.key]}: {x.label}: {x.message}
            </li>
          ))}
          {errors.length > 8 && <li>…and {errors.length - 8} more</li>}
        </ul>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => apply.mutate()} disabled={apply.isPending || !changes}>
          Apply {changes} change{changes === 1 ? "" : "s"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => discard.mutate()}
          disabled={discard.isPending}
        >
          Discard
        </Button>
      </div>
    </div>
  );
}

function Sources({ onChanged }: { onChanged: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["contract-sources"],
    queryFn: () => api<{ items: Source[] }>("/api/contract/sources").then((r) => r.items),
  });
  const [target, setTarget] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const remove = useMutation({
    mutationFn: () =>
      api<{ undone: number; backup: string }>("/api/contract/sources/remove", {
        method: "POST",
        json: { system: target, confirm },
      }),
    onSuccess: (r) => {
      toast.success(`Removed data from ${target}`, {
        description: `${r.undone} import(s) undone. Backup: backups/${r.backup}`,
      });
      setTarget(null);
      onChanged();
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });
  if (!q.data?.length) return null;
  return (
    <div className="grid gap-2 border-t pt-4">
      <h3 className="text-[13px] font-semibold">Data by source</h3>
      <ul className="divide-y rounded-md border" aria-label="Data by source">
        {q.data.map((s) => (
          <li
            key={s.system}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[13px]"
          >
            <span className="font-medium">{s.system}</span>
            <span className="text-muted-foreground tabular text-xs">
              {s.imports} import{s.imports === 1 ? "" : "s"} · {s.linkedRecords} linked record
              {s.linkedRecords === 1 ? "" : "s"} · {s.pending} waiting
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="text-critical-text ml-auto h-7"
              onClick={() => {
                setTarget(s.system);
                setConfirm("");
              }}
              aria-label={`Remove all data from ${s.system}`}
            >
              <Trash2 /> Remove all data from {s.system}
            </Button>
          </li>
        ))}
      </ul>
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove all data from {target}?</DialogTitle>
            <DialogDescription>
              Undoes every import from {target}: records it created are deleted and records it
              changed go back to their previous values. Waiting files are discarded. A backup is
              written first.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="remove-confirm">Type REMOVE {target} to confirm</Label>
            <Input
              id="remove-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirm !== `REMOVE ${target}` || remove.isPending}
              onClick={() => remove.mutate()}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
