import { notFound } from "next/navigation";
import { PlanTimeline } from "@/components/plan/plan-timeline";
import { customerSteps } from "@/lib/map/model";
import { getPlan } from "@/lib/server/action-plans";

export const dynamic = "force-dynamic";

/** Print-only route for the mutual action plan PDF. Customer audience shows visible steps only, without notes. */
export default async function PrintPlan({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ audience?: string }>;
}) {
  const [{ id }, { audience }] = await Promise.all([params, searchParams]);
  const plan = await getPlan(id).catch(() => null);
  if (!plan) notFound();
  const internal = audience === "internal";
  return (
    <main className="min-h-screen bg-white p-2 text-black" data-print-ready="true">
      <style>{`@page { size: Letter; } html, body { background: #fff !important; } li { break-inside: avoid; }`}</style>
      <PlanTimeline
        title={plan.title}
        accountName={plan.opportunity.accountName}
        objective={plan.objective}
        targetDate={plan.targetDate}
        steps={internal ? plan.steps : customerSteps(plan.steps)}
        now={new Date()}
        showNotes={internal}
      />
    </main>
  );
}
