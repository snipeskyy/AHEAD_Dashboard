import { AlertTriangle, Inbox, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <span className="bg-muted text-muted-foreground grid size-10 place-items-center rounded-lg">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <div className="text-sm font-medium">{title}</div>
        {description && (
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/**
 * Compact empty state sized to a widget body (`height` px). Always says why it's empty and what
 * to do next; never render a zero-data chart instead.
 */
export function WidgetEmpty({
  height,
  icon: Icon = Inbox,
  title,
  description,
  href,
  cta,
}: {
  height: number;
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  href?: string;
  cta?: string;
}) {
  return (
    <div
      style={{ height }}
      className="flex flex-col items-center justify-center gap-2 overflow-hidden px-4 text-center"
    >
      <Icon className="text-muted-foreground size-5" aria-hidden />
      <div className="text-[13px] font-medium">{title}</div>
      {description && <p className="text-muted-foreground max-w-xs text-xs">{description}</p>}
      {href && cta && (
        <Link
          href={href}
          className="text-primary text-xs font-medium underline-offset-2 hover:underline"
        >
          {cta}
        </Link>
      )}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  error,
  onRetry,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="border-critical/30 bg-critical/5 flex flex-col items-center gap-3 rounded-lg border px-6 py-10 text-center"
    >
      <AlertTriangle className="text-critical-text size-5" aria-hidden />
      <div>
        <div className="text-sm font-medium">{title}</div>
        {error instanceof Error && (
          <p className="text-muted-foreground mt-1 text-sm">{error.message}</p>
        )}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-primary text-sm font-medium underline-offset-4 hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function CardSkeleton({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div
      className={cn("bg-card rounded-lg border p-4", className)}
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="mb-4 h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="mb-2 h-3" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}
