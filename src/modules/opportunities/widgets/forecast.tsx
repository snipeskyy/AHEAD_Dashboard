"use client";
import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetProps } from "@/modules/types";
import { ForecastChart } from "../components/pipeline-charts";
import { useWidgetPipeline } from "./use-widget-pipeline";

export default function ForecastWidget({ height, size }: WidgetProps) {
  const { a, isLoading } = useWidgetPipeline();
  if (isLoading) return <Skeleton style={{ height }} />;
  return (
    <ForecastChart
      buckets={a.quarters}
      target={a.settings.quarterlyTarget}
      height={height}
      compact={size === "md" || size === "sm"}
    />
  );
}
