import { Box } from "lucide-react";
import { describe, expect, it } from "vitest";
import { createRegistry, registry, validateModules } from "../registry";
import type { AccModule } from "../types";

const Page = () => null;
const mod = (over: Partial<AccModule> = {}): AccModule => ({
  id: "demo-mod",
  title: "Demo",
  description: "",
  icon: Box,
  category: "addon",
  order: 1,
  exportSections: [],
  ...over,
});

describe("module registry", () => {
  it("discovers all built-in modules and every one declares exportSections", () => {
    const ids = registry.modules.map((m) => m.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "command-home",
        "account-intel",
        "signals",
        "opportunities",
        "demand-gen",
        "exports",
        "sandbox",
        "settings",
      ]),
    );
    for (const m of registry.modules) expect(Array.isArray(m.exportSections)).toBe(true);
    expect(validateModules(registry.modules)).toEqual([]);
  });

  it("sorts by order", () => {
    const r = createRegistry([mod({ id: "b", order: 2 }), mod({ id: "a", order: 1 })]);
    expect(r.modules.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("rejects duplicate ids, un-namespaced widgets/sections and route clashes", () => {
    const load = async () => ({ default: Page });
    const issues = validateModules([
      mod({ id: "x", routes: [{ path: "p", title: "P", load }] }),
      mod({ id: "x" }),
      mod({
        id: "y",
        routes: [{ path: "p", title: "P", load }],
        exportSections: [
          { id: "oops", title: "", description: "", scopes: ["account"], fields: [] },
        ],
      }),
      mod({
        id: "z",
        widgets: [
          {
            id: "w",
            title: "",
            description: "",
            defaultSize: "sm",
            sizes: ["sm"],
            load: async () => ({ default: Page }),
          },
        ],
      }),
    ]);
    const msgs = issues.map((i) => `${i.moduleId}: ${i.message}`);
    expect(msgs).toEqual(
      expect.arrayContaining([
        "x: duplicate module id",
        'y: route "p" already owned by x',
        'y: export section "oops" must be prefixed "y."',
        'z: widget "w" must be prefixed "z."',
      ]),
    );
    expect(() => createRegistry([mod({ id: "x" }), mod({ id: "x" })])).toThrow(
      /Invalid module registry/,
    );
  });

  it("matches routes with params, preferring static segments", () => {
    const load = async () => ({ default: Page });
    const r = createRegistry([
      mod({
        routes: [
          { path: "things/[id]", title: "Thing", load },
          { path: "things/new", title: "New", load },
          { path: "", title: "Home", load },
        ],
      }),
    ]);
    expect(r.matchRoute(["things", "abc%20d"])).toMatchObject({
      route: { title: "Thing" },
      params: { id: "abc d" },
    });
    expect(r.matchRoute(["things", "new"])?.route.title).toBe("New");
    expect(r.matchRoute([])?.route.title).toBe("Home");
    expect(r.matchRoute(["nope"])).toBeNull();
  });

  it("hides feature-flagged modules and their widgets/sections/commands", () => {
    const r = createRegistry([
      mod({
        id: "on",
        exportSections: [
          { id: "on.s", title: "", description: "", scopes: ["account"], fields: [] },
        ],
      }),
      mod({
        id: "off",
        featureFlag: "module.off",
        exportSections: [
          { id: "off.s", title: "", description: "", scopes: ["account"], fields: [] },
        ],
        commands: [{ id: "c", label: "C", group: "Actions", action: "x" }],
      }),
    ]);
    expect(r.enabled({ "module.off": false }).map((m) => m.id)).toEqual(["on"]);
    expect(r.exportSections({ "module.off": false }).map((s) => s.id)).toEqual(["on.s"]);
    expect(r.commands({ "module.off": false })).toEqual([]);
    expect(r.exportSections({}).map((s) => s.id)).toEqual(["on.s", "off.s"]);
  });
});
