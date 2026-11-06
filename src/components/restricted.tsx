"use client";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { VISIBILITY_FIELDS, type VisibilityField } from "@/config/roles";
import { useCanSee } from "@/hooks/use-me";

/** Renders children only if the current role may see `field`; otherwise a quiet lock (or nothing with `hide`). */
export function Restricted({ field, children, hide = false }: { field: VisibilityField; children: ReactNode; hide?: boolean }) {
  const ok = useCanSee(field);
  if (ok) return <>{children}</>;
  if (hide) return null;
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs" title={`${VISIBILITY_FIELDS[field].label}: hidden for your role`} data-restricted={field}>
      <Lock className="size-3" aria-hidden />
      <span className="sr-only">{VISIBILITY_FIELDS[field].label} hidden for your role</span>
    </span>
  );
}
