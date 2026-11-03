import { Megaphone } from "lucide-react";
import { ModulePlaceholder } from "@/components/states/module-placeholder";

export default function Page() {
  return (
    <ModulePlaceholder
      icon={Megaphone}
      title="Demand Gen"
      phase="Phase 3"
      description="Plan and run outreach with a reusable play library and an explainable recommender."
      features={[
        "Play library (15 generic plays)",
        "Play recommender with reasons",
        "Campaign planner calendar",
        "Template-based message builder",
        "Events and invite tracking",
      ]}
    />
  );
}
