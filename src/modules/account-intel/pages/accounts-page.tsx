import { Building2 } from "lucide-react";
import { ModulePlaceholder } from "@/components/states/module-placeholder";

export default function Page() {
  return (
    <ModulePlaceholder
      icon={Building2}
      title="Accounts"
      phase="Phase 2"
      description="Every account at a glance — tier, health, whitespace, and what changed."
      features={[
        "Virtualized account table with saved views & CSV export",
        "Transparent health and whitespace scores",
        "Tier, industry, and owner filters",
        "Jump straight into Account 360",
      ]}
    />
  );
}
