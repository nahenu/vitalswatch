import { describe, expect, it } from "vitest";
import { diffDiagnostics, isEmptyDiff } from "./diff";
import { sampleDiagnostics } from "./sample-diagnostics";

describe("diffDiagnostics", () => {
  const clean = sampleDiagnostics("https://store.test");
  const widget = sampleDiagnostics("https://store.test", "widget");

  it("spots the third party, issue and script a deploy added", () => {
    const d = diffDiagnostics(clean, widget);
    expect(d.newThirdParties.map((t) => t.entity)).toEqual(["Chatly"]);
    expect(d.newIssues.map((i) => i.id)).toEqual(["bootup-time"]);
    expect(d.newFiles[0].url).toBe("https://widget.chatly.example/v3/loader.js");
    expect(d.bytesDelta).toBe(214_000);
    expect(d.requestsDelta).toBe(5);
  });

  it("reports the reverse as fixed and removed", () => {
    const d = diffDiagnostics(widget, clean);
    expect(d.resolvedIssues.map((i) => i.id)).toEqual(["bootup-time"]);
    expect(d.goneThirdParties.map((t) => t.entity)).toEqual(["Chatly"]);
    expect(d.newFiles).toEqual([]);
  });

  it("treats cache-busting query strings as the same file", () => {
    const a = sampleDiagnostics("https://store.test");
    const b = sampleDiagnostics("https://store.test");
    b.issues[0].items[0].url += "?v=2";
    expect(diffDiagnostics(a, b).newFiles).toEqual([]);
  });

  it("is empty when nothing meaningful changed", () => {
    expect(isEmptyDiff(diffDiagnostics(clean, sampleDiagnostics("https://store.test")))).toBe(true);
  });
});
