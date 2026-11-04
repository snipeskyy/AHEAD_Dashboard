import Link from "next/link";

/** Sub-line for KPI tiles whose target hasn't been set yet (targets start blank). */
export function SetTargetLink() {
  return (
    <Link href="/settings?tab=modules" className="text-primary underline-offset-2 hover:underline">
      Set a target in Settings
    </Link>
  );
}
