import { Upload } from "lucide-react";
import { ModulePlaceholder } from "@/components/states/module-placeholder";

export default function Page() {
  return (
    <ModulePlaceholder
      icon={Upload}
      title="Import target accounts"
      phase="Phase 2"
      description="Bring in your own target-account list by public name, domain, and ticker. Real accounts are enriched only from public sources."
      features={[
        "CSV upload with field-mapping UI",
        "Duplicate detection by domain and name",
        "Ticker → SEC CIK resolution",
        "No generated intelligence on real accounts",
      ]}
    />
  );
}
