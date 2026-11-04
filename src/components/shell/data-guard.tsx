"use client";
import { DatabaseZap, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMeta } from "@/hooks/use-meta";

/** Top-bar chip shown only when the server runs against the TEST database (e2e / fixtures). */
export function TestDbChip() {
  const { data } = useMeta();
  if (!data?.testDb) return null;
  return (
    <span
      role="status"
      aria-label="Connected to the test database"
      className="text-muted-foreground inline-flex h-6 items-center gap-1.5 rounded-md border border-dashed px-2 text-[11px] font-semibold tracking-wide whitespace-nowrap uppercase"
    >
      <DatabaseZap className="size-3.5" aria-hidden />
      Test<span className="hidden sm:inline"> DB</span>
    </span>
  );
}

/**
 * Safety net: demo/synthetic rows must never mix silently with real data. If any `isDemo` row
 * exists in the real database, this banner stays up until it is removed in Settings → Data.
 */
export function DemoDataWarning() {
  const { data } = useMeta();
  if (!data?.demo || data.testDb) return null;
  return (
    <div
      role="alert"
      className="border-critical/40 bg-critical/10 text-critical-text flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-[13px]"
    >
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      <span className="font-semibold">Demo data found in your database.</span>
      <span>
        {data.counts.demoAccounts} fictional account{data.counts.demoAccounts === 1 ? "" : "s"} are
        mixed in with your real data.
      </span>
      <Link
        href="/settings?tab=data"
        className="ml-auto font-medium underline underline-offset-2 hover:no-underline"
      >
        Remove demo data
      </Link>
    </div>
  );
}
