# Adding a module

Every feature in ACC is a module. Adding one means **creating one folder**; you never edit the shell, the router, or
the registry.

## How discovery works

- `scripts/gen-module-index.ts` globs `src/modules/*/module.ts` and writes `src/modules/_generated.ts`. It runs
  automatically before `dev`, `build` and `typecheck`.
- `src/modules/registry.ts` validates every manifest. It checks:
  - kebab-case ids
  - unique routes
  - namespaced widget and export-section ids
  - that `exportSections` is present

  Validation fails at startup with a clear message if anything is wrong.

- The catch-all route `src/app/(shell)/[[...slug]]/page.tsx` resolves URLs through `registry.matchRoute()`.
- Everything else is generated from the registry:
  - the sidebar
  - ⌘K commands
  - G-sequence shortcuts
  - Settings → Modules (feature flags and the auto-generated settings form)
  - the widget picker (Phase 2) and export builder (Phase 4)

## Worked example: a "Competitive Watch" add-on

### 1. Create the manifest

`src/modules/competitive-watch/module.ts`:

```ts
import { Swords } from "lucide-react";
import { z } from "zod";
import type { AccModule } from "../types";

const competitiveWatch: AccModule = {
  id: "competitive-watch",
  title: "Competitive Watch",
  description: "Track competitor mentions across signals and opportunities.",
  icon: Swords,
  category: "addon",
  order: 70,
  status: "preview",
  featureFlag: "module.competitive-watch", // toggle in Settings → Modules
  routes: [
    {
      path: "competitive",
      title: "Competitive Watch",
      nav: true,
      load: () => import("./pages/competitive-page"),
    },
    {
      path: "competitive/[competitor]",
      title: "Competitor",
      load: () => import("./pages/competitor-page"),
    },
  ],
  widgets: [
    {
      id: "competitive-watch.mentions", // must be prefixed with the module id
      title: "Competitor mentions",
      description: "Mentions in the last 30 days",
      defaultSize: "md",
      sizes: ["sm", "md", "lg"],
      load: () => import("./widgets/mentions-widget"), // default export: (props: WidgetProps) => JSX
    },
  ],
  settingsSchema: z.object({
    lookbackDays: z.number().int().min(7).max(180).default(30).describe("Look-back window (days)"),
  }),
  exportSections: [
    {
      id: "competitive-watch.summary",
      title: "Competitive landscape",
      description: "Competitors active in the selected accounts.",
      scopes: ["account", "accounts"],
      internalOnly: true, // never appears in customer-facing exports
      fields: [{ id: "competitors", label: "Competitors", visibility: "internal" }],
    },
  ],
  commands: [
    {
      id: "nav.competitive",
      label: "Go to Competitive Watch",
      group: "Navigate",
      href: "/competitive",
    },
  ],
};

export default competitiveWatch;
```

### 2. Add the page

`src/modules/competitive-watch/pages/competitive-page.tsx`. Route pages receive `{ params }`, with dynamic segments
already decoded:

```tsx
"use client";
import { PageContainer, PageHeader } from "@/components/page-header";

export default function CompetitivePage() {
  return (
    <PageContainer>
      <PageHeader
        title="Competitive Watch"
        description="Competitor mentions across your portfolio."
      />
      {/* fetch from /api/... with TanStack Query; show Empty/Error/Skeleton states from @/components/states */}
    </PageContainer>
  );
}
```

### 2b. Add the widget

`src/modules/competitive-watch/widgets/mentions-widget.tsx`. A widget receives `{ size, height }`, where `height` is
the usable body height in pixels. Size your chart or list to it.

```tsx
"use client";
import { Chart, baseOption, categoryAxis, valueAxis } from "@/components/chart";
import type { WidgetProps } from "@/modules/types";

export default function MentionsWidget({ height }: WidgetProps) {
  const data = [{ name: "Global SI", n: 4 }]; // fetch with TanStack Query in real code
  return (
    <Chart
      label="Competitor mentions, last 30 days"
      height={height}
      table={{ columns: ["Competitor", "Mentions"], rows: data.map((d) => [d.name, d.n]) }}
      option={(t) => ({
        ...baseOption(t),
        xAxis: categoryAxis(
          t,
          data.map((d) => d.name),
        ),
        yAxis: valueAxis(t),
        series: [{ type: "bar", data: data.map((d) => d.n), itemStyle: { color: t.series[0] } }],
      })}
    />
  );
}
```

The widget now appears in **Command Home → Customize → Add widget**.

### 3. Add data access (optional)

Add `src/app/api/competitive/route.ts`. Validate input with Zod and wrap it with `handler()` from
`@/lib/server/http`. Module-specific API routes are the one place you add files outside the module folder.

### 4. Run it

Run `npm run dev`. The module appears in the sidebar under **Deliver**, its route works, its command is in ⌘K, and
its settings form and feature-flag toggle show up in **Settings → Modules**.

### 5. Test it

Put tests next to the module, e.g. `src/modules/competitive-watch/__tests__/*.test.ts`. The registry test
(`src/modules/__tests__/registry.test.ts`) already asserts that every discovered module validates.

## Rules of thumb

- Every module declares `exportSections`. Use `[]` if it truly contributes nothing.
- Mark fields `visibility: "internal"` when they must never reach a customer: amounts, probabilities, risk flags,
  competitors, internal notes. The redaction engine and Presentation Mode rely on this.
- Never fetch from non-public sources. New external sources are `DataAdapter`s (`src/lib/adapters/types.ts`) run by
  the worker, never by the browser.
- Keep components small (< ~300 lines), and give every view empty, loading and error states.
