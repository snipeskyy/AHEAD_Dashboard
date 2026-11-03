import { ExternalLink, FlaskConical, Lightbulb, Radio } from "lucide-react";
import Link from "next/link";
import type { Evidence } from "@/lib/intel/angles";

/** Every intelligence item shows where it came from: a public URL, a signal, or "user hypothesis" / "demo". */
export function EvidenceLink({ e }: { e: Evidence }) {
  const label = e.title.length > 70 ? `${e.title.slice(0, 70)}…` : e.title;
  if (e.url)
    return (
      <a
        href={e.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
      >
        <ExternalLink className="size-3 shrink-0" /> {label}
      </a>
    );
  if (e.kind === "signal")
    return (
      <Link
        href={`/signals?focus=${e.id}`}
        className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
      >
        <Radio className="size-3 shrink-0" /> {label}
      </Link>
    );
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
      {e.source === "user-hypothesis" ? (
        <Lightbulb className="size-3 shrink-0" />
      ) : (
        <FlaskConical className="size-3 shrink-0" />
      )}
      {label} ·{" "}
      {e.source === "user-hypothesis"
        ? "your hypothesis"
        : e.source === "seed"
          ? "demo data"
          : e.source}
    </span>
  );
}

export function SourceTag({ source, url }: { source: string; url?: string | null }) {
  if (url)
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary inline-flex items-center gap-1 text-[11px] hover:underline"
      >
        <ExternalLink className="size-3" /> source
      </a>
    );
  return (
    <span className="text-muted-foreground text-[11px]">
      {source === "user-hypothesis" ? "Your hypothesis" : source === "seed" ? "Demo data" : source}
    </span>
  );
}
