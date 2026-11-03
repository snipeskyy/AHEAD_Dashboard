import { KanbanSquare } from "lucide-react";
import { ModulePlaceholder } from "@/components/states/module-placeholder";

export default function Page() {
  return (
    <ModulePlaceholder
      icon={KanbanSquare}
      title="Opportunities"
      phase="Phase 2"
      description="Plan and track pipeline with Kanban, dense table, and forecast views."
      features={[
        "Drag-and-drop Kanban with stage history",
        "Inline-edit table with saved views",
        "Commit / best case / pipeline forecast",
        "MEDDPICC completeness and red flags",
        "Deal-risk heuristics",
      ]}
    />
  );
}
