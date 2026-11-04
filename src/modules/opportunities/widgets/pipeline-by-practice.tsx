"use client";
import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetProps } from "@/modules/types";
import { PracticeBarChart } from "../components/pipeline-charts";
import { NoOppsEmpty } from "./no-opps";
import { useWidgetPipeline } from "./use-widget-pipeline";

export default function PipelineByPracticeWidget({ height }: WidgetProps) {
  const { a, data, isLoading } = useWidgetPipeline();
  if (isLoading) return <Skeleton style={{ height }} />;
  if (!data?.length) return <NoOppsEmpty height={height} />;
  return <PracticeBarChart data={a.byPractice} height={height} />;
}
