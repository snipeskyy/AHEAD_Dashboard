"use client";
import { Plus } from "lucide-react";
import { useState } from "react";
import { EMPTY_TABLE_STATE, type TableState } from "@/components/data-table";
import { CardSkeleton, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { CreateOppDialog } from "@/modules/opportunities/components/create-opp-dialog";
import { PipelineKpiStrip } from "@/modules/opportunities/components/kpi-strip";
import { OppDetailSheet } from "@/modules/opportunities/components/opp-detail-sheet";
import { OppTable } from "@/modules/opportunities/components/opp-table";
import { useOpportunities } from "@/modules/opportunities/hooks/use-opportunities";
import { usePipelineAnalytics } from "@/modules/opportunities/hooks/use-pipeline-data";

export function OppsTab({ accountId, accountName }: { accountId: string; accountName: string }) {
  const { data, isLoading } = useOpportunities({ accountId });
  const [state, setState] = useState<TableState>({
    ...EMPTY_TABLE_STATE,
    sorting: [{ id: "closeDate", desc: false }],
    columnVisibility: { account: false },
  });
  const [focus, setFocus] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const a = usePipelineAnalytics(data ?? [], []);
  if (isLoading) return <CardSkeleton lines={6} />;
  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus /> New opportunity
        </Button>
      </div>
      {!data?.length ? (
        <EmptyState
          title="No opportunities yet"
          description="Create one here, or from the Whitespace map."
        />
      ) : (
        <>
          <PipelineKpiStrip k={a.kpis} />
          <OppTable rows={data} state={state} onStateChange={setState} onOpen={setFocus} />
        </>
      )}
      <OppDetailSheet id={focus} onClose={() => setFocus(null)} />
      <CreateOppDialog
        open={creating}
        onOpenChange={setCreating}
        defaults={{ account: { id: accountId, name: accountName } }}
        onCreated={setFocus}
      />
    </div>
  );
}
