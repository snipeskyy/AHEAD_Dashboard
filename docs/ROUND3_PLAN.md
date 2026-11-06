# Round 3 plan: presentation-grade deliverables, the full DC Sandbox, and internal-tool readiness

> Status: **approved (Nov 2026)**: order 10 → 11 → 12 → 13 → 14; TCO uses user-entered assumptions only; build the
> neutral data contract now, no live connector. Builds on Phases 0–9. Each phase ends with checks, screenshots, a commit
> and a stop for review, as before. The rules in `CLAUDE.md` still apply: no internal data in the repo, no built-in
> pricing or margins, branding only from the local brand pack, public sources only.

## Where we are

- **Exports**: one generic "executive summary" document (blocks: heading, paragraph, kv, table, list, chart, callout)
  rendered to PDF, Markdown and a minimal PPTX (title slide + paginated text). Audience redaction and roles work.
- **Sandbox**: a stub. A vendor-neutral component library, a rack-elevation SVG and a `SandboxScenario` table.
- **Data**: everything is local and user-entered or public. The private integration slot throws by design.

## Phase 10: Deliverables engine (presentation-grade exports)

The biggest step up in day-to-day value: walk into a QBR or exec meeting with a deck that looks designed.

1. **Slide layouts, not text dumps.** A layout library for PPTX and PDF: title, agenda, KPI tiles, chart + takeaway,
   two-column compare, table, timeline/roadmap, quote/callout, section divider, closing/next steps. Layouts adapt to
   content length. 16:9, speaker notes on every slide.
2. **Branded theme from the local brand pack**: logo, colors, fonts (if supplied), master slide with footer,
   confidentiality marking and page numbers. The neutral theme stays the default in the repo.
3. **Document templates** (each is a list of sections and layouts the user can reorder, add to and save):
   - _Executive summary_ (1–3 pages): situation, priorities from public evidence, our point of view, proposed next steps.
   - _QBR / account review deck_: relationship map, pipeline and wins, health trends, whitespace, plan for next quarter.
   - _Meeting prep brief_ (exists) as a one-page PDF/slide.
   - _Account plan_: objectives, initiatives, whitespace, mutual action plan, owners and dates.
   - _TCO / business case_ (Phase 11 supplies the numbers).
   - _Partner co-sell brief_ for an OEM partner.
4. **Native charts in PPTX** (editable PowerPoint charts, not images) using the validated series palette.
5. **Narrative helpers (template-only)**: auto-written "so what" lines from the data ("Pipeline up 18% QoQ, driven by
   AI Infrastructure"), every number linked to its source. No AI; the AI add-on can plug in later.
6. **Builder UX**: live slide-thumbnail preview, drag to reorder, per-slide hide/show, "presenter view" in the
   browser (Presentation Mode plays the deck full-screen with notes), version history and duplicate-as-template.
7. **Customer-safe guarantee**: the redaction pass runs on every slide; a pre-export checklist shows what was removed.

## Phase 11: TCO / business-case builder

1. **Models with explicit assumptions**: on-prem refresh vs cloud vs hybrid vs colocation; 3- and 5-year TCO; NPV, IRR,
   payback; sensitivity (tornado chart) and scenario compare. Pure, unit-tested math in `src/lib/tco/`.
2. **Every input is user-entered and labeled**: hardware, software/licensing, support, power ($/kWh), cooling (from
   PUE), space, staff FTE, migration and one-time costs, growth rate, discount rate. Nothing is pre-filled with
   company pricing or margins. Inputs can come from a Sandbox scenario (power, racks, devices).
3. **Outputs**: summary tiles, cost-over-time chart, cumulative savings, assumptions table, all exportable as
   TCO slides and a one-page business case. Clearly marked "estimate; based on the assumptions listed".
4. **Saved per account and per opportunity**, versioned, comparable side by side.

## Phase 12: Data Center Sandbox (full)

The spec's queued add-on, built for customer conversations.

1. **2D floor-plan editor**: rooms, rows, hot/cold aisles, racks; drag-and-drop from the vendor-neutral library;
   snapping, multi-select, undo/redo, copy/paste, measurements.
2. **Rack elevation editor** (U-level) with power draw, weight and heat per device; port/cable counts.
3. **Engineering calculators**: power (kW per rack, per row, per room; N, N+1, 2N), cooling (air vs rear-door vs
   direct-to-chip liquid), PUE, floor load, space utilization. Warnings when limits are exceeded. Pure and tested.
4. **3D walkthrough** (react-three-fiber): orbit, first-person walk, heat-map overlay, click a rack to inspect.
5. **Growth and what-if**: capacity over time from the growth rate, "add 4 AI racks" scenarios, before/after compare,
   failure and maintenance simulations (lose a PDU or a CRAH: what happens).
6. **Mock operations console**: simulated live telemetry (utilization, temps, power) clearly labeled "simulated".
7. **Customer tour mode**: a guided, full-screen walkthrough with captions; export views into decks (Phase 10) and
   feed power/space numbers into TCO (Phase 11).
8. Everything stays generic: "Illustrative, not vendor-certified".

## Phase 13: Internal-tool readiness (data contract, no internal data)

Makes the eventual port to the company's internal AI tool straightforward, without putting internal data or a
connector in this repository.

1. **ACC Data Contract v1**: versioned JSON Schemas (and an OpenAPI description) for accounts, contacts,
   opportunities, activities/touches, notes, partners, tasks, and the read models (My Day, account 360, pipeline).
   Field-level `visibility` and provenance travel with the data.
2. **Bulk import/export in that contract** (file-based, like packs): the internal tool, or a script the company
   approves, can produce a file ACC imports with preview, dedupe and undo; ACC can export the same shape.
3. **Local read-only API** (`/api/v1/...`, token-protected, off by default) so an approved internal tool could read
   ACC on the same machine. Writing stays file-based until an integration is approved.
4. **`docs/INTERNAL_PORT.md`**: what an internal deployment would need (data classification, which fields map to
   which internal systems, the private adapter slot, the AI add-on boundary). The `private-future` adapter keeps
   throwing until the company approves an integration.

## Phase 14: Team value and polish

- **Account team workspace**: shared territory plan view, owner/assignee on tasks, weekly team digest (export).
- **Win/loss and pipeline-trend analytics**: conversion by stage and practice over time, cycle-time trends.
- **Mutual action plans** per opportunity (customer-shareable timeline, export to PDF).
- **Keyboard and command coverage** for every new screen; accessibility and screenshot passes as in Phase 9.

## Decisions needed

1. **Order**: deliverables first (Phases 10 → 11 → 12) is recommended; the Sandbox and TCO both feed the decks.
2. **TCO inputs** are user-entered assumptions only (no built-in company pricing or margins). Confirm that is right
   for how you'd use it with customers.
3. **Internal port**: build the neutral data contract now (Phase 13) and leave any real connection to the company's
   internal tool and its approval process. Confirm.
4. **3D** adds `three` / `@react-three/fiber` / `@react-three/drei` (the original spec's choice). Confirm.
