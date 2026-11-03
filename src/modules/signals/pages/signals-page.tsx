import { Radio } from "lucide-react";
import { ModulePlaceholder } from "@/components/states/module-placeholder";

export default function Page() {
  return (
    <ModulePlaceholder
      icon={Radio}
      title="Live Signals"
      phase="Phase 3"
      description="A real-time feed of public signals across every account, auto-tagged to practice areas and scored for relevance."
      features={[
        "Server-sent events live feed",
        "Transparent tagging rules and relevance breakdown",
        "Star, dismiss, note, convert to play / touch / opportunity",
        "Daily and weekly digest",
        "Public adapters: news RSS, SEC EDGAR, Greenhouse, Lever, GDELT",
      ]}
    />
  );
}
