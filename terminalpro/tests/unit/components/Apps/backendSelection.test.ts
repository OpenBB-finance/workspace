import { describe, expect, it } from "vitest";
import {
  isAllBackendsSelected,
  isNoneBackendsSelected,
  toggleBackendSelection,
} from "~/components/Apps/backendSelection";

const ALL = ["a", "b", "c"];

describe("isAllBackendsSelected", () => {
  it("treats the null sentinel as 'all'", () => {
    expect(isAllBackendsSelected(null, ALL)).toBe(true);
  });

  it("treats an explicitly complete selection as all", () => {
    expect(isAllBackendsSelected(["a", "b", "c"], ALL)).toBe(true);
  });

  it("is false for an explicit empty selection", () => {
    expect(isAllBackendsSelected([], ALL)).toBe(false);
  });

  it("is false for a partial selection", () => {
    expect(isAllBackendsSelected(["a"], ALL)).toBe(false);
    expect(isAllBackendsSelected(["a", "b"], ALL)).toBe(false);
  });

  it("treats 'no backends connected' as all", () => {
    expect(isAllBackendsSelected(null, [])).toBe(true);
    expect(isAllBackendsSelected([], [])).toBe(true);
    expect(isAllBackendsSelected(["x"], [])).toBe(true);
  });
});

describe("isNoneBackendsSelected", () => {
  it("is true only for the explicit empty selection with connected backends", () => {
    expect(isNoneBackendsSelected([], ALL)).toBe(true);
  });

  it("is false for the null 'all' sentinel", () => {
    expect(isNoneBackendsSelected(null, ALL)).toBe(false);
  });

  it("is false for any non-empty selection", () => {
    expect(isNoneBackendsSelected(["a"], ALL)).toBe(false);
  });

  it("is false when no backends are connected (no checkboxes to render)", () => {
    expect(isNoneBackendsSelected([], [])).toBe(false);
  });
});

describe("toggleBackendSelection", () => {
  it("materializes the 'all' sentinel when deselecting one backend", () => {
    expect(toggleBackendSelection(null, ALL, "b", false)).toEqual(["a", "c"]);
  });

  it("collapses a now-complete selection back to the null sentinel", () => {
    expect(toggleBackendSelection(["a", "b"], ALL, "c", true)).toEqual(null);
  });

  it("removes a backend from a partial selection", () => {
    expect(toggleBackendSelection(["a", "b"], ALL, "a", false)).toEqual(["b"]);
  });

  it("collapses to explicit empty when the last remaining backend is deselected", () => {
    expect(toggleBackendSelection(["a"], ALL, "a", false)).toEqual([]);
  });

  it("stays at 'all' when re-checking from the null sentinel", () => {
    expect(toggleBackendSelection(null, ALL, "b", true)).toEqual(null);
  });

  it("picks a single backend when checking from the explicit empty state", () => {
    expect(toggleBackendSelection([], ALL, "b", true)).toEqual(["b"]);
  });

  it("does not duplicate an already-selected backend", () => {
    expect(toggleBackendSelection(["a"], ALL, "a", true)).toEqual(["a"]);
  });

  it("ignores removal of an id that is not selected", () => {
    expect(toggleBackendSelection(["a"], ALL, "z", false)).toEqual(["a"]);
  });
});
