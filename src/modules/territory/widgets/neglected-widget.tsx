"use client";
import { CheckCircle2 } from "lucide-react";
import { WidgetEmpty } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetProps } from "@/modules/types";
import { NeglectedList } from "../components/account-lists";
import { useTerritory } from "../components/use-territory";

export default function NeglectedWidget({ height }: WidgetProps) {
  const { data, isLoading } = useTerritory();
  if (isLoading) return <Skeleton style={{ height }} />;
  if (!data?.neglected.length) return <WidgetEmpty height={height} icon={CheckCircle2} title="Every account is within cadence" />;
  return <div className="overflow-y-auto" style={{ height }}><NeglectedList rows={data.neglected} /></div>;
}
