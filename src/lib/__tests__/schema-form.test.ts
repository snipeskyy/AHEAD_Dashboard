import { describe, expect, it } from "vitest";
import { z } from "zod";
import { describeSchema } from "../schema-form";

describe("describeSchema", () => {
  it("introspects labels, kinds, defaults and ranges", () => {
    const fields = describeSchema(
      z.object({
        days: z.number().int().min(7).max(120).default(30).describe("Stalled days"),
        on: z.boolean().default(false).describe("Enabled"),
        mode: z.enum(["a", "b"]).default("a"),
      }),
    );
    expect(fields).toEqual([
      expect.objectContaining({
        key: "days",
        label: "Stalled days",
        kind: "number",
        defaultValue: 30,
        min: 7,
        max: 120,
        integer: true,
      }),
      expect.objectContaining({
        key: "on",
        label: "Enabled",
        kind: "boolean",
        defaultValue: false,
      }),
      expect.objectContaining({
        key: "mode",
        kind: "enum",
        options: ["a", "b"],
        defaultValue: "a",
      }),
    ]);
  });
});
