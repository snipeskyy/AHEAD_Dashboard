import "server-only";
import { renderChartSvg } from "@/lib/export/chart-svg";
import type { Slide } from "./types";

/**
 * Re-renders chart SVGs at the slide's aspect ratio (document charts are 760×300). A smaller virtual
 * canvas scaled up on the slide keeps axis labels readable from the back of a room.
 */
const SIZE: Partial<Record<Slide["layout"], [number, number]>> = {
  chart: [840, 360],
  "chart-takeaway": [560, 380],
};

export function withSlideCharts(slides: Slide[]): Slide[] {
  return slides.map((s) => {
    const size = SIZE[s.layout];
    if (!size) return s;
    return {
      ...s,
      blocks: s.blocks.map((b) => (b.kind === "chart" && !b.redacted ? { ...b, svg: renderChartSvg(b.spec, size[0], size[1]) } : b)),
    };
  });
}
