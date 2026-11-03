"use client";
import type { ReactNode } from "react";
import type { usePipelineAnalytics } from "../hooks/use-pipeline-data";
import {
  AgingChart,
  ConversionChart,
  CreationTrendChart,
  PracticeBarChart,
  StageFunnelChart,
  VelocityChart,
} from "./pipeline-charts";

type Analytics = ReturnType<typeof usePipelineAnalytics>;

export function ChartCard({
  title,
  description,
  children,
  internal,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  internal?: boolean;
}) {
  return (
    <section
      className="bg-card rounded-lg border p-4"
      data-internal-only={internal ? "true" : undefined}
    >
      <header className="mb-3 pr-8">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </header>
      {children}
    </section>
  );
}

export function AnalyticsView({ a }: { a: Analytics }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Pipeline by stage" description="Open amount per stage" internal>
        <StageFunnelChart data={a.byStage} />
      </ChartCard>
      <ChartCard title="Pipeline by practice area" description="Open amount per practice" internal>
        <PracticeBarChart data={a.byPractice} />
      </ChartCard>
      <ChartCard
        title="Stage conversion"
        description="Share of deals reaching a stage that advanced further"
      >
        <ConversionChart data={a.conversion} />
      </ChartCard>
      <ChartCard title="Velocity" description="Average days spent in each stage">
        <VelocityChart data={a.velocity} />
      </ChartCard>
      <ChartCard title="Aging" description="Open amount by deal age (days since created)" internal>
        <AgingChart data={a.aging} />
      </ChartCard>
      <ChartCard
        title="Pipeline creation trend"
        description="New pipeline created per month, last 12 months"
        internal
      >
        <CreationTrendChart data={a.creation} />
      </ChartCard>
    </div>
  );
}
