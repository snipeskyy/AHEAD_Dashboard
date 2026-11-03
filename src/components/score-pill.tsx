import { cn } from "@/lib/utils";

/** Score 0–100 with a status-colored bar; the number is always visible (never color alone). */
export function ScorePill({
  value,
  label,
  invert = false,
  className,
}: {
  value: number;
  label: string;
  invert?: boolean;
  className?: string;
}) {
  const v = Math.round(value);
  const good = invert ? v < 40 : v >= 70;
  const warn = invert ? v < 65 : v >= 50;
  const color = good ? "bg-good" : warn ? "bg-warning" : "bg-critical";
  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      aria-label={`${label} ${v} of 100`}
    >
      <span className="tabular w-6 text-right text-[13px] font-medium">{v}</span>
      <span className="bg-muted h-1.5 w-14 overflow-hidden rounded-full" aria-hidden>
        <span
          className={cn("block h-full rounded-full", color)}
          style={{ width: `${Math.max(3, v)}%` }}
        />
      </span>
    </span>
  );
}

/** Neutral magnitude bar (for whitespace — not a good/bad status). */
export function MagnitudeBar({ value, label }: { value: number; label: string }) {
  const v = Math.round(value);
  return (
    <span className="inline-flex items-center gap-2" aria-label={`${label} ${v} of 100`}>
      <span className="tabular w-6 text-right text-[13px] font-medium">{v}</span>
      <span className="bg-muted h-1.5 w-14 overflow-hidden rounded-full" aria-hidden>
        <span
          className="bg-chart-1 block h-full rounded-full"
          style={{ width: `${Math.max(3, v)}%` }}
        />
      </span>
    </span>
  );
}
