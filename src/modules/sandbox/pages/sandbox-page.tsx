import { Server } from "lucide-react";
import { ModulePlaceholder } from "@/components/states/module-placeholder";

export default function Page() {
  return (
    <ModulePlaceholder
      icon={Server}
      title="Data Center Sandbox"
      phase="Add-on"
      description="Show customers what their future data center will look like, feel like, and how it runs."
      features={[
        "2D rack elevations and floor plans",
        "Power, heat, and cooling calculators (illustrative)",
        "Failure and maintenance simulations",
        "Export views into executive summaries",
      ]}
    />
  );
}
