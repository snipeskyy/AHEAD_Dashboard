import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { assertSameOriginWrite } = await import("../http");

const req = (method: string, headers: Record<string, string>) =>
  new Request("http://127.0.0.1:3000/api/x", { method, headers });

describe("same-origin writes (CSRF guard)", () => {
  it("allows reads, same-origin writes and non-browser clients", () => {
    expect(() =>
      assertSameOriginWrite(req("GET", { origin: "https://evil.example" })),
    ).not.toThrow();
    expect(() =>
      assertSameOriginWrite(
        req("POST", { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" }),
      ),
    ).not.toThrow();
    expect(() => assertSameOriginWrite(req("POST", { host: "127.0.0.1:3000" }))).not.toThrow();
  });
  it("refuses cross-site browser writes", () => {
    expect(() =>
      assertSameOriginWrite(
        req("POST", { origin: "https://evil.example", host: "127.0.0.1:3000" }),
      ),
    ).toThrow(/Cross-origin/);
    expect(() =>
      assertSameOriginWrite(
        req("DELETE", { "sec-fetch-site": "cross-site", host: "127.0.0.1:3000" }),
      ),
    ).toThrow(/Cross-origin/);
    expect(() =>
      assertSameOriginWrite(req("PATCH", { origin: "null", host: "127.0.0.1:3000" })),
    ).toThrow(/Cross-origin/);
  });
});
