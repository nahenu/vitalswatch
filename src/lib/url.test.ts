import { describe, expect, it } from "vitest";
import { normalizeSiteUrl } from "./url";

describe("normalizeSiteUrl", () => {
  it("adds https and derives a name from the host", () => {
    expect(normalizeSiteUrl("example.com")).toEqual({ url: "https://example.com/", name: "example.com" });
    expect(normalizeSiteUrl("  https://www.Example.com/pricing?plan=pro#faq ")).toEqual({
      url: "https://www.example.com/pricing?plan=pro",
      name: "example.com",
    });
  });

  it("rejects pages Google can't reach", () => {
    for (const input of ["localhost:3000", "http://127.0.0.1", "192.168.1.10", "10.0.0.5", "printer.local", "http://[::1]/"]) {
      expect(normalizeSiteUrl(input)).toHaveProperty("error");
    }
  });

  it("rejects other schemes, credentials and bare words", () => {
    expect(normalizeSiteUrl("ftp://example.com")).toHaveProperty("error");
    expect(normalizeSiteUrl("https://user:pass@example.com")).toHaveProperty("error");
    expect(normalizeSiteUrl("intranet")).toHaveProperty("error");
    expect(normalizeSiteUrl("")).toHaveProperty("error");
  });
});
