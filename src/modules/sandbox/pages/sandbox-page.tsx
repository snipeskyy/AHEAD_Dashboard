import { Boxes, Cable, Cpu, FileOutput, Info, Thermometer, Zap } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_STYLE, RackElevation } from "../components/rack-elevation";
import { createLibrary, LIBRARY_DISCLAIMER, PREVIEW_RACKS } from "../lib/library";

const lib = createLibrary();

const PLANNED = [
  {
    icon: Boxes,
    title: "Scenario builder",
    text: "Sites → rooms → rows → racks. Drag generic devices from the component library into a rack elevation.",
  },
  {
    icon: Zap,
    title: "Power",
    text: "Per-rack typical and peak draw against feed capacity (voltage × amps × phase × derate).",
  },
  {
    icon: Thermometer,
    title: "Cooling",
    text: "Heat load in BTU/hr, air vs. rear-door vs. direct-liquid, room capacity headroom.",
  },
  { icon: Cable, title: "Network", text: "Leaf/spine links and port budgets per rack." },
  {
    icon: Cpu,
    title: "Simulation engine",
    text: "A pluggable, explainable SimulationEngine — every figure shows its formula.",
  },
  {
    icon: FileOutput,
    title: "Exports",
    text: "Rack views and capacity tables as sections in the Export Builder.",
  },
];

function rackTotals(r: (typeof PREVIEW_RACKS)[number]) {
  let used = 0,
    typ = 0,
    max = 0;
  for (const d of r.devices) {
    const p = lib.get(d.profileId);
    if (!p) continue;
    used += p.heightU;
    typ += p.typicalKw;
    max += p.maxKw;
  }
  return { used, typ, max, heat: Math.round(typ * 3412) };
}

export default function SandboxPage() {
  const categories = [
    ...new Set(PREVIEW_RACKS.flatMap((r) => r.devices.map((d) => lib.get(d.profileId)?.category))),
  ].filter(Boolean) as Array<keyof typeof CATEGORY_STYLE>;
  categories.sort((a, b) => CATEGORY_STYLE[a].series - CATEGORY_STYLE[b].series);
  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <Badge variant="outline" className="font-normal">
            Add-on · Coming next
          </Badge>
        }
        title="DC Sandbox"
        description="Sketch data center scenarios with customers — rack elevations, power, cooling and network — using generic, illustrative components."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm">Preview · rack elevation</CardTitle>
            <span className="text-muted-foreground text-xs">Static mock-up</span>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              {PREVIEW_RACKS.map((r) => (
                <RackElevation key={r.label} {...r} />
              ))}
            </div>
            <ul
              className="text-muted-foreground flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs"
              aria-label="Legend"
            >
              {categories.map((c) => (
                <li key={c} className="flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ background: `var(--series-${CATEGORY_STYLE[c].series})` }}
                    aria-hidden
                  />
                  {CATEGORY_STYLE[c].label}
                </li>
              ))}
            </ul>
            <table className="w-full text-[13px]">
              <caption className="sr-only">Illustrative capacity per preview rack</caption>
              <thead className="text-muted-foreground text-xs">
                <tr className="border-b">
                  {["Rack", "Used U", "Typical kW", "Peak kW", "Feed kW", "Heat BTU/hr"].map(
                    (h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={`py-1.5 font-medium ${i ? "text-right" : "text-left"}`}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="tabular">
                {PREVIEW_RACKS.map((r) => {
                  const t = rackTotals(r);
                  return (
                    <tr key={r.label} className="border-b last:border-0">
                      <td className="py-1.5">{r.label}</td>
                      <td className="py-1.5 text-right">
                        {t.used}/{r.heightU}
                      </td>
                      <td className="py-1.5 text-right">{t.typ.toFixed(1)}</td>
                      <td className="py-1.5 text-right">{t.max.toFixed(1)}</td>
                      <td className="py-1.5 text-right">{r.feedKw.toFixed(1)}</td>
                      <td className="py-1.5 text-right">{t.heat.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {LIBRARY_DISCLAIMER} Heat = typical kW × 3,412.
            </p>
          </CardContent>
        </Card>
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">What&apos;s planned</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {PLANNED.map((f) => (
                  <li key={f.title} className="flex gap-2.5">
                    <span className="bg-muted grid size-7 shrink-0 place-items-center rounded-md">
                      <f.icon className="size-3.5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-[13px] font-medium">{f.title}</p>
                      <p className="text-muted-foreground text-xs">{f.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm">Component library</CardTitle>
              <Badge variant="outline" className="font-normal">
                Illustrative, not vendor-certified
              </Badge>
            </CardHeader>
            <CardContent>
              <table className="w-full text-[13px]">
                <caption className="sr-only">Illustrative device profiles</caption>
                <thead className="text-muted-foreground text-xs">
                  <tr className="border-b">
                    <th scope="col" className="py-1.5 text-left font-medium">
                      Profile
                    </th>
                    <th scope="col" className="py-1.5 text-right font-medium">
                      U
                    </th>
                    <th scope="col" className="py-1.5 text-right font-medium">
                      Typical kW
                    </th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {lib.profiles.map((p) => (
                    <tr key={p.id} className="border-b last:border-0" title={p.note}>
                      <td className="py-1.5">{p.label}</td>
                      <td className="py-1.5 text-right">{p.heightU || "0U"}</td>
                      <td className="py-1.5 text-right">
                        {p.typicalKw ? p.typicalKw.toFixed(2) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
