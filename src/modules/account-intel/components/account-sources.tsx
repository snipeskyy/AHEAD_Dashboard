"use client";
import { useMutation } from "@tanstack/react-query";
import { PlugZap, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import { useAccountMutation, type Account360 } from "../hooks/use-accounts";

interface SourceConfig {
  googleNews?: boolean;
  rssFeeds?: string[];
  greenhouseSlug?: string | null;
  leverSlug?: string | null;
}

/** Per-account public-source settings (real accounts). Demo accounts use the offline simulator. */
export function AccountSources({ d }: { d: Account360 }) {
  const a = d.account;
  const cfg = (a.sourceConfig ?? {}) as SourceConfig;
  const [feed, setFeed] = useState("");
  const [gh, setGh] = useState(cfg.greenhouseSlug ?? "");
  const [lv, setLv] = useState(cfg.leverSlug ?? "");
  const save = useAccountMutation(
    a.id,
    (next: SourceConfig) =>
      api(`/api/accounts/${a.id}`, {
        method: "PATCH",
        json: { sourceConfig: { ...cfg, ...next } },
      }),
    "Sources saved",
  );
  const fetchNow = useMutation({
    mutationFn: () => api("/api/sources/fetch", { method: "POST", json: { accountId: a.id } }),
    onSuccess: () => toast.success("Fetching — new signals will stream in"),
  });

  if (a.isDemo)
    return (
      <p className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-xs">
        <PlugZap className="size-3.5" /> Fictional demo account — no external sources are queried.
      </p>
    );
  return (
    <section className="bg-card grid gap-3 rounded-lg border p-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Public sources for this account</h2>
          <p className="text-muted-foreground text-xs">
            Only public data. SEC filings use the ticker ({a.ticker ?? "none set"}).
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fetchNow.mutate()}
          disabled={fetchNow.isPending}
        >
          <RefreshCw /> Fetch now
        </Button>
      </header>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex items-center gap-2">
          <Switch
            id="src-gn"
            checked={cfg.googleNews === true}
            onCheckedChange={(v) => save.mutate({ googleNews: v })}
          />
          <Label htmlFor="src-gn" className="font-normal">
            Google News search
            <span className="text-muted-foreground text-xs">(opt-in · unofficial feed)</span>
          </Label>
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ greenhouseSlug: gh.trim() || null });
          }}
        >
          <div className="grid flex-1 gap-1">
            <Label htmlFor="src-gh" className="text-xs">
              Greenhouse board slug
            </Label>
            <Input
              id="src-gh"
              value={gh}
              onChange={(e) => setGh(e.target.value)}
              placeholder="e.g. companyname"
              className="h-8"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={gh === (cfg.greenhouseSlug ?? "")}
          >
            Save
          </Button>
        </form>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ leverSlug: lv.trim() || null });
          }}
        >
          <div className="grid flex-1 gap-1">
            <Label htmlFor="src-lv" className="text-xs">
              Lever board slug
            </Label>
            <Input
              id="src-lv"
              value={lv}
              onChange={(e) => setLv(e.target.value)}
              placeholder="e.g. companyname"
              className="h-8"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={lv === (cfg.leverSlug ?? "")}>
            Save
          </Button>
        </form>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">RSS feeds (newsroom, trade press)</Label>
        <ul className="flex flex-wrap gap-1.5">
          {(cfg.rssFeeds ?? []).map((u) => (
            <li key={u} className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs">
              {u}
              <button
                type="button"
                aria-label={`Remove ${u}`}
                onClick={() =>
                  save.mutate({ rssFeeds: (cfg.rssFeeds ?? []).filter((x) => x !== u) })
                }
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^https?:\/\//.test(feed)) {
              save.mutate({ rssFeeds: [...new Set([...(cfg.rssFeeds ?? []), feed.trim()])] });
              setFeed("");
            }
          }}
        >
          <Input
            value={feed}
            onChange={(e) => setFeed(e.target.value)}
            placeholder="https://example.com/newsroom/rss"
            className="h-8 max-w-md"
            aria-label="Add RSS feed URL"
            type="url"
          />
          <Button type="submit" size="sm" variant="outline" disabled={!/^https?:\/\//.test(feed)}>
            Add feed
          </Button>
        </form>
      </div>
    </section>
  );
}
