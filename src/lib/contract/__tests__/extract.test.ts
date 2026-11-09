import { describe, expect, it } from "vitest";
import { extractJson } from "../extract";

describe("extractJson (pasted AI output)", () => {
  it("accepts plain JSON, fenced JSON and JSON with prose around it", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('Here you go:\n```json\n{"a":{"b":2}}\n```\nLet me know!')).toEqual({
      a: { b: 2 },
    });
    expect(extractJson('Result: {"a":3} (done)')).toEqual({ a: 3 });
  });
  it("explains what's wrong", () => {
    expect(() => extractJson("no json here")).toThrow(/No JSON object/);
    expect(() => extractJson("{ not: json }")).toThrow(/isn't valid JSON/);
  });
});
