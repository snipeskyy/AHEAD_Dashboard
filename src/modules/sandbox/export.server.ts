import "server-only";
import { perAccount } from "@/lib/export/build-helpers";
import type { BuildContext, SectionBuilders } from "@/lib/export/builder-types";
import type { Block } from "@/lib/export/types";
import { readSpec } from "@/lib/server/sandbox";
import { failures, growth, roomCalc } from "./lib/calc";
import { createLibrary, LIBRARY_DISCLAIMER } from "./lib/library";
import { floorPlanSvg, rackRowSvg } from "./lib/svg";

const lib = createLibrary();
const latest = (ctx: BuildContext, accountId: string) =>
  ctx.db.sandboxScenario.findFirst({ where: { accountId }, orderBy: { updatedAt: "desc" } });
const none: Block[] = [
  {
    kind: "paragraph",
    field: "floor",
    text: "No DC Sandbox scenario for this account yet (DC Sandbox → Create).",
  },
];

/** The account's most recently edited sandbox scenario: views and capacity. Illustrative planning figures. */
export const builders: SectionBuilders = {
  "sandbox.views": (ctx) =>
    perAccount(ctx, async (acc) => {
      const s = await latest(ctx, acc.id);
      if (!s) return none;
      const spec = readSpec(s.spec);
      const c = roomCalc(spec, lib);
      const blocks: Block[] = [
        { kind: "heading", level: 3, text: `${s.name}: floor plan`, field: "floor" },
        {
          kind: "image",
          field: "floor",
          svg: floorPlanSvg(spec, c),
          alt: `Floor plan of ${spec.room.label} with ${spec.racks.length} racks colored by heat and ${spec.coolingUnits.length} cooling units`,
          caption: `${(spec.room.widthTiles * 0.6).toFixed(1)} × ${(spec.room.depthTiles * 0.6).toFixed(1)} m · 0.6 m tiles · thick edge = rack front`,
        },
      ];
      if (spec.racks.length)
        blocks.push(
          { kind: "heading", level: 3, text: "Rack elevations", field: "racks" },
          {
            kind: "image",
            field: "racks",
            svg: rackRowSvg(spec, lib, c),
            alt: `Front elevations of the ${Math.min(6, spec.racks.length)} most loaded racks`,
            caption: LIBRARY_DISCLAIMER,
          },
        );
      return blocks;
    }),
  "sandbox.capacity": (ctx) =>
    perAccount(ctx, async (acc) => {
      const s = await latest(ctx, acc.id);
      if (!s) return [{ ...none[0], field: "capacity" }];
      const spec = readSpec(s.spec);
      const c = roomCalc(spec, lib);
      const g = growth(spec, lib);
      const f = failures(spec, lib);
      const k = (n: number) => `${n >= 100 ? Math.round(n) : n.toFixed(1)} kW`;
      const crit = c.issues.filter((i) => i.severity !== "info");
      return [
        { kind: "heading", level: 3, text: `${s.name}: capacity`, field: "capacity" },
        {
          kind: "kv",
          field: "capacity",
          items: [
            { label: "IT load", value: `${k(c.drawKw)} of ${k(c.upsCapacityKw)} UPS` },
            { label: "Heat to air", value: `${k(c.airKw)} of ${k(c.airCapacityKw)}` },
            {
              label: "Heat to liquid",
              value:
                c.liquidKw || c.liquidCapacityKw
                  ? `${k(c.liquidKw)} of ${k(c.liquidCapacityKw)}`
                  : "none",
            },
            { label: "PUE (estimate)", value: c.pue ? c.pue.toFixed(2) : "—" },
            { label: "Racks", value: String(spec.racks.length) },
            { label: "Rack units used", value: `${Math.round(c.uUtilization * 100)}%` },
          ],
        },
        {
          kind: "chart",
          field: "growth",
          title: "Growth runway",
          spec: {
            type: "line",
            categories: g.series.map((_, i) => (i === 0 ? "Now" : `Year ${i}`)),
            series: [{ name: "Projected IT load (kW)", values: g.series.map(Math.round) }],
            reference: { label: `${g.binding.label} limit`, value: Math.round(g.binding.kw) },
          },
        },
        {
          kind: "paragraph",
          field: "growth",
          text:
            g.yearsLeft === null
              ? `At ${spec.assumptions.growthPctPerYear}%/yr, capacity holds beyond the ${spec.assumptions.horizonYears}-year projection.`
              : g.yearsLeft === 0
                ? `Today's load already reaches the ${g.binding.label.toLowerCase()} limit.`
                : `At ${spec.assumptions.growthPctPerYear}%/yr, the ${g.binding.label.toLowerCase()} limit is reached in about ${g.yearsLeft.toFixed(1)} years.`,
        },
        {
          kind: "table",
          field: "capacity",
          caption: "Per rack",
          columns: [
            { key: "r", label: "Rack" },
            { key: "c", label: "Cooling" },
            { key: "d", label: "Draw", align: "right" },
            { key: "m", label: "Nameplate", align: "right" },
            { key: "f", label: "Feed load", align: "right" },
            { key: "u", label: "U used", align: "right" },
          ],
          rows: c.racks.map((r, i) => ({
            r: { text: r.label },
            c: { text: spec.racks[i].cooling },
            d: { text: k(r.drawKw) },
            m: { text: k(r.maxKw) },
            f: { text: `${Math.round(r.feedLoad * 100)}%` },
            u: { text: `${r.usedU}/${spec.racks[i].heightU}` },
          })),
        },
        {
          kind: "list",
          field: "issues",
          items: [
            {
              text: `${spec.room.coolingRedundancy} cooling: holds with any one unit offline in ${f.cooling.filter((x) => x.ok).length} of ${f.cooling.length} cases`,
            },
            {
              text: `If power feed A fails: ${f.feedA.filter((x) => x.status === "ok").length} of ${f.feedA.length} racks keep running`,
            },
            ...crit
              .slice(0, 6)
              .map((i) => ({
                text: `${i.severity === "critical" ? "Critical" : "Warning"}: ${i.message}`,
              })),
          ],
        },
        {
          kind: "callout",
          tone: "info",
          field: "capacity",
          text: `${LIBRARY_DISCLAIMER} Validate with facilities engineering before committing.`,
        },
      ];
    }),
};
