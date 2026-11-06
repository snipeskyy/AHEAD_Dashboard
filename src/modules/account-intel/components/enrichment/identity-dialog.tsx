"use client";
import { ExternalLink, Fingerprint, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useConfirmIdentity,
  useIdentityCandidates,
  type AccountEnrichment,
} from "../../hooks/use-enrichment";

type Ids = {
  cik?: string;
  ticker?: string;
  lei?: string;
  wikidataId?: string;
  domain?: string;
  legalName?: string;
};
const FIELDS: Array<[keyof Ids, string, string]> = [
  ["legalName", "Legal name", "Example Holdings, Inc."],
  ["domain", "Domain", "example.com"],
  ["ticker", "Ticker", "EXMP"],
  ["cik", "SEC CIK", "0000000000"],
  ["lei", "LEI", "20 characters"],
  ["wikidataId", "Wikidata ID", "Q123"],
];

/** Disambiguation: pick the right legal entity from SEC / GLEIF / Wikidata candidates, or override identifiers by hand. */
export function IdentityDialog({
  accountId,
  accountName,
  identity,
}: {
  accountId: string;
  accountName: string;
  identity: AccountEnrichment["identity"];
}) {
  const [open, setOpen] = useState(false);
  const q = useIdentityCandidates(accountId, open);
  const confirm = useConfirmIdentity(accountId);
  const [picked, setPicked] = useState<string | null>(null);
  const [manual, setManual] = useState<Ids>({});
  const choice = picked ?? q.data?.defaultKey ?? null;
  const cand = q.data?.candidates.find((c) => c.key === choice);
  const base: Ids = Object.fromEntries(
    Object.entries(identity ?? {}).filter(([, v]) => typeof v === "string"),
  ) as Ids;
  const value = (k: keyof Ids) => manual[k] ?? cand?.identifiers[k] ?? base[k] ?? "";

  const submit = () => {
    const ids: Record<string, string | null> = {};
    for (const [k] of FIELDS) {
      const v = value(k).trim();
      if (v !== (base[k] ?? "")) ids[k] = v || null;
    }
    confirm.mutate(ids, { onSuccess: () => setOpen(false) });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Fingerprint /> Resolve identity
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Which company is “{accountName}”?</DialogTitle>
          <DialogDescription>
            Matches from SEC, GLEIF and Wikidata, linked where they share identifiers. Pick one,
            then adjust any identifier. Confirmed identifiers are locked and used by every public
            source.
          </DialogDescription>
        </DialogHeader>
        {q.isLoading ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> Searching public registries…
          </p>
        ) : (
          <div className="grid gap-2" role="radiogroup" aria-label="Candidate entities">
            {(q.data?.candidates ?? []).map((c) => (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={choice === c.key}
                onClick={() => {
                  setPicked(c.key);
                  setManual({});
                }}
                className={cn(
                  "focus-visible:ring-ring rounded-lg border p-3 text-left text-[13px] focus-visible:ring-2 focus-visible:outline-none",
                  choice === c.key ? "border-primary bg-brand-soft" : "hover:bg-muted/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.label}</span>
                  <span className="text-muted-foreground tabular text-xs">match {c.score}</span>
                </div>
                <div className="text-muted-foreground text-xs">
                  {c.facts.filter(Boolean).join(" · ")}
                </div>
                <div className="text-muted-foreground mt-1 text-xs">{c.reasons.join(" · ")}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {c.sources.map((s) => (
                    <a
                      key={s.url}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-primary inline-flex items-center gap-0.5 hover:underline"
                    >
                      {s.source} <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ))}
                </div>
              </button>
            ))}
            {q.data && !q.data.candidates.length && (
              <p className="text-muted-foreground text-sm">
                No confident matches. Enter identifiers below if you know them.
              </p>
            )}
            {q.data?.notes.map((n) => (
              <p key={n} className="text-muted-foreground text-xs">
                {n}
              </p>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(([k, l, ph]) => (
            <div key={k} className="grid gap-1">
              <Label htmlFor={`id-${k}`} className="text-xs">
                {l}
              </Label>
              <Input
                id={`id-${k}`}
                className="h-8"
                placeholder={ph}
                value={value(k)}
                onChange={(e) => setManual({ ...manual, [k]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={confirm.isPending}>
            Confirm identity &amp; enrich
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
