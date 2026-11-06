"use client";
import { EyeOff } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useMe } from "@/hooks/use-me";
import { applyRoleHidden } from "@/lib/client/dom";

/** Applies the role's hidden fields to <html> and shows a chip when the role hides anything. */
export function RoleChip() {
  const { data } = useMe();
  const hidden = data?.role.hidden;
  useEffect(() => {
    applyRoleHidden(hidden ?? []);
  }, [hidden]);
  if (!data || !hidden?.length) return null;
  return (
    <Link
      href="/settings?tab=profile"
      className="text-muted-foreground hover:text-foreground hidden h-7 items-center gap-1 rounded-md border px-2 text-xs sm:inline-flex"
      aria-label={`Viewing as ${data.role.label}: ${hidden.length} field groups hidden. Change in Settings.`}
      title={`Some fields are hidden for the ${data.role.label} role`}
    >
      <EyeOff className="size-3.5" aria-hidden /> {data.role.label}
    </Link>
  );
}
