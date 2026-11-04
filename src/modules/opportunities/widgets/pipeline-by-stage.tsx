"use client";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetProps } from "@/modules/types";
import { StageFunnelChart } from "../components/pipeline-charts";
import { NoOppsEmpty } from "./no-opps";
import { useWidgetPipeline } from "./use-widget-pipeline";

export default function PipelineByStageWidget({ height }: WidgetProps) {
  const { a, data, isLoading } = useWidgetPipeline();
  const router = useRouter();
  if (isLoading) return <Skeleton style={{ height }} />;
  if (!data?.length) return <NoOppsEmpty height={height} />;
  return (
    <StageFunnelChart
      data={a.byStage}
      height={height}
      onSelect={() => router.push("/opportunities?view=board")}
    />
  );
}
