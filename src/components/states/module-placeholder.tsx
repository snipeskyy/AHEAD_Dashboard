import { Check, type LucideIcon } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

/** Polished "being built" page used by modules whose UI lands in a later build phase. */
export function ModulePlaceholder({
  icon: Icon,
  title,
  description,
  phase,
  features,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: string;
  features: string[];
}) {
  return (
    <PageContainer>
      <PageHeader
        title={title}
        description={description}
        actions={<Badge variant="outline">{phase}</Badge>}
      />
      <div className="bg-card grid gap-6 rounded-xl border p-6 md:grid-cols-[auto_1fr] md:p-8">
        <span className="bg-brand-soft text-primary grid size-12 place-items-center rounded-xl">
          <Icon className="size-6" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-semibold">What this module will include</h2>
          <ul className="text-muted-foreground mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {features.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PageContainer>
  );
}
