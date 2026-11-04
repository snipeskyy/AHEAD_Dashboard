import { Briefcase } from "lucide-react";
import { WidgetEmpty } from "@/components/states";

/** Shown by every pipeline widget until the first opportunity exists. */
export function NoOppsEmpty({ height }: { height: number }) {
  return (
    <WidgetEmpty
      height={height}
      icon={Briefcase}
      title="No opportunities yet"
      description="Add one from an account, or import them from CSV or Excel."
      href="/import?kind=opportunities"
      cta="Import opportunities"
    />
  );
}
