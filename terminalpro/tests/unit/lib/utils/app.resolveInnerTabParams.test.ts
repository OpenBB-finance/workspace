import { describe, expect, it } from "vitest";
import { resolveInnerTabParams } from "~/lib/utils/app";

describe("resolveInnerTabParams", () => {
  // Regression guard: an empty dashboard has no inner-tab layout to select, so the
  // dashboard route used to fire a navigation on every render pass with an unchanged
  // URL. Each one was a history push, which is what tripped Chrome's navigation
  // throttling and left the sidebar links dead.
  it("returns null when the URL would not change", () => {
    const next = resolveInnerTabParams({
      gridLayout: {},
      currentTab: "",
      lastInnerTab: undefined,
      searchParams: new URLSearchParams(""),
    });

    expect(next).toBeNull();
  });

  it("returns null when the only inner tab is the unnamed one", () => {
    const next = resolveInnerTabParams({
      gridLayout: { "": [{ i: "w1" }] } as never,
      currentTab: "",
      lastInnerTab: undefined,
      searchParams: new URLSearchParams(""),
    });

    expect(next).toBeNull();
  });

  it("selects the first inner tab that has widgets", () => {
    const next = resolveInnerTabParams({
      gridLayout: { overview: [{ i: "w1" }], empty: [] } as never,
      currentTab: "",
      lastInnerTab: undefined,
      searchParams: new URLSearchParams(""),
    });

    expect(next?.get("tab")).toBe("overview");
  });

  it("prefers the last opened inner tab when it still has widgets", () => {
    const next = resolveInnerTabParams({
      gridLayout: { overview: [{ i: "w1" }], financials: [{ i: "w2" }] } as never,
      currentTab: "",
      lastInnerTab: "financials",
      searchParams: new URLSearchParams(""),
    });

    expect(next?.get("tab")).toBe("financials");
  });

  it("drops a tab param that the dashboard no longer has", () => {
    const next = resolveInnerTabParams({
      gridLayout: {} as never,
      currentTab: "deleted",
      lastInnerTab: undefined,
      searchParams: new URLSearchParams("tab=deleted"),
    });

    expect(next?.has("tab")).toBe(false);
  });

  it("keeps unrelated params untouched", () => {
    const next = resolveInnerTabParams({
      gridLayout: { overview: [{ i: "w1" }] } as never,
      currentTab: "",
      lastInnerTab: undefined,
      searchParams: new URLSearchParams("chat=abc"),
    });

    expect(next?.get("chat")).toBe("abc");
    expect(next?.get("tab")).toBe("overview");
  });
});
