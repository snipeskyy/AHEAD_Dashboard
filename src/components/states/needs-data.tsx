"use client";
import { Building2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useMeta } from "@/hooks/use-meta";
import { EmptyState } from "./index";

/**
 * Renders `children` only once the workspace has accounts; otherwise a first-run empty state
 * that says what's missing and links to the import.
 */
export function NeedsAccounts({
  children,
  what,
  icon = Building2,
}: {
  children: ReactNode;
  /** e.g. "Recommendations" → "Recommendations appear once you have accounts." */
  what: string;
  icon?: LucideIcon;
}) {
  const { data } = useMeta();
  if (data?.empty)
    return (
      <EmptyState
        icon={icon}
        title="Import your accounts first"
        description={`${what} appear once you have accounts.`}
        action={
          <Button size="sm" asChild>
            <Link href="/import?kind=accounts">Import accounts</Link>
          </Button>
        }
      />
    );
  return <>{children}</>;
}
