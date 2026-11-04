"use client";
import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetProps } from "@/modules/types";
import { ForecastChart } from "../components/pipeline-charts";
import { NoOppsEmpty } from "./no-opps";
import { useWidgetPipeline } from "./use-widget-pipeline";

export default function ForecastWidget({ height, size }: WidgetProps) {
  const { a, data, isLoading } = useWidgetPipeline();
  if (isLoading) return <Skeleton style={{ height }} />;
  if (!data?.length) return <NoOppsEmpty height={height} />;
  return (
    <ForecastChart
      buckets={a.quarters}
      target={a.settings.quarterlyTarget}
      height={height}
      compact={size === "md" || size === "sm"}
    />
  );
}
