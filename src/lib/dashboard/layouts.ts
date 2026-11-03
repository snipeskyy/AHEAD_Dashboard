import { z } from "zod";
import type { WidgetSize } from "@/modules/types";

/** Grid: 12 columns, 56px rows. Each placed widget is an instance (i) of a registered widget (widgetId). */
export const GRID_COLS = 12;
export const ROW_HEIGHT = 56;
export const GRID_MARGIN = 16;

export const PlacedWidgetSchema = z.object({
  i: z.string().min(1).max(80),
  widgetId: z.string().min(1).max(120),
  x: z
    .number()
    .int()
    .min(0)
    .max(GRID_COLS - 1),
  y: z.number().int().min(0).max(1000),
  w: z.number().int().min(2).max(GRID_COLS),
  h: z.number().int().min(2).max(20),
});
export type PlacedWidget = z.infer<typeof PlacedWidgetSchema>;
export const LayoutWidgetsSchema = z.array(PlacedWidgetSchema).max(40);

export const SIZE_DIMENSIONS: Record<WidgetSize, { w: number; h: number }> = {
  sm: { w: 3, h: 5 },
  md: { w: 4, h: 6 },
  lg: { w: 6, h: 6 },
  xl: { w: 12, h: 6 },
};

/** Pixel height of a widget body for h rows (minus the card header). */
export const bodyHeight = (h: number) => h * ROW_HEIGHT + (h - 1) * GRID_MARGIN - 52;

const W = (
  i: string,
  widgetId: string,
  x: number,
  y: number,
  w: number,
  h: number,
): PlacedWidget => ({ i, widgetId, x, y, w, h });

/** Three default layouts shipped with the app (spec 5.1). */
export const DEFAULT_LAYOUTS: Array<{ name: string; widgets: PlacedWidget[] }> = [
  {
    name: "Monday Pipeline Review",
    widgets: [
      W("forecast", "opportunities.forecast-vs-target", 0, 0, 8, 6),
      W("changes", "command-home.whats-changed", 8, 0, 4, 6),
      W("stage", "opportunities.pipeline-by-stage", 0, 6, 4, 6),
      W("practice", "opportunities.pipeline-by-practice", 4, 6, 4, 6),
      W("closes", "opportunities.upcoming-closes", 8, 6, 4, 6),
      W("stalled", "opportunities.stalled-deals", 0, 12, 6, 6),
      W("nba", "command-home.next-best-actions", 6, 12, 6, 6),
    ],
  },
  {
    name: "Account Prep",
    widgets: [
      W("nba", "command-home.next-best-actions", 0, 0, 5, 7),
      W("signals", "signals.signal-feed", 5, 0, 7, 7),
      W("heatmap", "account-intel.health-heatmap", 0, 7, 7, 8),
      W("movers", "account-intel.top-movers", 7, 7, 5, 8),
    ],
  },
  {
    name: "Exec Readout",
    widgets: [
      W("forecast", "opportunities.forecast-vs-target", 0, 0, 12, 6),
      W("practice", "opportunities.pipeline-by-practice", 0, 6, 6, 6),
      W("stage", "opportunities.pipeline-by-stage", 6, 6, 6, 6),
      W("movers", "account-intel.top-movers", 0, 12, 6, 6),
      W("changes", "command-home.whats-changed", 6, 12, 6, 6),
    ],
  },
];
