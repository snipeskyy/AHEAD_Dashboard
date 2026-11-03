import { FileOutput } from "lucide-react";
import { ModulePlaceholder } from "@/components/states/module-placeholder";

export default function Page() {
  return (
    <ModulePlaceholder
      icon={FileOutput}
      title="Exports"
      phase="Phase 4"
      description="Assemble executive-ready summaries from every module, with audience modes and redaction."
      features={[
        "Scope: account, account set, or portfolio",
        "Sections assembled from the module registry",
        "Internal vs customer-facing redaction preview",
        "PDF, Markdown, and PPTX output with history",
      ]}
    />
  );
}
