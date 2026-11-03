import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Stat tile per dataviz contract: label · value (proportional figures) · optional sub/delta. */
export function StatTile({
  label,
  value,
  sub,
  internal,
  className,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  internal?: boolean;
  className?: string;
  tone?: "good" | "warning" | "critical";
}) {
  return (
    <div
      data-internal-only={internal ? "true" : undefined}
      className={cn("bg-card min-w-0 rounded-lg border px-4 py-3", className)}
    >
      <div className="text-muted-foreground truncate text-xs">{label}</div>
      <div className="mt-1 truncate text-xl font-semibold tracking-tight">{value}</div>
      {sub && (
        <div
          className={cn(
            "text-muted-foreground mt-0.5 truncate text-xs",
            tone === "good" && "text-good-text",
            tone === "warning" && "text-warning-text",
            tone === "critical" && "text-critical-text",
          )}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
