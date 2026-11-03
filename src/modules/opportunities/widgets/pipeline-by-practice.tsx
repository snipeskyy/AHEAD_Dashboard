"use client";
import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetProps } from "@/modules/types";
import { PracticeBarChart } from "../components/pipeline-charts";
import { useWidgetPipeline } from "./use-widget-pipeline";

export default function PipelineByPracticeWidget({ height }: WidgetProps) {
  const { a, isLoading } = useWidgetPipeline();
  if (isLoading) return <Skeleton style={{ height }} />;
  return <PracticeBarChart data={a.byPractice} height={height} />;
}
