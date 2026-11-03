import { Building2 } from "lucide-react";
import { ModulePlaceholder } from "@/components/states/module-placeholder";

export default function Page() {
  return (
    <ModulePlaceholder
      icon={Building2}
      title="Account 360"
      phase="Phase 2"
      description="One page per account with overview, intelligence, buying committee, whitespace, signals, opportunities, activity, notes, and plan."
      features={[
        "Overview with health score breakdown",
        "Initiatives, tech-stack hypotheses, and opening angles with evidence",
        "Buying-committee map with coverage gaps",
        "Whitespace map: practice areas × engagement",
        "Structured account plan that feeds exports",
      ]}
    />
  );
}
