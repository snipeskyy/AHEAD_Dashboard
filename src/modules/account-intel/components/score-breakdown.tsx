"use client";
import { Info } from "lucide-react";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ScoreBreakdown as SB } from "@/lib/scoring/types";
import { cn } from "@/lib/utils";

/** Transparent score: value, formula, and every input's contribution. */
export function ScoreBreakdown({
  title,
  score,
  settingsHref,
  tone,
}: {
  title: string;
  score: SB;
  settingsHref?: string;
  tone: "status" | "neutral";
}) {
  const v = Math.round(score.value);
  const color =
    tone === "neutral"
      ? "text-foreground"
      : v >= 70
        ? "text-good-text"
        : v >= 50
          ? "text-warning-text"
          : "text-critical-text";
  const max = Math.max(...score.components.map((c) => c.contribution), 1);
  return (
    <section className="bg-card rounded-lg border p-4" data-internal-only="true">
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold">{title}</h2>
            <Tooltip>
              <TooltipTrigger aria-label={`${title} formula`}>
                <Info className="text-muted-foreground size-3.5" />
              </TooltipTrigger>
              <TooltipContent className="max-w-72">{score.formula}</TooltipContent>
            </Tooltip>
          </div>
          <p className="text-muted-foreground text-xs">{score.formula}</p>
        </div>
        <div className={cn("text-3xl font-semibold tracking-tight", color)}>{v}</div>
      </header>
      <table className="mt-3 w-full text-xs">
        <caption className="sr-only">{title} inputs</caption>
        <thead className="sr-only">
          <tr>
            <th>Component</th>
            <th>Input</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {score.components.map((c) => (
            <tr key={c.id} className="border-t first:border-0">
              <td className="py-1.5 pr-2">
                <div className="text-foreground font-medium">{c.label}</div>
                <div className="text-muted-foreground">{c.input}</div>
              </td>
              <td className="w-24 py-1.5">
                <span className="bg-muted block h-1.5 overflow-hidden rounded-full" aria-hidden>
                  <span
                    className="bg-chart-1 block h-full rounded-full"
                    style={{ width: `${(c.contribution / max) * 100}%` }}
                  />
                </span>
              </td>
              <td className="tabular w-14 py-1.5 text-right">+{c.contribution.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {settingsHref && (
        <Link
          href={settingsHref}
          className="text-primary mt-2 inline-block text-xs hover:underline"
        >
          Adjust weights
        </Link>
      )}
    </section>
  );
}
