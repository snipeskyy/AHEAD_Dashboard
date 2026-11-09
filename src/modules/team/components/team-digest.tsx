"use client";
import { useQuery } from "@tanstack/react-query";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { CardSkeleton, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { DigestSection } from "@/lib/team/digest";

/** The weekly team digest: computed from the last 7 days of records; download as Markdown or copy. */
export function TeamDigest() {
  const q = useQuery({
    queryKey: ["team-digest"],
    queryFn: () =>
      api<{ title: string; summary: string; sections: DigestSection[]; markdown: string }>(
        "/api/team-workspace/digest",
      ),
  });
  if (q.isLoading) return <CardSkeleton lines={10} />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  return (
    <article
      className="bg-card grid gap-5 rounded-lg border p-5"
      aria-label="Weekly team digest"
      data-internal-only="true"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{d.title}</h2>
          <p className="text-muted-foreground text-[13px]">{d.summary}</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              navigator.clipboard
                ?.writeText(d.markdown)
                .then(() => toast.success("Digest copied as Markdown"))
            }
          >
            <Copy /> Copy
          </Button>
          <Button size="sm" asChild>
            <a href="/api/team-workspace/digest?format=md" download aria-label="Download Markdown">
              <Download /> Download Markdown
            </a>
          </Button>
        </div>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {d.sections.map((s) => (
          <section key={s.id} aria-label={s.title}>
            <h3 className="mb-1.5 text-[13px] font-semibold">{s.title}</h3>
            {s.items.length ? (
              <ul className="grid list-disc gap-0.5 pl-5 text-[13px]">
                {s.items.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-[13px]">{s.empty}</p>
            )}
          </section>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Internal. Every line comes from a record in this workspace (last 7 days; closes and plan
        steps for the next 14).
      </p>
    </article>
  );
}
