"use client";
import { Copy, Lightbulb, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DEFAULT_PRACTICE_AREAS, practiceLabel } from "@/config/practice-areas";
import { api } from "@/lib/api-client";
import type { Account360 } from "../../hooks/use-accounts";
import { useAccountMutation } from "../../hooks/use-accounts";
import { EvidenceLink } from "../evidence-link";
import { EvidenceBoard } from "../enrichment/evidence-board";
import { TechHypotheses } from "../enrichment/tech-hypotheses";

function Card({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-lg border p-4">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-muted-foreground text-xs">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function IntelligenceTab({ d }: { d: Account360 }) {
  const id = d.account.id;
  const delInit = useAccountMutation(
    id,
    (iid: string) => api(`/api/initiatives/${iid}`, { method: "DELETE" }),
    "Initiative removed",
  );
  const delTech = useAccountMutation(
    id,
    (tid: string) => api(`/api/tech-stack/${tid}`, { method: "DELETE" }),
    "Removed",
  );
  const techStatus = useAccountMutation(
    id,
    ({ tid, status }: { tid: string; status: string }) =>
      api(`/api/tech-stack/${tid}`, { method: "PATCH", json: { status } }),
    "Updated",
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card
        title="Initiative evidence"
        description="Grouped by practice area. Each item cites its public source, or is your hypothesis."
        action={<AddInitiative accountId={id} />}
      >
        {d.initiatives.length === 0 ? (
          <Empty real={!d.account.isDemo} what="initiatives" />
        ) : (
          <EvidenceBoard items={d.initiatives} onDelete={(iid) => delInit.mutate(iid)} />
        )}
      </Card>

      <Card title="Opening angles" description="Conversation starters, each tied to evidence.">
        {d.openingAngles.length === 0 ? (
          <Empty real={!d.account.isDemo} what="opening angles" />
        ) : (
          <ol className="grid gap-2.5">
            {d.openingAngles.map((o, i) => (
              <li key={i} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px]">{o.angle}</p>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Copy angle"
                    onClick={() =>
                      navigator.clipboard.writeText(o.angle).then(() => toast.success("Copied"))
                    }
                  >
                    <Copy />
                  </Button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-normal">
                    {practiceLabel(o.practiceArea, true)}
                  </Badge>
                  <EvidenceLink e={o.evidence} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card
        title="Likely pain points"
        description="Mapped to practice areas from the evidence above."
      >
        {d.painPoints.length === 0 ? (
          <Empty real={!d.account.isDemo} what="pain points" />
        ) : (
          <ul className="grid gap-2.5">
            {d.painPoints.slice(0, 8).map((p, i) => (
              <li key={i} className="grid gap-1">
                <div className="flex items-center gap-2 text-[13px]">
                  <Badge variant="secondary" className="font-normal">
                    {practiceLabel(p.practiceArea, true)}
                  </Badge>
                  {p.pain}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-1">
                  {p.evidence.slice(0, 2).map((e) => (
                    <EvidenceLink key={e.id} e={e} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Tech stack hypotheses"
        description="Grouped by category, with evidence. Confirm or reject as you learn more."
        action={<AddTech accountId={id} />}
      >
        {d.techStack.length === 0 ? (
          <Empty real={!d.account.isDemo} what="tech-stack hypotheses" />
        ) : (
          <TechHypotheses
            items={d.techStack}
            onStatus={(tid, status) => techStatus.mutate({ tid, status })}
            onDelete={(tid) => delTech.mutate(tid)}
          />
        )}
      </Card>
    </div>
  );
}

function Empty({ real, what }: { real: boolean; what: string }) {
  return (
    <p className="text-muted-foreground text-[13px]">
      No {what} yet.
      {real
        ? " This is a real account: intelligence only comes from public sources (with links) or hypotheses you add."
        : ""}
    </p>
  );
}

function AddInitiative({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [practice, setPractice] = useState(DEFAULT_PRACTICE_AREAS[0].id);
  const [url, setUrl] = useState("");
  const [conf, setConf] = useState(50);
  const add = useAccountMutation(
    accountId,
    () =>
      api(`/api/accounts/${accountId}/initiatives`, {
        method: "POST",
        json: { title, practiceAreas: [practice], sourceUrl: url || null, confidence: conf / 100 },
      }),
    "Initiative added",
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs">
          <Plus /> Hypothesis
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(undefined, {
              onSuccess: () => {
                setOpen(false);
                setTitle("");
                setUrl("");
              },
            });
          }}
        >
          <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0" /> Saved as your hypothesis. Add a
            public URL if you have one.
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="ini-title">Initiative</Label>
            <Input
              id="ini-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ini-practice">Practice area</Label>
            <select
              id="ini-practice"
              className="border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-2 text-sm"
              value={practice}
              onChange={(e) => setPractice(e.target.value)}
            >
              {DEFAULT_PRACTICE_AREAS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ini-url">Public source URL (optional)</Label>
            <Input
              id="ini-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ini-conf">Confidence: {conf}%</Label>
            <input
              id="ini-conf"
              type="range"
              min={0}
              max={100}
              step={5}
              value={conf}
              onChange={(e) => setConf(Number(e.target.value))}
            />
          </div>
          <Button type="submit" size="sm" disabled={title.trim().length < 3 || add.isPending}>
            Add initiative
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function AddTech({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ category: "", technology: "", evidence: "", sourceUrl: "" });
  const add = useAccountMutation(
    accountId,
    () =>
      api(`/api/accounts/${accountId}/tech-stack`, {
        method: "POST",
        json: { ...f, sourceUrl: f.sourceUrl || null },
      }),
    "Hypothesis added",
  );
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs">
          <Plus /> Hypothesis
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(undefined, {
              onSuccess: () => {
                setOpen(false);
                setF({ category: "", technology: "", evidence: "", sourceUrl: "" });
              },
            });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="ts-cat">Category</Label>
            <Input
              id="ts-cat"
              value={f.category}
              onChange={set("category")}
              placeholder="e.g. Storage"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ts-tech">Technology</Label>
            <Input id="ts-tech" value={f.technology} onChange={set("technology")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ts-ev">Evidence</Label>
            <Input
              id="ts-ev"
              value={f.evidence}
              onChange={set("evidence")}
              placeholder="Why you believe this"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ts-url">Public source URL (optional)</Label>
            <Input id="ts-url" type="url" value={f.sourceUrl} onChange={set("sourceUrl")} />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={
              f.category.length < 2 ||
              f.technology.length < 2 ||
              f.evidence.length < 2 ||
              add.isPending
            }
          >
            Add
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
